/**
 * Reranking Service
 * Uses Cohere rerank API for improved retrieval precision
 * Falls back gracefully when Cohere API is not available
 */

import type { RetrievalResult } from "@/domain/chat/types";

interface CohereRerankResult {
  index: number;
  relevance_score: number;
}

interface CohereRerankResponse {
  results: CohereRerankResult[];
}

/**
 * Rerank retrieval results using Cohere
 * Returns results in order of relevance
 */
export async function rerankResults(
  query: string,
  results: RetrievalResult[],
  options: {
    topK?: number;
    model?: string;
  } = {}
): Promise<RetrievalResult[]> {
  const { topK = 5, model = "rerank-english-v3.0" } = options;
  
  // If no Cohere API key, return original results sorted by similarity
  if (!process.env.COHERE_API_KEY) {
    console.warn("[Rerank] No COHERE_API_KEY, using similarity-based ranking");
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  if (results.length === 0) return [];
  if (results.length === 1) return results;

  try {
    const response = await fetch("https://api.cohere.ai/v1/rerank", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        query,
        documents: results.map(r => r.content),
        top_n: Math.min(topK, results.length),
        return_documents: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Rerank] Cohere API error:", response.status, errorText);
      // Fallback to similarity-based ranking
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    }

    const data = await response.json() as CohereRerankResponse;
    
    // Map reranked results back to original results with updated scores
    const rerankedResults = data.results.map(r => ({
      ...results[r.index],
      similarity: r.relevance_score, // Use rerank score as new similarity
    }));

    return rerankedResults;
  } catch (error) {
    console.error("[Rerank] Error calling Cohere:", error);
    // Fallback to similarity-based ranking
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}

/**
 * Check if reranking is available
 */
export function isRerankingAvailable(): boolean {
  return !!process.env.COHERE_API_KEY;
}

