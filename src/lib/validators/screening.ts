import { z } from "zod";

// ============== ENUMS ==============

export const screeningPhaseSchema = z.enum(["TITLE_ABSTRACT", "FULL_TEXT", "FINAL"]);
export const screeningDecisionSchema = z.enum(["INCLUDE", "EXCLUDE", "MAYBE"]);

// ============== DECISION SCHEMAS ==============

export const submitDecisionSchema = z.object({
  projectWorkId: z.string().cuid(),
  phase: screeningPhaseSchema,
  decision: screeningDecisionSchema,
  reasoning: z.string().max(2000).optional(),
  exclusionReason: z.string().max(500).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  timeSpentMs: z.number().int().positive().optional(),
  followedAi: z.boolean().optional(),
}).refine((data) => {
  if (data.decision === "EXCLUDE" && !data.exclusionReason) {
    return false;
  }
  return true;
}, {
  message: "Exclusion reason is required when excluding a study",
  path: ["exclusionReason"],
});

export const batchDecisionSchema = z.object({
  projectWorkIds: z.array(z.string().cuid()).min(1).max(100),
  phase: screeningPhaseSchema,
  decision: screeningDecisionSchema,
  reasoning: z.string().max(2000).optional(),
});

// ============== CONFLICT RESOLUTION ==============

export const resolveConflictSchema = z.object({
  finalDecision: screeningDecisionSchema,
  reasoning: z.string().max(2000).optional(),
});

// ============== QUEUE FILTERS ==============

export const screeningQueueFiltersSchema = z.object({
  phase: screeningPhaseSchema.optional(),
  status: z.enum(["PENDING", "SCREENING", "CONFLICT", "INCLUDED", "EXCLUDED", "MAYBE"]).optional(),
  search: z.string().max(200).optional(),
  hasAiSuggestion: z.boolean().optional(),
  aiSuggestion: screeningDecisionSchema.optional(),
  sortBy: z.enum(["title", "year", "aiConfidence", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// ============== AI SCREENING ==============

export const aiScreeningRequestSchema = z.object({
  projectWorkIds: z.array(z.string().cuid()).min(1).max(50),
  phase: screeningPhaseSchema,
});

// ============== CALIBRATION ==============

export const createCalibrationRoundSchema = z.object({
  phase: screeningPhaseSchema,
  sampleSize: z.number().int().min(5).max(100).default(20),
  targetAgreement: z.number().min(0.5).max(1.0).default(0.8),
});

export const submitCalibrationDecisionSchema = z.object({
  roundId: z.string().cuid(),
  projectWorkId: z.string().cuid(),
  decision: screeningDecisionSchema,
  reasoning: z.string().max(2000).optional(),
  timeSpentMs: z.number().int().positive().optional(),
});

// ============== TYPE EXPORTS ==============

export type ScreeningPhase = z.infer<typeof screeningPhaseSchema>;
export type ScreeningDecision = z.infer<typeof screeningDecisionSchema>;
export type SubmitDecisionInput = z.infer<typeof submitDecisionSchema>;
export type BatchDecisionInput = z.infer<typeof batchDecisionSchema>;
export type ResolveConflictInput = z.infer<typeof resolveConflictSchema>;
export type ScreeningQueueFilters = z.infer<typeof screeningQueueFiltersSchema>;
export type AIScreeningRequest = z.infer<typeof aiScreeningRequestSchema>;
export type CreateCalibrationRoundInput = z.infer<typeof createCalibrationRoundSchema>;
export type SubmitCalibrationDecisionInput = z.infer<typeof submitCalibrationDecisionSchema>;

