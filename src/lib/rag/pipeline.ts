import { db } from "@/lib/db";
import { ingestDocument } from "./ingestion";
import { downloadFile } from "@/lib/r2";

async function fetchPdfBuffer(url: string): Promise<Buffer | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (e) {
        console.error("Failed to fetch PDF from URL", e);
        return null;
    }
}

export async function ingestWork(workId: string) {
    const work = await db.work.findUnique({
        where: { id: workId },
    });

    if (!work) return;

    // 1. Try to get PDF from R2 (if we stored it separately - logic TBD)
    // For now, check 'url' field
    let pdfBuffer: Buffer | null = null;

    if (work.url) {
        console.log(`[RAG] Checking work ${workId} for PDF ingestion. URL: ${work.url}`);
        // Check if it looks like a PDF or if we should just try fetching it
        // For now, we'll try to fetch ANY url and check headers/success
        pdfBuffer = await fetchPdfBuffer(work.url);
    }

    if (pdfBuffer) {
        console.log(`[RAG] PDF buffer obtained (${pdfBuffer.length} bytes). Starting ingestion for ${workId}`);
        await ingestDocument(workId, pdfBuffer, { title: work.title, doi: work.doi });
        console.log(`[RAG] Auto-ingested work ${workId} successfully`);
    } else {
        console.log(`[RAG] No PDF buffer obtained for work ${workId} (URL: ${work.url}), skipping auto-ingestion`);
    }
}
