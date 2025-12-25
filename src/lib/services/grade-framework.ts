/**
 * GRADE Framework Service
 * Grading of Recommendations Assessment, Development and Evaluation
 */

import { db } from "@/lib/db";

// ============== TYPES ==============

export interface GradeAssessment {
  id: string;
  projectId: string;
  outcomeName: string;
  outcomeDescription?: string;
  
  // Number of studies and participants
  numberOfStudies: number;
  totalParticipants?: number;
  
  // Study design
  studyDesign: "RCT" | "OBSERVATIONAL" | "MIXED";
  
  // GRADE domains (each can downgrade or upgrade)
  riskOfBias: GradeDomain;
  inconsistency: GradeDomain;
  indirectness: GradeDomain;
  imprecision: GradeDomain;
  publicationBias: GradeDomain;
  
  // Upgrade factors (for observational studies)
  largeEffect?: GradeUpgrade;
  doseResponse?: GradeUpgrade;
  plausibleConfounding?: GradeUpgrade;
  
  // Final grade
  startingGrade: number; // 4 for RCT, 2 for observational
  finalGrade: GradeQuality;
  
  // Effect estimates
  effectEstimate?: {
    type: "RR" | "OR" | "HR" | "MD" | "SMD";
    value: number;
    ciLower: number;
    ciUpper: number;
  };
  
  // Summary
  summary: string;
  importanceRating?: number; // 1-9
  
  createdAt: Date;
  updatedAt: Date;
}

export interface GradeDomain {
  level: "NO_CONCERNS" | "SERIOUS" | "VERY_SERIOUS";
  downgrades: number; // 0, 1, or 2
  justification: string;
}

export interface GradeUpgrade {
  applies: boolean;
  upgrades: number; // 0, 1, or 2
  justification: string;
}

export type GradeQuality = "HIGH" | "MODERATE" | "LOW" | "VERY_LOW";

export interface GradeSummaryOfFindings {
  projectId: string;
  title: string;
  comparison: string;
  outcomes: GradeAssessment[];
  footnotes: string[];
  createdAt: Date;
}

// ============== GRADE ASSESSMENT ==============

/**
 * Create or update a GRADE assessment for an outcome
 */
export async function saveGradeAssessment(
  projectId: string,
  data: Omit<GradeAssessment, "id" | "createdAt" | "updatedAt" | "projectId" | "finalGrade">
): Promise<GradeAssessment> {
  // Calculate final grade
  const finalGrade = calculateFinalGrade(data);

  // Store in protocol content or separate table
  // For now, we'll add to the project's protocol content
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { protocol: true },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const protocolContent = (project.protocol?.content || {}) as Record<string, unknown>;
  const gradeAssessments = (protocolContent.gradeAssessments || []) as GradeAssessment[];

  // Check if assessment for this outcome exists
  const existingIndex = gradeAssessments.findIndex((a) => a.outcomeName === data.outcomeName);

  const assessment: GradeAssessment = {
    ...data,
    id: existingIndex >= 0 ? gradeAssessments[existingIndex].id : `grade_${Date.now()}`,
    projectId,
    finalGrade,
    createdAt: existingIndex >= 0 ? gradeAssessments[existingIndex].createdAt : new Date(),
    updatedAt: new Date(),
  };

  if (existingIndex >= 0) {
    gradeAssessments[existingIndex] = assessment;
  } else {
    gradeAssessments.push(assessment);
  }

  // Update protocol
  if (project.protocol) {
    await db.reviewProtocol.update({
      where: { id: project.protocol.id },
      data: {
        content: {
          ...protocolContent,
          gradeAssessments: gradeAssessments as unknown as object[],
        },
      },
    });
  }

  return assessment;
}

/**
 * Get GRADE assessments for a project
 */
export async function getGradeAssessments(projectId: string): Promise<GradeAssessment[]> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { protocol: true },
  });

  if (!project?.protocol) {
    return [];
  }

  const content = project.protocol.content as Record<string, unknown>;
  return (content.gradeAssessments || []) as GradeAssessment[];
}

/**
 * Calculate final GRADE quality
 */
export function calculateFinalGrade(
  data: Omit<GradeAssessment, "id" | "createdAt" | "updatedAt" | "projectId" | "finalGrade">
): GradeQuality {
  // Starting grade: 4 for RCT, 2 for observational
  let grade = data.startingGrade;

  // Downgrade for concerns
  grade -= data.riskOfBias.downgrades;
  grade -= data.inconsistency.downgrades;
  grade -= data.indirectness.downgrades;
  grade -= data.imprecision.downgrades;
  grade -= data.publicationBias.downgrades;

  // Upgrade for factors (only for observational studies that start at 2)
  if (data.studyDesign === "OBSERVATIONAL") {
    if (data.largeEffect?.applies) {
      grade += data.largeEffect.upgrades;
    }
    if (data.doseResponse?.applies) {
      grade += data.doseResponse.upgrades;
    }
    if (data.plausibleConfounding?.applies) {
      grade += data.plausibleConfounding.upgrades;
    }
  }

  // Clamp to 1-4
  grade = Math.max(1, Math.min(4, grade));

  // Map to quality
  switch (grade) {
    case 4:
      return "HIGH";
    case 3:
      return "MODERATE";
    case 2:
      return "LOW";
    default:
      return "VERY_LOW";
  }
}

/**
 * Generate Summary of Findings table
 */
