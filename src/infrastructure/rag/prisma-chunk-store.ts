/**
 * Prisma Chunk Store
 * 
 * Handles persistence of document chunks with embeddings.
 * Uses raw SQL for vector insertion (Prisma doesn't support pgvector write yet).
 */

import { db } from '@/lib/db';
import type { ChunkStore } from './ingestion-service';
import type { DocumentChunk } from '@/domain/rag/types';

export class PrismaChunkStore implements ChunkStore {
  /**
   * Delete all chunks for a work (for idempotency)
   */
  async deleteByWorkId(workId: string): Promise<void> {
    await db.documentChunk.deleteMany({
      where: { workId },
    });
    
    console.log(`[Chunk Store] Deleted existing chunks for work ${workId}`);
  }

  /**
   * Insert a single chunk with embedding
   */
  async insertChunk(chunk: DocumentChunk & { embedding: number[] }): Promise<void> {
    const vectorString = `[${chunk.embedding.join(',')}]`;
    
    await db.$executeRaw`
      INSERT INTO "DocumentChunk" (
        "id", 
        "workId", 
        "content", 
        "metadata", 
        "embedding", 
        "createdAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${chunk.metadata.workId},
        ${chunk.content},
        ${JSON.stringify(chunk.metadata)}::jsonb,
        ${vectorString}::vector,
        NOW()
      );
    `;
  }

  /**
   * Insert chunks in batch (more efficient)
   */
  async insertChunksBatch(
    chunks: Array<DocumentChunk & { embedding: number[] }>
  ): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    // Use transaction for atomicity
    await db.$transaction(async (tx) => {
      for (const chunk of chunks) {
        const vectorString = `[${chunk.embedding.join(',')}]`;
        
        await tx.$executeRaw`
          INSERT INTO "DocumentChunk" (
            "id", 
            "workId", 
            "content", 
            "metadata", 
            "embedding", 
            "createdAt"
          )
          VALUES (
            gen_random_uuid()::text,
            ${chunk.metadata.workId},
            ${chunk.content},
            ${JSON.stringify(chunk.metadata)}::jsonb,
            ${vectorString}::vector,
            NOW()
          );
        `;
      }
    });

    console.log(`[Chunk Store] Inserted ${chunks.length} chunks`);
  }
}

