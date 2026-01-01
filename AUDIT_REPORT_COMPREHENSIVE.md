# Comprehensive System Audit Report
## LitLens Project - RAG & Screening Workflows

**Date:** 2025-01-XX  
**Auditor:** Senior Full-Stack Developer (30+ years experience)  
**Scope:** RAG Implementation & Screening Workflows End-to-End

---

## Executive Summary

This audit examines two critical subsystems:
1. **RAG (Retrieval-Augmented Generation) Implementation** - PDF ingestion, vector embeddings, semantic search
2. **Screening Workflows** - End-to-end flow from abstract screening through full-text to final decisions

### Overall Assessment

**RAG Implementation:** ⚠️ **MODERATE RISK** - Core functionality exists but has critical gaps in error handling, retry logic, and edge cases.

**Screening Workflows:** ⚠️ **MODERATE-HIGH RISK** - Logic is sound but has several race conditions, state consistency issues, and missing validation checks.

---

## PART 1: RAG IMPLEMENTATION AUDIT

### 1.1 Architecture Overview

**Strengths:**
- ✅ Clean separation: Domain types (`domain/rag/types.ts`), Infrastructure (`infrastructure/rag/`), Services (`lib/rag/`)
- ✅ Dependency injection pattern used correctly
- ✅ Multiple search strategies supported (vector-only, hybrid, reranked)
- ✅ Proper use of PostgreSQL pgvector extension

**Weaknesses:**
- ⚠️ Inconsistent use of new vs legacy ingestion code
- ⚠️ Missing comprehensive error recovery
- ⚠️ No monitoring/observability hooks

### 1.2 Critical Gaps Identified

#### GAP R1: PDF Fetch Validation - PARTIALLY FIXED
**Location:** `src/lib/rag/pipeline.ts:9-51`

**Issue:**
- ✅ Content-type validation exists
- ✅ PDF magic bytes check exists
- ⚠️ **MISSING:** No timeout handling for slow PDF servers
- ⚠️ **MISSING:** No retry logic for transient network failures
- ⚠️ **MISSING:** No size limit validation (could cause memory issues)

**Recommendation:**
```typescript
async function fetchPdfBuffer(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
  
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'Accept': 'application/pdf',
        'User-Agent': 'LitLens-RAG/1.0',
      },
    });
    
    // Add size check
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
      throw new Error('PDF too large (>50MB)');
    }
    
    // ... existing validation ...
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('PDF fetch timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

#### GAP R2: Chunking Strategy Limitations
**Location:** `src/lib/rag/ingestion.ts:111-138`, `src/infrastructure/rag/ingestion-service.ts:240-273`

**Issue:**
- ⚠️ Fixed-size chunking (1000 chars) doesn't respect semantic boundaries
- ⚠️ No handling for tables, figures, equations (common in research papers)
- ⚠️ Overlap (200 chars) may split important sentences
- ⚠️ No metadata extraction for sections (Introduction, Methods, Results, etc.)

**Impact:** Lower retrieval quality for structured content

**Recommendation:**
- Implement semantic chunking using sentence transformers
- Add section detection (regex or ML-based)
- Preserve table/figure captions as separate chunks with metadata

#### GAP R3: Embedding Generation - Rate Limiting
**Location:** `src/lib/rag/embeddings.ts:18-33`, `src/infrastructure/rag/ingestion-service.ts:154-191`

**Issue:**
- ✅ Batch processing exists (5 chunks at a time)
- ⚠️ **MISSING:** No exponential backoff on rate limit errors
- ⚠️ **MISSING:** No retry logic for transient API failures
- ⚠️ **MISSING:** No cost tracking/monitoring

**Current Code:**
```typescript
// Batch size 5, delay 200ms - but no error handling
const BATCH_SIZE = 5;
for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
  const batch = chunks.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(async (chunk, idx) => {
    try {
      const embedding = await generateEmbedding(chunk.content);
      // ... insert ...
    } catch (err) {
      console.error(`[RAG] Failed to ingest chunk ${i + idx}`, err);
      // ❌ FAILS SILENTLY - chunk is lost forever
    }
  }));
}
```

**Recommendation:**
- Implement retry with exponential backoff
- Track failed chunks for manual review
- Add circuit breaker pattern for API failures

#### GAP R4: Vector Store Query Performance
**Location:** `src/infrastructure/rag/prisma-vector-store.ts:17-56`

**Issue:**
- ⚠️ No index on `(projectId, finalDecision)` for filtering
- ⚠️ Hybrid search uses `content_tsv` but no GIN index visible in schema
- ⚠️ No query plan analysis/optimization

**Recommendation:**
```sql
-- Add composite index for common filter pattern
CREATE INDEX idx_projectwork_project_decision 
ON "ProjectWork"("projectId", "finalDecision") 
WHERE "finalDecision" = 'INCLUDE';

