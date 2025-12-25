# LitLens Screening System - Consolidated Implementation Plan
## Synthesized from 4 Comprehensive Audits

**Date:** December 25, 2025  
**Target Codebase:** `/Users/zak/Documents/litlens`  
**Reference Codebase:** `/Users/zak/Desktop/sysreview`

---

## Executive Summary

This plan consolidates findings from four comprehensive audits comparing LitLens against a reference systematic review application. The core issue: **your backend is feature-complete, but the UI exposes ~30% of capabilities and lacks systematic review workflow guidance.**

### The "Pipeline Exhausted" Problem
- **What it means:** Your screening queue returned 0 studies for YOU for the current phase (Title/Abstract)
- **Why it's bad:** The UI shows a dead-end with a non-functional "Return to Workspace" button
- **Root cause:** No phase progression mechanism in UI; the backend `move_phase` batch operation exists but is never called
- **User impact:** Reviewers complete Title/Abstract screening and don't know what's next

### Critical Findings
1. ✅ **Backend is solid:** Phase progression, conflicts, analytics, AI suggestions, batch operations all implemented
2. ❌ **UI is incomplete:** Only shows basic screening queue; no workflow guidance, broken conflict resolution, hidden admin tools
3. ❌ **Missing industry-standard features:** Required exclusion reasons, confidence tracking, inter-rater reliability, PRISMA compliance
4. ❌ **Partner's AI theme discussion feature:** Not implemented in either codebase

---

## Part 1: Critical Bugs & UX Blockers (Fix Immediately)

### 1.1 Fix "Pipeline Exhausted" Dead-End
**Current State:**
- `src/features/screening/components/ScreeningQueue.tsx` lines 163-183 shows empty state
- "Return to Workspace" button has no `onClick` handler (line 180)
- No indication of what comes next

**Implementation:**
```typescript
// In ScreeningQueue.tsx empty state section
<Button 
  onClick={() => router.push(`/project/${projectId}`)}
  variant="outline"
>
  Return to Project Dashboard
</Button>
<Button 
  onClick={handleCheckNextPhase}
  variant="default"
>
  Check Next Steps
</Button>
```

**Add next-step logic:**
1. Check if conflicts exist → show "Resolve X conflicts first"
2. Check if other reviewers still screening → show "Waiting for team"
3. Check phase completion → suggest "Move to Full Text Screening"
4. Show summary stats (included/excluded/maybe counts)

**Files to modify:**
- `src/features/screening/components/ScreeningQueue.tsx`
- Add new endpoint: `src/app/api/projects/[id]/screening/next-steps/route.ts`

---

### 1.2 Fix Broken Conflict Resolution UI
**Current State:**
- `src/features/screening/components/ConflictAdjudicator.tsx` line 47 queries `status=OPEN`
- DB schema uses `PENDING | IN_DISCUSSION | RESOLVED` (not "OPEN")
- Resolution buttons just `console.log()` (lines 143-156)
- Client API mismatch: some code uses PATCH `/conflicts/{id}`, some uses POST `/conflicts/{id}/resolve`

**Implementation:**
1. Fix status query to use `PENDING`
2. Wire resolution buttons to correct API endpoint
3. Add optimistic updates for better UX
4. Show side-by-side comparison of conflicting decisions

**Files to modify:**
- `src/features/screening/components/ConflictAdjudicator.tsx`
- `src/lib/api-client.ts` (consolidate conflict APIs)
- `src/hooks/api/use-screening.ts`

---

### 1.3 Implement Phase Progression Mechanism
**Current State:**
- Backend has `move_phase` batch operation (`src/app/api/projects/[id]/screening/batch/route.ts` lines 18-34, 127-144)
- No UI calls this endpoint
- Studies stay in TITLE_ABSTRACT forever even when included

**Implementation:**
Create "Phase Manager" component for project leads:
1. Show current phase status (% complete, conflicts, team progress)
2. Validate prerequisites (min reviewers, conflict resolution)
3. Button: "Move Included Studies to Full Text Screening"
4. Calls batch API with `operation: "move_phase"`, `targetPhase: "FULL_TEXT"`

**New component:**
- `src/features/screening/components/PhaseManager.tsx`

**Add to:**
- Project dashboard or screening page (lead-only)

---

## Part 2: Missing Systematic Review Features (Industry Standard)

### 2.1 Required Exclusion Reasons
**Gap:** When users select "EXCLUDE", no reason is required (not PRISMA-compliant)

**Implementation:**
Add dropdown when EXCLUDE is selected:
```typescript
exclusionReasonOptions = [
  "Wrong Population",
  "Wrong Intervention", 
  "Wrong Comparison",
  "Wrong Outcome",
  "Wrong Study Type",
  "Duplicate",
  "Language",
  "Not Available",
  "Other (specify)"
]
```

**Backend support:** Already exists in `ScreeningDecisionRecord.exclusionReason` field

**Files to modify:**
- `src/features/screening/components/ScreeningQueue.tsx`
- Add validation in decision submission

