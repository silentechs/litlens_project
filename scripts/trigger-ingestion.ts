/**
 * Trigger PDF ingestion for all studies with uploaded PDFs
 */

import "dotenv/config";
import { db } from "@/lib/db";
import { BullMQIngestionQueue } from "@/infrastructure/jobs/ingestion-queue";

async function main() {
    console.log("[Trigger] Finding studies with uploaded PDFs...");

    // Find all ProjectWork with PDFs uploaded
    const studiesWithPdfs = await db.projectWork.findMany({
        where: {
            pdfR2Key: { not: null },
            OR: [
                { ingestionStatus: null },
                { ingestionStatus: { in: ["FAILED", "PENDING"] } },
            ],
        },
        select: {
            id: true,
            workId: true,
            pdfR2Key: true,
            ingestionStatus: true,
        },
        take: 20, // Limit for safety
    });

    console.log(`[Trigger] Found ${studiesWithPdfs.length} studies with PDFs to ingest`);

    if (studiesWithPdfs.length === 0) {
        console.log("[Trigger] No PDFs to ingest. Exiting.");
        process.exit(0);
    }

    const queue = new BullMQIngestionQueue();

    for (const study of studiesWithPdfs) {
        console.log(`[Trigger] Enqueuing ${study.id} (R2: ${study.pdfR2Key})`);
        await queue.enqueueIngestion({
            projectWorkId: study.id,
            workId: study.workId,
            source: "manual_trigger",
        });
    }

    await queue.close();
    console.log(`[Trigger] Successfully enqueued ${studiesWithPdfs.length} jobs`);
    process.exit(0);
}

main().catch((err) => {
    console.error("[Trigger] Fatal error:", err);
    process.exit(1);
});
