/**
 * Quality Assessment Service
 * Handles risk of bias assessment using standard tools (RoB 2.0, ROBINS-I, Newcastle-Ottawa, GRADE)
 */

import { db } from "@/lib/db";
import { AssessmentStatus, QualityToolType } from "@prisma/client";

// ============== TYPES ==============

export interface DomainDefinition {
  id: string;
  name: string;
  description: string;
  questions: DomainQuestion[];
  scoringOptions: ScoringOption[];
}

export interface DomainQuestion {
  id: string;
  text: string;
  helpText?: string;
  signallingQuestions?: string[];
}

export interface ScoringOption {
  value: string;
  label: string;
  color: string; // For visualization
  weight?: number;
}

export interface DomainScore {
  score: string;
  justification: string;
  answers?: Record<string, string>; // questionId -> answer
}

export interface AssessmentResult {
  id: string;
  studyTitle: string;
  tool: {
    id: string;
    name: string;
    type: QualityToolType;
  };
  assessor: {
    id: string;
    name: string | null;
  };
  domainScores: Record<string, DomainScore>;
  overallScore: string | null;
  overallJustification: string | null;
  status: AssessmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ============== STANDARD TOOL TEMPLATES ==============

/**
 * RoB 2.0 (Risk of Bias 2.0) for randomized trials
 */
export const ROB2_TEMPLATE: DomainDefinition[] = [
  {
    id: "randomization",
    name: "Bias arising from the randomization process",
    description: "Assessment of the randomization process and allocation concealment",
    questions: [
      { id: "1.1", text: "Was the allocation sequence random?" },
      { id: "1.2", text: "Was the allocation sequence concealed until participants were enrolled and assigned to interventions?" },
      { id: "1.3", text: "Did baseline differences between intervention groups suggest a problem with the randomization process?" },
    ],
    scoringOptions: [
      { value: "LOW", label: "Low risk", color: "#22c55e" },
      { value: "SOME_CONCERNS", label: "Some concerns", color: "#eab308" },
      { value: "HIGH", label: "High risk", color: "#ef4444" },
    ],
  },
  {
    id: "deviations",
    name: "Bias due to deviations from intended interventions",
    description: "Assessment of deviations from the intended intervention",
    questions: [
      { id: "2.1", text: "Were participants aware of their assigned intervention during the trial?" },
      { id: "2.2", text: "Were carers and people delivering the interventions aware of participants' assigned intervention?" },
      { id: "2.3", text: "Were there deviations from the intended intervention that arose because of the trial context?" },
      { id: "2.4", text: "Were these deviations likely to have affected the outcome?" },
      { id: "2.5", text: "Was an appropriate analysis used to estimate the effect of assignment to intervention?" },
    ],
    scoringOptions: [
      { value: "LOW", label: "Low risk", color: "#22c55e" },
      { value: "SOME_CONCERNS", label: "Some concerns", color: "#eab308" },
      { value: "HIGH", label: "High risk", color: "#ef4444" },
    ],
  },
  {
    id: "missing_data",
    name: "Bias due to missing outcome data",
    description: "Assessment of completeness of outcome data",
    questions: [
      { id: "3.1", text: "Were data for this outcome available for all, or nearly all, participants randomized?" },
      { id: "3.2", text: "Is there evidence that the result was not biased by missing outcome data?" },
      { id: "3.3", text: "Could missingness in the outcome depend on its true value?" },
      { id: "3.4", text: "Is it likely that missingness in the outcome depended on its true value?" },
    ],
    scoringOptions: [
      { value: "LOW", label: "Low risk", color: "#22c55e" },
      { value: "SOME_CONCERNS", label: "Some concerns", color: "#eab308" },
      { value: "HIGH", label: "High risk", color: "#ef4444" },
    ],
  },
  {
    id: "measurement",
    name: "Bias in measurement of the outcome",
    description: "Assessment of outcome measurement methods",
    questions: [
      { id: "4.1", text: "Was the method of measuring the outcome inappropriate?" },
      { id: "4.2", text: "Could measurement or ascertainment of the outcome have differed between intervention groups?" },
      { id: "4.3", text: "Were outcome assessors aware of the intervention received by study participants?" },
      { id: "4.4", text: "Could assessment of the outcome have been influenced by knowledge of intervention received?" },
      { id: "4.5", text: "Is it likely that assessment of the outcome was influenced by knowledge of intervention received?" },
    ],
    scoringOptions: [
      { value: "LOW", label: "Low risk", color: "#22c55e" },
      { value: "SOME_CONCERNS", label: "Some concerns", color: "#eab308" },
      { value: "HIGH", label: "High risk", color: "#ef4444" },
    ],
  },
  {
    id: "selection",
    name: "Bias in selection of the reported result",
    description: "Assessment of selective reporting",
    questions: [
      { id: "5.1", text: "Were the data that produced this result analysed in accordance with a pre-specified analysis plan?" },
      { id: "5.2", text: "Is the numerical result being assessed likely to have been selected from multiple outcome measurements?" },
      { id: "5.3", text: "Is the numerical result being assessed likely to have been selected from multiple analyses?" },
    ],
    scoringOptions: [
      { value: "LOW", label: "Low risk", color: "#22c55e" },
      { value: "SOME_CONCERNS", label: "Some concerns", color: "#eab308" },
      { value: "HIGH", label: "High risk", color: "#ef4444" },
    ],
  },
];

/**
 * ROBINS-I for non-randomized studies
 */
export const ROBINS_I_TEMPLATE: DomainDefinition[] = [
  {
    id: "confounding",
    name: "Bias due to confounding",
    description: "Baseline confounding and time-varying confounding",
    questions: [
      { id: "1.1", text: "Is there potential for confounding of the effect of intervention in this study?" },
      { id: "1.2", text: "Was the analysis based on splitting participants' follow up time according to intervention received?" },
      { id: "1.3", text: "Were intervention discontinuations or switches likely to be related to factors that are prognostic for the outcome?" },
    ],
    scoringOptions: [
      { value: "LOW", label: "Low risk", color: "#22c55e" },
      { value: "MODERATE", label: "Moderate risk", color: "#eab308" },
      { value: "SERIOUS", label: "Serious risk", color: "#f97316" },
      { value: "CRITICAL", label: "Critical risk", color: "#ef4444" },
      { value: "NI", label: "No information", color: "#6b7280" },
    ],
  },
  {
    id: "selection_participants",
    name: "Bias in selection of participants",
    description: "Selection of participants into the study or into the analysis",
    questions: [
      { id: "2.1", text: "Was selection of participants into the study (or into the analysis) based on participant characteristics observed after the start of intervention?" },
      { id: "2.2", text: "Do start of follow-up and start of intervention coincide for most participants?" },
    ],
    scoringOptions: [
      { value: "LOW", label: "Low risk", color: "#22c55e" },
      { value: "MODERATE", label: "Moderate risk", color: "#eab308" },
      { value: "SERIOUS", label: "Serious risk", color: "#f97316" },
      { value: "CRITICAL", label: "Critical risk", color: "#ef4444" },
      { value: "NI", label: "No information", color: "#6b7280" },
    ],
  },
  {
    id: "classification",
    name: "Bias in classification of interventions",
    description: "Classification of intervention status",
    questions: [
      { id: "3.1", text: "Were intervention groups clearly defined?" },
      { id: "3.2", text: "Was the information used to define intervention groups recorded at the start of the intervention?" },
      { id: "3.3", text: "Could classification of intervention status have been affected by knowledge of the outcome or risk of the outcome?" },
    ],
    scoringOptions: [
      { value: "LOW", label: "Low risk", color: "#22c55e" },
      { value: "MODERATE", label: "Moderate risk", color: "#eab308" },
      { value: "SERIOUS", label: "Serious risk", color: "#f97316" },
      { value: "CRITICAL", label: "Critical risk", color: "#ef4444" },
      { value: "NI", label: "No information", color: "#6b7280" },
    ],
  },
  {
    id: "deviations_intended",
    name: "Bias due to deviations from intended interventions",
    description: "Deviations from the intended intervention",
    questions: [
      { id: "4.1", text: "Were there deviations from the intended intervention beyond what would be expected in usual practice?" },
      { id: "4.2", text: "Were these deviations from intended intervention unbalanced between groups and likely to have affected the outcome?" },
    ],
    scoringOptions: [
      { value: "LOW", label: "Low risk", color: "#22c55e" },
      { value: "MODERATE", label: "Moderate risk", color: "#eab308" },
      { value: "SERIOUS", label: "Serious risk", color: "#f97316" },
      { value: "CRITICAL", label: "Critical risk", color: "#ef4444" },
      { value: "NI", label: "No information", color: "#6b7280" },
    ],
  },
  {
    id: "missing_data",
    name: "Bias due to missing data",
    description: "Missing outcome data and other missing data",
    questions: [
      { id: "5.1", text: "Were outcome data available for all, or nearly all, participants?" },
      { id: "5.2", text: "Were participants excluded due to missing data on intervention status?" },
      { id: "5.3", text: "Were participants excluded due to missing data on other variables needed for the analysis?" },
    ],
    scoringOptions: [
      { value: "LOW", label: "Low risk", color: "#22c55e" },
      { value: "MODERATE", label: "Moderate risk", color: "#eab308" },
      { value: "SERIOUS", label: "Serious risk", color: "#f97316" },
      { value: "CRITICAL", label: "Critical risk", color: "#ef4444" },
      { value: "NI", label: "No information", color: "#6b7280" },
    ],
  },
  {
    id: "measurement_outcomes",
    name: "Bias in measurement of outcomes",
    description: "Measurement of the outcome",
    questions: [
      { id: "6.1", text: "Could the outcome measure have been influenced by knowledge of the intervention received?" },
      { id: "6.2", text: "Were outcome assessors aware of the intervention received by study participants?" },
      { id: "6.3", text: "Were the methods of outcome assessment comparable across intervention groups?" },
    ],
    scoringOptions: [
      { value: "LOW", label: "Low risk", color: "#22c55e" },
      { value: "MODERATE", label: "Moderate risk", color: "#eab308" },
      { value: "SERIOUS", label: "Serious risk", color: "#f97316" },
      { value: "CRITICAL", label: "Critical risk", color: "#ef4444" },
      { value: "NI", label: "No information", color: "#6b7280" },
    ],
  },
  {
    id: "selection_reported",
    name: "Bias in selection of the reported result",
    description: "Selection of the reported result",
    questions: [
      { id: "7.1", text: "Is the reported effect estimate likely to be selected, on the basis of the results, from multiple outcome measurements?" },
      { id: "7.2", text: "Is the reported effect estimate likely to be selected, on the basis of the results, from multiple analyses of the intervention-outcome relationship?" },
    ],
    scoringOptions: [
      { value: "LOW", label: "Low risk", color: "#22c55e" },
      { value: "MODERATE", label: "Moderate risk", color: "#eab308" },
      { value: "SERIOUS", label: "Serious risk", color: "#f97316" },
      { value: "CRITICAL", label: "Critical risk", color: "#ef4444" },
      { value: "NI", label: "No information", color: "#6b7280" },
    ],
  },
];

/**
 * Newcastle-Ottawa Scale for cohort studies
 */
export const NEWCASTLE_OTTAWA_COHORT_TEMPLATE: DomainDefinition[] = [
  {
    id: "selection",
    name: "Selection",
    description: "Selection of study groups",
    questions: [
      { id: "S1", text: "Representativeness of the exposed cohort" },
      { id: "S2", text: "Selection of the non-exposed cohort" },
      { id: "S3", text: "Ascertainment of exposure" },
      { id: "S4", text: "Demonstration that outcome of interest was not present at start of study" },
    ],
    scoringOptions: [
      { value: "STAR", label: "★", color: "#22c55e" },
      { value: "NO_STAR", label: "No star", color: "#6b7280" },
    ],
  },
  {
    id: "comparability",
    name: "Comparability",
    description: "Comparability of cohorts on the basis of design or analysis",
    questions: [
      { id: "C1", text: "Comparability of cohorts (Study controls for most important factor)" },
      { id: "C2", text: "Comparability of cohorts (Study controls for any additional factor)" },
    ],
    scoringOptions: [
      { value: "STAR", label: "★", color: "#22c55e" },
      { value: "NO_STAR", label: "No star", color: "#6b7280" },
    ],
  },
  {
    id: "outcome",
    name: "Outcome",
    description: "Assessment of outcome",
    questions: [
      { id: "O1", text: "Assessment of outcome" },
      { id: "O2", text: "Was follow-up long enough for outcomes to occur?" },
      { id: "O3", text: "Adequacy of follow-up of cohorts" },
    ],
    scoringOptions: [
      { value: "STAR", label: "★", color: "#22c55e" },
      { value: "NO_STAR", label: "No star", color: "#6b7280" },
    ],
  },
];

// ============== TOOL MANAGEMENT ==============

/**
 * Create a quality assessment tool for a project
 */
export async function createAssessmentTool(
  projectId: string,
  data: {
    name: string;
    type: QualityToolType;
    domains?: DomainDefinition[];
  }
): Promise<{ id: string }> {
  // Use standard template if no custom domains provided
  let domains = data.domains;
  if (!domains) {
    switch (data.type) {
      case QualityToolType.ROB2:
        domains = ROB2_TEMPLATE;
        break;
      case QualityToolType.ROBINS_I:
        domains = ROBINS_I_TEMPLATE;
        break;
      case QualityToolType.NEWCASTLE_OTTAWA:
        domains = NEWCASTLE_OTTAWA_COHORT_TEMPLATE;
        break;
      default:
        domains = [];
    }
  }

  const tool = await db.qualityAssessmentTool.create({
    data: {
      projectId,
      name: data.name,
      type: data.type,
      domains: domains as unknown as object[],
    },
    select: { id: true },
  });

  return tool;
}

/**
 * Get tool with domain definitions
 */
export async function getAssessmentTool(toolId: string) {
  const tool = await db.qualityAssessmentTool.findUnique({
    where: { id: toolId },
  });

  if (!tool) {
    return null;
  }

  return {
    ...tool,
    domains: tool.domains as unknown as DomainDefinition[],
  };
}

/**
 * Get all tools for a project
 */
export async function getProjectTools(projectId: string, activeOnly = true) {
  const tools = await db.qualityAssessmentTool.findMany({
    where: {
      projectId,
      ...(activeOnly ? { isActive: true } : {}),
    },
    include: {
      _count: {
        select: { assessments: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return tools.map((t) => ({
    ...t,
    domains: t.domains as unknown as DomainDefinition[],
    assessmentCount: t._count.assessments,
  }));
}

// ============== ASSESSMENT MANAGEMENT ==============

/**
 * Save or update quality assessment
 */
export async function saveAssessment(
  projectId: string,
  projectWorkId: string,
  toolId: string,
  assessorId: string,
  data: {
    domainScores: Record<string, DomainScore>;
    overallScore?: string;
    overallJustification?: string;
    complete?: boolean;
  }
): Promise<{ id: string }> {
  const status = data.complete ? AssessmentStatus.COMPLETED : AssessmentStatus.IN_PROGRESS;

  const assessment = await db.qualityAssessment.upsert({
    where: {
      projectWorkId_toolId_assessorId: {
        projectWorkId,
        toolId,
        assessorId,
      },
    },
    create: {
      projectId,
      projectWorkId,
      toolId,
      assessorId,
      domainScores: data.domainScores as unknown as object,
      overallScore: data.overallScore,
      overallJustification: data.overallJustification,
      status,
    },
    update: {
      domainScores: data.domainScores as unknown as object,
      overallScore: data.overallScore,
      overallJustification: data.overallJustification,
      status,
    },
    select: { id: true },
  });

  return assessment;
}

/**
 * Get assessment for a study
 */
export async function getAssessment(
  projectWorkId: string,
  toolId: string,
  assessorId?: string
): Promise<AssessmentResult[]> {
  const where: Record<string, unknown> = {
    projectWorkId,
    toolId,
  };

  if (assessorId) {
    where.assessorId = assessorId;
  }

  const assessments = await db.qualityAssessment.findMany({
    where,
    include: {
      tool: {
        select: { id: true, name: true, type: true },
      },
      assessor: {
        select: { id: true, name: true },
      },
      projectWork: {
        include: {
          work: {
            select: { title: true },
          },
        },
      },
    },
  });

  return assessments.map((a) => ({
    id: a.id,
    studyTitle: a.projectWork.work.title,
    tool: a.tool,
    assessor: a.assessor,
    domainScores: a.domainScores as unknown as Record<string, DomainScore>,
    overallScore: a.overallScore,
    overallJustification: a.overallJustification,
    status: a.status,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }));
}

/**
 * Calculate overall risk of bias score based on domain scores
 */
export function calculateOverallScore(
  domains: DomainDefinition[],
  domainScores: Record<string, DomainScore>
): string {
  const scores = Object.values(domainScores).map((d) => d.score);

  // RoB 2.0 / ROBINS-I logic
  if (scores.includes("CRITICAL")) {
    return "CRITICAL";
  }
  if (scores.includes("HIGH") || scores.includes("SERIOUS")) {
    return "HIGH";
  }
  if (scores.filter((s) => s === "SOME_CONCERNS" || s === "MODERATE").length >= 3) {
    return "HIGH";
  }
  if (scores.includes("SOME_CONCERNS") || scores.includes("MODERATE")) {
    return "SOME_CONCERNS";
  }
  if (scores.every((s) => s === "LOW")) {
    return "LOW";
  }

  return "SOME_CONCERNS";
}

/**
 * Get assessment summary for a project
 */
export async function getProjectAssessmentSummary(projectId: string) {
  const tools = await db.qualityAssessmentTool.findMany({
    where: { projectId, isActive: true },
    select: { id: true, name: true, type: true },
  });

  const summaries = await Promise.all(
    tools.map(async (tool) => {
      const assessments = await db.qualityAssessment.findMany({
        where: { projectId, toolId: tool.id },
        select: {
          overallScore: true,
          status: true,
        },
      });

      const scoreCounts: Record<string, number> = {};
      let completed = 0;
      let inProgress = 0;

      assessments.forEach((a) => {
        if (a.status === AssessmentStatus.COMPLETED) {
          completed++;
          if (a.overallScore) {
            scoreCounts[a.overallScore] = (scoreCounts[a.overallScore] || 0) + 1;
          }
        } else {
          inProgress++;
        }
      });

      return {
        tool,
        total: assessments.length,
        completed,
        inProgress,
        scoreCounts,
      };
    })
  );

  return summaries;
}

/**
 * Get assessment progress by study
 */
export async function getStudyAssessmentProgress(
  projectId: string,
  toolId: string
): Promise<{
  total: number;
  assessed: number;
  pending: number;
  byScore: Record<string, number>;
}> {
  // Get included studies count
  const totalIncluded = await db.projectWork.count({
    where: { projectId, status: "INCLUDED" },
  });

  // Get assessments
  const assessments = await db.qualityAssessment.findMany({
    where: { projectId, toolId, status: AssessmentStatus.COMPLETED },
    select: { projectWorkId: true, overallScore: true },
  });

  // Count unique studies assessed
  const assessedStudies = new Set(assessments.map((a) => a.projectWorkId));

  // Count by score
  const byScore: Record<string, number> = {};
  assessments.forEach((a) => {
    if (a.overallScore) {
      byScore[a.overallScore] = (byScore[a.overallScore] || 0) + 1;
    }
  });

  return {
    total: totalIncluded,
    assessed: assessedStudies.size,
    pending: totalIncluded - assessedStudies.size,
    byScore,
  };
}

// ============== CONSENSUS ==============

/**
 * Check for assessment disagreements and create consensus needed
 */
export async function checkAssessmentConsensus(
  projectWorkId: string,
  toolId: string
): Promise<{
  needsConsensus: boolean;
  disagreements: Array<{
    domain: string;
    scores: Array<{ assessorId: string; score: string }>;
  }>;
}> {
  const assessments = await db.qualityAssessment.findMany({
    where: {
      projectWorkId,
      toolId,
      status: AssessmentStatus.COMPLETED,
    },
    select: {
      assessorId: true,
      domainScores: true,
    },
  });

  if (assessments.length < 2) {
    return { needsConsensus: false, disagreements: [] };
  }

  const disagreements: Array<{
    domain: string;
    scores: Array<{ assessorId: string; score: string }>;
  }> = [];

  // Compare domain scores
  const domains = new Set<string>();
  assessments.forEach((a) => {
    Object.keys(a.domainScores as unknown as Record<string, DomainScore>).forEach((d) => domains.add(d));
  });

  domains.forEach((domain) => {
    const domainScores = assessments.map((a) => ({
      assessorId: a.assessorId,
      score: (a.domainScores as unknown as Record<string, DomainScore>)[domain]?.score || "UNKNOWN",
    }));

    const uniqueScores = new Set(domainScores.map((s) => s.score));
    if (uniqueScores.size > 1) {
      disagreements.push({ domain, scores: domainScores });
    }
  });

  return {
    needsConsensus: disagreements.length > 0,
    disagreements,
  };
}