---

### 2.2 Confidence Slider & Decision Notes
**Gap:** No reviewer confidence tracking (though backend supports it)

**Implementation:**
Add to decision panel:
- Confidence slider (0-100%)
- Optional notes field
- Time tracking (already implemented in backend)

**Fields already in DB:**
- `ScreeningDecisionRecord` has `reasoning` field
- `ProjectWork` has `aiConfidence` field (extend for reviewer confidence)

**Files to modify:**
- `src/features/screening/components/ScreeningQueue.tsx`
- `src/lib/validators/screening.ts` (add confidence to schema)

---

### 2.3 Keyword Highlighting System
**Gap:** No keyword-based screening assistance

**Reference has:** `KeywordHighlighter` component that highlights include (green) / exclude (red) keywords

**Implementation:**
1. Add keyword management UI (project settings)
2. Store keywords per-project in DB (new table or JSON field)
3. Highlight keywords in title/abstract during screening
4. API endpoints:
   - GET/POST `/api/projects/[id]/keywords`

**New components:**
- `src/features/screening/components/KeywordHighlighter.tsx`
- `src/app/(app)/project/[id]/settings/keywords/page.tsx`

**Database migration:**
```prisma
model Project {
  // ... existing fields
  includeKeywords  String[] @default([])
  excludeKeywords  String[] @default([])
}
```

---

### 2.4 Progress Statistics Dashboard
**Gap:** Users can't see team progress, consensus rates, or IRR metrics

**Backend exists:**
- `src/app/api/projects/[id]/screening/analytics/route.ts`
- `src/lib/services/screening-analytics.ts` (has Kappa, PRISMA flow, reviewer stats)

