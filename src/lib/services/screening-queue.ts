/**
 * Smart Screening Queue Service
 * Optimizes study order for efficient screening
 */

import { db } from "@/lib/db";
import { Prisma, ProjectWorkStatus, ScreeningPhase } from "@prisma/client";

// Types
export interface QueueOptions {
  userId: string;
  projectId: string;
  phase?: ScreeningPhase;
  limit?: number;
  strategy?: QueueStrategy;
}

export type QueueStrategy = 
  | "default"        // Standard FIFO
  | "ai_confident"   // AI high-confidence first
  | "ai_uncertain"   // AI low-confidence first (human expertise needed)
  | "priority"       // By priority score
  | "balanced"       // Mix of strategies
  | "random";        // Random order (reduces bias)

export interface QueuedStudy {
  id: string;
  workId: string;
  title: string;
  abstract: string | null;
  authors: Array<{ name: string }>;
  year: number | null;
  journal: string | null;
  keywords: string[];
  aiSuggestion: string | null;
  aiConfidence: number | null;
  aiReasoning: string | null;
  priorityScore: number;
  position: number;
}

export interface QueueStats {
  total: number;
  pending: number;
  screened: number;
  conflicts: number;
  aiCoverage: number; // % of pending with AI suggestions
}

/**
 * Get optimized screening queue for a user
 */
export async function getScreeningQueue(options: QueueOptions): Promise<QueuedStudy[]> {
  const { 
    userId, 
    projectId, 
    phase = "TITLE_ABSTRACT", 
    limit = 20,
    strategy = "balanced"
  } = options;

  // Get studies pending screening that user hasn't screened yet
  const orderBy = getOrderByForStrategy(strategy);
  
  const studies = await db.projectWork.findMany({
    where: {
      projectId,
      phase,
      status: ProjectWorkStatus.PENDING,
      // Exclude studies user has already screened
      NOT: {
        decisions: {
          some: {
            reviewerId: userId,
            phase,
          },
        },
      },
    },
    take: limit,
    orderBy,
    include: {
      work: {
        select: {
          id: true,
          title: true,
          abstract: true,
          authors: true,
          year: true,
          journal: true,
          keywords: true,
        },
      },
    },
  });

  // Apply additional strategy-specific logic
  let processed = studies;
  
  if (strategy === "random") {
    // Shuffle for random order
    processed = shuffleArray([...studies]);
  } else if (strategy === "balanced") {
    // Interleave high confidence and low confidence
    processed = balanceQueue(studies);
  }

  // Transform to queue format
  return processed.map((pw, index) => ({
    id: pw.id,
    workId: pw.work.id,
    title: pw.work.title,
    abstract: pw.work.abstract,
    authors: (pw.work.authors as Array<{ name: string }>) || [],
    year: pw.work.year,
    journal: pw.work.journal,
    keywords: (pw.work.keywords as string[]) || [],
    aiSuggestion: pw.aiSuggestion,
    aiConfidence: pw.aiConfidence,
    aiReasoning: pw.aiReasoning,
    priorityScore: pw.priorityScore || 0,
    position: index + 1,
  }));
}

/**
 * Get queue statistics for a project
 */
export async function getQueueStats(
  projectId: string, 
  phase: ScreeningPhase = "TITLE_ABSTRACT"
): Promise<QueueStats> {
  const [total, pending, conflicts, withAi] = await Promise.all([
    db.projectWork.count({
      where: { projectId, phase },
    }),
    db.projectWork.count({
      where: { projectId, phase, status: ProjectWorkStatus.PENDING },
    }),
    db.projectWork.count({
      where: { projectId, phase, status: ProjectWorkStatus.CONFLICT },
    }),
    db.projectWork.count({
      where: { 
        projectId, 
        phase, 
        status: ProjectWorkStatus.PENDING,
        aiSuggestion: { not: null },
      },
    }),
  ]);

  return {
    total,
    pending,
    screened: total - pending - conflicts,
    conflicts,
    aiCoverage: pending > 0 ? (withAi / pending) * 100 : 100,
  };
}

/**
 * Update priority scores based on various factors
 */