-- Ensure GIN index exists for full-text search
CREATE INDEX idx_documentchunk_content_tsv 
ON "DocumentChunk" USING GIN("content_tsv");
```

#### GAP R5: Ingestion Queue - Error Recovery
**Location:** `src/infrastructure/jobs/ingestion-queue.ts:109-194`

**Issue:**
- ✅ BullMQ retry mechanism exists (3 attempts, exponential backoff)
- ⚠️ **MISSING:** No dead-letter queue for permanently failed jobs
- ⚠️ **MISSING:** No manual retry mechanism for admins
- ⚠️ **MISSING:** No alerting when failure rate exceeds threshold

**Recommendation:**
- Add dead-letter queue with admin notification
- Implement job retry API endpoint
- Add metrics dashboard for ingestion health

#### GAP R6: RAG Retrieval - Missing Filters
**Location:** `src/lib/rag/retrieval.ts:70-174`

**Issue:**
- ✅ `onlyIncluded` filter exists
- ⚠️ **MISSING:** No date range filtering (e.g., only papers from last 5 years)
- ⚠️ **MISSING:** No filtering by study type/metadata
- ⚠️ **MISSING:** No deduplication of similar chunks from same paper

**Impact:** Users can't narrow search scope effectively

#### GAP R7: Reranking Integration - Optional Dependency
**Location:** `src/lib/rag/reranking.ts:22-84`

**Issue:**
- ✅ Graceful fallback when Cohere API unavailable
- ⚠️ **MISSING:** No A/B testing to measure reranking impact
- ⚠️ **MISSING:** No cost tracking for Cohere API calls

**Recommendation:**
- Add feature flag for reranking
- Track retrieval quality metrics (precision@k, recall@k)
- Compare reranked vs non-reranked results

#### GAP R8: PDF Caching - R2 Storage
**Location:** `src/lib/rag/pipeline.ts:62-82`

**Issue:**
- ✅ R2 caching exists
- ⚠️ **MISSING:** No cache invalidation strategy (what if PDF is updated?)
- ⚠️ **MISSING:** No cache size limits/monitoring
- ⚠️ **MISSING:** No compression for large PDFs

**Recommendation:**
- Implement cache versioning (use `pdfUploadedAt` timestamp)
- Add cache cleanup job for old/unused PDFs
- Monitor R2 storage costs

### 1.3 Data Flow Issues

#### Issue R9: Dual Ingestion Paths
**Problem:** Two ingestion implementations exist:
1. Legacy: `src/lib/rag/ingestion.ts` (used by `pipeline.ts`)
2. New: `src/infrastructure/rag/ingestion-service.ts` (used by worker)

**Impact:** Inconsistency, maintenance burden, potential bugs

**Recommendation:** 
- Deprecate legacy code
- Migrate all callers to new service
- Remove `src/lib/rag/ingestion.ts` after migration

#### Issue R10: Missing Chunk Metadata
**Problem:** Chunks don't store:
- Section name (Introduction, Methods, etc.)
- Figure/table references
- Citation context
- Language (for multilingual papers)

**Impact:** Lower quality citations in AI responses

### 1.4 Security & Privacy Concerns

#### SECURITY R1: PDF Content Validation
**Issue:** No scanning for malicious PDFs (embedded scripts, malware)

**Recommendation:** Add PDF sanitization library (e.g., `pdf-lib` validation)

#### SECURITY R2: Embedding API Key Exposure
**Issue:** OpenAI API key in environment variable (standard practice) but no rotation mechanism

**Recommendation:** Implement key rotation policy

---

## PART 2: SCREENING WORKFLOWS END-TO-END AUDIT

### 2.1 Workflow Overview

**Phases:**
1. **TITLE_ABSTRACT** → Initial screening based on title/abstract
2. **FULL_TEXT** → Full PDF review
3. **FINAL** → Final inclusion decision

**State Machine:** `src/domain/screening/state-machine.ts`

### 2.2 Critical Gaps Identified

#### GAP S1: Auto-Advance Logic - PARTIALLY FIXED
**Location:** `src/domain/screening/state-machine.ts:173-180`

**Current Logic:**
```typescript
private static shouldAutoAdvancePhase(
  currentPhase: ScreeningPhase,
  decision: ScreeningDecision
): boolean {
  return currentPhase === 'TITLE_ABSTRACT' && decision === 'INCLUDE';
}
```

**Issue:**
- ✅ Only advances on INCLUDE consensus (correct)
- ⚠️ **MISSING:** No validation that PDF is available before advancing to FULL_TEXT
- ⚠️ **MISSING:** No check if ingestion is complete before allowing FULL_TEXT screening

**Impact:** Users may advance to FULL_TEXT phase without PDFs available

**Recommendation:**
```typescript
private static shouldAutoAdvancePhase(
  context: DecisionContext,
  decision: ScreeningDecision
): boolean {
  if (context.phase !== 'TITLE_ABSTRACT' || decision !== 'INCLUDE') {
    return false;
  }
  
  // ✅ NEW: Check if PDF is available (requires async check in service layer)
  // This should be validated in ScreeningService before applying transition
  return true;
}

