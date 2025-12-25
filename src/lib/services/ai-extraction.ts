/**
 * AI-Assisted Data Extraction Service
 * Uses OpenAI to assist with extracting data from study PDFs/text
 */

import OpenAI from "openai";
import { db } from "@/lib/db";
import { FieldDefinition, FieldType } from "./extraction-service";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types
export interface ExtractionSuggestion {
  fieldId: string;
  suggestedValue: unknown;
  confidence: number;
  reasoning: string;
  sourceQuote?: string;
}

export interface AIExtractionResult {
  suggestions: ExtractionSuggestion[];
  overallConfidence: number;
  processingTime: number;
}

/**
 * Extract data from study text using AI
 */
export async function extractDataWithAI(
  studyText: string,
  fields: FieldDefinition[]
): Promise<AIExtractionResult> {
  const startTime = Date.now();

  const prompt = buildExtractionPrompt(studyText, fields);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert data extractor for systematic reviews. Your task is to extract specific data points from research papers.

Rules:
1. Only extract data that is explicitly stated in the text
2. If data is not found, set value to null
3. Include the exact quote from the text that supports your extraction
4. Provide a confidence score (0-1) for each extraction
5. For numeric fields, extract only the number
6. For dates, use ISO format (YYYY-MM-DD)
7. For categorical fields, only use the provided options

Response format (JSON):
{
  "extractions": [
    {
      "fieldId": "field_name",
      "value": extracted_value_or_null,
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation",
      "sourceQuote": "Exact quote from text or null"
    }
  ]
}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        suggestions: [],
        overallConfidence: 0,
        processingTime: Date.now() - startTime,
      };
    }

    const parsed = JSON.parse(content) as { extractions: ExtractionSuggestion[] };
    const suggestions = parsed.extractions || [];

    // Calculate overall confidence
    const totalConfidence = suggestions.reduce((sum, s) => sum + (s.confidence || 0), 0);
    const overallConfidence = suggestions.length > 0 ? totalConfidence / suggestions.length : 0;

    // Validate and transform suggestions
    const validatedSuggestions = suggestions.map((s) => {
      const field = fields.find((f) => f.id === s.fieldId);
      if (!field) return s;

      return {
        ...s,
        suggestedValue: transformValue(s.suggestedValue, field.type),
        confidence: Math.max(0, Math.min(1, s.confidence || 0)),
      };
    });

    return {
      suggestions: validatedSuggestions,
      overallConfidence,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error("AI extraction error:", error);
    return {
      suggestions: [],
      overallConfidence: 0,
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Extract specific fields from study abstract
 */
export async function extractFromAbstract(
  workId: string,
  fields: FieldDefinition[]
): Promise<AIExtractionResult> {
  const work = await db.work.findUnique({
    where: { id: workId },
    select: {
      title: true,
      abstract: true,
      authors: true,
      year: true,
      journal: true,
    },
  });

  if (!work) {
    throw new Error("Work not found");
  }

  // Build context from study metadata
  const studyText = `
Title: ${work.title}

Abstract: ${work.abstract || "No abstract available"}

Authors: ${(work.authors as Array<{ name: string }>)?.map((a) => a.name).join(", ") || "Unknown"}

Year: ${work.year || "Unknown"}

Journal: ${work.journal || "Unknown"}
`.trim();

  return extractDataWithAI(studyText, fields);
}

/**
 * Extract structured outcome data from text
 */
export async function extractOutcomeData(
  text: string
): Promise<{
  outcomes: Array<{
    name: string;
    type: "primary" | "secondary";
    measurement: string;
    timePoints: string[];
    results?: {
      treatmentGroup?: { n?: number; mean?: number; sd?: number };
      controlGroup?: { n?: number; mean?: number; sd?: number };
      effectSize?: number;
      pValue?: number;
      ci?: { lower: number; upper: number };
    };
  }>;
  confidence: number;
}> {
  const prompt = `Extract all outcome measures from the following study text. For each outcome, identify:
- Name of the outcome
- Whether it's primary or secondary
- How it was measured
- Time points for measurement
- Statistical results if available (sample sizes, means, SDs, effect sizes, p-values, confidence intervals)

Text:
${text}

Respond in JSON format with an "outcomes" array.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting outcome data from clinical research papers. Always provide structured data in the exact format requested.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { outcomes: [], confidence: 0 };
    }

    const parsed = JSON.parse(content);
    return {
      outcomes: parsed.outcomes || [],
      confidence: parsed.confidence || 0.7,
    };
  } catch (error) {
    console.error("Outcome extraction error:", error);
    return { outcomes: [], confidence: 0 };
  }
}

/**
 * Extract population/participant characteristics
 */
export async function extractPopulationData(
  text: string
): Promise<{
  totalParticipants?: number;
  groups: Array<{
    name: string;
    n: number;
    demographics?: {
      age?: { mean?: number; sd?: number; range?: string };
      sexDistribution?: { male?: number; female?: number };
      otherCharacteristics?: Record<string, unknown>;
    };
  }>;
  inclusionCriteria?: string[];
  exclusionCriteria?: string[];
  confidence: number;
}> {
  const prompt = `Extract population/participant characteristics from the following study text:
- Total number of participants
- Study groups (intervention, control, etc.) with sample sizes
- Demographics (age, sex distribution)
- Inclusion and exclusion criteria

Text:
${text}

Respond in JSON format.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting population characteristics from clinical research papers.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { groups: [], confidence: 0 };
    }

    const parsed = JSON.parse(content);
    return {
      totalParticipants: parsed.totalParticipants,
      groups: parsed.groups || [],
      inclusionCriteria: parsed.inclusionCriteria,
      exclusionCriteria: parsed.exclusionCriteria,
      confidence: parsed.confidence || 0.7,
    };
  } catch (error) {
    console.error("Population extraction error:", error);
    return { groups: [], confidence: 0 };
  }
}

