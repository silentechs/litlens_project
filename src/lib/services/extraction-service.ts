/**
 * Data Extraction Service
 * Handles extraction templates, validation, and double extraction workflow
 */

import { db } from "@/lib/db";
import { ExtractionStatus, DiscrepancyStatus } from "@prisma/client";

// Types
export interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  description?: string;
  required: boolean;
  validation?: ValidationRule[];
  options?: FieldOption[]; // For select/radio fields
  conditional?: ConditionalLogic;
  defaultValue?: unknown;
  placeholder?: string;
  helpText?: string;
}

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "select"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "range" // numeric range
  | "calculated" // computed from other fields
  | "json" // free-form JSON
  | "email"
  | "url";

export interface FieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface ValidationRule {
  type: ValidationType;
  value?: unknown;
  message: string;
}

export type ValidationType =
  | "required"
  | "min"
  | "max"
  | "minLength"
  | "maxLength"
  | "pattern"
  | "email"
  | "url"
  | "custom";

export interface ConditionalLogic {
  field: string;
  operator: "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan" | "isEmpty" | "isNotEmpty";
  value?: unknown;
}

export interface ValidationError {
  field: string;
  message: string;
  rule: ValidationType;
}

export interface ExtractionComparison {
  fieldName: string;
  fieldLabel: string;
  value1: unknown;
  value2: unknown;
  matches: boolean;
  extractor1: { id: string; name: string | null };
  extractor2: { id: string; name: string | null };
}

// ============== TEMPLATE MANAGEMENT ==============

/**
 * Create an extraction template
 */
export async function createExtractionTemplate(
  projectId: string,
  data: {
    name: string;
    description?: string;
    fields: FieldDefinition[];
  }
): Promise<{ id: string }> {
  // Validate field IDs are unique
  const fieldIds = new Set<string>();
  for (const field of data.fields) {
    if (fieldIds.has(field.id)) {
      throw new Error(`Duplicate field ID: ${field.id}`);
    }
    fieldIds.add(field.id);
  }

  const template = await db.extractionTemplate.create({
    data: {
      projectId,
      name: data.name,
      description: data.description,
      fields: data.fields as unknown as object[],
    },
    select: { id: true },
  });

  return template;
}

/**
 * Update template fields (creates new version)
 */
export async function updateExtractionTemplate(
  templateId: string,
  data: {
    name?: string;
    description?: string;
    fields?: FieldDefinition[];
  }
): Promise<{ id: string; version: number }> {
  const existing = await db.extractionTemplate.findUnique({
    where: { id: templateId },
  });

  if (!existing) {
    throw new Error("Template not found");
  }

  // Check if there's extraction data using this template
  const hasExtractions = await db.extractionData.count({
    where: { templateId },
  });

  // If there are extractions, increment version
  const newVersion = hasExtractions > 0 ? existing.version + 1 : existing.version;

  const updated = await db.extractionTemplate.update({
    where: { id: templateId },
    data: {
      name: data.name,
      description: data.description,
      fields: data.fields ? (data.fields as unknown as object[]) : undefined,
      version: newVersion,
    },
    select: { id: true, version: true },
  });

  return updated;
}

/**
 * Get template with field definitions
 */
export async function getExtractionTemplate(templateId: string) {
  const template = await db.extractionTemplate.findUnique({
    where: { id: templateId },
    include: {
      project: {
        select: { id: true, title: true },
      },
    },
  });

  if (!template) {
    return null;
  }

  return {
    ...template,
    fields: template.fields as unknown as FieldDefinition[],
  };
}

// ============== DATA VALIDATION ==============

/**
 * Validate extraction data against template fields
 */
