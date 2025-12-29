-- =========================================
-- Migration: Add Hybrid Search + PDF Tracking
-- =========================================

-- 1. Add PDF storage tracking to ProjectWork
ALTER TABLE "ProjectWork" 
  ADD COLUMN IF NOT EXISTS "pdfR2Key" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfUploadedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pdfFileSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "pdfSource" TEXT,
  ADD COLUMN IF NOT EXISTS "ingestionStatus" TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "ingestionError" TEXT,
  ADD COLUMN IF NOT EXISTS "chunksCreated" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastIngestedAt" TIMESTAMP(3);

-- 2. Add unique constraint on Conflict (projectWorkId, phase)
ALTER TABLE "Conflict" 
  ADD CONSTRAINT "Conflict_projectWorkId_phase_key" 
  UNIQUE ("projectWorkId", "phase");

-- 3. Add full-text search column to DocumentChunk
ALTER TABLE "DocumentChunk" 
  ADD COLUMN IF NOT EXISTS "content_tsv" tsvector;

-- 4. Create index on tsvector column
CREATE INDEX IF NOT EXISTS "chunk_content_tsv_idx" 
  ON "DocumentChunk" USING gin("content_tsv");

-- 5. Create trigger to auto-update tsvector on insert/update
CREATE OR REPLACE FUNCTION update_chunk_tsv() 
RETURNS trigger AS $$
BEGIN
  NEW.content_tsv := to_tsvector('english', NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chunk_tsv_update ON "DocumentChunk";
CREATE TRIGGER chunk_tsv_update 
  BEFORE INSERT OR UPDATE ON "DocumentChunk"
  FOR EACH ROW 
  EXECUTE FUNCTION update_chunk_tsv();

-- 6. Populate content_tsv for existing rows
UPDATE "DocumentChunk" 
SET "content_tsv" = to_tsvector('english', "content")
WHERE "content_tsv" IS NULL;

-- 7. Add index on ingestionStatus for query performance
CREATE INDEX IF NOT EXISTS "ProjectWork_ingestionStatus_idx" 
  ON "ProjectWork"("ingestionStatus");

-- 8. Add index on pdfR2Key for lookups
CREATE INDEX IF NOT EXISTS "ProjectWork_pdfR2Key_idx" 
  ON "ProjectWork"("pdfR2Key") 
  WHERE "pdfR2Key" IS NOT NULL;

