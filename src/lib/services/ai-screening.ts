/**
 * AI-Assisted Screening Service
 * Uses OpenAI to provide screening suggestions based on study characteristics
 */

import OpenAI from "openai";
import { db } from "@/lib/db";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types
export interface ScreeningSuggestion {
  decision: "INCLUDE" | "EXCLUDE" | "MAYBE";
  confidence: number; // 0-1
  reasoning: string;
  keyFactors: string[];
  relevantCriteria: string[];
}

export interface StudyForScreening {
  title: string;
  abstract: string | null;
  authors: Array<{ name: string }>;
  year: number | null;
  journal: string | null;
  keywords: string[];
}

export interface ScreeningCriteria {
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  pico?: {
    population?: string;
    intervention?: string;
    comparison?: string;
    outcome?: string;
  };
  studyTypes?: string[];
  dateRange?: {
    from?: number;
    to?: number;
  };
}

/**
 * Get AI screening suggestion for a single study
 */
export async function getScreeningSuggestion(
  study: StudyForScreening,
  criteria: ScreeningCriteria
): Promise<ScreeningSuggestion> {
  const prompt = buildScreeningPrompt(study, criteria);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert systematic review screener. Your task is to evaluate studies against inclusion/exclusion criteria.
          
Be rigorous and evidence-based. When uncertain, lean towards "MAYBE" to let human reviewers decide.
          
Response format (JSON):
{
  "decision": "INCLUDE" | "EXCLUDE" | "MAYBE",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of your decision",
  "keyFactors": ["Factor 1", "Factor 2"],
  "relevantCriteria": ["Criteria that influenced decision"]
}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature for consistency
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return getDefaultSuggestion();
    }

    const parsed = JSON.parse(content) as ScreeningSuggestion;
    
    // Validate and normalize the response
    return {
      decision: validateDecision(parsed.decision),
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      reasoning: parsed.reasoning || "Unable to determine reasoning",
      keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : [],
      relevantCriteria: Array.isArray(parsed.relevantCriteria) ? parsed.relevantCriteria : [],
    };
  } catch (error) {
    console.error("AI screening error:", error);
    return getDefaultSuggestion();
  }
}

/**
 * Batch AI screening for multiple studies
 */
