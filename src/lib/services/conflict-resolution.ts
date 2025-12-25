/**
 * Conflict Resolution Service
 * Handles screening disagreements and resolution workflows
 */

import { db } from "@/lib/db";
import { ConflictStatus, ScreeningDecision, ScreeningPhase, ProjectWorkStatus } from "@prisma/client";

// Types
export interface ConflictDetails {
  id: string;
  projectId: string;
  projectWorkId: string;
  phase: ScreeningPhase;
  status: ConflictStatus;
  decisions: ConflictDecision[];
  work: {
    title: string;
    abstract: string | null;
    authors: Array<{ name: string }>;
    year: number | null;
  };
  aiSuggestion: string | null;
  aiConfidence: number | null;
  aiReasoning: string | null;
  resolution: ConflictResolutionDetails | null;
  createdAt: Date;
}

export interface ConflictDecision {
  reviewerId: string;
  reviewerName: string | null;
  reviewerImage: string | null;
  decision: ScreeningDecision;
  reasoning: string | null;
  exclusionReason: string | null;
  createdAt: Date;
}

export interface ConflictResolutionDetails {
  id: string;
  finalDecision: ScreeningDecision;
  reasoning: string | null;
  resolverName: string | null;
  resolvedAt: Date;
}

export interface ResolveConflictInput {
  conflictId: string;
  resolverId: string;
  finalDecision: ScreeningDecision;
  reasoning: string;
}

export interface ConflictStats {
  total: number;
  pending: number;
  resolved: number;
  byPhase: {
    phase: ScreeningPhase;
    count: number;
  }[];
  averageResolutionTimeMs: number | null;
}

/**
 * Get detailed conflict information
 */
