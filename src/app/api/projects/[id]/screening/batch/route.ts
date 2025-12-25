import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  success,
} from "@/lib/api";
import { z } from "zod";
import { ProjectWorkStatus, ScreeningDecision, ScreeningPhase } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Batch operations schema
const batchOperationSchema = z.object({
  operation: z.enum([
    "move_phase",     // Move studies to next/previous phase
    "bulk_decision",  // Apply same decision to multiple studies
    "assign",         // Assign studies to a reviewer
    "reset",          // Reset decisions for re-screening
    "apply_ai",       // Apply AI suggestions as decisions
  ]),
  projectWorkIds: z.array(z.string().cuid()).min(1, "At least one study required"),
  // Operation-specific params
  targetPhase: z.enum(["TITLE_ABSTRACT", "FULL_TEXT", "FINAL"]).optional(),
  decision: z.enum(["INCLUDE", "EXCLUDE", "MAYBE"]).optional(),
  reasoning: z.string().optional(),
  assigneeId: z.string().cuid().optional(),
  aiConfidenceThreshold: z.number().min(0).max(1).optional(),
});

// POST /api/projects/[id]/screening/batch - Execute batch operations
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Check project access and role (only leads can do batch operations)
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
      throw new ForbiddenError("Only project leads can perform batch operations");
    }

    const body = await request.json();
    const { operation, projectWorkIds, targetPhase, decision, reasoning, assigneeId, aiConfidenceThreshold } = 
      batchOperationSchema.parse(body);

    // Verify all studies belong to this project
    const studies = await db.projectWork.findMany({
      where: {
        id: { in: projectWorkIds },
        projectId,
      },
      select: { id: true, phase: true, status: true, aiSuggestion: true, aiConfidence: true },
    });

    if (studies.length !== projectWorkIds.length) {
      throw new NotFoundError("One or more studies not found in this project");
    }

    let result: { processed: number; failed: number; details?: unknown };

    switch (operation) {
      case "move_phase":
        result = await movePhaseBatch(projectId, studies, targetPhase!);
        break;
      case "bulk_decision":
        result = await bulkDecisionBatch(projectId, session.user.id, studies, decision!, reasoning);
        break;
      case "assign":
        result = await assignBatch(projectId, studies, assigneeId!);
        break;
      case "reset":
        result = await resetBatch(projectId, studies);
        break;
      case "apply_ai":
        result = await applyAiBatch(projectId, session.user.id, studies, aiConfidenceThreshold || 0.8);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "SCREENING_DECISION",
        description: `Batch ${operation}: ${result.processed} studies processed`,
        metadata: {
          operation,
          studyCount: projectWorkIds.length,
          processed: result.processed,
          failed: result.failed,
        },
      },
    });

    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}

// ============== BATCH OPERATIONS ==============

async function movePhaseBatch(
  projectId: string,
  studies: Array<{ id: string; phase: ScreeningPhase; status: ProjectWorkStatus }>,
  targetPhase: ScreeningPhase
): Promise<{ processed: number; failed: number }> {
  const validStudies = studies.filter((s) => 
    s.status === ProjectWorkStatus.INCLUDED || s.status === ProjectWorkStatus.MAYBE
  );

  await db.projectWork.updateMany({
    where: {
      id: { in: validStudies.map((s) => s.id) },
    },
    data: {
      phase: targetPhase,
      status: ProjectWorkStatus.PENDING,
    },
  });

  return {
    processed: validStudies.length,
    failed: studies.length - validStudies.length,
  };
}