export async function batchScreeningSuggestions(
  studies: Array<{ id: string; study: StudyForScreening }>,
  criteria: ScreeningCriteria,
  options: { maxConcurrent?: number } = {}
): Promise<Map<string, ScreeningSuggestion>> {
  const { maxConcurrent = 5 } = options;
  const results = new Map<string, ScreeningSuggestion>();
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < studies.length; i += maxConcurrent) {
    const batch = studies.slice(i, i + maxConcurrent);
    
    const batchResults = await Promise.all(
      batch.map(async ({ id, study }) => {
        const suggestion = await getScreeningSuggestion(study, criteria);
        return { id, suggestion };
      })
    );
    
    batchResults.forEach(({ id, suggestion }) => {
      results.set(id, suggestion);
    });
    
    // Small delay between batches to respect rate limits
    if (i + maxConcurrent < studies.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  
  return results;
}

/**
 * Get AI suggestions for a project's pending studies
 */
export async function generateProjectSuggestions(
  projectId: string,
  options: {
    phase?: "TITLE_ABSTRACT" | "FULL_TEXT";
    limit?: number;
  } = {}
): Promise<{ processed: number; cached: number }> {
  const { phase = "TITLE_ABSTRACT", limit = 100 } = options;

  // Get project with its protocol criteria
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      protocol: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Build criteria from protocol content (stored as JSON)
  const protocolContent = (project.protocol?.content || {}) as Record<string, unknown>;
  const criteria: ScreeningCriteria = {
    inclusionCriteria: (protocolContent.inclusionCriteria as string[]) || [],
    exclusionCriteria: (protocolContent.exclusionCriteria as string[]) || [],
    pico: protocolContent.pico as ScreeningCriteria["pico"],
    studyTypes: (protocolContent.studyTypes as string[]) || [],
  };

  // Get pending studies without AI suggestions
  const pendingStudies = await db.projectWork.findMany({
    where: {
      projectId,
      phase,
      status: "PENDING",
      aiSuggestion: null, // Only studies without suggestions
    },
    take: limit,
    include: {
      work: {
        select: {
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

  if (pendingStudies.length === 0) {
    return { processed: 0, cached: 0 };
  }

  // Generate suggestions
  const studiesForScreening = pendingStudies.map((pw) => ({
    id: pw.id,
    study: {
      title: pw.work.title,
      abstract: pw.work.abstract,
      authors: (pw.work.authors as Array<{ name: string }>) || [],
      year: pw.work.year,
      journal: pw.work.journal,
      keywords: (pw.work.keywords as string[]) || [],
    },
  }));

  const suggestions = await batchScreeningSuggestions(studiesForScreening, criteria);

  // Save suggestions to database
  let processed = 0;
  for (const [projectWorkId, suggestion] of suggestions.entries()) {
    await db.projectWork.update({
      where: { id: projectWorkId },
      data: {
        aiSuggestion: suggestion.decision,
        aiConfidence: suggestion.confidence,
        aiReasoning: suggestion.reasoning,
      },
    });
    processed++;
  }

  return { processed, cached: 0 };
}

// ============== HELPERS ==============

function buildScreeningPrompt(
  study: StudyForScreening,
  criteria: ScreeningCriteria
): string {
  let prompt = `## Study to Screen\n\n`;
  prompt += `**Title:** ${study.title}\n\n`;
  
  if (study.abstract) {
    prompt += `**Abstract:** ${study.abstract}\n\n`;
  } else {
    prompt += `**Abstract:** Not available\n\n`;
  }
  
  if (study.authors.length > 0) {
    prompt += `**Authors:** ${study.authors.map((a) => a.name).join(", ")}\n`;
  }
  
  if (study.year) {
    prompt += `**Year:** ${study.year}\n`;
  }
  
  if (study.journal) {
    prompt += `**Journal:** ${study.journal}\n`;
  }
  
  if (study.keywords.length > 0) {
    prompt += `**Keywords:** ${study.keywords.join(", ")}\n`;
  }
  
  prompt += `\n## Screening Criteria\n\n`;
  
  if (criteria.inclusionCriteria.length > 0) {
    prompt += `**Inclusion Criteria:**\n`;
    criteria.inclusionCriteria.forEach((c, i) => {
      prompt += `${i + 1}. ${c}\n`;
    });
    prompt += `\n`;
  }
  
  if (criteria.exclusionCriteria.length > 0) {
    prompt += `**Exclusion Criteria:**\n`;
    criteria.exclusionCriteria.forEach((c, i) => {
      prompt += `${i + 1}. ${c}\n`;
    });
    prompt += `\n`;
  }
  
  if (criteria.pico) {
    prompt += `**PICO Framework:**\n`;
    if (criteria.pico.population) prompt += `- Population: ${criteria.pico.population}\n`;
    if (criteria.pico.intervention) prompt += `- Intervention: ${criteria.pico.intervention}\n`;
    if (criteria.pico.comparison) prompt += `- Comparison: ${criteria.pico.comparison}\n`;
    if (criteria.pico.outcome) prompt += `- Outcome: ${criteria.pico.outcome}\n`;
    prompt += `\n`;
  }
  
  if (criteria.studyTypes && criteria.studyTypes.length > 0) {
    prompt += `**Acceptable Study Types:** ${criteria.studyTypes.join(", ")}\n\n`;
  }
  
  if (criteria.dateRange) {
    if (criteria.dateRange.from) {
      prompt += `**Date Range:** From ${criteria.dateRange.from}`;
      if (criteria.dateRange.to) {
        prompt += ` to ${criteria.dateRange.to}`;
      }
      prompt += `\n`;
    }
  }
  
  prompt += `\n## Task\n\n`;
  prompt += `Based on the title and abstract, evaluate whether this study meets the inclusion criteria for a systematic review. `;
  prompt += `If the abstract is not available, make a decision based on the title only, but lower your confidence accordingly.\n\n`;
  prompt += `Respond with your screening decision in JSON format.`;
  
  return prompt;
}

function validateDecision(decision: unknown): "INCLUDE" | "EXCLUDE" | "MAYBE" {
  const validDecisions = ["INCLUDE", "EXCLUDE", "MAYBE"];
  if (typeof decision === "string" && validDecisions.includes(decision.toUpperCase())) {
    return decision.toUpperCase() as "INCLUDE" | "EXCLUDE" | "MAYBE";
  }
  return "MAYBE";
}

function getDefaultSuggestion(): ScreeningSuggestion {
  return {
    decision: "MAYBE",
    confidence: 0,
    reasoning: "Unable to generate AI suggestion",
    keyFactors: [],
    relevantCriteria: [],
  };
}

