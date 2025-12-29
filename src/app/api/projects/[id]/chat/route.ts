/**
 * Legacy Chat Route - Redirects to enhanced AI Chat
 * Keep for backward compatibility, but new code should use /ai-chat
 */

import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { UnauthorizedError, NotFoundError, handleApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { searchProjectKnowledge } from "@/lib/rag/retrieval";

export const maxDuration = 30;

interface RouteParams {
    params: Promise<{ id: string }>;
}

function getLastUserMessageText(messages: Array<{ role: string; content: unknown }>): string {
    // ChatInterface sends `content` as a string, but keep this robust.
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== "user") continue;
        if (typeof msg.content === "string") return msg.content;
        if (Array.isArray(msg.content)) {
            return msg.content
                .map((part) => {
                    if (typeof part === "string") return part;
                    if (part && typeof part === "object" && "text" in part) {
                        return String((part as { text?: unknown }).text ?? "");
                    }
                    return "";
                })
                .join("\n")
                .trim();
        }
        return String(msg.content ?? "").trim();
    }
    return "";
}

function looksLikeCountQuestion(text: string): boolean {
    const q = text.toLowerCase();
    return (
        /(how many|number of|count of)/.test(q) &&
        /(stud(y|ies)|papers?|records?|articles?)/.test(q)
    );
}

function looksLikeReviewerQuestion(text: string): boolean {
    const q = text.toLowerCase();
    return /(how many|number of|count of|who)/.test(q) && /(reviewers?|screeners?|team)/.test(q);
}

