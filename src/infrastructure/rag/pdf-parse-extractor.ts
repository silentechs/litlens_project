/**
 * PDF Parse Extractor
 *
 * Concrete PDF text extraction using `pdf-parse`.
 * Keeps dependencies Node-only (intended for the ingestion worker process).
 */

import type { PDFExtractor } from "./ingestion-service";

export class PdfParseExtractor implements PDFExtractor {
  async extractText(pdfBuffer: Buffer): Promise<{
    text: string;
    metadata: Record<string, unknown>;
  }> {
    // `pdf-parse` is CommonJS; require avoids ESM interop issues in different runtimes.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdf = require("pdf-parse");

    const data = await pdf(pdfBuffer);

    const info = (data?.info ?? {}) as Record<string, unknown>;
    const meta = (data?.metadata ?? {}) as Record<string, unknown>;

    // Best-effort canonical fields (used for chunk metadata/citations)
    const title =
      (info.Title as string | undefined) ||
      (meta.title as string | undefined) ||
      undefined;

    return {
      text: (data?.text ?? "").toString(),
      metadata: {
        title,
        ...info,
        ...meta,
      },
    };
  }
}


