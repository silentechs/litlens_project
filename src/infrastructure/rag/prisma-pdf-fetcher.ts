/**
 * Prisma PDF Fetcher
 * 
 * Fetches PDFs for ingestion from various sources:
 * - R2 storage (uploaded PDFs)
 * - Direct URLs (from Work.url)
 * - External APIs
 */

import { db } from '@/lib/db';
import { downloadFile as r2DownloadFile, uploadFile } from '@/lib/r2';
import type { PDFFetcher } from './ingestion-service';

export class PrismaPDFFetcher implements PDFFetcher {
  /**
   * Fetch PDF buffer for a work
   * Priority: R2 storage > Direct URL > null
   */
  async fetchPDF(input: { projectWorkId: string; workId: string }): Promise<Buffer | null> {
    // Fetch project-scoped PDF first (prevents cross-project leakage when a Work appears in multiple projects)
    const projectWork = await db.projectWork.findUnique({
      where: { id: input.projectWorkId },
      select: {
        id: true,
        projectId: true,
        workId: true,
        pdfR2Key: true,
        pdfSource: true,
        work: { select: { url: true } },
      },
    });

    if (!projectWork || projectWork.workId !== input.workId) {
      console.error(`[PDF Fetcher] ProjectWork ${input.projectWorkId} not found for work ${input.workId}`);
      return null;
    }

    // Priority 1: Check R2 storage (uploaded PDF)
    const r2Key = projectWork.pdfR2Key;
    if (r2Key) {
      try {
        console.log(`[PDF Fetcher] Fetching from R2: ${r2Key}`);
        return await this.fetchFromR2(r2Key);
      } catch (error) {
        console.error(`[PDF Fetcher] Failed to fetch from R2:`, error);
        // Fall through to try URL
      }
    }

    // Priority 2: Try direct URL
    if (projectWork.work.url) {
      try {
        console.log(`[PDF Fetcher] Fetching from URL: ${projectWork.work.url}`);
        const buffer = await this.fetchFromURL(projectWork.work.url);

        // If we got a PDF and there's no R2 key yet, persist it to R2 for future use.
        if (buffer && !projectWork.pdfR2Key) {
          try {
            const key = `pdfs/${projectWork.projectId}/${projectWork.id}.pdf`;
            await uploadFile({
              key,
              body: buffer,
              contentType: 'application/pdf',
              metadata: {
                projectId: projectWork.projectId,
                projectWorkId: projectWork.id,
                workId: projectWork.workId,
                source: 'url_fetch',
                fetchedFrom: projectWork.work.url,
                uploadedAt: new Date().toISOString(),
              },
            });

            await db.projectWork.update({
              where: { id: projectWork.id },
              data: {
                pdfR2Key: key,
                pdfUploadedAt: new Date(),
                pdfFileSize: buffer.length,
                pdfSource: 'url_fetch',
              },
            });
          } catch (persistErr) {
            console.error('[PDF Fetcher] Failed to persist fetched PDF to R2', persistErr);
          }
        }

        return buffer;
      } catch (error) {
        console.error(`[PDF Fetcher] Failed to fetch from URL:`, error);
      }
    }

    // No PDF available
    console.warn(`[PDF Fetcher] No PDF available for projectWork ${projectWork.id} (work: ${projectWork.workId})`);
    return null;
  }

  /**
   * Fetch PDF from R2 storage
   */
  private async fetchFromR2(key: string): Promise<Buffer> {
    return r2DownloadFile(key);
  }

  /**
   * Fetch PDF from direct URL
   */
  private async fetchFromURL(url: string): Promise<Buffer> {
    // Check if URL looks like a PDF
    const isPdfUrl = url.toLowerCase().endsWith('.pdf') || url.includes('pdf');
    
    if (!isPdfUrl) {
      console.warn(`[PDF Fetcher] URL doesn't look like a PDF: ${url}`);
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LitLens/1.0 (Systematic Review Tool)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('pdf')) {
      // Many publishers return HTML landing pages; don't treat as a PDF.
      throw new Error(`Unexpected content type (expected pdf): ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

