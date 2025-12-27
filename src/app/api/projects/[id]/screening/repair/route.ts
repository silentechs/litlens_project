import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
    handleApiError,
    UnauthorizedError,
    NotFoundError,
    ForbiddenError,
    success,
} from "@/lib/api";
import type { ScreeningPhase } from "@/types/screening";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId } = await params;
        const body = await request.json();
        const currentPhase = (body.phase as ScreeningPhase) || "TITLE_ABSTRACT";

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

        if (!["OWNER", "LEAD", "ADMIN"].includes(membership.role)) {
            throw new ForbiddenError("Only project leads can trigger repair");
        }

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

        let repairCount = 0;

        if (stuckStudies.length > 0) {
            for (const study of stuckStudies) {
                if (study.decisions.length > 0) {
                    const latest = study.decisions[0];

                    // Consensus check (simplified version of the one in GET)
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
                        repairCount++;
                    }
                }
            }
        }

        return success({
            repaired: repairCount,
            totalChecked: stuckStudies.length,
            message: `Successfully repaired ${repairCount} stuck items.`
        });

    } catch (error) {
        return handleApiError(error);
    }
}
