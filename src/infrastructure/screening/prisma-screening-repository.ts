/**
 * Prisma Screening Repository
 * 
 * Concrete implementation of ScreeningRepository using Prisma ORM.
 * Separates domain logic from data access.
 */

import { db } from '@/lib/db';
import type {
  ScreeningRepository,
  ProjectWorkData,
  CreateDecisionData,
  ProjectWorkUpdate,
} from './screening-service';
import type {
  DecisionRecord,
  ScreeningConfig,
  ScreeningPhase,
  ConflictData,
} from '@/domain/screening/types';

export class PrismaScreeningRepository implements ScreeningRepository {
  async getProjectWork(id: string): Promise<ProjectWorkData | null> {
    const projectWork = await db.projectWork.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        workId: true,
        phase: true,
      },
    });

    return projectWork;
  }

  async getDecisions(
    projectWorkId: string,
    phase: ScreeningPhase
  ): Promise<DecisionRecord[]> {
    const decisions = await db.screeningDecisionRecord.findMany({
      where: {
        projectWorkId,
        phase,
      },
      select: {
        id: true,
        reviewerId: true,
        decision: true,
        reasoning: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc', // ✅ CRITICAL: Consistent ordering
      },
    });

    return decisions.map(d => ({
      id: d.id,
      reviewerId: d.reviewerId,
      decision: d.decision,
      reasoning: d.reasoning || undefined,
      createdAt: d.createdAt,
    }));
  }

  async createDecision(data: CreateDecisionData): Promise<void> {
    await db.screeningDecisionRecord.create({
      data: {
        projectWorkId: data.projectWorkId,
        reviewerId: data.reviewerId,
        phase: data.phase,
        decision: data.decision,
        reasoning: data.reasoning,
        exclusionReason: data.exclusionReason,
        timeSpentMs: data.timeSpentMs,
        confidence: data.confidence,
        followedAi: data.followedAi,
      },
    });
  }

  async updateProjectWorkStatus(
    id: string,
    update: ProjectWorkUpdate
  ): Promise<void> {
    await db.projectWork.update({
      where: { id },
      data: {
        status: update.status,
        phase: update.phase,
        finalDecision: update.finalDecision,
      },
    });
  }

  async upsertConflict(
    conflict: ConflictData & { projectId: string }
  ): Promise<void> {
    await db.conflict.upsert({
      where: {
        projectWorkId_phase: {
          projectWorkId: conflict.projectWorkId,
          phase: conflict.phase,
        },
      },
      update: {
        status: 'PENDING',
        decisions: conflict.decisions,
      },
      create: {
        projectId: conflict.projectId,
        projectWorkId: conflict.projectWorkId,
        phase: conflict.phase,
        status: 'PENDING',
        decisions: conflict.decisions,
      },
    });
  }

  async getProjectConfig(projectId: string): Promise<ScreeningConfig> {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        requireDualScreening: true,
        blindScreening: true,
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    return {
      requireDualScreening: project.requireDualScreening,
      blindScreening: project.blindScreening,
      reviewersNeeded: project.requireDualScreening ? 2 : 1,
    };
  }
}

