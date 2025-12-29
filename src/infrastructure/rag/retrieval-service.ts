/**
 * RAG Retrieval Service
 * 
 * Implements semantic search over document chunks.
 * Supports multiple search strategies (vector, hybrid, reranked).
 * 
 * @principles
 * - Strategy Pattern: Pluggable search strategies
 * - Dependency Injection: Testable
 * - Open/Closed: Extensible with new strategies
 */

import type {
  SearchQuery,
  SearchResult,
  SearchStrategy,
  SearchFilters,
} from '@/domain/rag/types';

import { DEFAULT_SEARCH_LIMIT, DEFAULT_MIN_SIMILARITY } from '@/domain/rag/types';
import type { TextEmbedder } from './ingestion-service';

/**
 * Vector Store Interface (persistence layer)
 */
export interface VectorStore {
  search(params: {
    projectId: string;
    embedding: number[];
    limit: number;
    filters?: SearchFilters;
  }): Promise<RawSearchResult[]>;

  hybridSearch(params: {
    projectId: string;
    embedding: number[];
    queryText: string;
    limit: number;
    filters?: SearchFilters;
  }): Promise<RawSearchResult[]>;
}

/**
 * Raw search result from store (before domain mapping)
 */
export interface RawSearchResult {
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  workId: string;
}

/**
 * Retrieval Service
 */
export class RetrievalService {
  constructor(
    private readonly embedder: TextEmbedder,
    private readonly vectorStore: VectorStore
  ) {}

  /**
   * Search knowledge base
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    // Generate query embedding
    const embedding = await this.embedder.generateEmbedding(query.query);

    // Determine strategy
    const strategy: SearchStrategy = 'vector_only'; // Can be parameterized

    // Execute search
    const rawResults = await this.executeSearch(
      strategy,
      query,
      embedding
    );

    // Filter by minimum similarity
    const minSimilarity = query.filters?.minSimilarity ?? DEFAULT_MIN_SIMILARITY;
    const filtered = rawResults.filter(r => r.similarity >= minSimilarity);

    // Map to domain type
    return filtered.map(r => this.mapToDomainResult(r));
  }

  /**
   * Execute search based on strategy
   */
  private async executeSearch(
    strategy: SearchStrategy,
    query: SearchQuery,
    embedding: number[]
  ): Promise<RawSearchResult[]> {
    const limit = query.limit ?? DEFAULT_SEARCH_LIMIT;
    const filters = this.normalizeFilters(query.filters);

    switch (strategy) {
      case 'vector_only':
        return this.vectorStore.search({
          projectId: query.projectId,
          embedding,
          limit,
          filters,
        });

      case 'hybrid':
        return this.vectorStore.hybridSearch({
          projectId: query.projectId,
          embedding,
          queryText: query.query,
          limit,
          filters,
        });

      case 'reranked':
        // Would implement reranking on top of hybrid
        throw new Error('Reranked strategy not implemented yet');

      default:
        throw new Error(`Unknown search strategy: ${strategy}`);
    }
  }

  /**
   * Normalize search filters
   */
  private normalizeFilters(filters?: SearchFilters): SearchFilters {
    return {
      onlyIncluded: filters?.onlyIncluded ?? true, // ✅ Default to included only
      workIds: filters?.workIds,
      minSimilarity: filters?.minSimilarity,
      includeMetadata: filters?.includeMetadata ?? true,
    };
  }

  /**
   * Map raw result to domain result
   */
  private mapToDomainResult(raw: RawSearchResult): SearchResult {
    return {
      content: raw.content,
      similarity: raw.similarity,
      workId: raw.workId,
      metadata: {
        workId: raw.workId,
        workTitle: raw.metadata.workTitle as string | undefined,
        chunkIndex: raw.metadata.chunkIndex as number,
        totalChunks: raw.metadata.totalChunks as number | undefined,
        pageNumber: raw.metadata.pageNumber as number | undefined,
        section: raw.metadata.section as string | undefined,
        doi: raw.metadata.doi as string | undefined,
      },
    };
  }
}

