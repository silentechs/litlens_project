# Audit Summary - Quick Reference

## Critical Issues Requiring Immediate Attention

### 🔴 RAG Implementation

1. **Silent Chunk Loss** (`src/lib/rag/ingestion.ts:93-95`)
   - Failed embedding generation causes chunks to be lost forever
   - **Fix:** Add retry logic with exponential backoff

2. **PDF Fetch Timeout** (`src/lib/rag/pipeline.ts:9-51`)
   - No timeout handling for slow PDF servers
   - **Fix:** Add 30s timeout with AbortController

3. **Missing PDF Validation Before Ingestion** (`src/infrastructure/screening/screening-service.ts:261-268`)
   - Ingestion queued even when PDF doesn't exist
   - **Fix:** Check `pdfR2Key` and `work.url` before enqueueing

### 🔴 Screening Workflows

1. **Race Condition: Duplicate Decisions** (`src/domain/screening/state-machine.ts:262-292`)
   - Two concurrent requests can both create decisions
   - **Fix:** Add database unique constraint `UNIQUE(projectWorkId, reviewerId, phase)`

2. **Phase Advancement Without PDFs** (`src/app/api/projects/[id]/screening/advance-phase/route.ts:127-153`)
   - Can advance to FULL_TEXT phase without PDFs available
   - **Fix:** Validate PDF availability before advancing

3. **Ingestion Trigger Race Condition** (`src/infrastructure/screening/screening-service.ts:261-268`)
   - Multiple INCLUDE decisions can queue duplicate ingestion jobs
   - **Fix:** Check `ingestionStatus` before enqueueing

4. **Conflict Resolution Logic Gap** (`src/app/api/projects/[id]/screening/advance-phase/route.ts:99-113`)
   - Doesn't handle majority rule (e.g., 2 INCLUDE, 1 EXCLUDE)
   - **Fix:** Implement majority wins logic

## High Priority Issues

### 🟡 RAG

- **Chunking Strategy:** Fixed-size chunking doesn't respect semantic boundaries
- **Error Recovery:** No dead-letter queue for failed ingestion jobs
- **Query Performance:** Missing database indexes for common filter patterns

### 🟡 Screening

- **Blind Screening:** Queue filtering doesn't properly hide other reviewers' decisions
- **AI Suggestions:** No invalidation when protocol criteria change
- **State Consistency:** No validation for invalid status/phase combinations

## Quick Wins (Easy Fixes)

1. **Add Database Index:**
   ```sql
   CREATE INDEX idx_projectwork_project_decision 
   ON "ProjectWork"("projectId", "finalDecision") 
   WHERE "finalDecision" = 'INCLUDE';
   ```

2. **Add Unique Constraint:**
   ```prisma
   @@unique([projectWorkId, reviewerId, phase])
   ```

3. **Add Timeout to PDF Fetch:**
   ```typescript
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 30000);
   ```

4. **Check Ingestion Status Before Enqueueing:**
   ```typescript
   if (projectWork.ingestionStatus === 'COMPLETED' || 
       projectWork.ingestionStatus === 'PROCESSING') {
     return; // Skip
   }
   ```

## Testing Gaps

- ❌ No unit tests for state machine logic
- ❌ No integration tests for screening workflows
- ❌ No E2E tests for RAG pipeline

## Monitoring Gaps

- ❌ No error tracking (Sentry, etc.)
- ❌ No metrics collection (Prometheus)
- ❌ Limited structured logging

---

**See `AUDIT_REPORT_COMPREHENSIVE.md` for full details.**

