/**
 * Enhanced AI Chat Route
 * 
 * Features:
 * - Conversation persistence
 * - Citation grounding with page/section references
 * - Confidence scores and evidence quality indicators
 * - Reranking for improved retrieval
 * - Suggested follow-up questions
 * - Cross-paper synthesis detection
 */

import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { UnauthorizedError, NotFoundError, handleApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { searchProjectKnowledgeEnhanced, toCitations } from "@/lib/rag/retrieval";
import { analyzeQuery, generateSuggestedQuestions } from "@/lib/rag/query-analyzer";
import { 
  createConversation, 
  getConversation,
  addMessage,
  generateConversationTitle,
} from "@/lib/services/ai-conversation";
import { 
  determineEvidenceQuality, 
  calculateConfidence,
  type Citation,
  type EvidenceQuality,
} from "@/domain/chat/types";

export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============== HELPERS ==============

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

function formatCitation(citation: Citation, index: number): string {
  const parts = [citation.workTitle];
  if (citation.authors) parts.push(`(${citation.authors.split(',')[0]} et al.`);
  if (citation.year) parts.push(`${citation.year})`);
  else if (citation.authors) parts[parts.length - 1] += ')';
  if (citation.pageNumber) parts.push(`p.${citation.pageNumber}`);
  if (citation.section) parts.push(`§${citation.section}`);
  return `[${index + 1}] ${parts.join(', ')}`;
}

// ============== MAIN HANDLER ==============

export async function POST(req: Request, { params }: RouteParams) {
  const startTime = Date.now();
  
  try {
    const { id: projectId } = await params;

    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    // Verify access
    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: session.user.id } },
    });
    if (!membership) throw new NotFoundError("Project");

    const body = await req.json();
    const { messages, conversationId: existingConversationId } = body;
    
    // Get the last user message
    const lastUserMessage = messages?.filter((m: { role: string }) => m.role === 'user').pop();
    const lastUserText = typeof lastUserMessage?.content === 'string' 
      ? lastUserMessage.content 
      : '';

    // Analyze the query
    const queryAnalysis = analyzeQuery(lastUserText);

    // Get or create conversation
    let conversationId = existingConversationId;
    if (!conversationId) {
      const newConversation = await createConversation(projectId, session.user.id);
      conversationId = newConversation.id;
    }

    // Save user message
    await addMessage(conversationId, {
      role: 'user',
      content: lastUserText,
    });

    // Generate title if this is the first message
    const conversation = await getConversation(conversationId, session.user.id);
    if (conversation && conversation.messageCount <= 1) {
      await generateConversationTitle(conversationId, lastUserText);
    }

    // ============== DETERMINISTIC ANSWERS ==============
    
    // Project stats (always compute - fast)
    const [total, included, excluded, maybe] = await Promise.all([
      db.projectWork.count({ where: { projectId } }),
      db.projectWork.count({ where: { projectId, finalDecision: "INCLUDE" } }),
      db.projectWork.count({ where: { projectId, finalDecision: "EXCLUDE" } }),
      db.projectWork.count({ where: { projectId, finalDecision: "MAYBE" } }),
    ]);
    const pending = total - included - excluded - maybe;

    // Handle count questions deterministically
    if (queryAnalysis.isCountQuestion) {
      const text =
        `This project has **${total}** studies.\n\n` +
        `- Included: **${included}**\n` +
        `- Excluded: **${excluded}**\n` +
        `- Maybe: **${maybe}**\n` +
        `- Pending/unscreened: **${pending}**\n`;

      // Save assistant response
      await addMessage(conversationId, {
        role: 'assistant',
        content: text,
        confidence: 1.0,
        evidenceQuality: 'strong',
        sourceCount: 0,
        processingTimeMs: Date.now() - startTime,
      });

      return new Response(text, {
        headers: { 
          "Content-Type": "text/plain; charset=utf-8",
          "X-Conversation-Id": conversationId,
        },
      });
    }

    // Handle team questions deterministically
    if (queryAnalysis.isTeamQuestion) {
      const team = await db.projectMember.findMany({
        where: { projectId },
        orderBy: { joinedAt: "asc" },
        select: {
          role: true,
          user: { select: { name: true, email: true } },
        },
      });

      const screeners = team.filter((m) => ["OWNER", "LEAD", "REVIEWER"].includes(m.role));
      const decisionMakers = await db.screeningDecisionRecord.findMany({
        where: { projectWork: { projectId } },
        distinct: ["reviewerId"],
        select: { reviewer: { select: { name: true } } },
      });

      const lines: string[] = [];
      lines.push(`**Team members:** ${team.length}`);
      lines.push(`**Screeners (Owner/Lead/Reviewer):** ${screeners.length}`);
      lines.push("");
      lines.push("People who can screen:");
      screeners.forEach((m) => lines.push(`- ${m.user.name ?? "Unnamed"} (${m.role})`));
      lines.push("");
      lines.push(`**Active screeners:** ${decisionMakers.length}`);
      decisionMakers.forEach((d) => lines.push(`- ${d.reviewer?.name ?? "Unnamed"}`));

      const text = lines.join("\n");

      await addMessage(conversationId, {
        role: 'assistant',
        content: text,
        confidence: 1.0,
        evidenceQuality: 'strong',
        sourceCount: 0,
        processingTimeMs: Date.now() - startTime,
      });

      return new Response(text, {
        headers: { 
          "Content-Type": "text/plain; charset=utf-8",
          "X-Conversation-Id": conversationId,
        },
      });
    }

    // ============== RAG-POWERED RESPONSE ==============

    // Check ingestion status
    const ingestedCount = await db.projectWork.count({
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

    // Evidence retrieval with reranking
    let citations: Citation[] = [];
    let evidenceQuality: EvidenceQuality = 'none';
    let confidence = 0;

    if (lastUserText && lastUserText.length >= 8 && ingestedCount > 0) {
      try {
        const chunks = await searchProjectKnowledgeEnhanced(projectId, lastUserText, {
          limit: 6,
          onlyIncluded: true,
          useReranking: true,
        });

        citations = toCitations(chunks);
        evidenceQuality = determineEvidenceQuality(
          chunks.map(c => ({
            content: c.content,
            similarity: c.similarity,
            workId: c.workId,
            workTitle: c.workTitle,
            chunkIndex: c.chunkIndex,
          })),
          true // hasPdfSources
        );
        confidence = calculateConfidence(
          chunks.map(c => ({
            content: c.content,
            similarity: c.similarity,
            workId: c.workId,
            workTitle: c.workTitle,
            chunkIndex: c.chunkIndex,
          })),
          evidenceQuality
        );
      } catch (e) {
        console.error("[AI Chat] Retrieval failed", e);
      }
    }

    // Fallback to title/abstract if no PDF evidence
    let abstractFallback: Array<{ title: string; abstract: string | null; year: number | null }> = [];
    if (citations.length === 0 && lastUserText.length >= 8) {
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
        select: { work: { select: { title: true, abstract: true, year: true } } },
      });
      abstractFallback = hits.map((h) => h.work);
      if (abstractFallback.length > 0) {
        evidenceQuality = 'weak';
        confidence = 0.4;
      }
    }

    // Get included studies preview
    const includedPreview = await db.projectWork.findMany({
      where: { projectId, finalDecision: "INCLUDE" },
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: { work: { select: { title: true, year: true, doi: true } } },
    });

    // Build context
    const contextLines: string[] = [];
    
    contextLines.push("## Project Stats");
    contextLines.push(`- Total: ${total} | Included: ${included} | Excluded: ${excluded} | Maybe: ${maybe} | Pending: ${pending}`);
    contextLines.push(`- PDFs attached: ${includedWithPdfCount} | Ingested for search: ${ingestedCount}`);
    contextLines.push("");

    if (citations.length > 0) {
      contextLines.push("## Retrieved Evidence (from PDFs)");
      citations.forEach((c, i) => {
        contextLines.push(`### ${formatCitation(c, i)}`);
        if (c.pageNumber) contextLines.push(`Page: ${c.pageNumber}`);
        if (c.section) contextLines.push(`Section: ${c.section}`);
        contextLines.push(`Relevance: ${(c.similarity * 100).toFixed(1)}%`);
        contextLines.push(`> ${c.excerpt}`);
        contextLines.push("");
      });
    } else if (abstractFallback.length > 0) {
      contextLines.push("## Abstract Matches (PDFs not available)");
      abstractFallback.forEach((w, i) => {
        contextLines.push(`### [${i + 1}] ${w.title} (${w.year || 'n.d.'})`);
        contextLines.push(w.abstract?.slice(0, 800) || "(no abstract)");
        contextLines.push("");
      });
    }

    contextLines.push("## Included Studies Preview");
    includedPreview.forEach((pw, i) => {
      contextLines.push(`${i + 1}. ${pw.work?.title} (${pw.work?.year || 'n.d.'})`);
    });

    // Generate suggested questions
    const suggestedQuestions = generateSuggestedQuestions(
      lastUserText,
      queryAnalysis.extractedTopics,
      queryAnalysis.synthesisMode
    );

    // Build system prompt
    const systemPrompt = `You are an expert research assistant for systematic literature reviews.

RESPONSE GUIDELINES:
1. Ground your answers in the retrieved evidence. Cite sources using [1], [2], etc.
2. If evidence is from abstracts only (not full PDFs), state this clearly.
3. Never invent study details. If information isn't in the evidence, say so.
4. For synthesis questions, compare and contrast findings across sources.
5. Be concise but thorough. Use bullet points for clarity.

EVIDENCE QUALITY: ${evidenceQuality.toUpperCase()}
CONFIDENCE: ${(confidence * 100).toFixed(0)}%
${citations.length === 0 && abstractFallback.length === 0 ? '\n⚠️ No evidence retrieved. Answer based on general knowledge and note this limitation.' : ''}

PROJECT CONTEXT:
${contextLines.join('\n')}
`;

    // Prepare metadata to pass via headers (base64 encoded for safety)
    const metadata = {
      conversationId,
      citations,
      confidence,
      evidenceQuality,
      sourceCount: citations.length || abstractFallback.length,
      suggestedQuestions,
    };
    const metadataHeader = Buffer.from(JSON.stringify(metadata)).toString('base64');

    const result = streamText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages,
      onFinish: async ({ text }) => {
        // Save assistant message with all metadata
        await addMessage(conversationId, {
          role: 'assistant',
          content: text,
          citations: citations.length > 0 ? citations : undefined,
          confidence,
          evidenceQuality,
          sourceCount: citations.length || abstractFallback.length,
          suggestedQuestions,
          modelUsed: 'gpt-4o',
          processingTimeMs: Date.now() - startTime,
        });
      },
    });

    return result.toTextStreamResponse({ 
      headers: {
        "X-Conversation-Id": conversationId,
        "X-Chat-Metadata": metadataHeader,
      },
    });

  } catch (error) {
    return handleApiError(error);
  }
}

