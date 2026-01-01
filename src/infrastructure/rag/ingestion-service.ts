/**
 * RAG Ingestion Service (Infrastructure Layer)
 * 
 * Handles PDF extraction, chunking, embedding, and storage.
 * Implements clean separation between domain logic and infrastructure.
 * 
 * @principles
 * - Dependency Injection: All dependencies injected, testable
 * - Single Responsibility: Only handles document ingestion
 * - Error Handling: Comprehensive error types and recovery
 */

import type {
  IngestionJob,
  IngestionResult,
  DocumentChunk,
  ChunkingConfig,
  ChunkMetadata,
} from '@/domain/rag/types';

import { DEFAULT_CHUNKING_CONFIG } from '@/domain/rag/types';

/**
 * Dependencies (injected for testability)
 */
export interface IngestionDependencies {
  readonly pdfExtractor: PDFExtractor;
  readonly chunker: TextChunker;
  readonly embedder: TextEmbedder;
  readonly chunkStore: ChunkStore;
}

/**
 * PDF Extractor Interface
 */
export interface PDFExtractor {
  extractText(pdfBuffer: Buffer): Promise<{
    text: string;
    metadata: Record<string, unknown>;
  }>;
}

/**
 * Text Chunker Interface
 */
export interface TextChunker {
  chunk(text: string, config: ChunkingConfig): string[];
}

/**
 * Text Embedder Interface
 */
export interface TextEmbedder {
  generateEmbedding(text: string): Promise<number[]>;
  batchGenerateEmbeddings(texts: string[]): Promise<number[][]>;
}

/**
 * Chunk Store Interface (persistence)
 */
export interface ChunkStore {
  deleteByWorkId(workId: string): Promise<void>;
  insertChunk(chunk: DocumentChunk & { embedding: number[] }): Promise<void>;
  insertChunksBatch(chunks: Array<DocumentChunk & { embedding: number[] }>): Promise<void>;
}

/**
 * PDF Fetcher Interface
 */
export interface PDFFetcher {
  fetchPDF(input: { projectWorkId: string; workId: string }): Promise<Buffer | null>;
}

/**
 * Ingestion Service
 */
export class IngestionService {
  constructor(
    private readonly deps: IngestionDependencies,
    private readonly pdfFetcher: PDFFetcher
  ) { }

  /**
   * Ingest a document (main entry point)
   */
  async ingestDocument(job: IngestionJob): Promise<IngestionResult> {
    const startTime = Date.now();

    try {
      // Step 1: Fetch PDF
      const pdfBuffer = await this.pdfFetcher.fetchPDF({
        projectWorkId: job.projectWorkId,
        workId: job.workId,
      });
      if (!pdfBuffer) {
        return this.createSkippedResult('No PDF available', startTime);
      }

      // Step 2: Extract text
      const { text, metadata: pdfMetadata } = await this.deps.pdfExtractor.extractText(
        pdfBuffer
      );

      if (!text || text.trim().length === 0) {
        return this.createSkippedResult('PDF contains no extractable text', startTime);
      }

      // Step 3: Clear old chunks (idempotency)
      await this.deps.chunkStore.deleteByWorkId(job.workId);

      // Step 4: Chunk text
      const chunks = this.deps.chunker.chunk(text, DEFAULT_CHUNKING_CONFIG);

      if (chunks.length === 0) {
        return this.createSkippedResult('No chunks generated', startTime);
      }

      // Step 5: Generate embeddings and store (in batches)
      const chunksCreated = await this.embedAndStoreChunks(
        chunks,
        job.workId,
        pdfMetadata
      );

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        chunksCreated,
        metadata: {
          fileSize: pdfBuffer.length,
          processingTimeMs: processingTime,
          chunkingStrategy: DEFAULT_CHUNKING_CONFIG.strategy,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      return {
        success: false,
        chunksCreated: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          processingTimeMs: processingTime,
          chunkingStrategy: DEFAULT_CHUNKING_CONFIG.strategy,
        },
      };
    }
  }

  /**
   * Embed chunks and store them (with batching for rate limits)
   * ✅ R3 FIX: Added retry logic and fail-fast mechanism
   */
  private async embedAndStoreChunks(
    chunks: string[],
    workId: string,
    pdfMetadata: Record<string, unknown>
  ): Promise<number> {
    const BATCH_SIZE = 5; // Avoid rate limits
    let totalStored = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      let attempts = 0;
      const MAX_RETRIES = 3;
      let batchSuccess = false;

      while (attempts < MAX_RETRIES && !batchSuccess) {
        attempts++;
        try {
          // Generate embeddings in parallel for batch
          const embeddings = await this.deps.embedder.batchGenerateEmbeddings(batch);

          // Prepare chunks with embeddings
          const chunksWithEmbeddings = batch.map((content, idx) => ({
            content,
            embedding: embeddings[idx],
            metadata: this.createChunkMetadata(
              workId,
              i + idx,
              chunks.length,
              pdfMetadata
            ),
          }));

          // Store batch
          await this.deps.chunkStore.insertChunksBatch(chunksWithEmbeddings);
          totalStored += batch.length;
          batchSuccess = true;

          // Small delay between batches to respect rate limits
          if (i + BATCH_SIZE < chunks.length) {
            await this.delay(200);
          }

        } catch (error: any) {
          console.error(`[Ingestion] Batch processing failed (Attempt ${attempts}/${MAX_RETRIES}):`, error);

          if (attempts >= MAX_RETRIES) {
            throw new Error(`Failed to ingest batch after ${MAX_RETRIES} attempts. Error: ${error.message}`);
          }

          // Check if it's a rate limit error (429)
          const isRateLimit = error?.status === 429 || error?.code === 'rate_limit_exceeded';
          const delayMs = isRateLimit
            ? Math.min(1000 * Math.pow(2, attempts) + (Math.random() * 1000), 10000) // Jittered backoff for rate limits
            : 1000 * attempts; // Simple linear backoff for other errors

          console.log(`[Ingestion] Retrying batch in ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      }
    }

    return totalStored;
  }

  /**
   * Create chunk metadata
   */
  private createChunkMetadata(
    workId: string,
    chunkIndex: number,
    totalChunks: number,
    pdfMetadata: Record<string, unknown>
  ): ChunkMetadata {
    return {
      workId,
      chunkIndex,
      totalChunks,
      workTitle: pdfMetadata.title as string | undefined,
      doi: pdfMetadata.doi as string | undefined,
    };
  }

  /**
   * Create skipped result
   */
  private createSkippedResult(
    reason: string,
    startTime: number
  ): IngestionResult {
    return {
      success: false,
      chunksCreated: 0,
      error: reason,
      metadata: {
        processingTimeMs: Date.now() - startTime,
        chunkingStrategy: DEFAULT_CHUNKING_CONFIG.strategy,
      },
    };
  }

  /**
   * Utility: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Recursive Text Chunker Implementation
 */
export class RecursiveTextChunker implements TextChunker {
  chunk(text: string, config: ChunkingConfig): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + config.chunkSize, text.length);

      // Try to break at natural boundaries
      let splitPoint = end;
      if (end < text.length) {
        // Try newline first
        const nextNewline = text.lastIndexOf('\n', end);
        if (nextNewline > start + config.overlap) {
          splitPoint = nextNewline;
        } else {
          // Try space
          const nextSpace = text.lastIndexOf(' ', end);
          if (nextSpace > start + config.overlap) {
            splitPoint = nextSpace;
          }
        }
      }

      const chunk = text.slice(start, splitPoint).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      start = splitPoint - config.overlap;
    }

    return chunks;
  }
}

