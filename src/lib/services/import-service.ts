/**
 * Import Service
 * Handles processing of imported records
 */

import db from "@/lib/db";
import { publishImportProgress } from "@/lib/events/publisher";

// Import record type
export interface ImportRecord {
  title: string;
  abstract?: string;
  authors: { name: string; orcid?: string }[];
  year?: number;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  pmid?: string;
  keywords?: string[];
  raw?: unknown;
}

export async function processImport(
  batchId: string,
  records: ImportRecord[]
) {
  const batch = await db.importBatch.findUnique({
    where: { id: batchId },
    include: { project: true },
  });

  if (!batch) {
    throw new Error("Import batch not found");
  }

  // Update status
  await db.importBatch.update({
    where: { id: batchId },
    data: {
      status: "PARSING",
      startedAt: new Date(),
      totalRecords: records.length,
    },
  });

  publishImportProgress(batch.projectId, batchId, {
    status: "PARSING",
    totalRecords: records.length,
    processedRecords: 0,
    duplicatesFound: 0,
    errorsCount: 0,
  });

  let processedCount = 0;
  let duplicatesCount = 0;
  let errorsCount = 0;
  const errors: { record: number; error: string }[] = [];

  // Process in batches of 50
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const recordBatch = records.slice(i, i + BATCH_SIZE);
    
    await db.$transaction(async (tx) => {
      for (const record of recordBatch) {
        try {
          // Check for existing work by DOI or title
          let work = null;
          
          if (record.doi) {
            work = await tx.work.findUnique({
              where: { doi: record.doi },
            });
          }

          // Create work if not found
          if (!work) {
            work = await tx.work.create({
              data: {
                title: record.title,
                abstract: record.abstract,
                authors: record.authors,
                year: record.year,
                journal: record.journal,
                volume: record.volume,
                issue: record.issue,
                pages: record.pages,
                doi: record.doi,
                pmid: record.pmid,
                keywords: record.keywords || [],
                source: "import",
              },
            });
          }

          // Check if already in project
          const existingProjectWork = await tx.projectWork.findUnique({
            where: {
              projectId_workId: {
                projectId: batch.projectId,
                workId: work.id,
              },
            },
          });

          if (existingProjectWork) {
            duplicatesCount++;
            processedCount++;
            continue;
          }

          // Create project work
          await tx.projectWork.create({
            data: {
              projectId: batch.projectId,
              workId: work.id,
              importBatchId: batchId,
              importSource: batch.filename,
              rawRecord: record.raw as object | undefined,
              status: "PENDING",
              phase: "TITLE_ABSTRACT",
            },
          });

          processedCount++;
        } catch (error) {
          errorsCount++;
          errors.push({
            record: i + recordBatch.indexOf(record),
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    });

    // Publish progress
    publishImportProgress(batch.projectId, batchId, {
      status: "PARSING",
      totalRecords: records.length,
      processedRecords: processedCount,
      duplicatesFound: duplicatesCount,
      errorsCount,
    });
  }

  // Update final status
  await db.importBatch.update({
    where: { id: batchId },
    data: {
      status: errorsCount > 0 && processedCount === 0 ? "FAILED" : "COMPLETED",
      processedRecords: processedCount,
      duplicatesFound: duplicatesCount,
      errorsCount,
      errorLog: errors.length > 0 ? errors : undefined,
      completedAt: new Date(),
    },
  });

  publishImportProgress(batch.projectId, batchId, {
    status: "COMPLETED",
    totalRecords: records.length,
    processedRecords: processedCount,
    duplicatesFound: duplicatesCount,
    errorsCount,
  });

  return {
    processed: processedCount,
    duplicates: duplicatesCount,
    errors: errorsCount,
  };
}

