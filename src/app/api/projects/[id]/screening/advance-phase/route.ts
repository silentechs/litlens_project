import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
    handleApiError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
    success,
} from "@/lib/api";
import type { ScreeningPhase } from "@/types/screening";
// ✅ LOGIC UNIFICATION: Import domain constants to avoid duplicating logic
import { DECISION_STATUS_MAP } from "@/domain/screening/types";

interface RouteParams {
    params: Promise<{ id: string }>;
}

const PHASE_ORDER: ScreeningPhase[] = ["TITLE_ABSTRACT", "FULL_TEXT", "FINAL"];

function getNextPhase(current: ScreeningPhase): ScreeningPhase | null {
    const currentIndex = PHASE_ORDER.indexOf(current);
    if (currentIndex === -1 || currentIndex === PHASE_ORDER.length - 1) {
        return null;
    }
    return PHASE_ORDER[currentIndex + 1];
}

// POST /api/projects/[id]/screening/advance-phase
// Moves INCLUDED works from currentPhase to nextPhase
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId } = await params;
        const body = await request.json();
        const currentPhase: ScreeningPhase = body.currentPhase;

        if (!currentPhase) {
            throw new ValidationError("currentPhase is required");
        }

        // Check membership and role
        const membership = await db.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: session.user.id,
                },
            },
        });

        if (!membership) {
            throw new NotFoundError("Project");
        }

        if (!["OWNER", "LEAD"].includes(membership.role)) {
            throw new ForbiddenError("Only project owners and leads can advance phases");
        }

        const nextPhase = getNextPhase(currentPhase);
        if (!nextPhase) {
            throw new ValidationError("No next phase available");
        }

        // --- REPAIR/PRE-ADVANCE BLOCK ---
        // Ensure all studies with decisions are properly marked as INCLUDED/EXCLUDED
        const project = await db.project.findUnique({
            where: { id: projectId },
            select: { requireDualScreening: true }
        });

        const membersCount = await db.projectMember.count({ where: { projectId } });

        // Find studies that have decisions but are not yet INCLUDED/EXCLUDED/MAYBE
        const pendingWithDecisions = await db.projectWork.findMany({
            where: {
                projectId,
                phase: currentPhase,
                status: { in: ["PENDING", "SCREENING"] },
                decisions: { some: {} }
            },
            include: { decisions: true }
        });

        for (const study of pendingWithDecisions) {
            // If we only have 1 member, or dual screening is off, or we have 2+ decisions
            if (membersCount === 1 || !project?.requireDualScreening || study.decisions.length >= 2) {
                // ✅ S2 FIX: Sort decisions by createdAt descending to get latest first
                const sortedDecisions = [...study.decisions].sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );

                // ✅ S2 FIX: Implement Majority Rule Logic (instead of strict consensus)
                const counts = { INCLUDE: 0, EXCLUDE: 0, MAYBE: 0 };
                study.decisions.forEach(d => {
                    if (d.decision in counts) counts[d.decision as keyof typeof counts]++;
                });

                const totalDecisions = study.decisions.length;
                let finalDecision: string | null = null;

                // Simple Majority Check
                // If any decision has > 50% of the votes, it wins.
                // For 2 reviewers: Needs 2 (Unanimous). 1-1 is a tie (Conflict).
                // For 3 reviewers: Needs 2.
                for (const [decision, count] of Object.entries(counts)) {
                    if (count > totalDecisions / 2) {
                        finalDecision = decision;
                        break;
                    }
                }

                if (finalDecision) {
                    await db.projectWork.update({
                        where: { id: study.id },
                        data: {
                            status: DECISION_STATUS_MAP[finalDecision as keyof typeof DECISION_STATUS_MAP],
                            finalDecision: finalDecision as any
                        }
                    });
                } else {
                    // Tie or no majority -> Conflict (Skip auto-repair)
                    console.warn(`[AdvancePhase] Skipping study ${study.id} - no majority decision (Conflict)`);
                    continue;
                }
            }
        }
        // --------------------------------

        // ✅ S6 FIX: Phase Advancement Validation (Check for missing PDFs)
        if (nextPhase === 'FULL_TEXT') {
            const missingPdfCount = await db.projectWork.count({
                where: {
                    projectId,
                    phase: currentPhase,
                    status: "INCLUDED",
                    pdfR2Key: null,
                    work: {
                        url: null // Assuming URL is strictly required if PDF is missing
                    }
                }
            });

            if (missingPdfCount > 0) {
                throw new ValidationError(
                    `Cannot advance phase: ${missingPdfCount} included studies are missing PDFs or URLs. ` +
                    `Please retrieve PDFs for these studies before advancing to Full Text.`
                );
            }
        }

        // Find all INCLUDED works in the current phase
        const worksToAdvance = await db.projectWork.findMany({
            where: {
                projectId,
                phase: currentPhase,
                status: "INCLUDED",
            },
            select: { id: true },
        });

        if (worksToAdvance.length === 0) {
            throw new ValidationError("No included works found to advance. Please ensure studies are marked as INCLUDED.");
        }

        // Update all INCLUDED works to the next phase and reset status to PENDING
        const result = await db.projectWork.updateMany({
            where: {
                projectId,
                phase: currentPhase,
                status: "INCLUDED",
            },
            data: {
                phase: nextPhase,
                status: "PENDING",
                finalDecision: null, // Reset final decision for next phase
            },
        });

        // Log activity
        await db.activity.create({
            data: {
                userId: session.user.id,
                projectId,
                type: "PHASE_ADVANCED",
                description: `Advanced ${result.count} studies from ${currentPhase} to ${nextPhase}`,
                metadata: {
                    fromPhase: currentPhase,
                    toPhase: nextPhase,
                    count: result.count,
                },
            },
        });

        return success({
            message: `Successfully advanced ${result.count} studies to ${nextPhase}`,
            advancedCount: result.count,
            fromPhase: currentPhase,
            toPhase: nextPhase,
        });
    } catch (error) {
        return handleApiError(error);
    }
}
