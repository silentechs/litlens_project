import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { generateEmbedding } from "./embeddings";
import { rerankResults, isRerankingAvailable } from "./reranking";
import type { RetrievalResult, Citation } from "@/domain/chat/types";

/**
 * @deprecated Use EnhancedRetrievedChunk instead
 */
export interface RetrievedChunk {
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
}

/**
 * Enhanced chunk with full citation data
 */
export interface EnhancedRetrievedChunk {
    content: string;
    similarity: number;
    workId: string;
    workTitle: string;
    authors?: string;
    year?: number;
    doi?: string;
    pageNumber?: number;
    section?: string;
    chunkIndex: number;
    totalChunks?: number;
    metadata: Record<string, unknown>;
}

/**
 * Search project knowledge base with enhanced retrieval
 */
export async function searchProjectKnowledge(
    projectId: string,
    query: string,
    options?: {
        limit?: number;
        onlyIncluded?: boolean;
    }
): Promise<RetrievedChunk[]> {
    const results = await searchProjectKnowledgeEnhanced(projectId, query, options);
    
    // Map to legacy format for backward compatibility
    return results.map(r => ({
        content: r.content,
        metadata: {
            workId: r.workId,
            workTitle: r.workTitle,
            title: r.workTitle,
            authors: r.authors,
            year: r.year,
            doi: r.doi,
            pageNumber: r.pageNumber,
            section: r.section,
            chunkIndex: r.chunkIndex,
            totalChunks: r.totalChunks,
            ...r.metadata,
        },
        similarity: r.similarity,
    }));
}

/**
 * Enhanced search with full citation metadata and optional reranking
 */
export async function searchProjectKnowledgeEnhanced(
    projectId: string,
    query: string,
    options?: {
        limit?: number;
        onlyIncluded?: boolean;
        useReranking?: boolean;
    }
): Promise<EnhancedRetrievedChunk[]> {
    const limit = options?.limit ?? 5;
    const onlyIncluded = options?.onlyIncluded ?? true;
    const useReranking = options?.useReranking ?? isRerankingAvailable();

    const embedding = await generateEmbedding(query);
    const vectorString = `[${embedding.join(",")}]`;

    // Fetch more results if reranking (reranker will filter down)
    const fetchLimit = useReranking ? Math.min(limit * 3, 20) : limit;

    const results = await db.$queryRaw<Array<{
        content: string;
        metadata: unknown;
        similarity: number;
        workId: string;
        workTitle: string;
        authors: unknown;
        year: number | null;
        doi: string | null;
    }>>`
    SELECT 
      chunk."content",
      chunk."metadata",
      1 - (chunk."embedding" <=> ${vectorString}::vector) as similarity,
      work."id" as "workId",
      work."title" as "workTitle",
      work."authors",
      work."year",
      work."doi"
    FROM "DocumentChunk" chunk
    JOIN "Work" work ON chunk."workId" = work."id"
    JOIN "ProjectWork" pw ON work."id" = pw."workId"
    WHERE pw."projectId" = ${projectId}
      ${onlyIncluded ? Prisma.sql`AND pw."finalDecision" = 'INCLUDE'` : Prisma.empty}
    ORDER BY chunk."embedding" <=> ${vectorString}::vector
    LIMIT ${fetchLimit};
  `;

    // Map to enhanced format
    let enhancedResults: EnhancedRetrievedChunk[] = results.map(r => {
        const metadata = (r.metadata || {}) as Record<string, unknown>;
        const authors = Array.isArray(r.authors) 
            ? (r.authors as Array<{ name?: string }>).map(a => a.name || 'Unknown').join(', ')
            : undefined;
        
        return {
            content: r.content,
            similarity: r.similarity,
            workId: r.workId,
            workTitle: r.workTitle,
            authors,
            year: r.year || undefined,
            doi: r.doi || undefined,
            pageNumber: metadata.pageNumber as number | undefined,
            section: metadata.section as string | undefined,
            chunkIndex: (metadata.chunkIndex as number) || 0,
            totalChunks: metadata.totalChunks as number | undefined,
            metadata,
        };
    });

    // Apply reranking if enabled and available
    if (useReranking && enhancedResults.length > 0) {
        const rerankedResults = await rerankResults(
            query,
            enhancedResults.map(r => ({
                content: r.content,
                similarity: r.similarity,
                workId: r.workId,
                workTitle: r.workTitle,
                authors: r.authors,
                year: r.year,
                doi: r.doi,
                pageNumber: r.pageNumber,
                section: r.section,
                chunkIndex: r.chunkIndex,
                totalChunks: r.totalChunks,
            })),
            { topK: limit }
        );

        // Map back to enhanced format with reranked scores
        enhancedResults = rerankedResults.map(rr => {
            const original = enhancedResults.find(e => e.content === rr.content);
            return {
                ...original!,
                similarity: rr.similarity,
            };
        });
    } else {
        // Just take top results by similarity
        enhancedResults = enhancedResults.slice(0, limit);
    }

    return enhancedResults;
}

/**
 * Convert retrieval results to citations
 */
export function toCitations(results: EnhancedRetrievedChunk[]): Citation[] {
    return results.map(r => ({
        workId: r.workId,
        workTitle: r.workTitle,
        authors: r.authors,
        year: r.year,
        doi: r.doi,
        pageNumber: r.pageNumber,
        section: r.section,
        excerpt: truncateExcerpt(r.content, 200),
        excerptHighlight: undefined, // Could be enhanced with highlighting
        similarity: r.similarity,
        chunkIndex: r.chunkIndex,
    }));
}

/**
 * Truncate excerpt to max length, preserving word boundaries
 */
function truncateExcerpt(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.7) {
        return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
}
