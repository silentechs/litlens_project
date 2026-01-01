import { db } from "@/lib/db";
import { generateEmbedding } from "./embeddings";
// @ts-ignore removed top level import
import { r2Client, downloadFile } from "../r2";

// RecursiveCharacterTextSplitter equivalent logic
function splitText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        // Try to break at a newline or space if possible
        let splitPoint = end;
        if (end < text.length) {
            const nextSpace = text.lastIndexOf(" ", end);
            const nextNewline = text.lastIndexOf("\n", end);
            if (nextNewline > start + overlap) splitPoint = nextNewline;
            else if (nextSpace > start + overlap) splitPoint = nextSpace;
        }

        chunks.push(text.slice(start, splitPoint).trim());
        start = splitPoint - overlap;
    }

    return chunks.filter(c => c.length > 0);
}

export async function ingestDocument(workId: string, pdfBuffer: Buffer, metadata: any = {}) {
    // @ts-ignore
    const pdf = require("pdf-parse");
    // 1. Extract Text
    const data = await pdf(pdfBuffer);
    const text = data.text;

    // ✅ R5 FIX: Extract page count for page estimation
    const numPages = data.numpages || 1;
    const totalChars = text.length;
    const charsPerPage = totalChars / numPages;

    // 2. Clear existing chunks for this work (idempotency)
    await db.documentChunk.deleteMany({
        where: { workId },
    });

    // 3. Chunk Text with position tracking
    const chunks = splitTextWithPositions(text);
    console.log(`[RAG] Split into ${chunks.length} chunks from ${numPages} pages`);

    // 4. Process Chunks (Embed & Save)
    // Process in batches to avoid rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (chunk, idx) => {
            try {
                const embedding = await generateEmbedding(chunk.content);

                // Native SQL to insert vector
                const vectorString = `[${embedding.join(",")}]`;

                // ✅ R5 FIX: Estimate page number from character position
                const estimatedPage = Math.min(
                    Math.floor(chunk.startPosition / charsPerPage) + 1,
                    numPages
                );

                // Enhanced metadata with page number
                const chunkMetadata = {
                    ...metadata,
                    chunkIndex: i + idx,
                    totalChunks: chunks.length,
                    numPages,
                    pageNumber: estimatedPage,
                    startPosition: chunk.startPosition,
                    endPosition: chunk.endPosition,
                    pdfInfo: data.info,
                };

                // Using raw query because Prisma doesn't support 'vector' type write yet
                await db.$executeRaw`
          INSERT INTO "DocumentChunk" ("id", "workId", "content", "metadata", "embedding", "createdAt")
          VALUES (
            gen_random_uuid()::text, 
            ${workId}, 
            ${chunk.content}, 
            ${chunkMetadata}::jsonb, 
            ${vectorString}::vector, 
            NOW()
          );
        `;
            } catch (err) {
                console.error(`[RAG] Failed to ingest chunk ${i + idx}`, err);
            }
        }));
    }

    return { success: true, chunks: chunks.length, pages: numPages };
}

/**
 * ✅ R5 FIX: Enhanced text splitter that tracks character positions
 */
interface ChunkWithPosition {
    content: string;
    startPosition: number;
    endPosition: number;
}

function splitTextWithPositions(text: string, chunkSize: number = 1000, overlap: number = 200): ChunkWithPosition[] {
    const chunks: ChunkWithPosition[] = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        // Try to break at a newline or space if possible
        let splitPoint = end;
        if (end < text.length) {
            const nextSpace = text.lastIndexOf(" ", end);
            const nextNewline = text.lastIndexOf("\n", end);
            if (nextNewline > start + overlap) splitPoint = nextNewline;
            else if (nextSpace > start + overlap) splitPoint = nextSpace;
        }

        const content = text.slice(start, splitPoint).trim();
        if (content.length > 0) {
            chunks.push({
                content,
                startPosition: start,
                endPosition: splitPoint,
            });
        }
        start = splitPoint - overlap;
    }

    return chunks;
}
