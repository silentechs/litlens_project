import { z } from "zod";

// ============== ENUMS ==============

export const extractionStatusSchema = z.enum(["IN_PROGRESS", "COMPLETED", "NEEDS_REVIEW", "VERIFIED"]);
export const discrepancyStatusSchema = z.enum(["PENDING", "RESOLVED", "IGNORED"]);

// ============== FIELD TYPE SCHEMAS ==============

export const extractionFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "select",
  "multiselect",
  "radio",
  "checkbox",
  "date",
  "boolean",
  "json",
  "calculated",
]);

export const fieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

export const fieldValidationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  patternMessage: z.string().optional(),
  customValidator: z.string().optional(),
});

export const conditionalRuleSchema = z.object({
  fieldId: z.string(),
  operator: z.enum(["equals", "notEquals", "contains", "isEmpty", "isNotEmpty"]),
  value: z.unknown().optional(),
});

export const extractionFieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: extractionFieldTypeSchema,
  description: z.string().max(500).optional(),
  required: z.boolean().default(false),
  order: z.number().int().min(0),
  options: z.array(fieldOptionSchema).optional(),
  validation: fieldValidationSchema.optional(),
  conditionalDisplay: conditionalRuleSchema.optional(),
  defaultValue: z.unknown().optional(),
  group: z.string().max(100).optional(),
});

// ============== TEMPLATE SCHEMAS ==============

export const createExtractionTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  fields: z.array(extractionFieldSchema.omit({ id: true })).min(1),
});

export const updateExtractionTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  fields: z.array(extractionFieldSchema).optional(),
  isActive: z.boolean().optional(),
});

// ============== EXTRACTION DATA SCHEMAS ==============

export const saveExtractionDataSchema = z.object({
  projectWorkId: z.string().cuid(),
  templateId: z.string().cuid(),
  data: z.record(z.unknown()),
  status: extractionStatusSchema.optional(),
});

export const submitExtractionSchema = z.object({
  projectWorkId: z.string().cuid(),
  templateId: z.string().cuid(),
  data: z.record(z.unknown()),
});

// ============== DISCREPANCY SCHEMAS ==============

export const resolveDiscrepancySchema = z.object({
  resolvedValue: z.unknown(),
});

// ============== FILTER SCHEMAS ==============

export const extractionQueueFiltersSchema = z.object({
  status: z.enum(["pending", "in_progress", "needs_review", "completed", "conflict"]).optional(),
  search: z.string().max(200).optional(),
  hasDiscrepancies: z.boolean().optional(),
  templateId: z.string().cuid().optional(),
  sortBy: z.enum(["title", "updatedAt", "status"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// ============== EXPORT SCHEMAS ==============

export const extractionExportSchema = z.object({
  format: z.enum(["csv", "excel", "json", "stata", "spss"]),
  templateId: z.string().cuid(),
  includeMetadata: z.boolean().default(true),
  onlyCompleted: z.boolean().default(true),
});

// ============== TYPE EXPORTS ==============

export type ExtractionStatus = z.infer<typeof extractionStatusSchema>;
export type DiscrepancyStatus = z.infer<typeof discrepancyStatusSchema>;
export type ExtractionFieldType = z.infer<typeof extractionFieldTypeSchema>;
export type FieldOption = z.infer<typeof fieldOptionSchema>;
export type FieldValidation = z.infer<typeof fieldValidationSchema>;
export type ConditionalRule = z.infer<typeof conditionalRuleSchema>;
export type ExtractionField = z.infer<typeof extractionFieldSchema>;
export type CreateExtractionTemplateInput = z.infer<typeof createExtractionTemplateSchema>;
export type UpdateExtractionTemplateInput = z.infer<typeof updateExtractionTemplateSchema>;
export type SaveExtractionDataInput = z.infer<typeof saveExtractionDataSchema>;
export type SubmitExtractionInput = z.infer<typeof submitExtractionSchema>;
export type ResolveDiscrepancyInput = z.infer<typeof resolveDiscrepancySchema>;
export type ExtractionQueueFilters = z.infer<typeof extractionQueueFiltersSchema>;
export type ExtractionExportOptions = z.infer<typeof extractionExportSchema>;

