import { db } from "@/lib/db";
import { ScreeningPhase, ScreeningDecision } from "@prisma/client";

// ============== COHEN'S KAPPA CALCULATION ==============

interface DecisionPair {
  reviewer1: ScreeningDecision;
  reviewer2: ScreeningDecision;
}

/**
 * Calculate Cohen's Kappa for inter-rater reliability
 * Kappa = (Po - Pe) / (1 - Pe)
 * Po = Observed agreement
 * Pe = Expected agreement by chance
 */
export function calculateCohensKappa(pairs: DecisionPair[]): number {
  if (pairs.length === 0) return 0;

  const n = pairs.length;
  
  // Calculate observed agreement (Po)
  let agreements = 0;
  for (const pair of pairs) {
    if (pair.reviewer1 === pair.reviewer2) {
      agreements++;
    }
  }
  const po = agreements / n;

  // Calculate expected agreement by chance (Pe)
  const decisions: ScreeningDecision[] = ["INCLUDE", "EXCLUDE", "MAYBE"];
  const r1Counts: Record<string, number> = {};
  const r2Counts: Record<string, number> = {};

  // Count decisions for each reviewer
  for (const decision of decisions) {
    r1Counts[decision] = pairs.filter(p => p.reviewer1 === decision).length;
    r2Counts[decision] = pairs.filter(p => p.reviewer2 === decision).length;
  }

  // Calculate expected agreement
  let pe = 0;
  for (const decision of decisions) {
    const p1 = r1Counts[decision] / n;
    const p2 = r2Counts[decision] / n;
    pe += p1 * p2;
  }

  // Calculate Kappa
  if (pe === 1) return 1; // Perfect agreement by chance
  
  const kappa = (po - pe) / (1 - pe);
  return Math.round(kappa * 1000) / 1000; // Round to 3 decimal places
}

/**
 * Interpret Kappa score
 */
export function interpretKappa(kappa: number): {
  level: "Poor" | "Slight" | "Fair" | "Moderate" | "Substantial" | "Almost Perfect";
  color: string;
  recommendation: string;
} {
  if (kappa < 0) {
    return {
      level: "Poor",
      color: "#EF4444",
      recommendation: "Agreement is worse than chance. Review eligibility criteria and consider retraining reviewers.",
    };
  } else if (kappa < 0.2) {
    return {
      level: "Slight",
      color: "#F97316",
      recommendation: "Very low agreement. Conduct calibration round and clarify eligibility criteria.",
    };
  } else if (kappa < 0.4) {
    return {
      level: "Fair",
      color: "#F59E0B",
      recommendation: "Below acceptable threshold. Consider calibration and team discussion.",
    };
  } else if (kappa < 0.6) {
    return {
      level: "Moderate",
      color: "#EAB308",
      recommendation: "Acceptable for exploratory work. Consider improving for publication.",
    };
  } else if (kappa < 0.8) {
    return {
      level: "Substantial",
      color: "#84CC16",
      recommendation: "Good agreement. Suitable for most systematic reviews.",
    };
  } else {
    return {
      level: "Almost Perfect",
      color: "#10B981",
      recommendation: "Excellent agreement. Meets highest standards for systematic reviews.",
    };
  }
}

// ============== SCREENING ANALYTICS ==============

interface ScreeningAnalyticsParams {
  projectId: string;
  phase?: ScreeningPhase;
  include?: string[]; // What to calculate: kappa, irr, velocity, performance
}