// In ScreeningService.applyStateTransition:
if (result.shouldAdvancePhase && result.newPhase === 'FULL_TEXT') {
  const hasPdf = await this.deps.repository.hasPdfAvailable(projectWork.workId);
  if (!hasPdf) {
    // Don't advance, mark as needing PDF fetch
    await this.deps.repository.updateProjectWorkStatus(projectWork.id, {
      status: 'PENDING',
      phase: 'TITLE_ABSTRACT', // Stay in current phase
    });
    // Queue PDF fetch
    await this.deps.pdfFetcher.queueFetch(projectWork.workId);
    return; // Don't advance yet
  }
}
```

#### GAP S2: Conflict Resolution - Logic Inconsistency
**Location:** `src/app/api/projects/[id]/screening/advance-phase/route.ts:90-124`

**Issue:**
- ⚠️ Repair logic sorts decisions by `createdAt DESC` (newest first)
- ⚠️ But conflict detection uses `Set` of decisions (order-independent)
- ⚠️ **MISSING:** No handling for 3+ reviewers with split decisions (e.g., 2 INCLUDE, 1 EXCLUDE)

**Current Code:**
```typescript
const sortedDecisions = [...study.decisions].sort(
  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
);

const uniqueDecisions = new Set(sortedDecisions.map(d => d.decision));

if (uniqueDecisions.size === 1) {
  finalDecision = sortedDecisions[0].decision; // ✅ Consensus
} else if (study.decisions.length >= 2 && uniqueDecisions.size > 1) {
  // ⚠️ What if 2 INCLUDE, 1 EXCLUDE? Should be INCLUDE (majority)
  console.warn(`[AdvancePhase] Skipping study ${study.id} - unresolved conflict`);
  continue;
}
```

**Recommendation:**
```typescript
// Implement majority rule
const decisionCounts = new Map<ScreeningDecision, number>();
sortedDecisions.forEach(d => {
  decisionCounts.set(d.decision, (decisionCounts.get(d.decision) || 0) + 1);
});