export async function updatePriorityScores(
  projectId: string,
  options: {
    boostByYear?: boolean;
    boostByJournal?: string[];
    boostByKeywords?: string[];
  } = {}
): Promise<number> {
  const { boostByYear = true, boostByJournal = [], boostByKeywords = [] } = options;

  const studies = await db.projectWork.findMany({
    where: {
      projectId,
      status: ProjectWorkStatus.PENDING,
    },
    include: {
      work: {
        select: {
          year: true,
          journal: true,
          keywords: true,
        },
      },
    },
  });

  let updated = 0;
  const currentYear = new Date().getFullYear();

  for (const study of studies) {
    let score = 50; // Base score
    
    // Year boost (more recent = higher priority)
    if (boostByYear && study.work.year) {
      const yearsOld = currentYear - study.work.year;
      if (yearsOld <= 2) score += 20;
      else if (yearsOld <= 5) score += 10;
      else if (yearsOld > 10) score -= 10;
    }
    
    // Journal boost
    if (boostByJournal.length > 0 && study.work.journal) {
      const journalLower = study.work.journal.toLowerCase();
      if (boostByJournal.some((j) => journalLower.includes(j.toLowerCase()))) {
        score += 15;
      }
    }
    
    // Keyword boost
    if (boostByKeywords.length > 0) {
      const keywords = (study.work.keywords as string[]) || [];
      const matchCount = keywords.filter((kw) =>
        boostByKeywords.some((bk) => kw.toLowerCase().includes(bk.toLowerCase()))
      ).length;
      score += Math.min(matchCount * 5, 20);
    }
    
    // AI confidence factor
    if (study.aiConfidence !== null) {
      // Lower confidence = higher priority (needs human review)
      if (study.aiConfidence < 0.6) {
        score += 15;
      } else if (study.aiConfidence > 0.9) {
        score -= 5; // Can be deprioritized
      }
    }
    
    // Clamp score between 0-100
    score = Math.max(0, Math.min(100, score));
    
    await db.projectWork.update({
      where: { id: study.id },
      data: { priorityScore: score },
    });
    
    updated++;
  }

  return updated;
}

/**
 * Assign studies to reviewers for workload balancing
 */
export async function assignStudiesToReviewer(
  projectId: string,
  reviewerId: string,
  count: number,
  phase: ScreeningPhase = "TITLE_ABSTRACT"
): Promise<string[]> {
  // Get pending studies not yet assigned to this reviewer
  const studies = await db.projectWork.findMany({
    where: {
      projectId,
      phase,
      status: ProjectWorkStatus.PENDING,
      NOT: {
        decisions: {
          some: {
            reviewerId,
            phase,
          },
        },
      },
    },
    take: count,
    orderBy: { priorityScore: "desc" },
    select: { id: true },
  });

  return studies.map((s) => s.id);
}

/**
 * Get workload distribution across reviewers
 */
export async function getWorkloadDistribution(
  projectId: string,
  phase: ScreeningPhase = "TITLE_ABSTRACT"
): Promise<Array<{ userId: string; userName: string | null; completed: number; pending: number }>> {
  // Get all project members with REVIEWER role or higher
  const members = await db.projectMember.findMany({
    where: {
      projectId,
      role: { in: ["OWNER", "LEAD", "REVIEWER"] },
    },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });

  const distribution = await Promise.all(
    members.map(async (member) => {
      const [completed, total] = await Promise.all([
        db.screeningDecisionRecord.count({
          where: {
            reviewerId: member.userId,
            phase,
            projectWork: { projectId },
          },
        }),
        db.projectWork.count({
          where: { projectId, phase },
        }),
      ]);

      return {
        userId: member.userId,
        userName: member.user.name,
        completed,
        pending: total - completed,
      };
    })
  );

  return distribution.sort((a, b) => b.completed - a.completed);
}

// ============== HELPERS ==============

function getOrderByForStrategy(strategy: QueueStrategy): Prisma.ProjectWorkOrderByWithRelationInput[] {
  switch (strategy) {
    case "ai_confident":
      return [
        { aiConfidence: { sort: "desc", nulls: "last" } },
        { priorityScore: "desc" },
        { createdAt: "asc" },
      ];
    case "ai_uncertain":
      return [
        { aiConfidence: { sort: "asc", nulls: "first" } },
        { priorityScore: "desc" },
        { createdAt: "asc" },
      ];
    case "priority":
      return [
        { priorityScore: "desc" },
        { createdAt: "asc" },
      ];
    case "random":
    case "balanced":
    case "default":
    default:
      return [
        { priorityScore: "desc" },
        { createdAt: "asc" },
      ];
  }
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function balanceQueue<T extends { aiConfidence: number | null }>(studies: T[]): T[] {
  const highConfidence = studies.filter((s) => s.aiConfidence !== null && s.aiConfidence >= 0.7);
  const lowConfidence = studies.filter((s) => s.aiConfidence === null || s.aiConfidence < 0.7);
  
  // Interleave: low, high, low, high...
  const balanced: T[] = [];
  const maxLen = Math.max(highConfidence.length, lowConfidence.length);
  
  for (let i = 0; i < maxLen; i++) {
    if (i < lowConfidence.length) balanced.push(lowConfidence[i]);
    if (i < highConfidence.length) balanced.push(highConfidence[i]);
  }
  
  return balanced;
}