export async function getScreeningAnalytics(params: ScreeningAnalyticsParams) {
  const { projectId, phase, include = ["all"] } = params;
  const shouldInclude = (metric: string) => 
    include.includes("all") || include.includes(metric);

  const analytics: any = {
    projectId,
    phase: phase || "all",
    generatedAt: new Date().toISOString(),
  };

  // Get all project works for this phase
  const whereClause: any = { projectId };
  if (phase) {
    whereClause.phase = phase;
  }

  const projectWorks = await db.projectWork.findMany({
    where: whereClause,
    include: {
      decisions: {
        include: {
          reviewer: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
    },
  });

  // ============== KAPPA CALCULATION ==============
  if (shouldInclude("kappa")) {
    // Find all studies with exactly 2 decisions (dual screening)
    const dualScreenedStudies = projectWorks.filter(
      pw => pw.decisions.length === 2
    );

    if (dualScreenedStudies.length > 0) {
      const pairs: DecisionPair[] = dualScreenedStudies.map(pw => ({
        reviewer1: pw.decisions[0].decision as ScreeningDecision,
        reviewer2: pw.decisions[1].decision as ScreeningDecision,
      }));

      const kappa = calculateCohensKappa(pairs);
      const interpretation = interpretKappa(kappa);

      analytics.kappa = {
        score: kappa,
        interpretation: interpretation.level,
        color: interpretation.color,
        recommendation: interpretation.recommendation,
        studiesAnalyzed: dualScreenedStudies.length,
      };
    } else {
      analytics.kappa = {
        score: null,
        interpretation: "Insufficient Data",
        color: "#9CA3AF",
        recommendation: "Need at least one study with two independent reviews.",
        studiesAnalyzed: 0,
      };
    }
  }

  // ============== AGREEMENT RATES ==============
  if (shouldInclude("agreement")) {
    const dualScreenedStudies = projectWorks.filter(
      pw => pw.decisions.length >= 2
    );

    if (dualScreenedStudies.length > 0) {
      const agreements = dualScreenedStudies.filter(pw => 
        pw.decisions[0].decision === pw.decisions[1].decision
      ).length;

      const disagreements = dualScreenedStudies.length - agreements;

      analytics.agreement = {
        agreementRate: Math.round((agreements / dualScreenedStudies.length) * 100),
        agreements,
        disagreements,
        total: dualScreenedStudies.length,
      };
    } else {
      analytics.agreement = {
        agreementRate: null,
        agreements: 0,
        disagreements: 0,
        total: 0,
      };
    }
  }

  // ============== CONFLICT RATE ==============
  if (shouldInclude("conflicts")) {
    const conflicts = await db.conflict.count({
      where: {
        projectId,
        ...(phase && { phase }),
      },
    });

    const resolved = await db.conflict.count({
      where: {
        projectId,
        ...(phase && { phase }),
        status: "RESOLVED",
      },
    });

    analytics.conflicts = {
      total: conflicts,
      resolved,
      pending: conflicts - resolved,
      resolutionRate: conflicts > 0 ? Math.round((resolved / conflicts) * 100) : 100,
    };
  }

  // ============== REVIEWER PERFORMANCE ==============
  if (shouldInclude("performance")) {
    // Get all reviewers
    const reviewers = await db.projectMember.findMany({
      where: { projectId },
      include: { user: true },
    });

    const performance = await Promise.all(
      reviewers.map(async (reviewer) => {
        const decisions = await db.screeningDecisionRecord.findMany({
          where: {
            reviewerId: reviewer.userId,
            projectWork: { projectId },
            ...(phase && { phase }),
          },
        });

        const avgTime = decisions.length > 0
          ? decisions.reduce((sum, d) => sum + (d.timeSpentMs || 0), 0) / decisions.length
          : 0;

        const avgConfidence = decisions.length > 0
          ? decisions.reduce((sum, d) => sum + (d.confidence || 80), 0) / decisions.length
          : 0;

        // Calculate agreement with final decision
        const studiesWithFinal = await db.projectWork.findMany({
          where: {
            projectId,
            ...(phase && { phase }),
            finalDecision: { not: null },
            decisions: {
              some: { reviewerId: reviewer.userId },
            },
          },
          include: {
            decisions: {
              where: { reviewerId: reviewer.userId },
            },
          },
        });

        const agreementsWithFinal = studiesWithFinal.filter(pw => 
          pw.decisions[0]?.decision === pw.finalDecision
        ).length;

        const agreementWithConsensus = studiesWithFinal.length > 0
          ? Math.round((agreementsWithFinal / studiesWithFinal.length) * 100)
          : null;

        return {
          reviewerId: reviewer.userId,
          name: reviewer.user.name || "Unknown",
          image: reviewer.user.image,
          role: reviewer.role,
          studiesReviewed: decisions.length,
          avgTimePerStudy: Math.round(avgTime / 1000), // Convert to seconds
          avgConfidence: Math.round(avgConfidence),
          agreementWithConsensus,
        };
      })
    );

    analytics.performance = performance.filter(p => p.studiesReviewed > 0);
  }

  // ============== SCREENING VELOCITY ==============
  if (shouldInclude("velocity")) {
    // Get decisions grouped by date
    const decisions = await db.screeningDecisionRecord.findMany({
      where: {
        projectWork: { projectId },
        ...(phase && { phase }),
      },
      select: {
        createdAt: true,
        timeSpentMs: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by day
    const velocityByDay: Record<string, { count: number; totalTime: number }> = {};
    
    for (const decision of decisions) {
      const date = decision.createdAt.toISOString().split("T")[0];
      if (!velocityByDay[date]) {
        velocityByDay[date] = { count: 0, totalTime: 0 };
      }
      velocityByDay[date].count++;
      velocityByDay[date].totalTime += decision.timeSpentMs || 0;
    }

    const velocity = Object.entries(velocityByDay).map(([date, data]) => ({
      date,
      studiesScreened: data.count,
      avgTimePerStudy: data.count > 0 ? Math.round(data.totalTime / data.count / 1000) : 0,
    }));

    analytics.velocity = velocity;
  }

  // ============== PHASE STATISTICS ==============
  if (shouldInclude("stats")) {
    const stats = {
      total: projectWorks.length,
      pending: projectWorks.filter(pw => pw.status === "PENDING" || pw.status === "SCREENING").length,
      included: projectWorks.filter(pw => pw.finalDecision === "INCLUDE").length,
      excluded: projectWorks.filter(pw => pw.finalDecision === "EXCLUDE").length,
      maybe: projectWorks.filter(pw => pw.finalDecision === "MAYBE").length,
      conflicts: projectWorks.filter(pw => pw.status === "CONFLICT").length,
    };

    analytics.stats = stats;
  }

  return analytics;
}

// ============== PRISMA FLOW DATA ==============

export async function getPRISMAFlowData(projectId: string) {
  // Get counts for each stage
  const identification = await db.projectWork.count({
    where: { projectId },
  });

  const duplicates = await db.projectWork.count({
    where: { projectId, isDuplicate: true },
  });

  const afterDeduplication = identification - duplicates;

  const titleAbstractScreened = await db.projectWork.count({
    where: {
      projectId,
      phase: { in: ["FULL_TEXT", "FINAL"] },
    },
  });

  const titleAbstractExcluded = await db.projectWork.count({
    where: {
      projectId,
      phase: "TITLE_ABSTRACT",
      finalDecision: "EXCLUDE",
    },
  });

  const fullTextScreened = await db.projectWork.count({
    where: {
      projectId,
      phase: "FULL_TEXT",
    },
  });

  const fullTextExcluded = await db.projectWork.count({
    where: {
      projectId,
      phase: "FULL_TEXT",
      finalDecision: "EXCLUDE",
    },
  });

  // Get exclusion reasons
  const exclusionReasons = await db.screeningDecisionRecord.findMany({
    where: {
      projectWork: { projectId },
      decision: "EXCLUDE",
      exclusionReason: { not: null },
    },
    select: {
      exclusionReason: true,
    },
  });

  const reasonCounts: Record<string, number> = {};
  for (const record of exclusionReasons) {
    if (record.exclusionReason) {
      reasonCounts[record.exclusionReason] = (reasonCounts[record.exclusionReason] || 0) + 1;
    }
  }

  const included = await db.projectWork.count({
    where: {
      projectId,
      finalDecision: "INCLUDE",
    },
  });

  return {
    identification: {
      total: identification,
      duplicates,
      afterDeduplication,
    },
    screening: {
      titleAbstract: {
        screened: afterDeduplication,
        excluded: titleAbstractExcluded,
        remaining: titleAbstractScreened,
      },
      fullText: {
        screened: fullTextScreened,
        excluded: fullTextExcluded,
        remaining: fullTextScreened - fullTextExcluded,
      },
    },
    exclusionReasons: Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    included,
  };
}

// ============== UTILITY FUNCTIONS ==============

/**
 * Get all decision pairs for Kappa calculation
 */
export async function getDecisionPairs(
  projectId: string,
  phase?: ScreeningPhase
): Promise<DecisionPair[]> {
  const whereClause: any = { projectId };
  if (phase) {
    whereClause.phase = phase;
  }

  const projectWorks = await db.projectWork.findMany({
    where: whereClause,
    include: {
      decisions: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Filter to only dual-screened studies
  const dualScreened = projectWorks.filter(pw => pw.decisions.length === 2);

  return dualScreened.map(pw => ({
    reviewer1: pw.decisions[0].decision as ScreeningDecision,
    reviewer2: pw.decisions[1].decision as ScreeningDecision,
  }));
}

/**
 * Calculate percentage agreement
 */
export function calculateAgreementRate(pairs: DecisionPair[]): number {
  if (pairs.length === 0) return 0;
  
  const agreements = pairs.filter(p => p.reviewer1 === p.reviewer2).length;
  return Math.round((agreements / pairs.length) * 100);
}

/**
 * Get confusion matrix for decision patterns
 */
export function getConfusionMatrix(pairs: DecisionPair[]): {
  matrix: Record<string, Record<string, number>>;
  summary: { decision: string; count: number }[];
} {
  const decisions: ScreeningDecision[] = ["INCLUDE", "EXCLUDE", "MAYBE"];
  const matrix: Record<string, Record<string, number>> = {};

  // Initialize matrix
  for (const d1 of decisions) {
    matrix[d1] = {};
    for (const d2 of decisions) {
      matrix[d1][d2] = 0;
    }
  }

  // Fill matrix
  for (const pair of pairs) {
    matrix[pair.reviewer1][pair.reviewer2]++;
  }

  // Calculate summary
  const summary = decisions.map(decision => ({
    decision,
    count: Object.values(matrix[decision]).reduce((sum, val) => sum + val, 0),
  }));

  return { matrix, summary };
}