const maxCount = Math.max(...decisionCounts.values());
const majorityDecisions = Array.from(decisionCounts.entries())
  .filter(([_, count]) => count === maxCount)
  .map(([decision]) => decision);

if (majorityDecisions.length === 1) {
  finalDecision = majorityDecisions[0]; // Majority wins
} else {
  // True tie - requires conflict resolution
  console.warn(`[AdvancePhase] True tie for study ${study.id}`);
  continue;
}
```

#### GAP S3: Ingestion Trigger - Timing Issue
**Location:** `src/domain/screening/state-machine.ts:139-146`, `src/infrastructure/screening/screening-service.ts:261-268`

**Current Logic:**
```typescript
const isFullTextOrLater = context.phase === 'FULL_TEXT' || context.phase === 'FINAL';
const shouldIngest = consensusDecision === 'INCLUDE' && isFullTextOrLater && !shouldAdvance;
```

**Issue:**
- ✅ Triggers on INCLUDE at FULL_TEXT/FINAL
- ⚠️ **MISSING:** No check if PDF exists before queuing ingestion
- ⚠️ **MISSING:** No check if ingestion already completed
- ⚠️ **MISSING:** Race condition - multiple INCLUDE decisions could queue multiple ingestion jobs

**Impact:** Wasted API calls, duplicate ingestion attempts

**Recommendation:**
```typescript
// In ScreeningService.applyStateTransition:
if (result.shouldTriggerIngestion) {
  // Check if already ingested or in progress
  const projectWork = await this.deps.repository.getProjectWork(projectWork.id);
  if (projectWork.ingestionStatus === 'COMPLETED' || 
      projectWork.ingestionStatus === 'PROCESSING') {
    console.log(`[Screening] Skipping ingestion - already ${projectWork.ingestionStatus}`);
    return;
  }
  
  // Check if PDF exists
  if (!projectWork.pdfR2Key && !projectWork.work.url) {
    console.warn(`[Screening] Cannot ingest - no PDF available`);
    // Optionally queue PDF fetch first
    return;
  }
  
  await this.deps.ingestionQueue.enqueueIngestion({
    projectWorkId: projectWork.id,
    workId: projectWork.workId,
    source: 'screening_decision',
  });
}
```

#### GAP S4: Dual Screening - State Consistency
**Location:** `src/domain/screening/state-machine.ts:37-55`

**Issue:**
- ✅ Checks `config.reviewersNeeded` correctly
- ⚠️ **MISSING:** No validation that same reviewer doesn't vote twice
- ⚠️ **MISSING:** No handling for reviewer removal mid-screening

**Current Code:**
```typescript
// Rule 1: Insufficient decisions - Still screening
if (allDecisions.length < config.reviewersNeeded) {
  return this.createWaitingForReviewersResult(context);
}
```

**Problem:** If a reviewer is removed from project, their decision still counts, but `reviewersNeeded` might change.

**Recommendation:**
- Add `isActive` flag to project members
- Filter decisions by active reviewers only
- Add migration to handle historical data

#### GAP S5: Batch Decision Application - Missing Validation
**Location:** `src/app/api/projects/[id]/screening/batch/route.ts:297-365`

**Issue:**
- ⚠️ Batch AI application doesn't use `ScreeningService` (bypasses state machine)
- ⚠️ Direct status updates without conflict checking
- ⚠️ No validation that all studies are in same phase

**Current Code:**
```typescript
// ❌ Bypasses state machine
await tx.projectWork.update({
  where: { id: study.id },
  data: { status, finalDecision: decision },
});
```

**Recommendation:**
- Use `ScreeningService.processDecision` for each study
- Validate phase consistency
- Add transaction rollback on any failure

#### GAP S6: Phase Advancement - Validation Gaps
**Location:** `src/app/api/projects/[id]/screening/advance-phase/route.ts:32-179`

**Issue:**
- ✅ Checks for pending/conflicts before advancing
- ⚠️ **MISSING:** No validation that all INCLUDED studies have PDFs (for FULL_TEXT phase)
- ⚠️ **MISSING:** No check for studies stuck in SCREENING status
- ⚠️ **MISSING:** No atomic transaction - partial advancement possible on error

**Recommendation:**
```typescript
// Before advancing to FULL_TEXT, check PDF availability
if (nextPhase === 'FULL_TEXT') {
  const worksWithoutPdf = await db.projectWork.findMany({
    where: {
      projectId,
      phase: currentPhase,
      status: 'INCLUDED',
      pdfR2Key: null,
      work: { url: null },
    },
  });
  
  if (worksWithoutPdf.length > 0) {
    throw new ValidationError(
      `Cannot advance: ${worksWithoutPdf.length} included studies lack PDFs. ` +
      `Please fetch PDFs or mark as excluded.`
    );
  }
}