export async function generateSummaryOfFindings(
  projectId: string,
  title: string,
  comparison: string
): Promise<GradeSummaryOfFindings> {
  const assessments = await getGradeAssessments(projectId);

  // Generate footnotes based on assessments
  const footnotes: string[] = [];
  let footnoteIndex = 1;

  assessments.forEach((a) => {
    if (a.riskOfBias.downgrades > 0) {
      footnotes.push(`${footnoteIndex}. ${a.outcomeName}: Risk of bias - ${a.riskOfBias.justification}`);
      footnoteIndex++;
    }
    if (a.inconsistency.downgrades > 0) {
      footnotes.push(`${footnoteIndex}. ${a.outcomeName}: Inconsistency - ${a.inconsistency.justification}`);
      footnoteIndex++;
    }
    if (a.indirectness.downgrades > 0) {
      footnotes.push(`${footnoteIndex}. ${a.outcomeName}: Indirectness - ${a.indirectness.justification}`);
      footnoteIndex++;
    }
    if (a.imprecision.downgrades > 0) {
      footnotes.push(`${footnoteIndex}. ${a.outcomeName}: Imprecision - ${a.imprecision.justification}`);
      footnoteIndex++;
    }
    if (a.publicationBias.downgrades > 0) {
      footnotes.push(`${footnoteIndex}. ${a.outcomeName}: Publication bias - ${a.publicationBias.justification}`);
      footnoteIndex++;
    }
  });

  return {
    projectId,
    title,
    comparison,
    outcomes: assessments,
    footnotes,
    createdAt: new Date(),
  };
}

/**
 * Get GRADE evidence profile for an outcome
 */
export function getEvidenceProfile(assessment: GradeAssessment): {
  quality: GradeQuality;
  qualityDescription: string;
  confidence: string;
  factors: Array<{
    factor: string;
    rating: string;
    impact: string;
  }>;
} {
  const factors = [
    {
      factor: "Risk of bias",
      rating: assessment.riskOfBias.level,
      impact: assessment.riskOfBias.downgrades > 0 
        ? `-${assessment.riskOfBias.downgrades}` 
        : "No downgrade",
    },
    {
      factor: "Inconsistency",
      rating: assessment.inconsistency.level,
      impact: assessment.inconsistency.downgrades > 0 
        ? `-${assessment.inconsistency.downgrades}` 
        : "No downgrade",
    },
    {
      factor: "Indirectness",
      rating: assessment.indirectness.level,
      impact: assessment.indirectness.downgrades > 0 
        ? `-${assessment.indirectness.downgrades}` 
        : "No downgrade",
    },
    {
      factor: "Imprecision",
      rating: assessment.imprecision.level,
      impact: assessment.imprecision.downgrades > 0 
        ? `-${assessment.imprecision.downgrades}` 
        : "No downgrade",
    },
    {
      factor: "Publication bias",
      rating: assessment.publicationBias.level,
      impact: assessment.publicationBias.downgrades > 0 
        ? `-${assessment.publicationBias.downgrades}` 
        : "No downgrade",
    },
  ];

  // Add upgrade factors for observational studies
  if (assessment.studyDesign === "OBSERVATIONAL") {
    if (assessment.largeEffect?.applies) {
      factors.push({
        factor: "Large effect",
        rating: "Applies" as "NO_CONCERNS",
        impact: `+${assessment.largeEffect.upgrades}`,
      });
    }
    if (assessment.doseResponse?.applies) {
      factors.push({
        factor: "Dose-response gradient",
        rating: "Applies" as "NO_CONCERNS",
        impact: `+${assessment.doseResponse.upgrades}`,
      });
    }
    if (assessment.plausibleConfounding?.applies) {
      factors.push({
        factor: "Plausible confounding",
        rating: "Applies" as "NO_CONCERNS",
        impact: `+${assessment.plausibleConfounding.upgrades}`,
      });
    }
  }

  const qualityDescriptions: Record<GradeQuality, string> = {
    HIGH: "We are very confident that the true effect lies close to that of the estimate of the effect.",
    MODERATE: "We are moderately confident in the effect estimate: The true effect is likely to be close to the estimate of the effect, but there is a possibility that it is substantially different.",
    LOW: "Our confidence in the effect estimate is limited: The true effect may be substantially different from the estimate of the effect.",
    VERY_LOW: "We have very little confidence in the effect estimate: The true effect is likely to be substantially different from the estimate of effect.",
  };

  return {
    quality: assessment.finalGrade,
    qualityDescription: qualityDescriptions[assessment.finalGrade],
    confidence: `${assessment.finalGrade.replace("_", " ")} confidence`,
    factors,
  };
}

/**
 * Export GRADE table as formatted text
 */
export function exportGradeTable(sof: GradeSummaryOfFindings): string {
  let output = `# Summary of Findings\n\n`;
  output += `**${sof.title}**\n\n`;
  output += `Comparison: ${sof.comparison}\n\n`;
  
  output += `| Outcome | Studies | Participants | Effect | Quality | Comments |\n`;
  output += `|---------|---------|--------------|--------|---------|----------|\n`;
  
  sof.outcomes.forEach((o) => {
    const effect = o.effectEstimate 
      ? `${o.effectEstimate.type}: ${o.effectEstimate.value} (${o.effectEstimate.ciLower}-${o.effectEstimate.ciUpper})`
      : "Not reported";
    
    const qualitySymbols: Record<GradeQuality, string> = {
      HIGH: "⊕⊕⊕⊕",
      MODERATE: "⊕⊕⊕◯",
      LOW: "⊕⊕◯◯",
      VERY_LOW: "⊕◯◯◯",
    };
    
    output += `| ${o.outcomeName} | ${o.numberOfStudies} | ${o.totalParticipants || "NR"} | ${effect} | ${qualitySymbols[o.finalGrade]} ${o.finalGrade} | ${o.summary} |\n`;
  });
  
  if (sof.footnotes.length > 0) {
    output += `\n## Footnotes\n\n`;
    sof.footnotes.forEach((f) => {
      output += `${f}\n`;
    });
  }
  
  return output;
}

