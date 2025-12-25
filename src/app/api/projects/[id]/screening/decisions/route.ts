import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  created,
  success,
} from "@/lib/api";
import { submitDecisionSchema, batchDecisionSchema } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/screening/decisions - Submit screening decision
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;
    const body = await request.json();

    // Check if batch or single decision
    const isBatch = Array.isArray(body.projectWorkIds);
    
    if (isBatch) {
      return handleBatchDecision(projectId, session.user.id, body);
    }

    return handleSingleDecision(projectId, session.user.id, body);
  } catch (error) {
    return handleApiError(error);
  }
}

async function handleSingleDecision(
  projectId: string,
  userId: string,
  body: unknown
) {
  const data = submitDecisionSchema.parse(body);

  // Verify project membership
  const membership = await db.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new NotFoundError("Project");
  }

  if (!["OWNER", "LEAD", "REVIEWER"].includes(membership.role)) {
    throw new ForbiddenError("You don't have permission to screen studies");
  }

  // Verify projectWork belongs to this project
  const projectWork = await db.projectWork.findFirst({
    where: {
      id: data.projectWorkId,
      projectId,
    },
    include: {
      project: {
        select: {
          blindScreening: true,
          requireDualScreening: true,
        },
      },
    },
  });

  if (!projectWork) {
    throw new NotFoundError("Study");
  }

  // Check if user already made a decision for this phase
  const existingDecision = await db.screeningDecisionRecord.findUnique({
    where: {
      projectWorkId_reviewerId_phase: {
        projectWorkId: data.projectWorkId,
        reviewerId: userId,
        phase: data.phase,
      },
    },
  });

  if (existingDecision) {
    throw new ConflictError("You have already screened this study for this phase");
  }

  // Create the decision
  const decision = await db.screeningDecisionRecord.create({
    data: {
      projectWorkId: data.projectWorkId,
      reviewerId: userId,
      phase: data.phase,
      decision: data.decision,
      reasoning: data.reasoning,
      exclusionReason: data.exclusionReason,
      timeSpentMs: data.timeSpentMs,
      followedAi: data.followedAi,
    },
  });

  // Check for conflicts and update projectWork status
  await updateProjectWorkStatus(
    data.projectWorkId,
    data.phase,
    projectWork.project.requireDualScreening
  );

  // Log activity
  await db.activity.create({
    data: {
      userId,
      projectId,
      type: "SCREENING_DECISION",
      description: `Made ${data.decision} decision`,
      metadata: {
        projectWorkId: data.projectWorkId,
        phase: data.phase,
        decision: data.decision,
      },
    },
  });

  return created(decision);
}

async function handleBatchDecision(
  projectId: string,
  userId: string,
  body: unknown
) {
  const data = batchDecisionSchema.parse(body);

  // Verify project membership
  const membership = await db.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new NotFoundError("Project");
  }

  if (!["OWNER", "LEAD"].includes(membership.role)) {
    throw new ForbiddenError("Only project leads can make batch decisions");
  }

  // Process in transaction
  const results = await db.$transaction(async (tx) => {
    const processed: string[] = [];
    const failed: { projectWorkId: string; error: string }[] = [];

    for (const projectWorkId of data.projectWorkIds) {
      try {
        // Check if study exists in project
        const projectWork = await tx.projectWork.findFirst({
          where: { id: projectWorkId, projectId },
        });

        if (!projectWork) {
          failed.push({ projectWorkId, error: "Study not found" });
          continue;
        }

        // Check for existing decision
        const existing = await tx.screeningDecisionRecord.findUnique({
          where: {
            projectWorkId_reviewerId_phase: {
              projectWorkId,
              reviewerId: userId,
              phase: data.phase,
            },
          },
        });

        if (existing) {
          failed.push({ projectWorkId, error: "Already decided" });
          continue;
        }

        // Create decision
        await tx.screeningDecisionRecord.create({
          data: {
            projectWorkId,
            reviewerId: userId,
            phase: data.phase,
            decision: data.decision,
            reasoning: data.reasoning,
          },
        });

        processed.push(projectWorkId);
      } catch {
        failed.push({ projectWorkId, error: "Processing failed" });
      }
    }

    return { processed: processed.length, failed: failed.length, errors: failed };
  });

  // Log activity
  await db.activity.create({
    data: {
      userId,
      projectId,
      type: "SCREENING_DECISION",
      description: `Batch ${data.decision} decision on ${results.processed} studies`,
      metadata: {
        phase: data.phase,
        decision: data.decision,
        count: results.processed,
      },
    },
  });

  return success(results);
}

// ============== HELPERS ==============

async function updateProjectWorkStatus(
  projectWorkId: string,
  phase: string,
  requireDualScreening: boolean
) {
  // Get all decisions for this work and phase
  const decisions = await db.screeningDecisionRecord.findMany({
    where: {
      projectWorkId,
      phase: phase as "TITLE_ABSTRACT" | "FULL_TEXT" | "FINAL",
    },
  });

  if (decisions.length === 0) {
    return;
  }

  // If only one decision and dual screening required, mark as screening
  if (decisions.length === 1 && requireDualScreening) {
    await db.projectWork.update({
      where: { id: projectWorkId },
      data: { status: "SCREENING" },
    });
    return;
  }

  // Check for conflict (different decisions)
  const uniqueDecisions = new Set(decisions.map((d) => d.decision));
  
  if (uniqueDecisions.size > 1) {
    // Create conflict
    const projectWork = await db.projectWork.findUnique({
      where: { id: projectWorkId },
      select: { projectId: true },
    });

    if (projectWork) {
      await db.conflict.create({
        data: {
          projectId: projectWork.projectId,
          projectWorkId,
          phase: phase as "TITLE_ABSTRACT" | "FULL_TEXT" | "FINAL",
          status: "PENDING",
          decisions: decisions.map((d) => ({
            reviewerId: d.reviewerId,
            decision: d.decision,
            reasoning: d.reasoning,
          })),
        },
      });

      await db.projectWork.update({
        where: { id: projectWorkId },
        data: { status: "CONFLICT" },
      });
    }
    return;
  }

  // All decisions agree - update status
  const finalDecision = decisions[0].decision;
  await db.projectWork.update({
    where: { id: projectWorkId },
    data: {
      status: finalDecision === "INCLUDE" 
        ? "INCLUDED" 
        : finalDecision === "EXCLUDE" 
          ? "EXCLUDED" 
          : "MAYBE",
      finalDecision,
    },
  });
}

