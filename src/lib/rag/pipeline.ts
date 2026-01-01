import { db } from "@/lib/db";
import { ingestDocument } from "./ingestion";
import { downloadFile } from "@/lib/r2";

/**
 * Fetch PDF buffer with proper MIME type validation
 * Prevents ingesting HTML landing pages or non-PDF content
 */
// Hardened PDF fetch with timeout, size limit, and retries
async function fetchPdfBuffer(url: string, retries = 3): Promise<Buffer | null> {
    const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB limit
    const TIMEOUT_MS = 30000; // 30s timeout

    for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            // Follow redirects (DOI links often redirect multiple times)
            const res = await fetch(url, {
                signal: controller.signal,
                redirect: 'follow',
                headers: {
                    'Accept': 'application/pdf',
                    'User-Agent': 'LitLens-RAG/1.0 (Research Platform)',
                },
            });

            if (!res.ok) {
                console.warn(`[RAG] PDF fetch attempt ${attempt} failed with status ${res.status} for URL: ${url}`);
                if (attempt === retries) return null;
                throw new Error(`Status ${res.status}`);
            }

            // check content length if available
            const contentLength = res.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > MAX_SIZE_BYTES) {
                console.warn(`[RAG] PDF too large (>50MB) for URL: ${url}`);
                return null;
            }

            // ✅ R1 FIX: Validate content-type is actually PDF
            const contentType = res.headers.get('content-type') || '';
            const isPdf = contentType.includes('application/pdf') ||
                contentType.includes('application/octet-stream'); // Some servers use generic type

            if (!isPdf) {
                console.warn(`[RAG] Non-PDF content-type received: "${contentType}" for URL: ${url}`);
                console.warn(`[RAG] This is likely an HTML landing page. Skipping ingestion.`);
                return null;
            }

            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Size check on actual buffer
            if (buffer.length > MAX_SIZE_BYTES) {
                console.warn(`[RAG] PDF buffer too large (${buffer.length} bytes) for URL: ${url}`);
                return null;
            }

            // ✅ Additional validation: Check PDF magic bytes
            if (buffer.length < 5 || buffer.toString('utf8', 0, 5) !== '%PDF-') {
                console.warn(`[RAG] Response lacks PDF magic bytes for URL: ${url}`);
                return null;
            }

            console.log(`[RAG] Successfully fetched PDF (${buffer.length} bytes) from: ${url}`);
            return buffer;

        } catch (e: any) {
            clearTimeout(timeoutId);
            const isTimeout = e.name === 'AbortError';
            console.error(`[RAG] Failed to fetch PDF from URL: ${url} (Attempt ${attempt}/${retries}). ${isTimeout ? 'Timeout' : e.message}`);

            if (attempt < retries) {
                // Exponential backoff
                await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 5000)));
                continue;
            }
            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    }
    return null;
}

export async function ingestWork(workId: string) {
    const work = await db.work.findUnique({
        where: { id: workId },
    });

    if (!work) return;

    let pdfBuffer: Buffer | null = null;

    // ✅ PDF CACHING FIX: Check R2 cache FIRST before external fetch
    // This prevents redundant downloads and publisher rate-limiting
    const projectWorks = await db.projectWork.findMany({
        where: { workId },
        select: { pdfR2Key: true },
    });

    // Check if any ProjectWork has a cached PDF in R2
    const cachedR2Key = projectWorks.find(pw => pw.pdfR2Key)?.pdfR2Key;

    if (cachedR2Key) {
        console.log(`[RAG] Found cached PDF in R2: ${cachedR2Key}`);
        try {
            pdfBuffer = await downloadFile(cachedR2Key);
            if (pdfBuffer) {
                console.log(`[RAG] Successfully loaded PDF from R2 cache (${pdfBuffer.length} bytes)`);
            }
        } catch (e) {
            console.warn(`[RAG] Failed to load PDF from R2, falling back to URL fetch:`, e);
        }
    }

    // Only fetch from URL if no cached PDF
    if (!pdfBuffer && work.url) {
        console.log(`[RAG] No R2 cache found. Fetching from URL: ${work.url}`);
        pdfBuffer = await fetchPdfBuffer(work.url);
    }

    if (pdfBuffer) {
        console.log(`[RAG] PDF buffer obtained (${pdfBuffer.length} bytes). Starting ingestion for ${workId}`);
        await ingestDocument(workId, pdfBuffer, { title: work.title, doi: work.doi });
        console.log(`[RAG] Auto-ingested work ${workId} successfully`);
    } else {
        console.log(`[RAG] No PDF buffer obtained for work ${workId}, skipping auto-ingestion`);
    }
}