/**
 * Generate AI suggestions for a specific extraction field
 */
export async function suggestFieldValue(
  workId: string,
  field: FieldDefinition,
  existingData: Record<string, unknown> = {}
): Promise<ExtractionSuggestion | null> {
  const work = await db.work.findUnique({
    where: { id: workId },
    select: {
      title: true,
      abstract: true,
      keywords: true,
    },
  });

  if (!work) {
    return null;
  }

  const context = `
Title: ${work.title}
Abstract: ${work.abstract || "Not available"}
Keywords: ${(work.keywords as string[])?.join(", ") || "None"}

Previously extracted data: ${JSON.stringify(existingData)}
`.trim();

  const result = await extractDataWithAI(context, [field]);
  return result.suggestions[0] || null;
}

// ============== HELPERS ==============

function buildExtractionPrompt(text: string, fields: FieldDefinition[]): string {
  let prompt = `## Study Text\n\n${text}\n\n## Fields to Extract\n\n`;

  for (const field of fields) {
    prompt += `### ${field.label} (ID: ${field.id})\n`;
    prompt += `Type: ${field.type}\n`;
    
    if (field.description) {
      prompt += `Description: ${field.description}\n`;
    }

    if (field.options) {
      prompt += `Valid options: ${field.options.map((o) => o.value).join(", ")}\n`;
    }

    if (field.validation) {
      const rules = field.validation.map((v) => `${v.type}: ${v.value || v.message}`).join(", ");
      prompt += `Validation: ${rules}\n`;
    }

    prompt += "\n";
  }

  prompt += "\nExtract the data for each field based on the study text.";
  
  return prompt;
}

function transformValue(value: unknown, fieldType: FieldType): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  switch (fieldType) {
    case "number":
    case "integer":
      const num = parseFloat(String(value));
      if (isNaN(num)) return null;
      return fieldType === "integer" ? Math.round(num) : num;

    case "boolean":
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const lower = value.toLowerCase();
        if (["true", "yes", "1"].includes(lower)) return true;
        if (["false", "no", "0"].includes(lower)) return false;
      }
      return null;

    case "date":
      if (value instanceof Date) return value.toISOString().split("T")[0];
      if (typeof value === "string") {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
      }
      return null;

    case "multiselect":
    case "checkbox":
      if (Array.isArray(value)) return value;
      if (typeof value === "string") return value.split(",").map((s) => s.trim());
      return [];

    default:
      return value;
  }
}