export function validateExtractionData(
  fields: FieldDefinition[],
  data: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of fields) {
    const value = data[field.id];

    // Check required
    if (field.required && (value === undefined || value === null || value === "")) {
      errors.push({
        field: field.id,
        message: field.validation?.find((v) => v.type === "required")?.message || `${field.label} is required`,
        rule: "required",
      });
      continue;
    }

    // Skip validation if value is empty and not required
    if (value === undefined || value === null || value === "") {
      continue;
    }

    // Type-specific validation
    switch (field.type) {
      case "number":
      case "integer":
        if (typeof value !== "number" || (field.type === "integer" && !Number.isInteger(value))) {
          errors.push({
            field: field.id,
            message: `${field.label} must be a ${field.type === "integer" ? "whole " : ""}number`,
            rule: "custom",
          });
        }
        break;

      case "email":
        if (typeof value !== "string" || !value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          errors.push({
            field: field.id,
            message: `${field.label} must be a valid email address`,
            rule: "email",
          });
        }
        break;

      case "date":
        if (typeof value !== "string" || isNaN(Date.parse(value))) {
          errors.push({
            field: field.id,
            message: `${field.label} must be a valid date`,
            rule: "custom",
          });
        }
        break;

      case "boolean":
        if (typeof value !== "boolean") {
          errors.push({
            field: field.id,
            message: `${field.label} must be true or false`,
            rule: "custom",
          });
        }
        break;

      case "select":
      case "radio":
        if (field.options && !field.options.some((opt) => opt.value === value)) {
          errors.push({
            field: field.id,
            message: `${field.label} has an invalid option`,
            rule: "custom",
          });
        }
        break;

      case "multiselect":
      case "checkbox":
        if (!Array.isArray(value)) {
          errors.push({
            field: field.id,
            message: `${field.label} must be an array`,
            rule: "custom",
          });
        } else if (field.options) {
          const validValues = field.options.map((opt) => opt.value);
          if (!value.every((v) => validValues.includes(v as string))) {
            errors.push({
              field: field.id,
              message: `${field.label} has invalid options`,
              rule: "custom",
            });
          }
        }
        break;
    }

    // Custom validation rules
    if (field.validation) {
      for (const rule of field.validation) {
        switch (rule.type) {
          case "min":
            if (typeof value === "number" && value < (rule.value as number)) {
              errors.push({ field: field.id, message: rule.message, rule: "min" });
            }
            break;

          case "max":
            if (typeof value === "number" && value > (rule.value as number)) {
              errors.push({ field: field.id, message: rule.message, rule: "max" });
            }
            break;

          case "minLength":
            if (typeof value === "string" && value.length < (rule.value as number)) {
              errors.push({ field: field.id, message: rule.message, rule: "minLength" });
            }
            break;

          case "maxLength":
            if (typeof value === "string" && value.length > (rule.value as number)) {
              errors.push({ field: field.id, message: rule.message, rule: "maxLength" });
            }
            break;

          case "pattern":
            if (typeof value === "string" && !new RegExp(rule.value as string).test(value)) {
              errors.push({ field: field.id, message: rule.message, rule: "pattern" });
            }
            break;
        }
      }
    }
  }

  return errors;
}

// ============== EXTRACTION DATA ==============

/**
 * Save or update extraction data
 */
export async function saveExtractionData(
  projectId: string,
  projectWorkId: string,
  templateId: string,
  extractorId: string,
  data: Record<string, unknown>,
  options: { validate?: boolean; complete?: boolean } = {}
): Promise<{ id: string; isValid: boolean; errors: ValidationError[] }> {
  const { validate = true, complete = false } = options;

  let validationErrors: ValidationError[] = [];

  if (validate) {
    const template = await getExtractionTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }
    validationErrors = validateExtractionData(template.fields, data);
  }

  const isValid = validationErrors.length === 0;
  const status = complete
    ? isValid
      ? ExtractionStatus.COMPLETED
      : ExtractionStatus.NEEDS_REVIEW
    : ExtractionStatus.IN_PROGRESS;

  // Upsert extraction data
  const extraction = await db.extractionData.upsert({
    where: {
      projectWorkId_templateId_extractorId: {
        projectWorkId,
        templateId,
        extractorId,
      },
    },
    create: {
      projectId,
      projectWorkId,
      templateId,
      extractorId,
      data: data as object,
      status,
      isValid,
      validationErrors: validationErrors.length > 0 ? (validationErrors as unknown as object) : undefined,
    },
    update: {
      data: data as object,
      status,
      isValid,
      validationErrors: validationErrors.length > 0 ? (validationErrors as unknown as object) : undefined,
    },
    select: { id: true },
  });

  // Check for double extraction and create discrepancies if needed
  if (complete) {
    await checkAndCreateDiscrepancies(projectWorkId, templateId);
  }

  return { id: extraction.id, isValid, errors: validationErrors };
}

