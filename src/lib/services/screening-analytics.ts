/**
 * Screening Analytics Service
 * Provides comprehensive statistics and insights for screening progress
 */

import { db } from "@/lib/db";
import { 
  ProjectWorkStatus, 
  ScreeningPhase, 
  ScreeningDecision,
  ConflictStatus 
} from "@prisma/client";

// Types
export interface ScreeningOverview {
  project: {
    id: string;
    title: string;
    totalStudies: number;
    startDate: Date | null;
    targetEndDate: Date | null;
  };
  currentPhase: ScreeningPhase;
  progress: PhaseProgress[];
  overall: {
    completedStudies: number;
    remainingStudies: number;
    percentComplete: number;
    estimatedDaysToComplete: number | null;
  };
}

export interface PhaseProgress {
  phase: ScreeningPhase;
  total: number;
  pending: number;
  included: number;
  excluded: number;
  maybe: number;
  conflicts: number;
  percentComplete: number;
}

export interface ReviewerStats {
  userId: string;
  userName: string | null;
  userImage: string | null;
  decisionsCount: number;
  avgTimePerDecision: number | null;
  agreementRate: number | null;
  includedRate: number;
  excludedRate: number;
  maybeRate: number;
  dailyAverage: number;
  lastActive: Date | null;
}

export interface TimelineEntry {
  date: string;
  screened: number;
  included: number;
  excluded: number;
  maybe: number;
  cumulative: number;
}

export interface AIPerformance {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  byDecision: {
    include: { predicted: number; correct: number; accuracy: number };
    exclude: { predicted: number; correct: number; accuracy: number };
    maybe: { predicted: number; correct: number; accuracy: number };
  };
  confidenceCorrelation: {
    highConfidenceAccuracy: number;
    lowConfidenceAccuracy: number;
  };
  timesSaved: number; // Studies where AI was followed without modification
}

export interface PRISMAFlow {
  identification: {
    databasesSearched: number;
    recordsIdentified: number;
    duplicatesRemoved: number;
    recordsAfterDeduplication: number;
  };
  screening: {
    titleAbstract: {
      screened: number;
      excluded: number;
      reasons: Array<{ reason: string; count: number }>;
    };
    fullText: {
      assessed: number;
      excluded: number;
      reasons: Array<{ reason: string; count: number }>;
    };
  };
  included: {
    qualitativeSynthesis: number;
    quantitativeSynthesis: number;
  };
}

/**
 * Get screening overview for a project
 */
export async function getScreeningOverview(projectId: string): Promise<ScreeningOverview> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Get counts by phase and status
  const phaseStats = await db.projectWork.groupBy({
    by: ["phase", "status"],
    where: { projectId },
    _count: true,
  });

  // Build progress by phase
  const phases: ScreeningPhase[] = ["TITLE_ABSTRACT", "FULL_TEXT", "FINAL"];
  const progress: PhaseProgress[] = phases.map((phase) => {
    const phaseData = phaseStats.filter((s) => s.phase === phase);
    const total = phaseData.reduce((sum, d) => sum + d._count, 0);
    const pending = phaseData.find((d) => d.status === ProjectWorkStatus.PENDING)?._count || 0;
    const included = phaseData.find((d) => d.status === ProjectWorkStatus.INCLUDED)?._count || 0;
    const excluded = phaseData.find((d) => d.status === ProjectWorkStatus.EXCLUDED)?._count || 0;
    const maybe = phaseData.find((d) => d.status === ProjectWorkStatus.MAYBE)?._count || 0;
    const conflicts = phaseData.find((d) => d.status === ProjectWorkStatus.CONFLICT)?._count || 0;

    return {
      phase,
      total,
      pending,
      included,
      excluded,
      maybe,
      conflicts,
      percentComplete: total > 0 ? ((total - pending - conflicts) / total) * 100 : 0,
    };
  });

  // Determine current phase
  let currentPhase: ScreeningPhase = "TITLE_ABSTRACT";
  for (const p of progress) {
    if (p.pending > 0 || p.conflicts > 0) {
      currentPhase = p.phase;
      break;
    }
    if (p.total > 0) {
      currentPhase = p.phase;
    }
  }

  // Calculate overall progress
  const totalStudies = progress.reduce((sum, p) => sum + p.total, 0);
  const completedStudies = progress.reduce((sum, p) => sum + p.included + p.excluded + p.maybe, 0);
  const remainingStudies = progress.reduce((sum, p) => sum + p.pending + p.conflicts, 0);

  // Estimate days to complete based on recent velocity
  const estimatedDays = await estimateDaysToComplete(projectId, remainingStudies);

  return {
    project: {
      id: project.id,
      title: project.title,
      totalStudies,
      startDate: project.createdAt,
      targetEndDate: null, // Would come from project settings
    },
    currentPhase,
    progress,
    overall: {
      completedStudies,
      remainingStudies,
      percentComplete: totalStudies > 0 ? (completedStudies / totalStudies) * 100 : 0,
      estimatedDaysToComplete: estimatedDays,
    },
  };
}

