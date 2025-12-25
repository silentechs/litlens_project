import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  handleApiError,
  UnauthorizedError,
  success,
} from "@/lib/api";
import { semanticSearchSchema } from "@/lib/validators";
import type { WorkSearchResult } from "@/types/work";

/**
 * GET /api/search/semantic
 * Semantic similarity search using text embeddings
 * 
 * This endpoint provides vector-based semantic search:
 * - Generates embeddings for the query
 * - Finds semantically similar works using cosine similarity
 * - Returns results ranked by semantic relevance
 * 
 * Note: Full implementation requires OpenAI embeddings API.
 * Current implementation uses keyword-based fallback with semantic scoring.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const searchParams = request.nextUrl.searchParams;

    const params = semanticSearchSchema.parse({
      query: searchParams.get("query"),
      projectId: searchParams.get("projectId") || undefined,
      limit: searchParams.get("limit") || undefined,
      threshold: searchParams.get("threshold") || undefined,
    });

    const { query, projectId, limit, threshold } = params;

    // Get works to search from
    let workIds: string[] = [];

    if (projectId) {
      // Search within project
      const projectWorks = await db.projectWork.findMany({
        where: {
          projectId,
          screeningStatus: "INCLUDED",
        },
        select: { workId: true },
      });
      workIds = projectWorks.map((pw) => pw.workId);
    } else {
      // Search user's library
      const libraryItems = await db.libraryItem.findMany({
        where: { userId: session.user.id },
        select: { workId: true },
      });
      workIds = libraryItems.map((li) => li.workId);
    }

    if (workIds.length === 0) {
      return success({
        items: [],
        total: 0,
        sources: ["semantic"],
        message: projectId
          ? "No included studies in this project to search"
          : "Your library is empty. Add papers to enable semantic search.",
      });
    }

    // Fetch works with their content
    const works = await db.work.findMany({
      where: { id: { in: workIds } },
      include: {
        authors: true,
      },
    });

    // Perform semantic-like search using keyword extraction and matching
    // In production, this would use actual embeddings
    const results = semanticMatch(query, works, limit, threshold);

    return success({
      items: results,
      total: results.length,
      sources: ["semantic"],
      searchMode: "keyword-semantic", // Indicate fallback mode
      note: "Using keyword-based semantic approximation. Full vector search coming soon.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Semantic-like matching using keyword extraction and TF-IDF scoring
 * This is a fallback until proper embeddings are implemented
 */
function semanticMatch(
  query: string,
  works: Array<{
    id: string;
    title: string;
    abstract: string | null;
    year: number | null;
    journal: string | null;
    doi: string | null;
    pmid: string | null;
    url: string | null;
    citationCount: number | null;
    authors: Array<{ name: string; orcid: string | null }>;
  }>,
  limit: number,
  threshold: number
): WorkSearchResult[] {
  // Extract query terms and expand with synonyms
  const queryTerms = extractTerms(query);
  const expandedTerms = expandQueryTerms(queryTerms);

  // Score each work
  const scored = works.map((work) => {
    const workText = `${work.title} ${work.abstract || ""}`.toLowerCase();
    const workTerms = extractTerms(workText);

    // Calculate semantic similarity score
    const score = calculateSemanticScore(expandedTerms, workTerms, workText, query.toLowerCase());

    return { work, score };
  });

  // Filter by threshold and sort by score
  return scored
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ work, score }): WorkSearchResult => ({
      id: work.id,
      title: work.title,
      authors: work.authors.map((a) => ({
        name: a.name,
        orcid: a.orcid || undefined,
      })),
      abstract: work.abstract,
      year: work.year,
      journal: work.journal,
      doi: work.doi,
      pmid: work.pmid,
      url: work.url,
      citationCount: work.citationCount || 0,
      source: "semantic",
      relevanceScore: score,
    }));
}

/**
 * Extract meaningful terms from text
 */
function extractTerms(text: string): Set<string> {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "this",
    "that", "these", "those", "it", "its", "their", "they", "we", "our",
    "you", "your", "i", "my", "me", "he", "she", "him", "her", "his",
    "which", "who", "whom", "what", "when", "where", "why", "how",
    "all", "each", "every", "both", "few", "more", "most", "other",
    "some", "such", "no", "not", "only", "own", "same", "so", "than",
    "too", "very", "just", "also", "now", "here", "there", "then",
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word))
  );
}

/**
 * Expand query terms with common synonyms for research domains
 */
function expandQueryTerms(terms: Set<string>): Set<string> {
  const synonymMap: Record<string, string[]> = {
    // Medical/health
    treatment: ["therapy", "intervention", "medication", "drug"],
    patient: ["participant", "subject", "individual", "person"],
    disease: ["condition", "disorder", "illness", "syndrome"],
    study: ["trial", "research", "investigation", "analysis"],
    effect: ["impact", "outcome", "result", "influence"],
    significant: ["substantial", "notable", "meaningful", "important"],
    increase: ["rise", "elevation", "growth", "improvement"],
    decrease: ["reduction", "decline", "drop", "lowering"],
    
    // Research methodology
    randomized: ["random", "randomised", "rct"],
    systematic: ["comprehensive", "methodical"],
    metaanalysis: ["meta-analysis", "pooled", "aggregate"],
    cohort: ["longitudinal", "prospective", "retrospective"],
    
    // General academic
    analysis: ["examination", "assessment", "evaluation", "review"],
    method: ["approach", "technique", "procedure", "methodology"],
    result: ["finding", "outcome", "conclusion", "evidence"],
  };

  const expanded = new Set(terms);

  for (const term of terms) {
    const synonyms = synonymMap[term];
    if (synonyms) {
      synonyms.forEach((s) => expanded.add(s));
    }
    // Also check if term is a synonym
    for (const [key, values] of Object.entries(synonymMap)) {
      if (values.includes(term)) {
        expanded.add(key);
        values.forEach((v) => expanded.add(v));
      }
    }
  }

  return expanded;
}

/**
 * Calculate semantic similarity score
 */
function calculateSemanticScore(
  queryTerms: Set<string>,
  workTerms: Set<string>,
  workText: string,
  queryText: string
): number {
  // Jaccard-like similarity with term overlap
  const intersection = new Set([...queryTerms].filter((t) => workTerms.has(t)));
  const union = new Set([...queryTerms, ...workTerms]);
  const jaccardScore = intersection.size / union.size;

  // Phrase matching bonus
  let phraseBonus = 0;
  const queryPhrases = queryText.split(/\s+/).filter((w) => w.length > 3);
  for (let i = 0; i < queryPhrases.length - 1; i++) {
    const bigram = `${queryPhrases[i]} ${queryPhrases[i + 1]}`;
    if (workText.includes(bigram)) {
      phraseBonus += 0.1;
    }
  }

  // Title match bonus
  const titleBonus = queryTerms.size > 0 && intersection.size > 0 ? 0.1 : 0;

  // Combine scores
  const finalScore = Math.min(1, jaccardScore * 0.7 + phraseBonus + titleBonus);

  return Math.round(finalScore * 100) / 100;
}