**Implementation:**
Create analytics tab in project showing:
- Per-reviewer completion stats
- Agreement rate (Cohen's Kappa)
- Screening timeline
- AI suggestion performance
- PRISMA flow diagram data
- Conflict statistics

**New page:**
- `src/app/(app)/project/[id]/screening-analytics/page.tsx`
- Reuse existing analytics API

---

### 2.5 Dual-Reviewer Workflow & Consensus
**Gap:** No enforcement of dual-screening or automatic consensus detection

**Backend partially exists:**
- Conflict creation in `src/app/api/projects/[id]/screening/decisions/route.ts`
- But no "required reviewers per study" logic

**Implementation:**
1. Add project setting: `requiredReviewersPerStudy` (default 2)
2. Track screening assignments per study
3. When 2+ reviewers submit same decision → auto-mark as CONSENSUS
4. When decisions differ → create CONFLICT
5. Show consensus/conflict status in queue

**Database additions:**
```prisma
model ProjectWork {
  // ... existing fields
  requiredReviewers Int @default(2)
  assignedReviewers String[]
  completedReviewers String[]
  consensusReached Boolean @default(false)
  consensusDecision ScreeningDecision?
}
```

---

## Part 3: Expose Hidden Backend Features

### 3.1 Smart Queue Strategies (Lead Tool)
**Gap:** Backend has 5 queue strategies, UI only uses default

**Strategies available:**
- `balanced` - Mix of all below
- `ai_confident` - AI high-confidence first (quick wins)
- `ai_uncertain` - AI low-confidence first (human expertise needed)
- `priority` - By priority score (recent, preferred journals, keywords)
- `random` - Reduce bias

**Implementation:**
Add queue strategy selector (lead-only):
```tsx
<Select onValueChange={setStrategy}>
  <SelectItem value="balanced">Balanced (Recommended)</SelectItem>
  <SelectItem value="ai_confident">AI Confident First</SelectItem>
  <SelectItem value="ai_uncertain">Need Human Review First</SelectItem>
  <SelectItem value="priority">Priority Order</SelectItem>
  <SelectItem value="random">Random (Reduce Bias)</SelectItem>
</Select>
```

**API call:**
```typescript
fetch(`/api/projects/${id}/screening/queue?smart=true&strategy=${strategy}`)
```

**Files to modify:**
- `src/features/screening/components/ScreeningQueue.tsx`
- Add strategy selector UI

---

### 3.2 Lead Batch Operations Panel
**Gap:** Powerful batch operations exist but no UI

**Operations available** (`src/app/api/projects/[id]/screening/batch/route.ts`):
- `apply_ai` - Apply AI suggestions to all pending studies
- `reset` - Reset decisions for specified studies
- `move_phase` - Move studies to next phase
- `assign` - Assign studies to specific reviewers
- `update_priority` - Bulk priority changes

**Implementation:**
Create "Admin Tools" panel (lead/owner only):
- Button: "Apply AI Decisions to All" (with confirmation)
- Button: "Move Included to Full Text"
- Reviewer assignment tool
- Batch reset (with filters)

**New component:**
- `src/features/screening/components/LeadTools.tsx`

---

### 3.3 AI Suggestion Generation Tool
**Gap:** AI suggestions API exists but can't be triggered from UI

**Current state:**
- Endpoint: `src/app/api/projects/[id]/screening/ai-suggestions/route.ts`
- Uses OpenAI to batch-generate suggestions
- Lead-only operation

**Implementation:**
Add button in Lead Tools:
```tsx
<Button onClick={generateAISuggestions} disabled={generating}>
  {generating ? "Generating AI Suggestions..." : "Generate AI Suggestions for All Pending"}
</Button>
```

Shows progress:
- "Analyzing 45 studies..."
- "Generated suggestions for 45 studies (12s)"

**Files to modify:**
- `src/features/screening/components/LeadTools.tsx`

---

### 3.4 Priority Scoring Configuration
**Gap:** Priority boosters exist in backend, no UI to configure

**Backend:** `src/lib/services/screening-queue.ts` lines 165-244
- Year boost (recent = higher priority)
- Journal boost (preferred journals)
- Keyword boost
- AI confidence factor

**Implementation:**
Add to project settings:
```tsx
<Form>
  <Label>Preferred Journals (boost priority)</Label>
  <MultiSelect options={journalList} />
  
  <Label>Priority Keywords</Label>
  <TagInput />
  
  <Label>Recency Weight</Label>
  <Slider min={0} max={2} step={0.1} />
</Form>
```

**New page:**
- `src/app/(app)/project/[id]/settings/screening/page.tsx`

---

## Part 4: Guided Workflow Implementation

### 4.1 Phase Progress Visualization
**Gap:** No visual indication of review phases

**Reference has:** Top progress bar showing 5 phases with lock/unlock states

**Implementation:**
Create workflow stepper component:
```tsx
<WorkflowStepper>
  <Step status="completed" label="Title/Abstract" />
  <Step status="current" label="Full Text" />
  <Step status="locked" label="Data Extraction" />
  <Step status="locked" label="Quality Assessment" />
  <Step status="locked" label="Completed" />
</WorkflowStepper>
```

**Phase gating rules:**
- Full Text: Requires Title/Abstract ≥80% complete + conflicts resolved
- Data Extraction: Requires Full Text ≥80% complete
- Quality Assessment: Requires Data Extraction ≥80% complete

**New component:**
- `src/features/screening/components/WorkflowStepper.tsx`

**Add to:**
- All project pages (persistent header)

---

### 4.2 Phase Transition Dialogs
**Gap:** No confirmation/guidance when moving phases

**Implementation:**
When lead clicks "Move to Full Text":
```tsx
<Dialog>
  <DialogTitle>Ready to Move to Full Text Screening?</DialogTitle>
  <DialogContent>
    <p>Summary:</p>
    <ul>
      <li>✅ 245 studies completed (98%)</li>
      <li>✅ 180 included → will move to Full Text</li>
      <li>✅ 60 excluded</li>
      <li>✅ 5 maybe → will move to Full Text</li>
      <li>✅ All conflicts resolved</li>
    </ul>
    <Alert>
      This will create 185 studies for Full Text Screening.
      Title/Abstract decisions cannot be changed after this.
    </Alert>
  </DialogContent>
  <DialogActions>
    <Button variant="outline">Cancel</Button>
    <Button onClick={confirmMovePhase}>Proceed to Full Text</Button>
  </DialogActions>
</Dialog>
```

**New component:**
- `src/features/screening/components/PhaseTransitionDialog.tsx`

---

### 4.3 Completion Summary Screen
**Gap:** "Pipeline Exhausted" is confusing; need proper completion UI

**Implementation:**
When user's queue is empty, show:
```tsx
<CompletionSummary>
  <Icon>✓</Icon>
  <Title>Title/Abstract Screening Complete!</Title>
  <Stats>
    <Stat label="Studies Screened" value={245} />
    <Stat label="Time Spent" value="3h 42m" />
    <Stat label="Your Decisions" value="Include: 180, Exclude: 60, Maybe: 5" />
  </Stats>
  
  {conflicts > 0 && (
    <Alert variant="warning">
      {conflicts} conflicts need resolution before proceeding
      <Button onClick={goToConflicts}>Resolve Conflicts</Button>
    </Alert>
  )}
  
  {waitingForTeam && (
    <Alert variant="info">
      Waiting for {remainingReviewers.length} team members to complete screening
    </Alert>
  )}
  
  {canProceed && (
    <Alert variant="success">
      Ready to proceed to Full Text Screening!
      {isLead && <Button onClick={movePhase}>Start Full Text Phase</Button>}
    </Alert>
  )}
  
  <Actions>
    <Button variant="outline" onClick={goToDashboard}>Return to Dashboard</Button>
    <Button onClick={viewAnalytics}>View Analytics</Button>
  </Actions>
</CompletionSummary>
```

**Files to modify:**
- `src/features/screening/components/ScreeningQueue.tsx`

---

## Part 5: Data Extraction & Quality Assessment Integration

### 5.1 Data Extraction Phase
**Current state:**
- Extraction components exist: `src/features/extraction/components/`
- Page exists: `src/app/(app)/project/[id]/extraction/page.tsx`
- NOT integrated into workflow

**Implementation:**
1. Only show extraction page when phase = FULL_TEXT complete
2. Create extraction templates (define fields to extract)
3. AI-assisted extraction suggestions
4. Double extraction with comparison
5. Extraction conflict resolution

**API routes needed:**
- GET/POST `/api/projects/[id]/extraction/templates`
- GET/POST `/api/projects/[id]/extraction/data`
- POST `/api/projects/[id]/extraction/conflicts`

**Database additions:**
```prisma
model ExtractionTemplate {
  id          String   @id @default(cuid())
  projectId   String
  name        String
  fields      Json     // Array of field definitions
  createdAt   DateTime @default(now())
  
  project     Project  @relation(...)
  extractions Extraction[]
}

model Extraction {
  id          String   @id @default(cuid())
  studyId     String
  projectId   String
  templateId  String
  extractorId String
  data        Json     // Extracted field values
  validated   Boolean  @default(false)
  createdAt   DateTime @default(now())
  
  study       ProjectWork @relation(...)
  project     Project @relation(...)
  template    ExtractionTemplate @relation(...)
  extractor   User @relation(...)
}
```

---

### 5.2 Quality Assessment Integration
**Current state:**
- RoB2 component exists: `src/components/quality/RoB2AssessmentForm.tsx`
- ROBINS-I component exists: `src/components/quality/ROBINSIAssessmentForm.tsx`
- Page exists: `src/app/(app)/project/[id]/quality/page.tsx`
- NOT integrated into workflow

**Implementation:**
1. Only unlock after data extraction
2. Select quality assessment tool per project (RoB2, ROBINS-I, Newcastle-Ottawa, etc.)
3. Dual assessment with conflict resolution
4. AI quality assessment suggestions
5. Export quality summary table

**API routes needed:**
- GET/POST `/api/projects/[id]/quality-assessment`
- POST `/api/projects/[id]/quality-assessment/conflicts`

**Database additions:**
```prisma
model QualityAssessment {
  id          String   @id @default(cuid())
  studyId     String
  projectId   String
  assessorId  String
  tool        String   // RoB2, ROBINS-I, etc.
  domains     Json     // Domain-by-domain ratings
  overallRisk String   // LOW, SOME_CONCERNS, HIGH
  notes       String?
  createdAt   DateTime @default(now())
  
  study       ProjectWork @relation(...)
  project     Project @relation(...)
  assessor    User @relation(...)
}
```

---

## Part 6: Advanced Features (Competitive Advantage)

### 6.1 Mobile Swipe Interface
**Current state:**
- Components exist: `src/components/screening/MobileScreeningCard.tsx`, `SwipeableCard.tsx`
- Not integrated or functional

**Implementation:**
1. Detect mobile viewport
2. Auto-switch to swipe mode
3. Gestures:
   - Swipe right → Include
   - Swipe left → Exclude
   - Swipe up → Maybe
   - Tap → View details
4. Offline support (IndexedDB for local decisions, sync when online)
5. Haptic feedback

**Files to modify:**
- `src/features/screening/components/ScreeningQueue.tsx` (add mobile detector)
- Complete `src/components/screening/SwipeableCard.tsx` implementation

---

### 6.2 Real-Time Collaboration
**Current state:**
- SSE infrastructure exists: `src/hooks/use-sse.ts`
- Presence hook exists: `src/hooks/use-presence.ts`
- Not fully utilized

**Implementation:**
1. Show online team members during screening
2. Real-time conflict notifications
3. Live decision updates (see when teammate screens same study)
4. Team activity feed
5. WebSocket or SSE-based updates

**New components:**
- `src/features/collaboration/components/OnlineUsers.tsx`
- `src/features/collaboration/components/LiveActivityFeed.tsx`

**API routes:**
- Enhance `src/app/api/presence/` endpoints

---

### 6.3 Advanced Filtering in Screening Queue
**Gap:** Can only get "next study", no filtering

**Implementation:**
Add filter panel:
```tsx
<Filters>
  <Select label="Status">
    <Option>Pending</Option>
    <Option>Conflict</Option>
    <Option>My Assignments</Option>
  </Select>
  
  <Select label="AI Recommendation">
    <Option>All</Option>
    <Option>Include</Option>
    <Option>Exclude</Option>
  </Select>
  
  <Input label="Journal" />
  <Input label="Author" />
  <RangeInput label="Year" min={1990} max={2025} />
</Filters>
```

**Files to modify:**
- `src/app/api/projects/[id]/screening/queue/route.ts` (add filter params)
- `src/features/screening/components/ScreeningQueue.tsx`

---

### 6.4 Calibration Rounds
**Current state:**
- DB schema exists: `CalibrationRound`, `CalibrationDecision`
- Validators exist: `src/lib/validators/screening.ts`
- NO API routes or UI

**Implementation:**
Calibration = team screens same small set to ensure agreement before full review

1. Lead creates calibration round (e.g., 20 studies)
2. All reviewers screen these studies
3. System calculates inter-rater agreement (Kappa)
4. If Kappa < threshold, discuss disagreements
5. Repeat until team is calibrated
6. Then proceed to full screening

**New API routes:**
- POST `/api/projects/[id]/calibration/rounds`
- POST `/api/projects/[id]/calibration/decisions`
- GET `/api/projects/[id]/calibration/results`

**New UI:**
- `src/app/(app)/project/[id]/calibration/page.tsx`

---

## Part 7: Partner's AI Theme Discussion Feature (Major Addition)

### 7.1 Requirements Analysis
**What they want:**
> "After cleaning extracted data, AI can discuss included documents with self-described or automatic theme generation"

**Breaking it down:**
1. **Input:** INCLUDED studies + extracted/validated data
2. **Output:** Thematic synthesis with AI discussion capability
3. **Features:**
   - Automatic theme identification (clustering)
   - Manual theme creation/editing
   - AI chat interface scoped to project
   - Evidence-to-theme linking
   - Exportable synthesis

**Current state:** Neither LitLens nor reference codebase has this end-to-end

---

### 7.2 Architecture for AI Theme Discussion

**7.2.1 Semantic Infrastructure**

Add OpenAI embeddings for semantic search:

```prisma
model ProjectWork {
  // ... existing fields
  embedding       String?  // Vector embedding (1536 dims)
  embeddingText   String?  // Text used for embedding
  embeddingUpdatedAt DateTime?
}
```

**Service:** `src/lib/services/semantic-search.ts`
```typescript
export async function generateEmbedding(text: string): Promise<number[]>
export async function semanticSearch(query: string, projectId: string, limit: number)
export async function clusterStudies(projectId: string): Promise<Cluster[]>
```

**API route:** `POST /api/projects/[id]/embeddings/generate`
- Batch generate embeddings for all included studies
- Store in DB
- Use for semantic search + clustering

---

**7.2.2 Automatic Theme Generation**

**Service:** `src/lib/services/thematic-analysis.ts`
```typescript
interface Theme {
  id: string
  label: string
  description: string
  studyIds: string[]
  confidence: number
  keywords: string[]
}

export async function generateThemes(projectId: string): Promise<Theme[]> {
  // 1. Get all INCLUDED studies with embeddings
  // 2. Cluster by semantic similarity (k-means or hierarchical)
  // 3. For each cluster:
  //    - Extract common keywords (TF-IDF)
  //    - Use GPT-4 to generate theme label + description
  //    - Assign confidence score
  // 4. Return themes
}
```

**API route:** `POST /api/projects/[id]/themes/generate`

**Database:**
```prisma
model Theme {
  id          String   @id @default(cuid())
  projectId   String
  label       String
  description String
  auto        Boolean  @default(false) // auto-generated vs manual
  studyIds    String[]
  keywords    String[]
  confidence  Float?
  createdAt   DateTime @default(now())
  createdById String
  
  project     Project @relation(...)
  createdBy   User @relation(...)
  messages    ThemeMessage[]
}
```

---

**7.2.3 AI Discussion/Chat Interface**

**RAG (Retrieval-Augmented Generation) approach:**

1. User asks: "What are the main findings about intervention X?"
2. System retrieves relevant studies (semantic search)
3. System retrieves relevant extracted data (filter by fields)
4. System constructs context from studies + extractions
5. OpenAI generates response with citations
6. Store conversation in DB

**Service:** `src/lib/services/ai-discussion.ts`
```typescript
interface Message {
  role: 'user' | 'assistant'
  content: string
  citations: { studyId: string, text: string }[]
}

export async function discussWithAI(
  projectId: string,
  themeId: string | null, // null = all included studies
  messages: Message[]
): Promise<Message>
```

**API route:** `POST /api/projects/[id]/themes/[themeId]/chat`

**Database:**
```prisma
model ThemeMessage {
  id        String   @id @default(cuid())
  themeId   String?
  projectId String
  userId    String
  role      String   // user | assistant
  content   String   @db.Text
  citations Json?    // Array of study citations
  createdAt DateTime @default(now())
  
  theme     Theme? @relation(...)
  project   Project @relation(...)
  user      User @relation(...)
}
```

---

**7.2.4 Theme Management UI**

**New page:** `src/app/(app)/project/[id]/themes/page.tsx`

```tsx
<ThemesDashboard>
  {/* Auto-generated themes */}
  <Section title="Discovered Themes">
    <Button onClick={generateThemes}>
      Generate Themes from Included Studies
    </Button>
    
    {themes.map(theme => (
      <ThemeCard 
        key={theme.id}
        theme={theme}
        onChat={() => openChat(theme.id)}
        onEdit={() => editTheme(theme.id)}
      />
    ))}
  </Section>
  
  {/* Manual themes */}
  <Section title="Custom Themes">
    <Button onClick={createTheme}>Create Theme</Button>
    {/* ... */}
  </Section>
  
  {/* Chat interface */}
  <ChatPanel
    projectId={projectId}
    themeId={selectedTheme}
    onClose={closeChat}
  />
</ThemesDashboard>
```

**Components:**
- `src/features/themes/components/ThemeCard.tsx`
- `src/features/themes/components/ThemeChatPanel.tsx`
- `src/features/themes/components/ThemeEditor.tsx`
- `src/features/themes/components/ThemeVisualization.tsx` (network graph of themes + studies)

---

**7.2.5 Evidence Linking**

Allow users to manually link extracted data to themes:

```tsx
<ExtractionView>
  {/* Show extracted data fields */}
  <Field label="Outcome" value="Reduced anxiety by 30%" />
  
  {/* Link to themes */}
  <ThemeLinks>
    <Badge onClick={linkToTheme}>Link to Theme</Badge>
    <Badge variant="outline">Mental Health Outcomes</Badge>
    <Badge variant="outline">Intervention Effectiveness</Badge>
  </ThemeLinks>
</ExtractionView>
```

**Database:**
```prisma
model ExtractionThemeLink {
  id           String @id @default(cuid())
  extractionId String
  themeId      String
  fieldPath    String // JSON path to specific field
  
  extraction   Extraction @relation(...)
  theme        Theme @relation(...)
  
  @@unique([extractionId, themeId, fieldPath])
}
```

---

**7.2.6 Synthesis Export**

Generate thematic synthesis document:

**API route:** `POST /api/projects/[id]/themes/export`

**Output formats:**
- PDF with themes, descriptions, evidence tables
- Word document (via docx library)
- Markdown

**Implementation:**
```typescript
// src/lib/services/synthesis-export.ts
export async function generateSynthesis(projectId: string): Promise<Document> {
  // 1. Get all themes with linked studies
  // 2. For each theme:
  //    - Theme description
  //    - List of included studies
  //    - Extracted data evidence table
  //    - AI-generated summary
  // 3. Generate GRADE tables if applicable
  // 4. Export to PDF/Word
}
```

---

### 7.3 Implementation Roadmap for AI Themes

**Phase 1: Semantic Infrastructure (2-3 days)**
1. Add embedding fields to schema
2. Create semantic-search service
3. API route for batch embedding generation
4. Test clustering algorithm

**Phase 2: Basic Theme Generation (2-3 days)**
1. Implement auto theme generation
2. Theme CRUD APIs
3. Basic theme list UI
4. Test with sample data

**Phase 3: AI Discussion (3-4 days)**
1. Implement RAG system
2. Chat API with citation support
3. Chat UI component
4. Message persistence

**Phase 4: Polish & Integration (2-3 days)**
1. Theme visualization
2. Evidence linking
3. Export functionality
4. Workflow integration (unlock themes after extraction)

**Total estimate:** 9-13 days for one developer

**Dependencies:**
- OpenAI API key (embeddings + chat)
- Sufficient token budget
- Vector similarity calculation (can use cosine similarity in JS, no special DB needed initially)

---

## Part 8: Implementation Priority Matrix

### P0 - Critical (Ship to unblock users)
**Timeline: 1-2 weeks**

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Fix "Pipeline Exhausted" button | 2h | HIGH | ScreeningQueue.tsx |
| Fix conflict resolution UI | 4h | HIGH | ConflictAdjudicator.tsx, API client |
| Add exclusion reason requirement | 3h | MEDIUM | ScreeningQueue.tsx, validators |
| Add next-steps logic & API | 6h | HIGH | New: next-steps/route.ts |
| Completion summary screen | 4h | HIGH | ScreeningQueue.tsx |
| Phase manager UI (lead) | 6h | HIGH | New: PhaseManager.tsx |

**Total:** ~3 days

---

### P1 - Important (Make it production-ready)
**Timeline: 2-4 weeks**

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Phase progress visualization | 6h | MEDIUM | New: WorkflowStepper.tsx |
| Confidence slider + notes | 4h | MEDIUM | ScreeningQueue.tsx |
| Keyword highlighting | 8h | MEDIUM | New: KeywordHighlighter.tsx, settings |
| Progress stats dashboard | 8h | MEDIUM | New: screening-analytics/page.tsx |
| Dual-reviewer enforcement | 12h | HIGH | Schema migration, decision API |
| Phase transition dialogs | 6h | MEDIUM | New: PhaseTransitionDialog.tsx |
| Smart queue strategy selector | 4h | LOW | ScreeningQueue.tsx |
| Lead batch operations panel | 8h | MEDIUM | New: LeadTools.tsx |

**Total:** ~7 days

---

### P2 - Nice to Have (Competitive features)
**Timeline: 1-2 months**

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Data extraction integration | 16h | MEDIUM | extraction/* APIs + workflow |
| Quality assessment integration | 16h | MEDIUM | quality/* APIs + workflow |
| Mobile swipe interface | 12h | LOW | SwipeableCard.tsx completion |
| Real-time collaboration | 16h | MEDIUM | WebSocket/SSE enhancement |
| Advanced filtering | 8h | LOW | Queue API enhancement |
| Calibration rounds | 12h | MEDIUM | New: calibration/* |
| PRISMA flow diagram generator | 8h | LOW | Analytics enhancement |

**Total:** ~11 days

---

### P3 - Future/Partner Request (Major feature)
**Timeline: 2-3 months**

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Semantic infrastructure | 16h | HIGH | semantic-search.ts, embeddings |
| Auto theme generation | 16h | HIGH | thematic-analysis.ts, clustering |
| AI discussion/chat | 24h | HIGH | ai-discussion.ts, chat UI |
| Theme management UI | 16h | MEDIUM | themes/* pages + components |
| Evidence linking | 12h | MEDIUM | Extraction enhancement |
| Synthesis export | 12h | MEDIUM | synthesis-export.ts |

**Total:** ~12 days (AI themes feature)

---

## Part 9: Database Migrations Summary

### Migration 1: Fix Conflicts & Add Phase Progression Fields
```prisma
model ProjectWork {
  // ... existing fields
  requiredReviewers   Int      @default(2)
  assignedReviewers   String[]
  completedReviewers  String[]
  consensusReached    Boolean  @default(false)
  consensusDecision   ScreeningDecision?
}

model Conflict {
  status ConflictStatus // Ensure PENDING | IN_DISCUSSION | RESOLVED
}
```

---

### Migration 2: Keyword Support
```prisma
model Project {
  // ... existing fields
  includeKeywords String[] @default([])
  excludeKeywords String[] @default([])
}
```

---

### Migration 3: Extraction System
```prisma
model ExtractionTemplate {
  id        String   @id @default(cuid())
  projectId String
  name      String
  fields    Json
  createdAt DateTime @default(now())
  
  project     Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  extractions Extraction[]
}

model Extraction {
  id          String   @id @default(cuid())
  studyId     String
  projectId   String
  templateId  String
  extractorId String
  data        Json
  validated   Boolean  @default(false)
  createdAt   DateTime @default(now())
  
  study    ProjectWork        @relation(fields: [studyId], references: [id], onDelete: Cascade)
  project  Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)
  template ExtractionTemplate @relation(fields: [templateId], references: [id])
  extractor User              @relation(fields: [extractorId], references: [id])
}
```

---

### Migration 4: Quality Assessment
```prisma
model QualityAssessment {
  id          String   @id @default(cuid())
  studyId     String
  projectId   String
  assessorId  String
  tool        String
  domains     Json
  overallRisk String
  notes       String?
  createdAt   DateTime @default(now())
  
  study    ProjectWork @relation(fields: [studyId], references: [id], onDelete: Cascade)
  project  Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assessor User        @relation(fields: [assessorId], references: [id])
}
```

---

### Migration 5: AI Themes System
```prisma
model ProjectWork {
  // ... existing fields
  embedding          String?  // Stores JSON array of numbers
  embeddingText      String?
  embeddingUpdatedAt DateTime?
}

model Theme {
  id          String   @id @default(cuid())
  projectId   String
  label       String
  description String   @db.Text
  auto        Boolean  @default(false)
  studyIds    String[]
  keywords    String[]
  confidence  Float?
  createdAt   DateTime @default(now())
  createdById String
  
  project     Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy   User           @relation(fields: [createdById], references: [id])
  messages    ThemeMessage[]
}

model ThemeMessage {
  id        String   @id @default(cuid())
  themeId   String?
  projectId String
  userId    String
  role      String
  content   String   @db.Text
  citations Json?
  createdAt DateTime @default(now())
  
  theme   Theme?  @relation(fields: [themeId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id])
}

model ExtractionThemeLink {
  id           String @id @default(cuid())
  extractionId String
  themeId      String
  fieldPath    String
  
  extraction Extraction @relation(fields: [extractionId], references: [id], onDelete: Cascade)
  theme      Theme      @relation(fields: [themeId], references: [id], onDelete: Cascade)
  
  @@unique([extractionId, themeId, fieldPath])
}
```

---

## Part 10: Testing Strategy

### Unit Tests (Vitest)
**Priority test files:**
1. `src/lib/services/__tests__/screening-queue.test.ts` (smart strategies)
2. `src/lib/services/__tests__/conflict-resolution.test.ts` (consensus detection)
3. `src/lib/services/__tests__/thematic-analysis.test.ts` (clustering)
4. `src/lib/validators/__tests__/screening.test.ts` (validation logic)

---

### Integration Tests
**API route tests:**
1. `src/app/api/projects/[id]/screening/next-steps/__tests__/route.test.ts`
2. `src/app/api/projects/[id]/screening/batch/__tests__/route.test.ts`
3. `src/app/api/projects/[id]/themes/__tests__/route.test.ts`

---

### E2E Tests (Playwright)
**User flows:**
1. Complete Title/Abstract screening → see next steps
2. Resolve conflict → verify status updates
3. Lead moves phase → verify studies transition
4. Generate themes → chat with AI → export synthesis

---

## Part 11: Quick Wins (< 1 day each)

1. **Fix Return to Workspace button** (2 hours)
   - Add `onClick={() => router.push(`/project/${projectId}`)}`

2. **Show conflict count in UI** (3 hours)
   - Add conflict count badge to sidebar
   - Add to completion summary

3. **Add decision time display** (2 hours)
   - Show "Average time per decision: 45s" in stats

4. **Add keyboard shortcuts hint** (1 hour)
   - Show "Press I (Include), E (Exclude), M (Maybe)" in UI

5. **Add study counter** (1 hour)
   - "Study 23 of 245" in screening card header

6. **Export decisions to CSV** (3 hours)
   - Button in analytics to download decisions

7. **Add "Skip to next" button** (2 hours)
   - Let users skip studies and come back later

8. **Show AI agreement rate** (2 hours)
   - "You agreed with AI 78% of the time"

---

## Part 12: Success Metrics

### User Experience Metrics
- **Time to complete screening phase** (should decrease with smart queue)
- **Conflict resolution time** (should decrease with better UI)
- **User confusion rate** (measure support tickets about "what's next")
- **Mobile adoption** (% of decisions made on mobile)

### Quality Metrics
- **Inter-rater reliability** (Cohen's Kappa ≥ 0.6 = good)
- **AI suggestion accuracy** (% of AI suggestions accepted)
- **Consensus rate** (% of studies with no conflicts)
- **Theme quality** (manual evaluation of auto-generated themes)

### Technical Metrics
- **API response time** (queue endpoint < 500ms)
- **Embedding generation time** (< 5s for 100 studies)
- **Chat response time** (< 3s for AI discussion)

---

## Part 13: Architecture Decisions

### 13.1 Should embeddings be in PostgreSQL or separate vector DB?
**Decision: Start with PostgreSQL (store as JSON), migrate to Pinecone/Qdrant later if needed**

**Rationale:**
- For < 10K studies, PostgreSQL is fine
- Cosine similarity in JS is fast enough
- Avoids infrastructure complexity
- Easy migration path later

---

### 13.2 Real-time updates: WebSocket or SSE?
**Decision: Keep SSE, add WebSocket for chat only**

**Rationale:**
- SSE already implemented for events
- WebSocket adds complexity
- Only chat needs true bidirectional
- Can upgrade gradually

---

### 13.3 Should themes be project-scoped or organization-scoped?
**Decision: Project-scoped first, add cross-project later**

**Rationale:**
- Each systematic review is independent
- Themes are review-specific
- Can add "theme templates" later for reuse

---

### 13.4 Should we support custom AI models or just OpenAI?
**Decision: OpenAI only, abstract behind interface for future swap**

**Rationale:**
- OpenAI has best embedding + chat quality
- Anthropic/Gemini can be added later via adapter pattern
- Focus on features, not model flexibility initially

---

## Part 14: Documentation Needs

### Developer Documentation
1. **Architecture overview** (system design doc)
2. **API reference** (all endpoints with examples)
3. **Database schema docs** (ERD + field descriptions)
4. **Deployment guide** (environment variables, migrations)

### User Documentation
1. **Screening workflow guide** (step-by-step with screenshots)
2. **Conflict resolution tutorial**
3. **AI features explainer** (how suggestions work, limitations)
4. **Theme generation guide** (how to use AI discussion)
5. **Admin guide** (lead tools, batch operations)

### Video Tutorials (nice to have)
1. "Your First Screening Project" (10 min)
2. "Resolving Conflicts" (5 min)
3. "Using AI Theme Generation" (8 min)

---

## Conclusion & Next Steps

### Current State Summary
- **Backend:** 80% feature-complete, solid architecture
- **UI:** 30% of backend capabilities exposed
- **Main blocker:** No workflow guidance/phase progression
- **Partner request (AI themes):** Not implemented, requires significant work

### Recommended Immediate Actions
1. **Week 1:** Fix P0 critical bugs (Pipeline Exhausted, conflicts, phase progression)
2. **Week 2-3:** Implement P1 features (workflow stepper, stats, dual-reviewer)
3. **Week 4-6:** Add data extraction + quality assessment integration
4. **Month 2-3:** Build AI themes system (if partner requirement is confirmed)

### Questions to Answer Before Starting
1. **Is the AI themes feature a hard requirement or nice-to-have?**
   - Affects roadmap priority significantly

2. **What's the target launch date for production?**
   - Determines which priority tier to focus on

3. **What's the expected user volume?**
   - Affects infrastructure decisions (embeddings storage, real-time features)

4. **Budget for OpenAI API?**
   - AI features require significant token usage

5. **Team size for implementation?**
   - Affects timeline estimates

---

**This plan consolidates 4 comprehensive audits into a single actionable roadmap. All findings are traced to specific files, with concrete implementation guidance and effort estimates.**

**Ready to proceed? Choose a priority tier and I can start implementation.**