/**
 * Get detailed reviewer statistics
 */
export async function getReviewerStats(projectId: string): Promise<ReviewerStats[]> {
  // Get all reviewers who have made decisions
  const reviewers = await db.screeningDecisionRecord.groupBy({
    by: ["reviewerId"],
    where: {
      projectWork: { projectId },
    },
    _count: true,
    _avg: {
      timeSpentMs: true,
    },
  });

  const stats = await Promise.all(
    reviewers.map(async (reviewer) => {
      // Get user info
      const user = await db.user.findUnique({
        where: { id: reviewer.reviewerId },
        select: { name: true, image: true },
      });

      // Get decision breakdown
      const decisions = await db.screeningDecisionRecord.groupBy({
        by: ["decision"],
        where: {
          reviewerId: reviewer.reviewerId,
          projectWork: { projectId },
        },
        _count: true,
      });

      const total = decisions.reduce((sum, d) => sum + d._count, 0);
      const included = decisions.find((d) => d.decision === ScreeningDecision.INCLUDE)?._count || 0;
      const excluded = decisions.find((d) => d.decision === ScreeningDecision.EXCLUDE)?._count || 0;
      const maybe = decisions.find((d) => d.decision === ScreeningDecision.MAYBE)?._count || 0;

      // Calculate agreement rate (% of decisions that matched final outcome)
      const agreementData = await db.screeningDecisionRecord.findMany({
        where: {
          reviewerId: reviewer.reviewerId,
          projectWork: {
            projectId,
            finalDecision: { not: null },
          },
        },
        include: {
          projectWork: {
            select: { finalDecision: true },
          },
        },
      });

      const agreedCount = agreementData.filter(
        (d) => d.decision === d.projectWork.finalDecision
      ).length;
      const agreementRate = agreementData.length > 0 
        ? (agreedCount / agreementData.length) * 100 
        : null;

      // Get last activity
      const lastDecision = await db.screeningDecisionRecord.findFirst({
        where: {
          reviewerId: reviewer.reviewerId,
          projectWork: { projectId },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      // Calculate daily average (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentDecisions = await db.screeningDecisionRecord.count({
        where: {
          reviewerId: reviewer.reviewerId,
          projectWork: { projectId },
          createdAt: { gte: sevenDaysAgo },
        },
      });

      return {
        userId: reviewer.reviewerId,
        userName: user?.name || null,
        userImage: user?.image || null,
        decisionsCount: reviewer._count,
        avgTimePerDecision: reviewer._avg.timeSpentMs,
        agreementRate,
        includedRate: total > 0 ? (included / total) * 100 : 0,
        excludedRate: total > 0 ? (excluded / total) * 100 : 0,
        maybeRate: total > 0 ? (maybe / total) * 100 : 0,
        dailyAverage: recentDecisions / 7,
        lastActive: lastDecision?.createdAt || null,
      };
    })
  );

  return stats.sort((a, b) => b.decisionsCount - a.decisionsCount);
}

/**
 * Get screening timeline data
 */
export async function getScreeningTimeline(
  projectId: string,
  days: number = 30
): Promise<TimelineEntry[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Get all decisions in the date range
  const decisions = await db.screeningDecisionRecord.findMany({
    where: {
      projectWork: { projectId },
      createdAt: { gte: startDate },
    },
    select: {
      createdAt: true,
      decision: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by date
  const dailyData = new Map<string, { screened: number; included: number; excluded: number; maybe: number }>();
  
  // Initialize all days
  for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    dailyData.set(dateStr, { screened: 0, included: 0, excluded: 0, maybe: 0 });
  }

  // Populate with actual data
  decisions.forEach((d) => {
    const dateStr = d.createdAt.toISOString().split("T")[0];
    const data = dailyData.get(dateStr);
    if (data) {
      data.screened++;
      if (d.decision === ScreeningDecision.INCLUDE) data.included++;
      else if (d.decision === ScreeningDecision.EXCLUDE) data.excluded++;
      else data.maybe++;
    }
  });

  // Build timeline with cumulative totals
  const timeline: TimelineEntry[] = [];
  let cumulative = 0;

  for (const [date, data] of dailyData) {
    cumulative += data.screened;
    timeline.push({
      date,
      ...data,
      cumulative,
    });
  }

  return timeline;
}

/**
 * Get AI performance metrics
 */
export async function getAIPerformance(projectId: string): Promise<AIPerformance> {
  // Get studies with AI predictions and final decisions
  const studies = await db.projectWork.findMany({
    where: {
      projectId,
      aiSuggestion: { not: null },
      finalDecision: { not: null },
    },
    select: {
      aiSuggestion: true,
      aiConfidence: true,
      finalDecision: true,
    },
  });

  const totalPredictions = studies.length;
  let correctPredictions = 0;
  let timesSaved = 0;

  const byDecision = {
    include: { predicted: 0, correct: 0, accuracy: 0 },
    exclude: { predicted: 0, correct: 0, accuracy: 0 },
    maybe: { predicted: 0, correct: 0, accuracy: 0 },
  };

  let highConfidenceCorrect = 0;
  let highConfidenceTotal = 0;
  let lowConfidenceCorrect = 0;
  let lowConfidenceTotal = 0;

  studies.forEach((s) => {
    const isCorrect = s.aiSuggestion === s.finalDecision;
    if (isCorrect) correctPredictions++;

    // By decision type
    const decisionKey = s.aiSuggestion?.toLowerCase() as keyof typeof byDecision;
    if (decisionKey && byDecision[decisionKey]) {
      byDecision[decisionKey].predicted++;
      if (isCorrect) byDecision[decisionKey].correct++;
    }

    // By confidence level
    if (s.aiConfidence !== null) {
      if (s.aiConfidence >= 0.7) {
        highConfidenceTotal++;
        if (isCorrect) highConfidenceCorrect++;
      } else {
        lowConfidenceTotal++;
        if (isCorrect) lowConfidenceCorrect++;
      }
    }
  });

  // Calculate studies where AI was followed
  const followedStudies = await db.screeningDecisionRecord.count({
    where: {
      projectWork: { projectId },
      followedAi: true,
    },
  });
  timesSaved = followedStudies;

  // Calculate accuracies
  Object.keys(byDecision).forEach((key) => {
    const d = byDecision[key as keyof typeof byDecision];
    d.accuracy = d.predicted > 0 ? (d.correct / d.predicted) * 100 : 0;
  });

  return {
    totalPredictions,
    correctPredictions,
    accuracy: totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0,
    byDecision,
    confidenceCorrelation: {
      highConfidenceAccuracy: highConfidenceTotal > 0 
        ? (highConfidenceCorrect / highConfidenceTotal) * 100 
        : 0,
      lowConfidenceAccuracy: lowConfidenceTotal > 0 
        ? (lowConfidenceCorrect / lowConfidenceTotal) * 100 
        : 0,
    },
    timesSaved,
  };
}

/**
 * Generate PRISMA flow diagram data
 */
export async function getPRISMAFlow(projectId: string): Promise<PRISMAFlow> {
  // Get import batches for identification section
  const importBatches = await db.importBatch.findMany({
    where: { projectId },
    select: {
      totalRecords: true,
      duplicatesFound: true,
    },
  });

  const recordsIdentified = importBatches.reduce((sum, b) => sum + (b.totalRecords || 0), 0);
  const duplicatesRemoved = importBatches.reduce((sum, b) => sum + (b.duplicatesFound || 0), 0);

  // Get screening stats
  const titleAbstractScreened = await db.projectWork.count({
    where: { projectId, phase: ScreeningPhase.TITLE_ABSTRACT },
  });

  const titleAbstractExcluded = await db.projectWork.count({
    where: { 
      projectId, 
      phase: ScreeningPhase.TITLE_ABSTRACT,
      status: ProjectWorkStatus.EXCLUDED,
    },
  });

  // Get exclusion reasons for title/abstract
  const taExclusionReasons = await db.screeningDecisionRecord.groupBy({
    by: ["exclusionReason"],
    where: {
      projectWork: { 
        projectId, 
        phase: ScreeningPhase.TITLE_ABSTRACT 
      },
      decision: ScreeningDecision.EXCLUDE,
      exclusionReason: { not: null },
    },
    _count: true,
  });

  // Full text screening
  const fullTextAssessed = await db.projectWork.count({
    where: { projectId, phase: ScreeningPhase.FULL_TEXT },
  });

  const fullTextExcluded = await db.projectWork.count({
    where: { 
      projectId, 
      phase: ScreeningPhase.FULL_TEXT,
      status: ProjectWorkStatus.EXCLUDED,
    },
  });

  const ftExclusionReasons = await db.screeningDecisionRecord.groupBy({
    by: ["exclusionReason"],
    where: {
      projectWork: { 
        projectId, 
        phase: ScreeningPhase.FULL_TEXT 
      },
      decision: ScreeningDecision.EXCLUDE,
      exclusionReason: { not: null },
    },
    _count: true,
  });

  // Final included
  const includedStudies = await db.projectWork.count({
    where: { 
      projectId, 
      status: ProjectWorkStatus.INCLUDED,
    },
  });

  return {
    identification: {
      databasesSearched: importBatches.length,
      recordsIdentified,
      duplicatesRemoved,
      recordsAfterDeduplication: recordsIdentified - duplicatesRemoved,
    },
    screening: {
      titleAbstract: {
        screened: titleAbstractScreened,
        excluded: titleAbstractExcluded,
        reasons: taExclusionReasons.map((r) => ({
          reason: r.exclusionReason || "No reason specified",
          count: r._count,
        })),
      },
      fullText: {
        assessed: fullTextAssessed,
        excluded: fullTextExcluded,
        reasons: ftExclusionReasons.map((r) => ({
          reason: r.exclusionReason || "No reason specified",
          count: r._count,
        })),
      },
    },
    included: {
      qualitativeSynthesis: includedStudies,
      quantitativeSynthesis: 0, // Would need additional data extraction status
    },
  };
}

/**
 * Get inter-rater reliability (Cohen's Kappa)
 */
export async function getInterRaterReliability(
  projectId: string,
  phase: ScreeningPhase = "TITLE_ABSTRACT"
): Promise<{
  kappa: number;
  interpretation: string;
  agreementPercentage: number;
  sampleSize: number;
}> {
  // Get studies with dual screening
  const dualScreenedStudies = await db.projectWork.findMany({
    where: {
      projectId,
      phase,
      decisions: {
        // Has at least 2 decisions
      },
    },
    include: {
      decisions: {
        where: { phase },
        select: {
          reviewerId: true,
          decision: true,
        },
      },
    },
  });

  // Filter to only those with exactly 2 decisions
  const pairs = dualScreenedStudies.filter((s) => s.decisions.length >= 2);
  
  if (pairs.length < 5) {
    return {
      kappa: 0,
      interpretation: "Insufficient data",
      agreementPercentage: 0,
      sampleSize: pairs.length,
    };
  }

  // Calculate agreement
  let agreements = 0;
  const decisionCounts = {
    include: { r1: 0, r2: 0 },
    exclude: { r1: 0, r2: 0 },
    maybe: { r1: 0, r2: 0 },
  };

  pairs.forEach((p) => {
    const [d1, d2] = p.decisions;
    if (d1.decision === d2.decision) agreements++;

    // Track marginal totals for Kappa calculation
    const d1Key = d1.decision.toLowerCase() as keyof typeof decisionCounts;
    const d2Key = d2.decision.toLowerCase() as keyof typeof decisionCounts;
    if (decisionCounts[d1Key]) decisionCounts[d1Key].r1++;
    if (decisionCounts[d2Key]) decisionCounts[d2Key].r2++;
  });

  const n = pairs.length;
  const observedAgreement = agreements / n;

  // Calculate expected agreement
  const expectedAgreement = Object.values(decisionCounts).reduce((sum, counts) => {
    return sum + (counts.r1 / n) * (counts.r2 / n);
  }, 0);

  // Cohen's Kappa
  const kappa = expectedAgreement === 1 
    ? 1 
    : (observedAgreement - expectedAgreement) / (1 - expectedAgreement);

  // Interpretation
  let interpretation: string;
  if (kappa < 0) interpretation = "Poor";
  else if (kappa < 0.2) interpretation = "Slight";
  else if (kappa < 0.4) interpretation = "Fair";
  else if (kappa < 0.6) interpretation = "Moderate";
  else if (kappa < 0.8) interpretation = "Substantial";
  else interpretation = "Almost Perfect";

  return {
    kappa: Math.round(kappa * 100) / 100,
    interpretation,
    agreementPercentage: Math.round(observedAgreement * 100),
    sampleSize: n,
  };
}

// ============== HELPERS ==============

async function estimateDaysToComplete(
  projectId: string,
  remaining: number
): Promise<number | null> {
  if (remaining === 0) return 0;

  // Get average daily completions over last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentDecisions = await db.screeningDecisionRecord.count({
    where: {
      projectWork: { projectId },
      createdAt: { gte: sevenDaysAgo },
    },
  });

  const dailyAverage = recentDecisions / 7;
  
  if (dailyAverage === 0) return null;

  return Math.ceil(remaining / dailyAverage);
}

