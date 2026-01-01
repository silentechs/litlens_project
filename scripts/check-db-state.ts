/** Check database state for PDFs */
import "dotenv/config";
import { db } from "@/lib/db";

async function main() {
    const totalStudies = await db.projectWork.count({ where: { projectId: "cmjrzwj1b001o1mk27djoidjv" } });
    const withPdf = await db.projectWork.count({ where: { projectId: "cmjrzwj1b001o1mk27djoidjv", pdfR2Key: { not: null } } });
    const included = await db.projectWork.count({ where: { projectId: "cmjrzwj1b001o1mk27djoidjv", finalDecision: "INCLUDE" } });
    const ingested = await db.projectWork.count({ where: { projectId: "cmjrzwj1b001o1mk27djoidjv", ingestionStatus: "COMPLETED" } });
    const chunks = await db.documentChunk.count();

    console.log("\n=== DATABASE STATE ===");
    console.log(`Project: cmjrzwj1b001o1mk27djoidjv`);
    console.log(`Total studies: ${totalStudies}`);
    console.log(`With PDF (pdfR2Key): ${withPdf}`);
    console.log(`Included studies: ${included}`);
    console.log(`Successfully ingested: ${ingested}`);
    console.log(`Total DocumentChunks (ALL projects): ${chunks}`);

    // Find sample study with details
    const sample = await db.projectWork.findFirst({
        where: { projectId: "cmjrzwj1b001o1mk27djoidjv" },
        select: {
            id: true,
            pdfR2Key: true,
            pdfUploadedAt: true,
            ingestionStatus: true,
            chunksCreated: true,
            work: { select: { title: true } },
        },
    });

    console.log("\n=== SAMPLE STUDY ===");
    console.log(JSON.stringify(sample, null, 2));

    process.exit(0);
}

main().catch(console.error);
