/**
 * Extraction Domain Types
 * Data extraction from included studies
 */

import type {
  ExtractionTemplate as PrismaExtractionTemplate,
  ExtractionData as PrismaExtractionData,
  ExtractionStatus,
  DiscrepancyStatus,
} from "@prisma/client";

// Re-export enums
export type { ExtractionStatus, DiscrepancyStatus } from "@prisma/client";

// ============== TEMPLATE TYPES ==============

export interface ExtractionTemplate extends PrismaExtractionTemplate {}

export interface ExtractionTemplateWithFields extends Omit<ExtractionTemplate, "fields"> {
  fields: ExtractionField[];
}

// ============== FIELD DEFINITIONS ==============

export interface ExtractionField {
  id: string;
  name: string;
  label: string;
  type: ExtractionFieldType;
  description?: string;
  required: boolean;
  order: number;
  
  // Type-specific options
  options?: FieldOption[];       // for select, multiselect, radio
  validation?: FieldValidation;
  conditionalDisplay?: ConditionalRule;
  defaultValue?: unknown;
  
  // Grouping
  group?: string;
}

export type ExtractionFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "date"
  | "boolean"
  | "json"
  | "calculated";

export interface FieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  customValidator?: string; // Function name
}

export interface ConditionalRule {
  fieldId: string;
  operator: "equals" | "notEquals" | "contains" | "isEmpty" | "isNotEmpty";
  value?: unknown;
}

// ============== EXTRACTION DATA TYPES ==============

export interface ExtractionData extends PrismaExtractionData {}

export interface ExtractionDataWithRelations extends Omit<ExtractionData, "data" | "validationErrors"> {
  data: Record<string, unknown>;
  validationErrors: ValidationError[] | null;
  template: ExtractionTemplateWithFields;
  extractor: {
    id: string;
    name: string | null;
    image: string | null;
  };
  projectWork: {
    id: string;
    work: {
      id: string;
      title: string;
      authors: { name: string }[];
      year: number | null;
    };
  };
}

export interface ValidationError {
  fieldId: string;
  message: string;
  severity: "error" | "warning";
}

// ============== EXTRACTION QUEUE ==============

export interface ExtractionQueueItem {
  id: string; // ProjectWork ID
  workId: string;
  title: string;
  authors: { name: string }[];
  year: number | null;
  status: ExtractionItemStatus;
  extractors: ExtractorInfo[];
  hasDiscrepancies: boolean;
  discrepancyCount: number;
  lastUpdated: string;
}

export type ExtractionItemStatus =
  | "pending"
  | "in_progress"
  | "needs_review"
  | "completed"
  | "conflict";

export interface ExtractorInfo {
  id: string;
  name: string | null;
  image: string | null;
  status: ExtractionStatus;
  completedAt: string | null;
}

// ============== DISCREPANCY TYPES ==============

export interface ExtractionDiscrepancy {
  id: string;
  extractionId: string;
  fieldName: string;
  fieldLabel: string;
  value1: unknown;
  value2: unknown;
  extractor1: ExtractorInfo;
  extractor2: ExtractorInfo;
  status: DiscrepancyStatus;
  resolvedValue: unknown | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface DiscrepancyResolutionInput {
  resolvedValue: unknown;
}

// ============== INPUT TYPES ==============

export interface CreateExtractionTemplateInput {
  name: string;
  description?: string;
  fields: Omit<ExtractionField, "id">[];
}

export interface UpdateExtractionTemplateInput {
  name?: string;
  description?: string;
  fields?: ExtractionField[];
  isActive?: boolean;
}

export interface SaveExtractionDataInput {
  projectWorkId: string;
  templateId: string;
  data: Record<string, unknown>;
  status?: ExtractionStatus;
}

export interface SubmitExtractionInput {
  projectWorkId: string;
  templateId: string;
  data: Record<string, unknown>;
}

// ============== COMPARISON VIEW ==============

export interface ExtractionComparison {
  projectWorkId: string;
  templateId: string;
  fields: ExtractionField[];
  extractions: {
    extractorId: string;
    extractorName: string | null;
    extractorImage: string | null;
    data: Record<string, unknown>;
    completedAt: string | null;
  }[];
  discrepancies: {
    fieldId: string;
    values: { extractorId: string; value: unknown }[];
    status: DiscrepancyStatus;
    resolvedValue?: unknown;
  }[];
}

// ============== STATS ==============

export interface ExtractionStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  withDiscrepancies: number;
  averageTimeMinutes: number;
  byExtractor: {
    extractorId: string;
    extractorName: string | null;
    completed: number;
    averageTimeMinutes: number;
  }[];
}

// ============== EXPORT ==============

export interface ExtractionExportOptions {
  format: "csv" | "excel" | "json" | "stata" | "spss";
  templateId: string;
  includeMetadata?: boolean;
  onlyCompleted?: boolean;
}