export async function getConflictDetails(conflictId: string): Promise<ConflictDetails | null> {
  const conflict = await db.conflict.findUnique({
    where: { id: conflictId },
    include: {
      resolution: {
        include: {
          resolver: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!conflict) {
    return null;
  }

  // Get project work with study details
  const projectWork = await db.projectWork.findUnique({
    where: { id: conflict.projectWorkId },
    include: {
      work: {
        select: {
          title: true,
          abstract: true,
          authors: true,
          year: true,
        },
      },
    },
  });

  if (!projectWork) {
    return null;
  }

  // Get reviewer details for decisions
  const decisions = conflict.decisions as Array<{
    reviewerId: string;
    decision: ScreeningDecision;
    reasoning: string | null;
    exclusionReason?: string | null;
    createdAt?: string;
  }>;

  const reviewerIds = decisions.map((d) => d.reviewerId);
  const reviewers = await db.user.findMany({
    where: { id: { in: reviewerIds } },
    select: { id: true, name: true, image: true },
  });

  const reviewerMap = new Map(reviewers.map((r) => [r.id, r]));

  // Get the actual decision records for more details
  const decisionRecords = await db.screeningDecisionRecord.findMany({
    where: {
      projectWorkId: conflict.projectWorkId,
      phase: conflict.phase,
      reviewerId: { in: reviewerIds },
    },
  });

  const decisionRecordMap = new Map(
    decisionRecords.map((d) => [d.reviewerId, d])
  );

  return {
    id: conflict.id,
    projectId: conflict.projectId,
    projectWorkId: conflict.projectWorkId,
    phase: conflict.phase,
    status: conflict.status,
    decisions: decisions.map((d) => {
      const reviewer = reviewerMap.get(d.reviewerId);
      const record = decisionRecordMap.get(d.reviewerId);
      return {
        reviewerId: d.reviewerId,
        reviewerName: reviewer?.name || null,
        reviewerImage: reviewer?.image || null,
        decision: d.decision,
        reasoning: d.reasoning || record?.reasoning || null,
        exclusionReason: record?.exclusionReason || null,
        createdAt: record?.createdAt || new Date(),
      };
    }),
    work: {
      title: projectWork.work.title,
      abstract: projectWork.work.abstract,
      authors: (projectWork.work.authors as Array<{ name: string }>) || [],
      year: projectWork.work.year,
    },
    aiSuggestion: projectWork.aiSuggestion,
    aiConfidence: projectWork.aiConfidence,
    aiReasoning: projectWork.aiReasoning,
    resolution: conflict.resolution
      ? {
          id: conflict.resolution.id,
          finalDecision: conflict.resolution.finalDecision,
          reasoning: conflict.resolution.reasoning,
          resolverName: conflict.resolution.resolver.name,
          resolvedAt: conflict.resolution.createdAt,
        }
      : null,
    createdAt: conflict.createdAt,
  };
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(input: ResolveConflictInput): Promise<ConflictDetails> {
  const { conflictId, resolverId, finalDecision, reasoning } = input;

  // Get conflict
  const conflict = await db.conflict.findUnique({
    where: { id: conflictId },
  });

  if (!conflict) {
    throw new Error("Conflict not found");
  }

  if (conflict.status === ConflictStatus.RESOLVED) {
    throw new Error("Conflict is already resolved");
  }

  // Verify resolver has permission (must be OWNER or LEAD)
  const membership = await db.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: conflict.projectId,
        userId: resolverId,
      },
    },
  });

  if (!membership || !["OWNER", "LEAD"].includes(membership.role)) {
    throw new Error("Only project leads can resolve conflicts");
  }

  // Create resolution and update conflict in transaction
  await db.$transaction(async (tx) => {
    // Create resolution record
    await tx.conflictResolution.create({
      data: {
        conflictId,
        resolverId,
        finalDecision,
        reasoning,
      },
    });

    // Update conflict status
    await tx.conflict.update({
      where: { id: conflictId },
      data: {
        status: ConflictStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });

    // Update project work status based on final decision
    const status = finalDecision === ScreeningDecision.INCLUDE
      ? ProjectWorkStatus.INCLUDED
      : finalDecision === ScreeningDecision.EXCLUDE
        ? ProjectWorkStatus.EXCLUDED
        : ProjectWorkStatus.MAYBE;

    await tx.projectWork.update({
      where: { id: conflict.projectWorkId },
      data: {
        status,
        finalDecision,
      },
    });

    // Log activity
    await tx.activity.create({
      data: {
        userId: resolverId,
        projectId: conflict.projectId,
        type: "CONFLICT_RESOLVED",
        description: `Resolved screening conflict with ${finalDecision} decision`,
        metadata: {
          conflictId,
          projectWorkId: conflict.projectWorkId,
          phase: conflict.phase,
          finalDecision,
        },
      },
    });
  });

  // Return updated conflict details
  const details = await getConflictDetails(conflictId);
  if (!details) {
    throw new Error("Failed to get conflict details after resolution");
  }
  return details;
}

/**
 * Auto-resolve conflicts where decisions match (shouldn't happen but for cleanup)
 */
export async function autoResolveMatchingConflicts(projectId: string): Promise<number> {
  const conflicts = await db.conflict.findMany({
    where: {
      projectId,
      status: ConflictStatus.PENDING,
    },
  });

  let resolved = 0;

  for (const conflict of conflicts) {
    const decisions = conflict.decisions as Array<{
      reviewerId: string;
      decision: ScreeningDecision;
    }>;

    // Check if all decisions match
    const uniqueDecisions = new Set(decisions.map((d) => d.decision));
    
    if (uniqueDecisions.size === 1) {
      // All decisions agree - auto-resolve
      const finalDecision = decisions[0].decision;
      
      await db.$transaction(async (tx) => {
        // Mark conflict as resolved
        await tx.conflict.update({
          where: { id: conflict.id },
          data: {
            status: ConflictStatus.RESOLVED,
            resolvedAt: new Date(),
          },
        });

        // Update project work status
        const status = finalDecision === ScreeningDecision.INCLUDE
          ? ProjectWorkStatus.INCLUDED
          : finalDecision === ScreeningDecision.EXCLUDE
            ? ProjectWorkStatus.EXCLUDED
            : ProjectWorkStatus.MAYBE;

        await tx.projectWork.update({
          where: { id: conflict.projectWorkId },
          data: {
            status,
            finalDecision,
          },
        });
      });

      resolved++;
    }
  }

  return resolved;
}

/**
 * Get conflict statistics for a project
 */
export async function getConflictStats(projectId: string): Promise<ConflictStats> {
  const [total, pending, resolved, byPhase] = await Promise.all([
    db.conflict.count({ where: { projectId } }),
    db.conflict.count({ where: { projectId, status: ConflictStatus.PENDING } }),
    db.conflict.count({ where: { projectId, status: ConflictStatus.RESOLVED } }),
    db.conflict.groupBy({
      by: ["phase"],
      where: { projectId },
      _count: true,
    }),
  ]);

  // Calculate average resolution time manually
  let averageResolutionTimeMs: number | null = null;
  if (resolved > 0) {
    const resolvedConflicts = await db.conflict.findMany({
      where: {
        projectId,
        status: ConflictStatus.RESOLVED,
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    if (resolvedConflicts.length > 0) {
      const totalTime = resolvedConflicts.reduce((sum, c) => {
        if (c.resolvedAt) {
          return sum + (c.resolvedAt.getTime() - c.createdAt.getTime());
        }
        return sum;
      }, 0);

      averageResolutionTimeMs = totalTime / resolvedConflicts.length;
    }
  }

  return {
    total,
    pending,
    resolved,
    byPhase: byPhase.map((bp) => ({
      phase: bp.phase,
      count: bp._count,
    })),
    averageResolutionTimeMs,
  };
}

/**
 * Detect potential conflicts (studies with disagreeing decisions)
 */
export async function detectNewConflicts(projectId: string): Promise<number> {
  // Find project works with multiple decisions that don't have conflicts yet
  const projectWorks = await db.projectWork.findMany({
    where: {
      projectId,
      status: ProjectWorkStatus.SCREENING,
    },
    include: {
      decisions: true,
    },
  });

  let created = 0;

  for (const pw of projectWorks) {
    if (pw.decisions.length < 2) continue;

    // Group decisions by phase
    const decisionsByPhase = new Map<ScreeningPhase, typeof pw.decisions>();
    pw.decisions.forEach((d) => {
      const existing = decisionsByPhase.get(d.phase) || [];
      existing.push(d);
      decisionsByPhase.set(d.phase, existing);
    });

    // Check each phase for conflicts
    for (const [phase, decisions] of decisionsByPhase) {
      if (decisions.length < 2) continue;

      const uniqueDecisions = new Set(decisions.map((d) => d.decision));
      if (uniqueDecisions.size <= 1) continue; // No conflict

      // Check if conflict already exists
      const existingConflict = await db.conflict.findFirst({
        where: {
          projectWorkId: pw.id,
          phase,
        },
      });

      if (existingConflict) continue;

      // Create conflict
      await db.conflict.create({
        data: {
          projectId,
          projectWorkId: pw.id,
          phase,
          status: ConflictStatus.PENDING,
          decisions: decisions.map((d) => ({
            reviewerId: d.reviewerId,
            decision: d.decision,
            reasoning: d.reasoning,
          })),
        },
      });

      // Update project work status
      await db.projectWork.update({
        where: { id: pw.id },
        data: { status: ProjectWorkStatus.CONFLICT },
      });

      created++;
    }
  }

  return created;
}

/**
 * Escalate conflict to project lead
 */
export async function escalateConflict(
  conflictId: string,
  escalatedBy: string,
  reason: string
): Promise<void> {
  const conflict = await db.conflict.findUnique({
    where: { id: conflictId },
  });

  if (!conflict) {
    throw new Error("Conflict not found");
  }

  // Update conflict with escalation info
  await db.conflict.update({
    where: { id: conflictId },
    data: {
      escalatedAt: new Date(),
      escalatedBy,
      escalationReason: reason,
    },
  });

  // Notify project leads
  const leads = await db.projectMember.findMany({
    where: {
      projectId: conflict.projectId,
      role: { in: ["OWNER", "LEAD"] },
    },
    select: { userId: true },
  });

  // Create activity for each lead (using PROJECT_UPDATED since CONFLICT_ESCALATED doesn't exist)
  await db.activity.createMany({
    data: leads.map((lead) => ({
      userId: lead.userId,
      projectId: conflict.projectId,
      type: "PROJECT_UPDATED" as const,
      description: `Conflict escalated: ${reason}`,
      metadata: {
        action: "conflict_escalated",
        conflictId,
        projectWorkId: conflict.projectWorkId,
        escalatedBy,
        reason,
      },
    })),
  });
}

