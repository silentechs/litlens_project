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
import { publishScreeningConflict } from "@/lib/events/publisher";

// Clean Architecture - Use Service Layer
import { ScreeningService } from "@/infrastructure/screening/screening-service";
import { PrismaScreeningRepository } from "@/infrastructure/screening/prisma-screening-repository";
import { ScreeningEventPublisherAdapter } from "@/infrastructure/screening/event-publisher-adapter";
import { BullMQIngestionQueue } from "@/infrastructure/jobs/ingestion-queue";

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
      return await handleBatchDecision(projectId, session.user.id, body);
    }

    return await handleSingleDecision(projectId, session.user.id, body);
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
  });

  if (!projectWork) {
    throw new NotFoundError("Study");
  }

  // ✅ CLEAN ARCHITECTURE: Use Service Layer
  const screeningService = new ScreeningService({
    repository: new PrismaScreeningRepository(),
    eventPublisher: new ScreeningEventPublisherAdapter(),
    ingestionQueue: new BullMQIngestionQueue(),
  });

  // Process decision through service (handles all business logic)
  const result = await screeningService.processDecision({
    projectWorkId: data.projectWorkId,
    reviewerId: userId,
    phase: data.phase,
    decision: data.decision,
    reasoning: data.reasoning,
    exclusionReason: data.exclusionReason,
    timeSpentMs: data.timeSpentMs,
    confidence: data.confidence,
    followedAi: data.followedAi,
  });

  // Return success with state transition result
  return created({
    message: 'Decision recorded successfully',
    result: {
      status: result.newStatus,
      phase: result.newPhase,
      finalDecision: result.finalDecision,
      conflictCreated: result.conflictCreated,
      shouldAdvancePhase: result.shouldAdvancePhase,
    },
  });
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
// (Old updateProjectWorkStatus removed - now handled by ScreeningService)

