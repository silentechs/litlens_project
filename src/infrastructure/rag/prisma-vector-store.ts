/**
 * Prisma Vector Store
 * 
 * PostgreSQL + pgvector implementation of VectorStore interface.
 * Handles vector similarity search with proper SQL queries.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { VectorStore, RawSearchResult } from './retrieval-service';
import type { SearchFilters } from '@/domain/rag/types';

export class PrismaVectorStore implements VectorStore {
  /**
   * Vector-only search (cosine similarity)
   */
  async search(params: {
    projectId: string;
    embedding: number[];
    limit: number;
    filters?: SearchFilters;
  }): Promise<RawSearchResult[]> {
    const vectorString = `[${params.embedding.join(',')}]`;
    
    // Build filter conditions
    const filterConditions = this.buildFilterConditions(params.filters);

    const results = await db.$queryRaw<
      Array<{
        content: string;
        metadata: Record<string, unknown>;
        work_id: string;
        similarity: number;
      }>
    >`
      SELECT 
        chunk."content",
        chunk."metadata",
        chunk."workId" as work_id,
        1 - (chunk."embedding" <=> ${vectorString}::vector) as similarity
      FROM "DocumentChunk" chunk
      JOIN "Work" work ON chunk."workId" = work."id"
      JOIN "ProjectWork" pw ON work."id" = pw."workId"
      WHERE pw."projectId" = ${params.projectId}
        ${filterConditions}
      ORDER BY chunk."embedding" <=> ${vectorString}::vector
      LIMIT ${params.limit};
    `;

    return results.map(r => ({
      content: r.content,
      similarity: r.similarity,
      metadata: r.metadata,
      workId: r.work_id,
    }));
  }

  /**
   * Hybrid search (vector + full-text search using RRF)
   */
  async hybridSearch(params: {
    projectId: string;
    embedding: number[];
    queryText: string;
    limit: number;
    filters?: SearchFilters;
  }): Promise<RawSearchResult[]> {
    const vectorString = `[${params.embedding.join(',')}]`;
    const filterConditions = this.buildFilterConditions(params.filters);

    // Reciprocal Rank Fusion (RRF) combining vector + text search
    const results = await db.$queryRaw<
      Array<{
        content: string;
        metadata: Record<string, unknown>;
        work_id: string;
        vector_score: number;
        text_score: number;
        combined_score: number;
      }>
    >`
      WITH vector_search AS (
        SELECT 
          chunk."id",
          chunk."content",
          chunk."metadata",
          chunk."workId" as work_id,
          1 - (chunk."embedding" <=> ${vectorString}::vector) as score,
          ROW_NUMBER() OVER (
            ORDER BY chunk."embedding" <=> ${vectorString}::vector
          ) as rank
        FROM "DocumentChunk" chunk
        JOIN "Work" work ON chunk."workId" = work."id"
        JOIN "ProjectWork" pw ON work."id" = pw."workId"
        WHERE pw."projectId" = ${params.projectId}
          ${filterConditions}
      ),
      text_search AS (
        SELECT
          chunk."id",
          ts_rank(
            chunk."content_tsv", 
            plainto_tsquery('english', ${params.queryText})
          ) as score,
          ROW_NUMBER() OVER (
            ORDER BY ts_rank(
              chunk."content_tsv", 
              plainto_tsquery('english', ${params.queryText})
            ) DESC
          ) as rank
        FROM "DocumentChunk" chunk
        JOIN "Work" work ON chunk."workId" = work."id"
        JOIN "ProjectWork" pw ON work."id" = pw."workId"
        WHERE pw."projectId" = ${params.projectId}
          ${filterConditions}
          AND chunk."content_tsv" @@ plainto_tsquery('english', ${params.queryText})
      )
      SELECT
        v."content",
        v."metadata",
        v.work_id,
        v.score as vector_score,
        COALESCE(t.score, 0) as text_score,
        -- RRF formula: 1/(k + rank)
        (1.0 / (60 + v.rank)) + COALESCE((1.0 / (60 + t.rank)), 0) as combined_score
      FROM vector_search v
      LEFT JOIN text_search t ON v.id = t.id
      ORDER BY combined_score DESC
      LIMIT ${params.limit};
    `;

    return results.map(r => ({
      content: r.content,
      similarity: r.combined_score,
      metadata: r.metadata,
      workId: r.work_id,
    }));
  }

  /**
   * Build SQL filter conditions
   */
  private buildFilterConditions(filters?: SearchFilters): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    // Filter to included studies only (default)
    if (filters?.onlyIncluded !== false) {
      conditions.push(Prisma.sql`AND pw."finalDecision" = 'INCLUDE'`);
    }

    // Filter to specific works
    if (filters?.workIds && filters.workIds.length > 0) {
      conditions.push(
        Prisma.sql`AND chunk."workId" = ANY(${filters.workIds}::text[])`
      );
    }

    // Combine conditions
    if (conditions.length === 0) {
      return Prisma.empty;
    }

    return Prisma.join(conditions, ' ');
  }
}