export async function POST(req: Request, { params }: RouteParams) {
    try {
        const { id: projectId } = await params;
        console.log(`[AI] POST /api/projects/${projectId}/chat hit`);

        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        // Verify access
        const membership = await db.projectMember.findUnique({
            where: { projectId_userId: { projectId, userId: session.user.id } }
        });
        if (!membership) throw new NotFoundError("Project");

        const { messages } = await req.json();

        const lastUserText = getLastUserMessageText(messages ?? []);

        // Always compute stats (fast, DB-only).
        const [total, included, excluded, maybe] = await Promise.all([
            db.projectWork.count({ where: { projectId } }),
            db.projectWork.count({ where: { projectId, finalDecision: "INCLUDE" } }),
            db.projectWork.count({ where: { projectId, finalDecision: "EXCLUDE" } }),
            db.projectWork.count({ where: { projectId, finalDecision: "MAYBE" } }),
        ]);
        const pending = total - included - excluded - maybe;

        // For direct count questions, answer deterministically (no model needed).
        if (looksLikeCountQuestion(lastUserText)) {
            const text =
                `This project has **${total}** studies.\n\n` +
                `- Included: **${included}**\n` +
                `- Excluded: **${excluded}**\n` +
                `- Maybe: **${maybe}**\n` +
                `- Pending/unscreened: **${pending}**\n`;

            return new Response(text, {
                headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
        }

        // Team context (helps answer “who are the reviewers?” etc.)
        const team = await db.projectMember.findMany({
            where: { projectId },
            orderBy: { joinedAt: "asc" },
            select: {
                role: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        email: true,
                    },
                },
            },
        });

        const teamSize = team.length;
        const reviewerRoleCount = team.filter((m) => m.role === "REVIEWER").length;
        const screeners = team.filter((m) => ["OWNER", "LEAD", "REVIEWER"].includes(m.role));

        const decisionMakers = await db.screeningDecisionRecord.findMany({
            where: { projectWork: { projectId } },
            distinct: ["reviewerId"],
            select: {
                reviewerId: true,
                reviewer: { select: { name: true, email: true, image: true } },
            },
        });

        // Deterministic answer for reviewer/team questions (prevents model miscounting).
        if (looksLikeReviewerQuestion(lastUserText)) {
            const lines: string[] = [];
            lines.push(`Team members: **${teamSize}**`);
            lines.push(`- Reviewer role: **${reviewerRoleCount}**`);
            lines.push(`- People who can screen (Owner/Lead/Reviewer): **${screeners.length}**`);
            lines.push("");
            lines.push("People who can screen:");
            screeners.forEach((m) => {
                const name = m.user.name ?? "Unnamed";
                lines.push(`- ${name} (${m.role})`);
            });

            lines.push("");
            lines.push(`People who have submitted screening decisions so far: **${decisionMakers.length}**`);
            if (decisionMakers.length > 0) {
                decisionMakers.forEach((d) => {
                    const name = d.reviewer?.name ?? "Unnamed";
                    lines.push(`- ${name}`);
                });
            }

            return new Response(lines.join("\n"), {
                headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
        }

        // Pull a small “preview” list of INCLUDED studies for grounding.
        const includedPreview = await db.projectWork.findMany({
            where: { projectId, finalDecision: "INCLUDE" },
            take: 8,
            orderBy: { updatedAt: "desc" },
            include: {
                work: { select: { title: true, year: true, doi: true } },
            },
        });

        // Decide whether to run vector retrieval (avoid embedding calls when nothing is ingested).
        const ingestedIncludedCount = await db.projectWork.count({
            where: {
                projectId,
                finalDecision: "INCLUDE",
                ingestionStatus: "COMPLETED",
                chunksCreated: { gt: 0 },
            },
        });

        const includedWithPdfCount = await db.projectWork.count({
            where: {
                projectId,
                finalDecision: "INCLUDE",
                pdfR2Key: { not: null },
            },
        });

        // Evidence retrieval (server-side; avoids tool calling).
        let retrieved: Array<{ similarity: number; title?: string; doi?: string; content: string }> = [];
        let abstractRetrieved: Array<{ title: string; year?: number | null; doi?: string | null; abstract?: string | null }> = [];

        if (lastUserText && lastUserText.length >= 8 && ingestedIncludedCount > 0) {
            try {
                const chunks = await searchProjectKnowledge(projectId, lastUserText, {
                    limit: 6,
                    onlyIncluded: true,
                });

                retrieved = (chunks || []).map((c) => ({
                    similarity: c.similarity,
                    title: (c.metadata?.title ?? c.metadata?.workTitle) as string | undefined,
                    doi: c.metadata?.doi as string | undefined,
                    content: c.content,
                }));
            } catch (e) {
                console.error("[AI] Retrieval failed", e);
            }
        }

        // Fallback: if no ingested PDFs yet, ground on titles/abstracts so chat is still useful pre-screening.
        if (retrieved.length === 0 && lastUserText && lastUserText.length >= 8) {
            const hits = await db.projectWork.findMany({
                where: {
                    projectId,
                    work: {
                        OR: [
                            { title: { contains: lastUserText, mode: "insensitive" } },
                            { abstract: { contains: lastUserText, mode: "insensitive" } },
                        ],
                    },
                },
                take: 5,
                orderBy: { updatedAt: "desc" },
                select: {
                    work: {
                        select: {
                            title: true,
                            year: true,
                            doi: true,
                            abstract: true,
                        },
                    },
                },
            });

            abstractRetrieved = hits.map((h) => h.work);
        }

        const contextLines: string[] = [];
        contextLines.push("## Project stats");
        contextLines.push(`- Total studies: ${total}`);
        contextLines.push(`- Included: ${included}`);
        contextLines.push(`- Excluded: ${excluded}`);
        contextLines.push(`- Maybe: ${maybe}`);
        contextLines.push(`- Pending/unscreened: ${pending}`);
        contextLines.push("");

        contextLines.push("## Included studies (most recently updated)");
        if (includedPreview.length === 0) {
            contextLines.push("- (none included yet)");
        } else {
            includedPreview.forEach((pw, idx) => {
                const title = pw.work?.title ?? "Untitled";
                const year = pw.work?.year ? ` (${pw.work.year})` : "";
                const doi = pw.work?.doi ? ` DOI: ${pw.work.doi}` : "";
                contextLines.push(`${idx + 1}. ${title}${year}${doi}`);
            });
        }
        contextLines.push("");

        contextLines.push("## Team");
        if (team.length === 0) {
            contextLines.push("- (no team members found)");
        } else {
            contextLines.push(`- Total members: ${teamSize}`);
            contextLines.push(`- Reviewer role count: ${reviewerRoleCount}`);
            contextLines.push(`- Screeners (Owner/Lead/Reviewer): ${screeners.length}`);
            team.forEach((m) => {
                const name = m.user.name ?? "Unnamed";
                const email = m.user.email ? ` <${m.user.email}>` : "";
                // Email disambiguates duplicate display names (common in real teams).
                contextLines.push(`- ${name}${email} (${m.role})`);
            });
        }
        contextLines.push("");

        contextLines.push("## Full-text evidence status");
        contextLines.push(`- Included studies with an attached PDF: ${includedWithPdfCount}`);
        contextLines.push(`- Included studies ingested (chunks available): ${ingestedIncludedCount}`);
        contextLines.push("");

        contextLines.push("## Retrieved excerpts (from included PDFs)");
        if (retrieved.length === 0) {
            contextLines.push("- (no PDF excerpts retrieved)");
        } else {
            retrieved.forEach((r, idx) => {
                const src = r.title ? `Source: ${r.title}` : "Source: (unknown)";
                const doi = r.doi ? ` DOI: ${r.doi}` : "";
                contextLines.push(`### Excerpt ${idx + 1} (similarity: ${r.similarity.toFixed(3)})`);
                contextLines.push(`${src}${doi}`);
                contextLines.push(r.content);
                contextLines.push("");
            });
        }

        contextLines.push("## Title/abstract matches (fallback when PDFs aren’t ingested)");
        if (abstractRetrieved.length === 0) {
            contextLines.push("- (no title/abstract matches)");
        } else {
            abstractRetrieved.forEach((w, idx) => {
                const year = w.year ? ` (${w.year})` : "";
                const doi = w.doi ? ` DOI: ${w.doi}` : "";
                contextLines.push(`### Match ${idx + 1}`);
                contextLines.push(`${w.title}${year}${doi}`);
                if (w.abstract) {
                    contextLines.push(w.abstract.slice(0, 1200));
                } else {
                    contextLines.push("(no abstract available)");
                }
                contextLines.push("");
            });
        }

        const system = `You are an expert research assistant for this systematic review project.

Use the PROJECT CONTEXT below. If asked about counts or progress, use the stats.
If asked about study findings, prioritize the retrieved PDF excerpts. If there are no PDF excerpts, fall back to title/abstract matches and be explicit that it is not full-text evidence.
Never invent study objectives/methods/results/conclusions. Only state findings that appear in the provided excerpts or abstracts. If only titles/DOIs are available, produce an outline/template and clearly state that full text is not available.

PROJECT CONTEXT:
${contextLines.join("\n")}
`;

        const result = streamText({
            model: openai("gpt-4o"),
            system,
            messages,
        });

        return result.toTextStreamResponse();
    } catch (error) {
        return handleApiError(error);
    }
}