async function bulkDecisionBatch(
  projectId: string,
  userId: string,
  studies: Array<{ id: string; phase: ScreeningPhase }>,
  decision: ScreeningDecision,
  reasoning?: string
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  await db.$transaction(async (tx) => {
    for (const study of studies) {
      try {
        // Check if user already has a decision
        const existing = await tx.screeningDecisionRecord.findUnique({
          where: {
            projectWorkId_reviewerId_phase: {
              projectWorkId: study.id,
              reviewerId: userId,
              phase: study.phase,
            },
          },
        });

        if (existing) {
          failed++;
          continue;
        }

        // Create decision
        await tx.screeningDecisionRecord.create({
          data: {
            projectWorkId: study.id,
            reviewerId: userId,
            phase: study.phase,
            decision,
            reasoning,
          },
        });

        // Update status
        const status = decision === ScreeningDecision.INCLUDE
          ? ProjectWorkStatus.INCLUDED
          : decision === ScreeningDecision.EXCLUDE
            ? ProjectWorkStatus.EXCLUDED
            : ProjectWorkStatus.MAYBE;

        await tx.projectWork.update({
          where: { id: study.id },
          data: { status, finalDecision: decision },
        });

        processed++;
      } catch {
        failed++;
      }
    }
  });

  return { processed, failed };
}

async function assignBatch(
  projectId: string,
  studies: Array<{ id: string }>,
  assigneeId: string
): Promise<{ processed: number; failed: number }> {
  // Verify assignee is a project member
  const membership = await db.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: assigneeId,
      },
    },
  });

  if (!membership) {
    throw new ForbiddenError("Assignee is not a project member");
  }

  // Note: Assignment tracking would require a new field/table
  // For now, we'll create activities to track assignments
  await db.activity.createMany({
    data: studies.map((s) => ({
      userId: assigneeId,
      projectId,
      type: "PROJECT_UPDATED" as const,
      description: `Study assigned for screening`,
      metadata: {
        action: "study_assigned",
        projectWorkId: s.id,
      },
    })),
  });

  return {
    processed: studies.length,
    failed: 0,
  };
}

async function resetBatch(
  projectId: string,
  studies: Array<{ id: string; phase: ScreeningPhase }>
): Promise<{ processed: number; failed: number }> {
  let processed = 0;

  await db.$transaction(async (tx) => {
    for (const study of studies) {
      // Delete existing decisions for this phase
      await tx.screeningDecisionRecord.deleteMany({
        where: {
          projectWorkId: study.id,
          phase: study.phase,
        },
      });

      // Delete any conflicts
      await tx.conflict.deleteMany({
        where: {
          projectWorkId: study.id,
          phase: study.phase,
        },
      });

      // Reset status to pending
      await tx.projectWork.update({
        where: { id: study.id },
        data: {
          status: ProjectWorkStatus.PENDING,
          finalDecision: null,
        },
      });

      processed++;
    }
  });

  return {
    processed,
    failed: 0,
  };
}

async function applyAiBatch(
  projectId: string,
  userId: string,
  studies: Array<{ id: string; phase: ScreeningPhase; aiSuggestion: string | null; aiConfidence: number | null }>,
  confidenceThreshold: number
): Promise<{ processed: number; failed: number; details: { applied: number; skipped: number } }> {
  let applied = 0;
  let skipped = 0;

  await db.$transaction(async (tx) => {
    for (const study of studies) {
      // Skip if no AI suggestion or low confidence
      if (!study.aiSuggestion || study.aiConfidence === null || study.aiConfidence < confidenceThreshold) {
        skipped++;
        continue;
      }

      // Check if user already has a decision
      const existing = await tx.screeningDecisionRecord.findUnique({
        where: {
          projectWorkId_reviewerId_phase: {
            projectWorkId: study.id,
            reviewerId: userId,
            phase: study.phase,
          },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const decision = study.aiSuggestion as ScreeningDecision;

      // Create decision with followedAi flag
      await tx.screeningDecisionRecord.create({
        data: {
          projectWorkId: study.id,
          reviewerId: userId,
          phase: study.phase,
          decision,
          reasoning: `Applied AI suggestion (confidence: ${(study.aiConfidence * 100).toFixed(0)}%)`,
          followedAi: true,
        },
      });

      // Update status
      const status = decision === ScreeningDecision.INCLUDE
        ? ProjectWorkStatus.INCLUDED
        : decision === ScreeningDecision.EXCLUDE
          ? ProjectWorkStatus.EXCLUDED
          : ProjectWorkStatus.MAYBE;

      await tx.projectWork.update({
        where: { id: study.id },
        data: { status, finalDecision: decision },
      });

      applied++;
    }
  });

  return {
    processed: applied,
    failed: 0,
    details: { applied, skipped },
  };
}

