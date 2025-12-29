import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
    handleApiError,
    UnauthorizedError,
    NotFoundError,
    success,
} from "@/lib/api";
import type { ScreeningPhase } from "@/types/screening";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId } = await params;
        const searchParams = request.nextUrl.searchParams;
        const currentPhase = (searchParams.get("phase") as ScreeningPhase) || "TITLE_ABSTRACT";

        // Check project access
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



        // 1. Check if user has any pending items in this phase
        // This confirms if "Pipeline Exhausted" is true for THEM
        const userPendingCount = await db.projectWork.count({
            where: {
                projectId,
                phase: currentPhase,
                decisions: {
                    none: {
                        reviewerId: session.user.id,
                        phase: currentPhase,
                    },
                },
            },
        });

        // 2. Get Phase Statistics
        const phaseStatsRaw = await db.projectWork.groupBy({
            by: ['status'],
            where: {
                projectId,
                phase: currentPhase,
            },
            _count: true,
        });

        // Note: status in DB is SCREENING, COMPLETED, etc.
        // We need to look at decisions to really know include/exclude counts if work is still in SCREENING
        // But ideally, completed works have a final decision.
        // For "Pipeline Exhausted" context, we care about "How many studies are fully decided?"

        // Let's get "Completed by team" vs "Total"
        const totalWorks = await db.projectWork.count({
            where: { projectId, phase: currentPhase }
        });

        // 3. Project config (reviewers needed)
        const project = await db.project.findUnique({
            where: { id: projectId },
            select: { requireDualScreening: true }
        });

        const reviewersNeeded = project?.requireDualScreening ? 2 : 1;

        // 4. Unresolved conflicts for this phase (team-level blocker)
        const conflictsCount = await db.conflict.count({
            where: {
                projectId,
                phase: currentPhase,
                status: { in: ["PENDING", "IN_DISCUSSION"] }
            }
        });

        // 5. Team-level completion: how many studies have the required number of decisions for this phase?
        // Use raw SQL for a single, scalable query (avoids N*M per-member loops).
        const requiredDecisionsRows = await db.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count
            FROM (
                SELECT sdr."projectWorkId"
                FROM "ScreeningDecisionRecord" sdr
                JOIN "ProjectWork" pw ON pw."id" = sdr."projectWorkId"
                WHERE pw."projectId" = ${projectId}
                  AND pw."phase" = ${currentPhase}::"ScreeningPhase"
                  AND sdr."phase" = ${currentPhase}::"ScreeningPhase"
                GROUP BY sdr."projectWorkId"
                HAVING COUNT(*) >= ${reviewersNeeded}
            ) t;
        `;

        const studiesWithRequiredDecisions = Number(requiredDecisionsRows?.[0]?.count ?? 0);
        const studiesAwaitingMoreReviews = Math.max(0, totalWorks - studiesWithRequiredDecisions);

        // 4. Can move to next phase?
        // Rules: 
        // - No pending user items (implied if they are calling this when exhausted)
        // - No conflicts (strict) OR minimal conflicts (lax)
        // - High percentage complete?

        // Simplify: Can move if > 95% of 'screenable' works are done AND conflicts == 0
        // "Screenable" excludes those that might be stuck/ignored

        const isPhaseComplete = studiesAwaitingMoreReviews === 0 && conflictsCount === 0 && totalWorks > 0;

        let nextPhase: ScreeningPhase | undefined;
        if (currentPhase === "TITLE_ABSTRACT") nextPhase = "FULL_TEXT";
        else if (currentPhase === "FULL_TEXT") nextPhase = "FINAL";

        // Calculate actual phase stats from ProjectWork status
        const phaseStatsMap: Record<string, number> = {};
        for (const stat of phaseStatsRaw) {
            phaseStatsMap[stat.status] = stat._count;
        }

        return success({
            completed: userPendingCount === 0,
            totalPending: userPendingCount,
            conflicts: conflictsCount,
            // NOTE: This field is consumed by UI; we repurpose it to the real blocker:
            // how many studies still need more reviews for the team to finish this phase.
            remainingReviewers: studiesAwaitingMoreReviews,
            phaseStats: {
                total: totalWorks,
                included: phaseStatsMap['INCLUDED'] || 0,
                excluded: phaseStatsMap['EXCLUDED'] || 0,
                maybe: phaseStatsMap['MAYBE'] || 0
            },
            canMoveToNextPhase: isPhaseComplete && ["OWNER", "LEAD"].includes(membership.role),
            nextPhase
        });

    } catch (error) {
        return handleApiError(error);
    }
}