// Use transaction for atomicity
await db.$transaction(async (tx) => {
  // ... advancement logic ...
});
```

#### GAP S7: Queue Filtering - Blind Screening Edge Case
**Location:** `src/app/api/projects/[id]/screening/queue/route.ts:139-146`

**Issue:**
- ✅ Excludes studies user already decided on
- ⚠️ **MISSING:** No handling for blind screening where user shouldn't see other decisions
- ⚠️ **MISSING:** Queue might show studies that are already fully decided (status should be INCLUDED/EXCLUDED, not PENDING)

**Current Code:**
```typescript
where.decisions = {
  none: {
    reviewerId: session.user.id,
    phase: filters.phase || "TITLE_ABSTRACT",
  },
};
```

**Problem:** If blind screening is enabled, user shouldn't see studies awaiting other reviewers (they might infer decisions).

**Recommendation:**
```typescript
// For blind screening, only show studies with no decisions yet
if (project?.blindScreening && membership.role === "REVIEWER") {
  where.decisions = {
    none: {
      phase: filters.phase || "TITLE_ABSTRACT",
    },
  };
} else {
  where.decisions = {
    none: {
      reviewerId: session.user.id,
      phase: filters.phase || "TITLE_ABSTRACT",
    },
  };
}
```

#### GAP S8: AI Suggestion Caching - Stale Data Risk
**Location:** `src/lib/services/ai-screening.ts:145-232`

**Issue:**
- ✅ Only generates suggestions for studies without them
- ⚠️ **MISSING:** No invalidation when criteria change
- ⚠️ **MISSING:** No refresh mechanism for low-confidence suggestions

**Impact:** Users see outdated AI suggestions after protocol updates

**Recommendation:**
- Add `criteriaVersion` to Project model
- Invalidate suggestions when criteria change
- Add "Regenerate AI Suggestions" button for leads

#### GAP S9: Conflict Resolution - Missing Ingestion Trigger
**Location:** `src/app/api/projects/[id]/conflicts/[conflictId]/resolve/route.ts:87-136`

**Issue:**
- ✅ Checks for ingestion trigger
- ⚠️ **MISSING:** Uses direct queue enqueue instead of `ScreeningService`
- ⚠️ **MISSING:** No validation that PDF exists before queuing

**Recommendation:**
- Use `ScreeningService.resolveConflict` (already implemented)
- Add PDF existence check

#### GAP S10: Decision Record - Missing Audit Trail
**Location:** `prisma/schema.prisma:499-520` (ScreeningDecisionRecord)

**Issue:**
- ✅ Stores decision, reasoning, confidence
- ⚠️ **MISSING:** No `updatedAt` timestamp (decisions shouldn't change, but audit trail is important)
- ⚠️ **MISSING:** No `ipAddress` or `userAgent` for security auditing
- ⚠️ **MISSING:** No `previousDecision` field (for tracking decision changes if allowed)

**Recommendation:**
- Add `updatedAt` (even if immutable, shows when record was created)
- Add optional audit fields for compliance
- Consider decision versioning if changes are allowed

### 2.3 State Machine Logic Issues

#### Issue S11: Status vs Phase Confusion
**Problem:** `status` (PENDING, SCREENING, INCLUDED, etc.) and `phase` (TITLE_ABSTRACT, FULL_TEXT, FINAL) are separate but related concepts.

**Example Confusion:**
- Study can be `status: INCLUDED` but `phase: TITLE_ABSTRACT` (waiting to advance)
- Study can be `status: PENDING` but `phase: FULL_TEXT` (after advancement)

**Impact:** Complex queries, potential bugs

**Recommendation:**
- Document state transition matrix clearly
- Add database constraints to prevent invalid combinations
- Consider computed column: `computed_status` that combines phase + status

#### Issue S12: MAYBE Decision Handling
**Problem:** `MAYBE` decision exists but:
- No clear workflow for resolving MAYBE decisions
- No automatic escalation
- No notification to leads when many MAYBE decisions accumulate

**Recommendation:**
- Add "Resolve MAYBE" workflow
- Auto-escalate MAYBE decisions after X days
- Add dashboard for pending MAYBE decisions

### 2.4 Data Integrity Issues

#### Issue S13: Orphaned Decisions
**Problem:** If a `ProjectWork` is deleted, `ScreeningDecisionRecord` entries remain (CASCADE should handle this, but verify).

**Recommendation:**
- Verify Prisma schema has `onDelete: Cascade` on all foreign keys
- Add database-level foreign key constraints

#### Issue S14: Duplicate Decision Prevention
**Location:** `src/domain/screening/state-machine.ts:262-292` (DecisionValidator)

**Issue:**
- ✅ Checks if reviewer already decided
- ⚠️ **MISSING:** Race condition - two requests could both pass validation and create duplicate decisions

**Current Code:**
```typescript
static validate(params: {
  reviewerId: string;
  existingDecisions: readonly DecisionRecord[];
  config: ScreeningConfig;
}): { valid: boolean; error?: string } {
  const alreadyDecided = params.existingDecisions.some(
    d => d.reviewerId === params.reviewerId
  );
  // ❌ Race condition: another request could insert decision between check and insert
}
```

**Recommendation:**
- Use database unique constraint: `UNIQUE(projectWorkId, reviewerId, phase)`
- Handle constraint violation gracefully in API

### 2.5 Performance & Scalability

#### Issue S15: N+1 Query Problem
**Location:** `src/app/api/projects/[id]/screening/queue/route.ts:165-210`

**Issue:**
- Multiple `include` statements could cause N+1 queries
- No query optimization visible

**Recommendation:**
- Use Prisma query logging to identify N+1 issues
- Consider DataLoader pattern for batch loading
- Add database query performance monitoring

#### Issue S16: Queue Pagination
**Location:** `src/app/api/projects/[id]/screening/queue/route.ts:78-94`

**Issue:**
- Standard pagination works but:
- ⚠️ No cursor-based pagination for large datasets
- ⚠️ No caching of queue results

**Recommendation:**
- Implement cursor pagination for better performance
- Add Redis caching for frequently accessed queues

---

## PART 3: CROSS-CUTTING CONCERNS

### 3.1 Error Handling

**Issues:**
- ⚠️ Many `try-catch` blocks only log errors, don't return user-friendly messages
- ⚠️ No centralized error tracking (Sentry, etc.)
- ⚠️ No error recovery strategies

**Recommendation:**
- Implement structured error types
- Add error tracking service
- Create error recovery workflows

### 3.2 Testing Coverage

**Issues:**
- ⚠️ No visible unit tests for state machine logic
- ⚠️ No integration tests for screening workflows
- ⚠️ No E2E tests for RAG ingestion

**Recommendation:**
- Add comprehensive test suite
- Test edge cases (conflicts, race conditions, etc.)
- Add property-based tests for state machine

### 3.3 Monitoring & Observability

**Issues:**
- ⚠️ No metrics collection (Prometheus, etc.)
- ⚠️ No distributed tracing (OpenTelemetry)
- ⚠️ Limited logging (console.log only)

**Recommendation:**
- Add structured logging (Winston, Pino)
- Implement metrics collection
- Add distributed tracing for complex workflows

### 3.4 Documentation

**Issues:**
- ⚠️ No API documentation (OpenAPI/Swagger)
- ⚠️ No architecture diagrams
- ⚠️ Limited inline documentation

**Recommendation:**
- Generate API docs from code
- Create architecture diagrams
- Add comprehensive README files

---

## PART 4: PRIORITY RECOMMENDATIONS

### 🔴 CRITICAL (Fix Immediately)

1. **GAP S3:** Fix ingestion trigger race condition (duplicate jobs)
2. **GAP S6:** Add PDF availability check before advancing to FULL_TEXT
3. **GAP S14:** Add database constraint to prevent duplicate decisions
4. **GAP R3:** Add retry logic for failed embedding generation (don't lose chunks silently)

### 🟡 HIGH (Fix Soon)

5. **GAP S2:** Implement majority rule for conflict resolution
6. **GAP S4:** Filter decisions by active reviewers only
7. **GAP R1:** Add timeout and size limits for PDF fetching
8. **GAP R5:** Add dead-letter queue for failed ingestion jobs

### 🟢 MEDIUM (Fix When Possible)

9. **GAP R2:** Implement semantic chunking for better retrieval
10. **GAP S7:** Fix blind screening queue filtering
11. **GAP R6:** Add more search filters (date range, study type)
12. **GAP S8:** Invalidate AI suggestions when criteria change

### 🔵 LOW (Nice to Have)

13. **GAP R7:** Add A/B testing for reranking
14. **GAP R8:** Implement cache invalidation strategy
15. **GAP S12:** Add MAYBE decision resolution workflow

---

## PART 5: TESTING RECOMMENDATIONS

### Unit Tests Needed

1. **State Machine Logic:**
   - Test all state transitions
   - Test conflict detection
   - Test auto-advance conditions
   - Test edge cases (3+ reviewers, etc.)

2. **RAG Components:**
   - Test chunking with various PDF structures
   - Test embedding generation error handling
   - Test retrieval with different filters

### Integration Tests Needed

1. **Screening Workflow:**
   - Test full workflow: TITLE_ABSTRACT → FULL_TEXT → FINAL
   - Test conflict resolution end-to-end
   - Test batch operations

2. **RAG Pipeline:**
   - Test PDF fetch → extraction → chunking → embedding → storage
   - Test retrieval → reranking → AI response

### E2E Tests Needed

1. **User Scenarios:**
   - Dual screening with conflicts
   - PDF ingestion after INCLUDE decision
   - Phase advancement with validation

---

## CONCLUSION

The codebase demonstrates solid architecture and clean separation of concerns. However, several critical gaps exist that could lead to:

1. **Data Loss:** Silent failures in embedding generation
2. **User Frustration:** Advancing to FULL_TEXT without PDFs
3. **Race Conditions:** Duplicate decisions, duplicate ingestion jobs
4. **Poor Retrieval Quality:** Fixed-size chunking, missing metadata

**Overall Risk Level:** ⚠️ **MODERATE-HIGH**

**Recommended Action Plan:**
1. Address all CRITICAL gaps immediately
2. Implement comprehensive test suite
3. Add monitoring and observability
4. Create runbook for common issues
5. Schedule regular architecture reviews

---

**End of Report**

