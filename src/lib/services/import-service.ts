/**
 * Import Service
 * Handles processing of imported records with file parsing and duplicate detection
 */

import db from "@/lib/db";
import { publishImportProgress } from "@/lib/events/publisher";
import { parseFile, ParsedWork, ParseResult } from "./parsers";
import { checkDuplicatesBatch, DuplicateCheckResult } from "./duplicate-detection";

// Import record type (extends ParsedWork with additional fields)
export interface ImportRecord extends ParsedWork {
  raw?: unknown;
}

/**
 * Parse file content and return parsed works
 */
export async function parseImportFile(
  content: string,
  filename: string
): Promise<ParseResult> {
  return parseFile(content, filename);
}

/**
 * Process import batch with duplicate detection
 */
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

  const projectId = batch.projectId;

  // Update status to PARSING
  await db.importBatch.update({
    where: { id: batchId },
    data: {
      status: "PARSING",
      startedAt: new Date(),
      totalRecords: records.length,
    },
  });

  publishImportProgress(projectId, batchId, {
    status: "PARSING",
    totalRecords: records.length,
    processedRecords: 0,
    duplicatesFound: 0,
    errorsCount: 0,
  });

  let processedCount = 0;
  let duplicatesCount = 0;
  let errorsCount = 0;
  let newWorksCount = 0;
  const errors: { record: number; error: string }[] = [];

  // Process in batches of 20 to avoid transaction timeouts
  const BATCH_SIZE = 20;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const recordBatch = records.slice(i, i + BATCH_SIZE);

    // Check duplicates for this batch
    const duplicateResults = await checkDuplicatesBatch(recordBatch, projectId);

    await db.$transaction(async (tx) => {
      for (let j = 0; j < recordBatch.length; j++) {
        const record = recordBatch[j];
        const globalIndex = i + j;
        const duplicateCheck = duplicateResults.get(j);

        try {
          let workId: string;
          // ... (rest of logic unchanged, just needed to wrap the transaction config)
          // Wait, I need to match the end of the transaction block to pass the config object.
          // The tool doesn't support "insert after block" easily without context.
          // Let me replace the start and end separately or the whole block.
          // The block is large (lines 77-183).
          // I will target the `BATCH_SIZE` definition and the `$transaction` closing.
          let isDuplicate = false;

          // Check if this is a duplicate
          if (duplicateCheck?.isDuplicate && duplicateCheck.existingWorkId) {
            // Use existing work
            workId = duplicateCheck.existingWorkId;

            // Check if already in this project
            const existingProjectWork = await tx.projectWork.findUnique({
              where: {
                projectId_workId: {
                  projectId,
                  workId,
                },
              },
            });

            if (existingProjectWork) {
              isDuplicate = true;
              duplicatesCount++;
              processedCount++;
              continue;
            }
          } else {
            // Create new work - first check by DOI to avoid constraint violation
            let existingWork = null;

            if (record.doi) {
              existingWork = await tx.work.findUnique({
                where: { doi: record.doi },
              });
            }

            if (existingWork) {
              workId = existingWork.id;
            } else {
              // Create new work
              const newWork = await tx.work.create({
                data: {
                  title: record.title,
                  abstract: record.abstract,
                  authors: record.authors || [],
                  year: record.year,
                  journal: record.journal,
                  volume: record.volume,
                  issue: record.issue,
                  pages: record.pages,
                  doi: record.doi,
                  pmid: record.pmid,
                  keywords: record.keywords || [],
                  url: record.url,
                  source: "import",
                },
              });
              workId = newWork.id;
              newWorksCount++;
            }
          }

          // Check if already in project (safety check)
          const existingProjectWork = await tx.projectWork.findUnique({
            where: {
              projectId_workId: {
                projectId,
                workId,
              },
            },
          });

          if (existingProjectWork) {
            duplicatesCount++;
            processedCount++;
            continue;
          }

          // Create project work association
          await tx.projectWork.create({
            data: {
              projectId,
              workId,
              importBatchId: batchId,
              importSource: batch.filename,
              rawRecord: record.rawData as object | undefined,
              status: "PENDING",
              phase: "TITLE_ABSTRACT",
            },
          });

          processedCount++;
        } catch (error) {
          errorsCount++;
          errors.push({
            record: globalIndex,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          console.error(`Error processing record ${globalIndex}:`, error);
        }
      }
    }, {
      maxWait: 5000, // 5s max wait to get tx
      timeout: 60000, // 60s timeout for the batch
    });

    // Publish progress
    publishImportProgress(projectId, batchId, {
      status: "PARSING",
      totalRecords: records.length,
      processedRecords: processedCount,
      duplicatesFound: duplicatesCount,
      errorsCount,
    });
  }

  // Determine final status - uses ImportStatus enum
  let finalStatus: "COMPLETED" | "FAILED";
  if (errorsCount > 0 && processedCount === 0) {
    finalStatus = "FAILED";
  } else {
    finalStatus = "COMPLETED";
  }

  // Update final status
  await db.importBatch.update({
    where: { id: batchId },
    data: {
      status: finalStatus,
      processedRecords: processedCount - duplicatesCount, // New records added
      duplicatesFound: duplicatesCount,
      errorsCount,
      errorLog: errors.length > 0 ? errors : undefined,
      completedAt: new Date(),
    },
  });

  publishImportProgress(projectId, batchId, {
    status: finalStatus,
    totalRecords: records.length,
    processedRecords: processedCount,
    duplicatesFound: duplicatesCount,
    errorsCount,
  });

  // Log activity - Note: ImportBatch doesn't track uploadedById, would need project owner for this
  // Skip activity creation for now until we refactor to track the user who initiated the import

  return {
    processed: processedCount - duplicatesCount,
    duplicates: duplicatesCount,
    errors: errorsCount,
    newWorks: newWorksCount,
  };
}

/**
 * Full import pipeline: parse file and process records
 */
export async function importFile(
  batchId: string,
  content: string,
  filename: string
): Promise<{
  parseResult: ParseResult;
  importResult: {
    processed: number;
    duplicates: number;
    errors: number;
    newWorks: number;
  };
}> {
  // Parse the file
  const parseResult = await parseImportFile(content, filename);

  if (parseResult.errors.length > 0 && parseResult.works.length === 0) {
    // Update batch status to failed if no works were parsed
    await db.importBatch.update({
      where: { id: batchId },
      data: {
        status: "FAILED",
        errorLog: parseResult.errors.map((e, i) => ({ record: i, error: e })),
        completedAt: new Date(),
      },
    });

    return {
      parseResult,
      importResult: { processed: 0, duplicates: 0, errors: parseResult.errors.length, newWorks: 0 },
    };
  }

  // Process the parsed works
  const importResult = await processImport(batchId, parseResult.works);

  return { parseResult, importResult };
}

