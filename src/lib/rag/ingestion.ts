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

    // 2. Clear existing chunks for this work (idempotency)
    await db.documentChunk.deleteMany({
        where: { workId },
    });

    // 3. Chunk Text
    const chunks = splitText(text);
    console.log(`[RAG] Split into ${chunks.length} chunks`);

    // 4. Process Chunks (Embed & Save)
    // Process in batches to avoid rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (chunkContent, idx) => {
            try {
                const embedding = await generateEmbedding(chunkContent);

                // Native SQL to insert vector
                // Note: vector string format is '[1.0, 0.5, ...]'
                const vectorString = `[${embedding.join(",")}]`;

                // Using raw query because Prisma doesn't support 'vector' type write yet
                await db.$executeRaw`
          INSERT INTO "DocumentChunk" ("id", "workId", "content", "metadata", "embedding", "createdAt")
          VALUES (
            gen_random_uuid()::text, 
            ${workId}, 
            ${chunkContent}, 
            ${{ ...metadata, chunkIndex: i + idx, totalHeader: data.info }}::jsonb, 
            ${vectorString}::vector, 
            NOW()
          );
        `;
            } catch (err) {
                console.error(`[RAG] Failed to ingest chunk ${i + idx}`, err);
            }
        }));
    }

    return { success: true, chunks: chunks.length };
}
