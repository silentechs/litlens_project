/**
 * Ingestion Worker Entrypoint
 *
 * Runs the BullMQ ingestion worker that processes queued PDF ingestion jobs.
 *
 * Usage:
 *   npm run worker:ingestion
 */

import "dotenv/config";

import { IngestionWorker } from "@/infrastructure/jobs/ingestion-queue";
import { IngestionService, RecursiveTextChunker } from "@/infrastructure/rag/ingestion-service";
import { OpenAIEmbedder } from "@/infrastructure/rag/openai-embedder";
import { PrismaChunkStore } from "@/infrastructure/rag/prisma-chunk-store";
import { PrismaPDFFetcher } from "@/infrastructure/rag/prisma-pdf-fetcher";
import { PdfParseExtractor } from "@/infrastructure/rag/pdf-parse-extractor";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required to run the ingestion worker`);
  return v;
}

async function main() {
  requireEnv("UPSTASH_REDIS_URL");
  const openAiKey = requireEnv("OPENAI_API_KEY");

  const ingestionService = new IngestionService(
    {
      pdfExtractor: new PdfParseExtractor(),
      chunker: new RecursiveTextChunker(),
      embedder: new OpenAIEmbedder(openAiKey),
      chunkStore: new PrismaChunkStore(),
    },
    new PrismaPDFFetcher()
  );

  const worker = new IngestionWorker(ingestionService);

  console.log("[IngestionWorker] Started. Waiting for jobs...");

  const shutdown = async () => {
    console.log("[IngestionWorker] Shutting down...");
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  console.error("[IngestionWorker] Fatal error:", err);
  process.exit(1);
});


