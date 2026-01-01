/**
 * Ingestion Queue (Background Jobs)
 * 
 * BullMQ-based job queue for asynchronous PDF ingestion.
 * Handles retries, failures, and progress tracking.
 * 
 * @principles
 * - Reliability: Persistent queue with retries
 * - Observability: Status tracking in DB
 * - Separation: Job processing separate from enqueueing
 */

import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { db } from '@/lib/db';
import type { IngestionQueue } from '../screening/screening-service';
import type { IngestionJob } from '@/domain/rag/types';

// ✅ Upstash Redis connection (serverless, no local Redis needed)
const connection = new Redis(process.env.UPSTASH_REDIS_URL!, {
  maxRetriesPerRequest: null, // Required for BullMQ
  retryStrategy: (times) => Math.min(times * 50, 2000),
  tls: process.env.UPSTASH_REDIS_URL?.includes('upstash') ? {} : undefined,
});

/**
 * Ingestion Queue (for enqueueing jobs)
 */
export class BullMQIngestionQueue implements IngestionQueue {
  private queue: Queue<IngestionJob>;

  constructor() {
    this.queue = new Queue<IngestionJob>('rag-ingestion', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5s delay
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24h
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });
  }

  /**
   * Enqueue ingestion job
   */
  async enqueueIngestion(job: {
    projectWorkId: string;
    workId: string;
    source: string;
  }): Promise<void> {
    // Update status to pending
    await db.projectWork.update({
      where: { id: job.projectWorkId },
      data: { ingestionStatus: 'PENDING' },
    });

    // Use a jobId that changes when a new PDF is uploaded, so re-uploads can trigger re-ingestion
    const pw = await db.projectWork.findUnique({
      where: { id: job.projectWorkId },
      select: { pdfUploadedAt: true },
    });
    const pdfVersion = pw?.pdfUploadedAt ? pw.pdfUploadedAt.getTime() : 0;

    // Add to queue
    await this.queue.add(
      'ingest',
      {
        projectWorkId: job.projectWorkId,
        workId: job.workId,
        source: job.source as any, // Cast to DocumentSource
      },
      {
        jobId: `ingest-${job.projectWorkId}-${pdfVersion}`, // Deduplicate per PDF version
      }
    );
  }

  /**
   * Get queue stats
   */
  async getStats() {
    const counts = await this.queue.getJobCounts();
    return counts;
  }

  /**
   * Close queue connection
   */
  async close(): Promise<void> {
    await this.queue.close();
  }
}

/**
 * Ingestion Worker (processes jobs)
 * 
 * This should run in a separate process or worker thread.
 * For development, can run in same process.
 */
export class IngestionWorker {
  private worker: Worker<IngestionJob>;

  constructor(
    private readonly ingestionService: {
      ingestDocument(job: IngestionJob): Promise<{
        success: boolean;
        chunksCreated: number;
        error?: string;
      }>;
    }
  ) {
    this.worker = new Worker<IngestionJob>(
      'rag-ingestion',
      async (job: Job<IngestionJob>) => {
        return this.processJob(job);
      },
      {
        connection,
        concurrency: 3, // Process 3 jobs in parallel
      }
    );

    // Event handlers
    this.worker.on('completed', (job) => {
      console.log(`[Ingestion] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[Ingestion] Job ${job?.id} failed:`, err);
    });
  }

  /**
   * Process individual job
   */
  private async processJob(job: Job<IngestionJob>): Promise<void> {
    const { projectWorkId, workId, source } = job.data;

    console.log(
      `[Ingestion] Processing ${projectWorkId} (work: ${workId}, source: ${source})`
    );

    // Update status to processing
    await db.projectWork.update({
      where: { id: projectWorkId },
      data: {
        ingestionStatus: 'PROCESSING',
      },
    });

    try {
      // Execute ingestion
      const result = await this.ingestionService.ingestDocument({
        projectWorkId,
        workId,
        source,
      });

      // Update status based on result
      await db.projectWork.update({
        where: { id: projectWorkId },
        data: {
          ingestionStatus: result.success ? 'COMPLETED' : 'FAILED',
          chunksCreated: result.chunksCreated,
          lastIngestedAt: result.success ? new Date() : undefined,
          ingestionError: result.error || null,
        },
      });

      if (!result.success) {
        throw new Error(result.error || 'Ingestion failed');
      }
    } catch (error) {
      // Check if this was the last attempt
      const maxAttempts = job.opts.attempts || 1;
      const attempt = job.attemptsMade + 1; // attemptsMade is 0-indexed
      const isFinalAttempt = attempt >= maxAttempts;

      // Update status
      await db.projectWork.update({
        where: { id: projectWorkId },
        data: {
          ingestionStatus: isFinalAttempt ? 'FAILED' : 'PENDING', // Go back to PENDING if retrying
          ingestionError: `Attempt ${attempt}/${maxAttempts} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });

      throw error; // Re-throw for BullMQ to handle retries
    }
  }

  /**
   * Close worker
   */
  async close(): Promise<void> {
    await this.worker.close();
  }
}

/**
 * Factory function to create queue and worker
 */
export function createIngestionInfrastructure(ingestionService: {
  ingestDocument(job: IngestionJob): Promise<{
    success: boolean;
    chunksCreated: number;
    error?: string;
  }>;
}) {
  const queue = new BullMQIngestionQueue();
  const worker = new IngestionWorker(ingestionService);

  return {
    queue,
    worker,
    async close() {
      await queue.close();
      await worker.close();
      await connection.quit();
    },
  };
}

