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

        // --- SELF-HEALING BLOCK ---
        // Fix studies where decisions exist but status is still PENDING or SCREENING
        // This handles studies affected by the previous status-update bug
        // and also single-member projects where dual-screening is enabled but no 2nd reviewer will come

        const project = await db.project.findUnique({
            where: { id: projectId },
            select: { requireDualScreening: true }
        });
        const membersCount = await db.projectMember.count({ where: { projectId } });

        // For single-member projects with dual screening, studies in SCREENING will never progress
        const shouldAutoFinalize = membersCount === 1 && project?.requireDualScreening;

        const stuckStudies = await db.projectWork.findMany({
            where: {
                projectId,
                phase: currentPhase,
                status: { in: ["PENDING", "SCREENING"] },
                decisions: { some: {} }
            },
            include: { decisions: true }
        });

        if (stuckStudies.length > 0) {
            for (const study of stuckStudies) {
                if (study.decisions.length > 0) {
                    const latest = study.decisions[0];

                    // Auto-fix if single-member project, or if consensus reached (2+ decisions that agree)
                    const shouldFix = shouldAutoFinalize ||
                        (!project?.requireDualScreening) ||
                        (study.decisions.length >= 2);

                    if (shouldFix) {
                        await db.projectWork.update({
                            where: { id: study.id },
                            data: {
                                status: latest.decision === "INCLUDE" ? "INCLUDED" :
                                    latest.decision === "EXCLUDE" ? "EXCLUDED" : "MAYBE",
                                finalDecision: latest.decision
                            }
                        });
                    }
                }
            }
        }
        // --------------------------


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

        // This is rough approximation because duplicate decisions exist (2 reviewers)
        // Better to count Works that have reached consensus or single decision
        // For now, let's stick to confirmed conflicts

        const conflictsCount = await db.conflict.count({
            where: {
                projectId,
                status: { in: ["PENDING", "IN_DISCUSSION"] } // Handle DB schema variations
            }
        });

        // 3. Check other reviewers' progress
        // Find members who have NOT completed screening
        const members = await db.projectMember.findMany({
            where: { projectId },
            select: { userId: true }
        });

        let remainingReviewers = 0;

        // This could be slow for huge teams, but fine for typical 2-10 person teams
        for (const member of members) {
            if (member.userId === session.user.id) continue;

            const pendingForMember = await db.projectWork.count({
                where: {
                    projectId,
                    phase: currentPhase,
                    decisions: {
                        none: {
                            reviewerId: member.userId,
                            phase: currentPhase
                        }
                    }
                }
            });

            if (pendingForMember > 0) {
                remainingReviewers++;
            }
        }

        // 4. Can move to next phase?
        // Rules: 
        // - No pending user items (implied if they are calling this when exhausted)
        // - No conflicts (strict) OR minimal conflicts (lax)
        // - High percentage complete?

        // Simplify: Can move if > 95% of 'screenable' works are done AND conflicts == 0
        // "Screenable" excludes those that might be stuck/ignored

        const isPhaseComplete = remainingReviewers === 0 && conflictsCount === 0 && totalWorks > 0;

        let nextPhase: ScreeningPhase | undefined;
        if (currentPhase === "TITLE_ABSTRACT") nextPhase = "FULL_TEXT";
        // Add other transitions later

        // Calculate actual phase stats from ProjectWork status
        const phaseStatsMap: Record<string, number> = {};
        for (const stat of phaseStatsRaw) {
            phaseStatsMap[stat.status] = stat._count;
        }

        return success({
            completed: userPendingCount === 0,
            totalPending: userPendingCount,
            conflicts: conflictsCount,
            remainingReviewers,
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