/**
 * Get extraction data for a study
 */
export async function getExtractionData(projectWorkId: string, templateId?: string) {
  const where: { projectWorkId: string; templateId?: string } = { projectWorkId };
  if (templateId) {
    where.templateId = templateId;
  }

  const extractions = await db.extractionData.findMany({
    where,
    include: {
      template: {
        select: {
          id: true,
          name: true,
          fields: true,
        },
      },
      extractor: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      discrepancies: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return extractions.map((e) => ({
    ...e,
    template: {
      ...e.template,
      fields: e.template.fields as unknown as FieldDefinition[],
    },
  }));
}

// ============== DOUBLE EXTRACTION ==============

/**
 * Check for discrepancies between two extractors
 */
export async function checkAndCreateDiscrepancies(
  projectWorkId: string,
  templateId: string
): Promise<number> {
  // Get completed extractions for this study/template
  const extractions = await db.extractionData.findMany({
    where: {
      projectWorkId,
      templateId,
      status: ExtractionStatus.COMPLETED,
    },
    orderBy: { createdAt: "asc" },
    take: 2,
  });

  if (extractions.length < 2) {
    return 0; // Need at least 2 extractions to compare
  }

  const [extraction1, extraction2] = extractions;
  const data1 = extraction1.data as Record<string, unknown>;
  const data2 = extraction2.data as Record<string, unknown>;

  // Get template fields
  const template = await getExtractionTemplate(templateId);
  if (!template) {
    return 0;
  }

  // Compare each field
  let discrepanciesCreated = 0;
  const fields = template.fields as FieldDefinition[];

  for (const field of fields) {
    const value1 = data1[field.id];
    const value2 = data2[field.id];

    if (!valuesMatch(value1, value2)) {
      // Check if discrepancy already exists
      const existing = await db.extractionDiscrepancy.findFirst({
        where: {
          extractionId: extraction1.id,
          fieldName: field.id,
        },
      });

      if (!existing) {
        await db.extractionDiscrepancy.create({
          data: {
            extractionId: extraction1.id,
            fieldName: field.id,
            value1: JSON.stringify(value1),
            value2: JSON.stringify(value2),
            status: DiscrepancyStatus.PENDING,
          },
        });
        discrepanciesCreated++;
      }
    }
  }

  // Update extraction status if discrepancies found
  if (discrepanciesCreated > 0) {
    await db.extractionData.updateMany({
      where: {
        id: { in: [extraction1.id, extraction2.id] },
      },
      data: { status: ExtractionStatus.NEEDS_REVIEW },
    });
  }

  return discrepanciesCreated;
}

/**
 * Compare two extractions
 */
export async function compareExtractions(
  projectWorkId: string,
  templateId: string
): Promise<ExtractionComparison[]> {
  const extractions = await db.extractionData.findMany({
    where: {
      projectWorkId,
      templateId,
    },
    include: {
      extractor: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 2,
  });

  if (extractions.length < 2) {
    return [];
  }

  const [extraction1, extraction2] = extractions;
  const data1 = extraction1.data as Record<string, unknown>;
  const data2 = extraction2.data as Record<string, unknown>;

  const template = await getExtractionTemplate(templateId);
  if (!template) {
    return [];
  }

  const comparisons: ExtractionComparison[] = [];

  for (const field of template.fields) {
    const value1 = data1[field.id];
    const value2 = data2[field.id];

    comparisons.push({
      fieldName: field.id,
      fieldLabel: field.label,
      value1,
      value2,
      matches: valuesMatch(value1, value2),
      extractor1: extraction1.extractor,
      extractor2: extraction2.extractor,
    });
  }

  return comparisons;
}

/**
 * Resolve a discrepancy
 */
export async function resolveDiscrepancy(
  discrepancyId: string,
  resolverId: string,
  resolvedValue: unknown,
  applyToExtraction: boolean = true
): Promise<void> {
  const discrepancy = await db.extractionDiscrepancy.findUnique({
    where: { id: discrepancyId },
    include: {
      extraction: {
        include: {
          template: true,
        },
      },
    },
  });

  if (!discrepancy) {
    throw new Error("Discrepancy not found");
  }

  await db.$transaction(async (tx) => {
    // Update discrepancy
    await tx.extractionDiscrepancy.update({
      where: { id: discrepancyId },
      data: {
        status: DiscrepancyStatus.RESOLVED,
        resolvedValue: JSON.stringify(resolvedValue),
        resolvedBy: resolverId,
        resolvedAt: new Date(),
      },
    });

    // Apply resolved value to all extractions if requested
    if (applyToExtraction) {
      const extractions = await tx.extractionData.findMany({
        where: {
          projectWorkId: discrepancy.extraction.projectWorkId,
          templateId: discrepancy.extraction.templateId,
        },
      });

      for (const extraction of extractions) {
        const data = extraction.data as Record<string, unknown>;
        data[discrepancy.fieldName] = resolvedValue;

        await tx.extractionData.update({
          where: { id: extraction.id },
          data: { data: data as object },
        });
      }
    }

    // Check if all discrepancies are resolved
    const pendingDiscrepancies = await tx.extractionDiscrepancy.count({
      where: {
        extractionId: discrepancy.extractionId,
        status: DiscrepancyStatus.PENDING,
      },
    });

    if (pendingDiscrepancies === 0) {
      // Update extraction status to VERIFIED
      await tx.extractionData.update({
        where: { id: discrepancy.extractionId },
        data: { status: ExtractionStatus.VERIFIED },
      });
    }
  });
}

/**
 * Get extraction progress for a project
 */
export async function getExtractionProgress(projectId: string) {
  const [total, inProgress, completed, needsReview, verified] = await Promise.all([
    db.projectWork.count({
      where: { projectId, status: "INCLUDED" },
    }),
    db.extractionData.groupBy({
      by: ["projectWorkId"],
      where: { projectId, status: ExtractionStatus.IN_PROGRESS },
    }),
    db.extractionData.groupBy({
      by: ["projectWorkId"],
      where: { projectId, status: ExtractionStatus.COMPLETED },
    }),
    db.extractionData.groupBy({
      by: ["projectWorkId"],
      where: { projectId, status: ExtractionStatus.NEEDS_REVIEW },
    }),
    db.extractionData.groupBy({
      by: ["projectWorkId"],
      where: { projectId, status: ExtractionStatus.VERIFIED },
    }),
  ]);

  const pendingDiscrepancies = await db.extractionDiscrepancy.count({
    where: {
      extraction: { projectId },
      status: DiscrepancyStatus.PENDING,
    },
  });

  return {
    totalStudies: total,
    inProgress: inProgress.length,
    completed: completed.length,
    needsReview: needsReview.length,
    verified: verified.length,
    notStarted: total - inProgress.length - completed.length - needsReview.length - verified.length,
    pendingDiscrepancies,
    percentComplete: total > 0 ? (verified.length / total) * 100 : 0,
  };
}

// ============== HELPERS ==============

function valuesMatch(value1: unknown, value2: unknown): boolean {
  // Handle null/undefined
  if (value1 === null || value1 === undefined) {
    return value2 === null || value2 === undefined;
  }
  if (value2 === null || value2 === undefined) {
    return false;
  }

  // Compare arrays
  if (Array.isArray(value1) && Array.isArray(value2)) {
    if (value1.length !== value2.length) return false;
    return value1.every((v, i) => valuesMatch(v, value2[i]));
  }

  // Compare objects
  if (typeof value1 === "object" && typeof value2 === "object") {
    const keys1 = Object.keys(value1 as object);
    const keys2 = Object.keys(value2 as object);
    if (keys1.length !== keys2.length) return false;
    return keys1.every((key) =>
      valuesMatch((value1 as Record<string, unknown>)[key], (value2 as Record<string, unknown>)[key])
    );
  }

  // Primitive comparison
  return value1 === value2;
}

