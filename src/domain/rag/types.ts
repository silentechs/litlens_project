/**
 * Domain Types for RAG (Retrieval-Augmented Generation)
 * Clean architecture - no infrastructure dependencies
 */

/**
 * Ingestion Status Lifecycle
 */
export type IngestionStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped'; // No PDF available

/**
 * Source of the document for ingestion
 */
export type DocumentSource = 
  | 'url_fetch'
  | 'manual_upload'
  | 'api_import'
  | 'batch_process';

/**
 * Ingestion Job - represents work to be done
 */
export interface IngestionJob {
  readonly projectWorkId: string;
  readonly workId: string;
  readonly source: DocumentSource;
  readonly priority?: number; // Higher = more urgent
}

/**
 * Ingestion Result
 */
export interface IngestionResult {
  readonly success: boolean;
  readonly chunksCreated: number;
  readonly error?: string;
  readonly metadata: {
    readonly pdfUrl?: string;
    readonly fileSize?: number;
    readonly processingTimeMs: number;
    readonly chunkingStrategy: string;
  };
}

/**
 * Document Chunk - piece of content with embedding
 */
export interface DocumentChunk {
  readonly content: string;
  readonly metadata: ChunkMetadata;
  readonly embedding?: number[]; // Optional for create, required for search
}

/**
 * Chunk Metadata - context information
 */
export interface ChunkMetadata {
  readonly workId: string;
  readonly workTitle?: string;
  readonly chunkIndex: number;
  readonly totalChunks?: number;
  readonly pageNumber?: number;
  readonly section?: string;
  readonly doi?: string;
}

/**
 * Search Query
 */
export interface SearchQuery {
  readonly query: string;
  readonly projectId: string;
  readonly filters?: SearchFilters;
  readonly limit?: number;
}

/**
 * Search Filters
 */
export interface SearchFilters {
  readonly onlyIncluded?: boolean; // Only search INCLUDED studies
  readonly workIds?: string[]; // Restrict to specific works
  readonly minSimilarity?: number; // Threshold
  readonly includeMetadata?: boolean; // Include full metadata in results
}

/**
 * Search Result
 */
export interface SearchResult {
  readonly content: string;
  readonly similarity: number; // 0-1 score
  readonly metadata: ChunkMetadata;
  readonly workId: string;
}

/**
 * Search Strategy
 */
export type SearchStrategy = 
  | 'vector_only'      // Pure semantic search
  | 'hybrid'           // Vector + keyword (BM25)
  | 'reranked';        // Hybrid + reranking model

/**
 * Chunking Strategy
 */
export interface ChunkingConfig {
  readonly chunkSize: number;
  readonly overlap: number;
  readonly strategy: 'fixed_size' | 'semantic' | 'recursive';
}

/**
 * Default configurations
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  chunkSize: 1000,
  overlap: 200,
  strategy: 'recursive',
} as const;

export const DEFAULT_SEARCH_LIMIT = 5;
export const DEFAULT_MIN_SIMILARITY = 0.3;

