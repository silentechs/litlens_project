/**
 * AI Writing Service
 * Provides AI-powered writing assistance using OpenAI
 */

import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types
export interface PaperContext {
  title: string;
  year?: number | null;
  abstract?: string | null;
  authors?: Array<{ name: string }>;
  journal?: string | null;
  doi?: string | null;
}

export interface WritingAssistanceRequest {
  type: "improve" | "expand" | "summarize" | "generate_section";
  content?: string;
  topic?: string;
  papers?: PaperContext[];
  sectionType?: "introduction" | "methodology" | "results" | "discussion" | "conclusion";
}

/**
 * Generate a full literature review based on papers
 */
export async function generateLiteratureReview(
  topic: string,
  papers: PaperContext[]
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  if (papers.length === 0) {
    throw new Error("At least one paper is required to generate a review");
  }

  // Format papers for context
  const context = papers
    .map(
      (p, idx) =>
        `[${idx + 1}] Title: ${p.title}
Year: ${p.year || "Unknown"}
Authors: ${p.authors?.map((a) => a.name).join(", ") || "Unknown"}
Journal: ${p.journal || "Unknown"}
Abstract: ${p.abstract || "Not available"}`
    )
    .join("\n\n");

  const prompt = `You are an academic research assistant writing a systematic literature review.

Topic: ${topic}

Available Papers:
${context}

Write a comprehensive, well-structured literature review that:
1. Synthesizes the key findings across these papers
2. Identifies common themes and methodologies
3. Highlights contradictions or gaps in the research
4. Uses proper academic tone and structure
5. Cites papers using (Author et al., Year) format

Structure your review with:
- Introduction
- Key Themes & Findings
- Methodological Approaches
- Critical Analysis
- Research Gaps
- Conclusion

Write in scholarly prose suitable for publication in an academic journal.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a rigorous academic research assistant specializing in systematic literature reviews. Write in formal academic English with proper citations.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw new Error("Failed to generate literature review");
  }
}

/**
 * Improve or refine existing writing
 */
export async function improveWriting(content: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const prompt = `Improve the following academic text while maintaining its core meaning and citations. Focus on:
- Clarity and flow
- Academic tone
- Conciseness
- Proper grammar and style

Original text:
${content}

Provide the improved version:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an academic writing editor. Improve text while preserving citations and academic rigor.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 2000,
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("AI Improvement Error:", error);
    throw new Error("Failed to improve writing");
  }
}

/**
 * Expand a section with more detail
 */
export async function expandSection(
  content: string,
  papers: PaperContext[] = []
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const paperContext = papers.length > 0
    ? `\n\nAvailable papers for reference:\n${papers.map((p, i) => `[${i + 1}] ${p.title} (${p.authors?.map((a) => a.name).join(", ")}, ${p.year})`).join("\n")}`
    : "";

  const prompt = `Expand the following section of an academic paper with more detail, examples, and analysis:

${content}${paperContext}

Provide an expanded version that:
- Adds more depth and detail
- Includes relevant examples
- Maintains academic rigor
- Preserves existing citations
- Is approximately 2-3 times longer

Expanded version:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an academic writing assistant. Expand text while maintaining scholarly quality.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2500,
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("AI Expansion Error:", error);
    throw new Error("Failed to expand section");
  }
}

/**
 * Summarize text to make it more concise
 */
export async function summarizeText(content: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const prompt = `Summarize the following academic text while preserving key points and citations:

${content}

Provide a concise summary that:
- Captures the main arguments
- Preserves important citations
- Maintains academic tone
- Is approximately 50% of the original length

Summary:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an academic editor. Create concise summaries while preserving scholarly value.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("AI Summarization Error:", error);
    throw new Error("Failed to summarize text");
  }
}

/**
 * Generate a specific section (introduction, methodology, etc.)
 */
export async function generateSection(
  sectionType: "introduction" | "methodology" | "results" | "discussion" | "conclusion",
  topic: string,
  papers: PaperContext[]
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const context = papers
    .map(
      (p, idx) =>
        `[${idx + 1}] ${p.title} (${p.authors?.map((a) => a.name).join(", ")}, ${p.year})`
    )
    .join("\n");

  const sectionInstructions: Record<string, string> = {
    introduction: "Write an introduction that sets the context, states the research question, and outlines the scope of the review.",
    methodology: "Describe the methodology used in the systematic review, including search strategy, inclusion/exclusion criteria, and analysis approach.",
    results: "Present the key findings from the reviewed papers, organized thematically with proper citations.",
    discussion: "Discuss the implications of the findings, compare different perspectives, and analyze the current state of research.",
    conclusion: "Provide a concise conclusion that summarizes key takeaways, identifies gaps, and suggests future research directions.",
  };

  const prompt = `Write the ${sectionType} section for a systematic literature review on: "${topic}"

${sectionInstructions[sectionType]}

Available papers:
${context}

Write in formal academic English with proper structure and citations.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an academic research assistant specializing in systematic reviews. Write the ${sectionType} section with scholarly rigor.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("AI Section Generation Error:", error);
    throw new Error(`Failed to generate ${sectionType} section`);
  }
}

