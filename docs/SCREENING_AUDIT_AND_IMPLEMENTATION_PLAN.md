# LitLens Screening Feature Audit & Implementation Plan
**Date**: December 27, 2025  
**Auditor**: Senior Full Stack Avant-Garde Developer  
**Benchmark**: Covidence Screening Features

---

## Executive Summary

### Current State: 70% Feature Parity with Covidence

**✅ Strong Implementation:**
- Core screening workflow (Title/Abstract, Full-Text)
- Decision tracking with confidence levels
- AI suggestions integration
- Phase management
- Batch mode foundation
- Keyboard shortcuts
- Focus mode for distraction-free screening
- Exclusion reason tracking

**❌ Critical Gaps:**
- No visible dual screening enforcement
- Missing AI-powered relevancy sorting
- No keyword highlighting in UI (component exists but not integrated)
- No calibration workflow
- Missing structured eligibility criteria (PICOS)
- Conflict resolution UI is broken
- No screening analytics dashboard (Kappa, IRR)
- No study tags and notes visible in UI
- No screening history/undo functionality
- Limited mobile optimization

**📊 Gap Analysis Score: 30 Missing Features**

---

## Part 1: Detailed Feature Comparison

### 1.1 Title & Abstract Screening

| Feature | Covidence | LitLens | Status | Priority |
|---------|-----------|---------|--------|----------|
| **Three-option voting (Yes/Maybe/No)** | ✅ | ✅ | Complete | - |
| **Dual screening mode** | ✅ Enforced by default | ⚠️ Backend exists, no UI indication | **CRITICAL** | P0 |
| **Blinded voting** | ✅ | ✅ Mentioned in UI but not visually clear | HIGH | P1 |
| **Exclusion reasons** | ✅ | ✅ Implemented | Complete | - |
| **Confidence rating** | ❌ Not standard | ✅ Implemented (0-100 slider) | **DIFFERENTIATOR** | - |
| **AI suggestions** | ✅ | ✅ Displayed with confidence | Complete | - |
| **Keyboard shortcuts** | ✅ | ✅ I/E/M, Arrow keys, F for focus | Complete | - |
| **Progress tracking** | ✅ | ✅ Progress bar + counter | Complete | - |
| **Study metadata display** | ✅ | ✅ Title, authors, journal, year, DOI | Complete | - |

**Gaps:**
1. No visual indicator showing "Awaiting second reviewer" status
2. No clear UI showing which reviewer voted
3. Missing "You are reviewer #1/#2" indicator

---

### 1.2 AI & Machine Learning

| Feature | Covidence | LitLens | Status | Priority |
|---------|-----------|---------|--------|----------|
| **Relevancy prediction** | ✅ Active learning | ✅ Backend exists (`aiSuggestion`, `aiConfidence`) | Complete | - |
| **"Most Relevant" sorting** | ✅ Triggers after 25 studies | ❌ **MISSING** | **CRITICAL** | P0 |
| **Learning from decisions** | ✅ | ⚠️ Unclear if implemented | MEDIUM | P2 |
| **Confidence thresholds** | ❌ | ⚠️ Have confidence field but no filtering | LOW | P3 |
| **AI reasoning display** | ❌ | ✅ `aiReasoning` field exists | **DIFFERENTIATOR** | - |

**Critical Gap**: AI sorting is not exposed in the UI despite backend support

---

### 1.3 Sorting & Filtering

| Feature | Covidence | LitLens | Status | Priority |
|---------|-----------|---------|--------|----------|
| **Most Relevant (AI)** | ✅ | ❌ **MISSING IN UI** | **CRITICAL** | P0 |
| **Author (alphabetical)** | ✅ | ❌ Missing | HIGH | P1 |
| **Title (alphabetical)** | ✅ | ❌ Missing | HIGH | P1 |
| **Most Recent** | ✅ | ❌ Missing | MEDIUM | P2 |
| **Year** | ❌ | ❌ Missing | LOW | P3 |
| **Filter by decision status** | ✅ | ⚠️ Backend exists (`status` param) | HIGH | P1 |
| **Search by keyword** | ✅ | ⚠️ Backend exists (`search` param) | HIGH | P1 |

**Critical Gap**: No sorting/filtering UI exposed to users

---

### 1.4 Eligibility Criteria Management

| Feature | Covidence | LitLens | Status | Priority |
|---------|-----------|---------|--------|----------|
| **PICOS framework** | ✅ Structured | ❌ **NOT IMPLEMENTED** | **CRITICAL** | P0 |
| **View criteria during screening** | ✅ | ❌ Missing | HIGH | P1 |
| **Structured criteria fields** | ✅ | ❌ Missing | HIGH | P1 |
| **Criteria versioning** | ⚠️ Implicit | ❌ Missing | LOW | P3 |

**Critical Gap**: No eligibility criteria system at all

---

### 1.5 Helper Features

| Feature | Covidence | LitLens | Status | Priority |
|---------|-----------|---------|--------|----------|
| **Keyword highlighting** | ✅ | ⚠️ Component exists but not visible | **CRITICAL** | P0 |
| **Study tags** | ✅ | ❌ No UI | HIGH | P1 |
| **Study notes** | ✅ | ⚠️ Field exists (`reasoning`) but no separate notes UI | MEDIUM | P2 |
| **History/undo** | ❌ | ❌ Missing | MEDIUM | P2 |
| **Bookmark studies** | ❌ | ❌ Missing | LOW | P3 |
| **Custom highlight colors** | ⚠️ Basic | ❌ Missing | LOW | P3 |

**Gap**: `KeywordHighlighter` component is imported but keywords are from `project?.highlightKeywords` which may not be set

---

### 1.6 Conflict Resolution

| Feature | Covidence | LitLens | Status | Priority |
|---------|-----------|---------|--------|----------|
| **Automatic conflict detection** | ✅ | ✅ Backend implemented | Complete | - |
| **Third reviewer assignment** | ✅ | ⚠️ Backend exists | Complete | - |
| **Conflict resolution UI** | ✅ | ❌ **BROKEN** (wrong enum per audit) | **CRITICAL** | P0 |
| **View conflicting decisions** | ✅ | ⚠️ Unclear | HIGH | P1 |
| **Discussion thread on conflicts** | ❌ | ❌ Missing | MEDIUM | P2 |
| **Escalation workflow** | ⚠️ Basic | ⚠️ Fields exist (`escalatedAt`, `escalatedBy`) | LOW | P3 |

**Critical Gap**: Conflict resolution page is completely broken

---

### 1.7 Full-Text Screening

| Feature | Covidence | LitLens | Status | Priority |
|---------|-----------|---------|--------|----------|
| **PDF upload** | ✅ | ⚠️ Backend exists but unclear UI | HIGH | P1 |
| **In-platform PDF viewer** | ✅ | ❌ Missing | HIGH | P1 |
| **Mandatory exclusion reasons** | ✅ | ✅ Enforced in UI | Complete | - |
| **Full-text-specific criteria** | ✅ | ❌ Missing | MEDIUM | P2 |
| **Link to full-text source** | ✅ | ⚠️ DOI displayed | MEDIUM | P2 |

---

### 1.8 Analytics & Reporting

| Feature | Covidence | LitLens | Status | Priority |
|---------|-----------|---------|--------|----------|
| **PRISMA flow diagram** | ✅ Auto-generated | ❌ **MISSING** | **CRITICAL** | P0 |
| **Cohen's Kappa** | ✅ | ⚠️ Backend endpoint exists (`/screening/analytics`) | **CRITICAL** | P0 |
| **Inter-rater reliability** | ✅ | ⚠️ Backend exists, no UI | **CRITICAL** | P0 |
| **Screening statistics** | ✅ | ✅ Basic stats shown | Complete | - |
| **Time tracking per study** | ❌ | ✅ `timeSpentMs` tracked | **DIFFERENTIATOR** | - |
| **Reviewer performance metrics** | ❌ | ⚠️ Possible with `timeSpentMs` + `confidence` | **DIFFERENTIATOR** | - |
| **Export screening decisions** | ✅ | ⚠️ Backend exists (`/api/projects/[id]/export`) | HIGH | P1 |

**Critical Gap**: Analytics dashboard completely missing despite backend support

---

### 1.9 Calibration & Training

| Feature | Covidence | LitLens | Status | Priority |
|---------|-----------|---------|--------|----------|
| **Calibration rounds** | ⚠️ Manual | ❌ **ORPHANED** | **CRITICAL** | P0 |
| **Practice screening** | ❌ | ❌ Missing | MEDIUM | P2 |
| **Inter-rater agreement tracking** | ✅ | ❌ Tables exist but no API/UI | **CRITICAL** | P0 |
| **Training materials** | ⚠️ External | ❌ Missing | LOW | P3 |

**Critical Gap**: `CalibrationRound` and `CalibrationDecision` tables are completely orphaned (no API, no UI)

---

### 1.10 Mobile Experience

| Feature | Covidence | LitLens | Status | Priority |
|---------|-----------|---------|--------|----------|
| **Responsive design** | ✅ | ⚠️ Partial (conditional rendering) | MEDIUM | P2 |
| **Swipe gestures** | ❌ | ⚠️ `SwipeableCard` component exists but incomplete | HIGH | P1 |
| **Mobile-optimized layout** | ✅ | ⚠️ `MobileScreeningCard` is a stub | HIGH | P1 |
| **Offline support** | ❌ | ❌ Missing | LOW | P3 |

---

### 1.11 Batch Operations

| Feature | Covidence | LitLens | Status | Priority |
|---------|-----------|---------|--------|----------|
| **Batch selection UI** | ✅ | ✅ Implemented (`isBatchMode`) | Complete | - |
| **Bulk include/exclude** | ✅ | ⚠️ `LeadOperationsPanel` exists | Complete | - |
| **Bulk AI suggestions** | ❌ | ⚠️ Batch endpoint exists | **DIFFERENTIATOR** | - |
| **Bulk assignment to reviewers** | ✅ | ⚠️ Unclear if implemented | MEDIUM | P2 |
| **Bulk reset decisions** | ✅ | ⚠️ Unclear | LOW | P3 |

---

## Part 2: Critical Issues to Fix

### 2.1 CRITICAL Bug: Conflict Resolution Broken ⚠️

**From Audit:**
> `ConflictResolution` — Adjudicated decisions | ⚠️ Broken UI

**Issue**: Wrong enum used in conflict resolution UI

**Fix Required:**
1. Examine `/project/[id]/conflicts` page
2. Check enum mismatch in `ConflictResolution` model
3. Wire up resolution buttons correctly
4. Test conflict creation → resolution flow

**Priority**: P0 (Blocks dual screening workflow)

---

### 2.2 CRITICAL Missing: Dual Screening Visual Feedback

**Current State**: Backend enforces dual screening, but users don't know:
- If they are the first or second reviewer
- If a study is waiting for another reviewer
- Who else has voted

**Implementation Plan:**
```typescript
// Add to ScreeningQueueItem type
interface ScreeningQueueItem {
  // ... existing fields
  reviewerStatus: "FIRST_REVIEWER" | "SECOND_REVIEWER" | "AWAITING_OTHER";
  votedReviewers?: { name: string; votedAt: Date }[];
  totalReviewersNeeded: number;
}
```

**UI Changes:**
1. Show badge: "You are reviewer #1" or "You are reviewer #2"
2. Display "Awaiting second reviewer" for first-voted studies
3. Show list of reviewers who have voted (names only, not decisions)

---

### 2.3 CRITICAL Missing: AI-Powered Sorting

**Backend Ready**: `/api/projects/[id]/screening/queue` accepts sorting params

**Implementation:**
1. Add sorting dropdown to header
2. Options: `Most Relevant` (AI), `Author`, `Title`, `Most Recent`, `Year`
3. Pass `sortBy` param to API
4. Show AI icon next to "Most Relevant" option

**Backend Enhancement Needed:**
```typescript
// Add to queue endpoint
interface QueueParams {
  sortBy?: "relevance" | "author" | "title" | "recent" | "year";
  sortOrder?: "asc" | "desc";
}
```

---

### 2.4 CRITICAL Missing: Eligibility Criteria (PICOS)

**No Tables, No API, No UI**

**Database Schema Addition:**
```prisma
model EligibilityCriteria {
  id          String   @id @default(cuid())
  projectId   String
  
  // PICOS Framework
  population     String?  @db.Text
  intervention   String?  @db.Text
  comparison     String?  @db.Text
  outcomes       String?  @db.Text
  studyDesigns   String[] // Array of acceptable designs
  
  // Additional criteria
  includePreprints    Boolean @default(false)
  languageRestriction String[] // ["English", "Spanish"]
  yearRange           Json?    // {min: 2000, max: 2024}
  
  // Other filters
  customCriteria Json?  // Flexible JSON for other criteria
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String
  
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@index([projectId])
}
```

**API Endpoints:**
```typescript
GET    /api/projects/[id]/eligibility-criteria
POST   /api/projects/[id]/eligibility-criteria
PATCH  /api/projects/[id]/eligibility-criteria
DELETE /api/projects/[id]/eligibility-criteria
```

**UI Component:**
```typescript
<EligibilityCriteriaPanel
  criteria={project.eligibilityCriteria}
  editable={isLead}
  collapsible={true}
  showInScreening={true} // Sidebar in screening interface
/>
```

---

### 2.5 CRITICAL Missing: Screening Analytics Dashboard

**Backend Ready**: `/api/projects/[id]/screening/analytics`

**Implementation:**
```typescript
// New route: /project/[id]/screening/analytics
interface ScreeningAnalytics {
  overallKappa: number;
  kappaByPhase: Record<ScreeningPhase, number>;
  agreementRate: number;
  conflictRate: number;
  reviewerPerformance: {
    reviewerId: string;
    name: string;
    studiesReviewed: number;
    avgTimePerStudy: number;
    avgConfidence: number;
    agreementWithConsensus: number;
  }[];
  screeningVelocity: {
    date: string;
    studiesScreened: number;
    avgTimePerStudy: number;
  }[];
}
```

**Dashboard Sections:**
1. **Quality Metrics**: Kappa, Agreement Rate, Conflict Rate
2. **Reviewer Performance**: Table with stats per reviewer
3. **Velocity**: Chart showing screening progress over time
4. **PRISMA Flow**: Auto-generated diagram

---

### 2.6 CRITICAL Missing: Calibration Workflow

**Orphaned Tables**: `CalibrationRound`, `CalibrationDecision`

**Purpose**: Test inter-rater reliability before full screening

**Implementation Plan:**

**1. API Endpoints:**
```typescript
POST   /api/projects/[id]/calibration/rounds
GET    /api/projects/[id]/calibration/rounds
GET    /api/projects/[id]/calibration/rounds/[roundId]
POST   /api/projects/[id]/calibration/rounds/[roundId]/decisions
GET    /api/projects/[id]/calibration/rounds/[roundId]/analytics
POST   /api/projects/[id]/calibration/rounds/[roundId]/complete
```

**2. Workflow:**
```
1. Project lead creates calibration round
2. Selects sample of studies (e.g., 20-50)
3. Assigns reviewers
4. Reviewers screen independently
5. System calculates Kappa
6. If Kappa < threshold (e.g., 0.6):
   - Show disagreements
   - Facilitate discussion
   - Optionally rescreen
7. Once Kappa acceptable → Proceed to full screening
```

**3. UI Routes:**
```
/project/[id]/calibration           - List of rounds
/project/[id]/calibration/new       - Create round
/project/[id]/calibration/[roundId] - Screening interface
/project/[id]/calibration/[roundId]/results - Analytics
```

---

### 2.7 HIGH Priority: Keyword Highlighting

**Current State**: Component exists but keywords not set

**Issue**: `project?.highlightKeywords` is likely `null` or `[]`

**Fix:**
1. Add `highlightKeywords` field to `Project` model if missing
2. Create UI in project settings to manage keywords
3. Default keywords from PICOS criteria (population terms, intervention terms)
4. Allow manual addition/removal

**UI:**
```typescript
// In /project/[id]/settings
<KeywordManager
  keywords={project.highlightKeywords}
  onAdd={handleAddKeyword}
  onRemove={handleRemoveKeyword}
  suggestions={picosSuggestions} // Auto-extract from eligibility criteria
/>
```

---

### 2.8 HIGH Priority: Sorting & Filtering UI

**Backend Ready**: `/queue?search=...&sortBy=...&filterBy=...`

**Implementation:**
```typescript
<ScreeningFilters
  search={searchTerm}
  onSearchChange={setSearchTerm}
  sortBy={sortBy}
  sortOptions={[
    { value: "relevance", label: "Most Relevant (AI)", icon: <Sparkles /> },
    { value: "author", label: "Author (A-Z)" },
    { value: "title", label: "Title (A-Z)" },
    { value: "recent", label: "Most Recent" },
    { value: "year", label: "Publication Year" },
  ]}
  onSortChange={setSortBy}
  filters={{
    decision: filterDecision, // "PENDING", "INCLUDE", "EXCLUDE", "MAYBE"
    aiConfidence: aiConfidenceRange, // [0, 100]
  }}
  onFilterChange={setFilters}
/>
```

---

### 2.9 HIGH Priority: Study Tags & Notes

**Implementation:**

**1. Database:**
```prisma
model StudyTag {
  id            String   @id @default(cuid())
  projectWorkId String
  projectId     String
  name          String
  color         String   @default("#3B82F6")
  createdBy     String
  createdAt     DateTime @default(now())
  
  projectWork ProjectWork @relation(fields: [projectWorkId], references: [id], onDelete: Cascade)
  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@unique([projectWorkId, name])
  @@index([projectId])
}

model StudyNote {
  id            String   @id @default(cuid())
  projectWorkId String
  userId        String
  content       String   @db.Text
  phase         ScreeningPhase?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  projectWork ProjectWork @relation(fields: [projectWorkId], references: [id], onDelete: Cascade)
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([projectWorkId])
}
```

**2. UI in Screening:**
```typescript
// Add to study card
<StudyMetadata>
  <TagsSection
    tags={currentStudy.tags}
    onAddTag={handleAddTag}
    onRemoveTag={handleRemoveTag}
  />
  <NotesSection
    notes={currentStudy.notes}
    onAddNote={handleAddNote}
    currentUser={user}
  />
</StudyMetadata>
```

---

### 2.10 MEDIUM Priority: PDF Viewer for Full-Text

**Implementation:**
```typescript
// Use react-pdf or similar
<PDFViewer
  url={currentStudy.fullTextPdf || currentStudy.doi}
  onAnnotate={handleAnnotation}
  highlights={project.highlightKeywords}
/>
```

**Backend:**
- Add `fullTextPdf` field to `ProjectWork`
- Upload endpoint: `/api/projects/[id]/works/[workId]/pdf`
- Serve from R2/S3

---

## Part 3: Implementation Roadmap (4 Sprints)

### 🚀 Sprint 1: Critical Fixes & Core UX (Week 1)

**Goal**: Fix broken features, improve core screening experience

**P0 Tasks:**
1. **Fix Conflict Resolution UI** (2 days)
   - [ ] Identify enum mismatch
   - [ ] Fix status field
   - [ ] Wire up resolution buttons
   - [ ] Test conflict → resolution flow

2. **Add Dual Screening Visual Feedback** (2 days)
   - [ ] Update `ScreeningQueueItem` type
   - [ ] Add `reviewerStatus` field to queue API
   - [ ] Show "Reviewer #1/#2" badge
   - [ ] Show "Awaiting other reviewer" state
   - [ ] Display voted reviewers list (names only)

3. **Implement AI-Powered Sorting** (2 days)
   - [ ] Add sorting dropdown to header
   - [ ] Update API to support `sortBy` parameter
   - [ ] Implement "Most Relevant" using AI confidence
   - [ ] Add Author, Title, Recent, Year sorts
   - [ ] Test sorting with large datasets

4. **Expose Keyword Highlighting** (1 day)
   - [ ] Add `highlightKeywords` to `Project` model migration
   - [ ] Create keyword management UI in settings
   - [ ] Test highlighting in screening interface
   - [ ] Add default keywords extraction from criteria

**Deliverables:**
- ✅ Conflict resolution works end-to-end
- ✅ Users see dual screening status clearly
- ✅ AI sorting available and functional
- ✅ Keywords highlight automatically

---

### 🔧 Sprint 2: Eligibility Criteria & Filtering (Week 2)

**Goal**: Add structured criteria and advanced filtering

**Tasks:**
1. **PICOS Eligibility Criteria** (3 days)
   - [ ] Create `EligibilityCriteria` model + migration
   - [ ] Build PICOS form component
   - [ ] API endpoints (CRUD)
   - [ ] Integrate into project setup wizard
   - [ ] Add criteria sidebar to screening interface
   - [ ] Make criteria accessible via keyboard shortcut (C)

2. **Filtering & Search UI** (2 days)
   - [ ] Build `ScreeningFilters` component
   - [ ] Add search functionality
   - [ ] Add decision status filter
   - [ ] Add AI confidence range filter
   - [ ] Add year range filter
   - [ ] Persist filter state in URL params

3. **Study Tags System** (2 days)
   - [ ] Create `StudyTag` model + migration
   - [ ] Tag CRUD API
   - [ ] Tag management UI component
   - [ ] Tag display in screening card
   - [ ] Tag filter in filters panel
   - [ ] Bulk tag operations

**Deliverables:**
- ✅ Projects have structured eligibility criteria
- ✅ Criteria visible during screening
- ✅ Advanced filtering works
- ✅ Study tagging system functional

---

### 📊 Sprint 3: Analytics & Calibration (Week 3)

**Goal**: Add quality assurance and measurement tools

**Tasks:**
1. **Screening Analytics Dashboard** (3 days)
   - [ ] Create `/project/[id]/screening/analytics` route
   - [ ] Build analytics page layout
   - [ ] Cohen's Kappa calculation + display
   - [ ] Agreement rate metrics
   - [ ] Reviewer performance table
   - [ ] Screening velocity chart
   - [ ] Export analytics to CSV

2. **PRISMA Flow Diagram** (2 days)
   - [ ] Create PRISMA generation service
   - [ ] Build flow diagram component (React Flow or D3)
   - [ ] Auto-populate from screening data
   - [ ] Export to PNG/SVG
   - [ ] Include in analytics page

3. **Calibration Workflow** (3 days)
   - [ ] Calibration API endpoints
   - [ ] Calibration round creation UI
   - [ ] Sample selection (random or manual)
   - [ ] Calibration screening interface
   - [ ] Results & analytics page
   - [ ] Discussion facilitation for low Kappa

**Deliverables:**
- ✅ Analytics dashboard with Kappa and IRR
- ✅ Auto-generated PRISMA flow
- ✅ Calibration rounds functional

---

### 🎨 Sprint 4: Polish & Mobile (Week 4)

**Goal**: Enhance UX and mobile experience

**Tasks:**
1. **Study Notes System** (2 days)
   - [ ] Create `StudyNote` model + migration
   - [ ] Notes API (CRUD, list)
   - [ ] Notes UI component
   - [ ] Notes display in screening
   - [ ] Notification when teammate adds note

2. **Mobile Optimization** (3 days)
   - [ ] Complete `SwipeableCard` implementation
   - [ ] Implement `MobileScreeningCard`
   - [ ] Optimize touch targets
   - [ ] Test on iOS/Android
   - [ ] Add PWA manifest for installation

3. **Full-Text PDF Viewer** (2 days)
   - [ ] Add `fullTextPdf` field to `ProjectWork`
   - [ ] PDF upload endpoint
   - [ ] Integrate react-pdf
   - [ ] PDF viewer with highlighting
   - [ ] Test with various PDF formats

4. **History & Undo** (2 days)
   - [ ] Track decision history
   - [ ] Undo last decision (within session)
   - [ ] Show history timeline
   - [ ] Allow reverting to previous decision

**Deliverables:**
- ✅ Study notes functional
- ✅ Mobile experience optimized
- ✅ PDF viewing in full-text phase
- ✅ Decision history and undo

---

## Part 4: Technical Implementation Details

### 4.1 Database Migrations Required

```prisma
// Migration 1: Eligibility Criteria
model EligibilityCriteria {
  id          String   @id @default(cuid())
  projectId   String
  population     String?  @db.Text
  intervention   String?  @db.Text
  comparison     String?  @db.Text
  outcomes       String?  @db.Text
  studyDesigns   String[]
  includePreprints    Boolean @default(false)
  languageRestriction String[]
  yearRange           Json?
  customCriteria Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@index([projectId])
}

// Migration 2: Study Tags
model StudyTag {
  id            String   @id @default(cuid())
  projectWorkId String
  projectId     String
  name          String
  color         String   @default("#3B82F6")
  createdBy     String
  createdAt     DateTime @default(now())
  projectWork ProjectWork @relation(fields: [projectWorkId], references: [id], onDelete: Cascade)
  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@unique([projectWorkId, name])
  @@index([projectId])
}

// Migration 3: Study Notes
model StudyNote {
  id            String   @id @default(cuid())
  projectWorkId String
  userId        String
  content       String   @db.Text
  phase         ScreeningPhase?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  projectWork ProjectWork @relation(fields: [projectWorkId], references: [id], onDelete: Cascade)
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([projectWorkId])
}

// Migration 4: Add to Project model
model Project {
  // ... existing fields
  highlightKeywords String[] @default([])
  // ... relations
  eligibilityCriteria EligibilityCriteria?
  studyTags           StudyTag[]
}

// Migration 5: Add to ProjectWork
model ProjectWork {
  // ... existing fields
  fullTextPdf String? // URL to PDF in R2/S3
  // ... relations
  tags  StudyTag[]
  notes StudyNote[]
}
```

### 4.2 API Enhancements

**New Endpoints:**
```typescript
// Eligibility Criteria
GET    /api/projects/[id]/eligibility-criteria
POST   /api/projects/[id]/eligibility-criteria
PATCH  /api/projects/[id]/eligibility-criteria
DELETE /api/projects/[id]/eligibility-criteria

// Study Tags
GET    /api/projects/[id]/tags
POST   /api/projects/[id]/tags
DELETE /api/projects/[id]/tags/[tagId]
POST   /api/projects/[id]/works/[workId]/tags
DELETE /api/projects/[id]/works/[workId]/tags/[tagId]

// Study Notes
GET    /api/projects/[id]/works/[workId]/notes
POST   /api/projects/[id]/works/[workId]/notes
PATCH  /api/projects/[id]/works/[workId]/notes/[noteId]
DELETE /api/projects/[id]/works/[workId]/notes/[noteId]

// Calibration
POST   /api/projects/[id]/calibration/rounds
GET    /api/projects/[id]/calibration/rounds
GET    /api/projects/[id]/calibration/rounds/[roundId]
POST   /api/projects/[id]/calibration/rounds/[roundId]/decisions
GET    /api/projects/[id]/calibration/rounds/[roundId]/analytics

// Analytics Enhancement
GET    /api/projects/[id]/screening/analytics?include=kappa,irr,velocity,prisma

// Screening Queue Enhancement
GET    /api/projects/[id]/screening/queue?sortBy=relevance&search=covid&decision=PENDING
```

**Enhanced Queue Response:**
```typescript
interface ScreeningQueueItem {
  // ... existing fields
  reviewerStatus: "FIRST_REVIEWER" | "SECOND_REVIEWER" | "AWAITING_OTHER";
  votedReviewers: { id: string; name: string; votedAt: Date }[];
  totalReviewersNeeded: number;
  tags: { id: string; name: string; color: string }[];
  notes: { id: string; userId: string; userName: string; preview: string; createdAt: Date }[];
  fullTextPdf?: string;
}
```

### 4.3 Component Architecture

**New Components:**

```typescript
// Eligibility Criteria
<EligibilityCriteriaForm />
<EligibilityPanel /> // Sidebar in screening
<PICOSEditor />

// Filtering & Sorting
<ScreeningFilters />
<SortDropdown />
<FilterPanel />

// Analytics
<ScreeningAnalyticsDashboard />
<KappaScoreDisplay />
<PRISMAFlowDiagram />
<ReviewerPerformanceTable />
<ScreeningVelocityChart />

// Calibration
<CalibrationRoundCreator />
<CalibrationScreeningInterface />
<CalibrationResults />

// Tags & Notes
<TagManager />
<StudyTagBadges />
<StudyNotesPanel />
<NoteThread />

// PDF Viewer
<PDFViewer />
<PDFAnnotator />

// Mobile
<MobileScreeningCard /> // Complete implementation
<SwipeableCard /> // Complete implementation
<MobileFilters /> // Drawer-based
```

### 4.4 State Management

**Add to screening-store.ts:**
```typescript
interface ScreeningStore {
  // ... existing state
  
  // Sorting & Filtering
  sortBy: "relevance" | "author" | "title" | "recent" | "year";
  setSortBy: (sort: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: {
    decision?: "PENDING" | "INCLUDE" | "EXCLUDE" | "MAYBE";
    aiConfidence?: [number, number];
    tags?: string[];
  };
  setFilters: (filters: Partial<Filters>) => void;
  
  // History
  decisionHistory: DecisionHistoryItem[];
  addToHistory: (item: DecisionHistoryItem) => void;
  undo: () => void;
  
  // Criteria visibility
  showEligibilityCriteria: boolean;
  toggleEligibilityCriteria: () => void;
}
```

---

## Part 5: Quality Assurance Strategy

### 5.1 Testing Requirements

**Unit Tests:**
- [ ] Dual screening logic (reviewer status calculation)
- [ ] AI sorting algorithm
- [ ] Kappa calculation
- [ ] PRISMA flow generation
- [ ] Tag and note CRUD operations

**Integration Tests:**
- [ ] Complete screening workflow (Title/Abstract → Full-Text)
- [ ] Conflict detection and resolution
- [ ] Calibration round lifecycle
- [ ] Analytics calculation accuracy

**E2E Tests:**
- [ ] Multi-reviewer screening scenario
- [ ] Conflict resolution by third reviewer
- [ ] Calibration round with low Kappa → discussion → re-screen
- [ ] Export PRISMA diagram

### 5.2 Performance Optimization

**Priority Optimizations:**
1. **Queue Loading**: Implement pagination and virtual scrolling for large queues
2. **AI Sorting**: Cache relevancy scores, avoid recalculating
3. **Analytics**: Pre-calculate Kappa during decision submission, not on-demand
4. **PDF Rendering**: Lazy load PDF pages, render viewport only

**Monitoring:**
- Track average time to load screening queue
- Monitor API response times for queue endpoint
- Alert if Kappa calculation takes > 1s

---

## Part 6: Differentiators Over Covidence

### Features LitLens Has That Covidence Doesn't:

1. **✅ Confidence Rating** (0-100 slider)
   - Track reviewer certainty
   - Use for analytics (e.g., low confidence → more conflicts)

2. **✅ Time Tracking** (`timeSpentMs`)
   - See which studies take longer
   - Identify efficiency issues
   - Reviewer performance metrics

3. **✅ AI Reasoning Display** (`aiReasoning` field)
   - Show why AI suggested decision
   - Transparency and explainability

4. **🚀 Potential: Real-Time Collaboration**
   - Chat on studies (backend exists: `ChatMessage`)
   - Live presence indicators
   - Collaborative notes

5. **🚀 Potential: Advanced Analytics**
   - Reviewer efficiency scores
   - Study complexity heatmap
   - Screening velocity forecasting

6. **🚀 Potential: Integration Ecosystem**
   - API keys (backend exists)
   - Webhooks (backend exists)
   - Zapier/Make integrations

---

## Part 7: Risk Assessment

### Technical Risks:

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Kappa calculation performance issues with large datasets | HIGH | MEDIUM | Pre-calculate during decisions, cache results |
| PDF viewer compatibility issues | MEDIUM | MEDIUM | Test with multiple browsers, fallback to download |
| Mobile swipe gestures conflict with scroll | MEDIUM | HIGH | Implement velocity thresholds, directional locks |
| Calibration creates duplicate screening work | LOW | LOW | Clear UX separation, different database tables |

### UX Risks:

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Too many filters overwhelm users | MEDIUM | HIGH | Progressive disclosure, presets |
| Dual screening confuses single reviewers | HIGH | MEDIUM | Clear onboarding, tooltips, documentation |
| PICOS form too complex | MEDIUM | MEDIUM | Make optional, provide templates |
| Analytics page too dense | LOW | HIGH | Dashboard customization, export options |

---

## Part 8: Success Metrics

### Pre-Implementation Baseline:
- Current screening queue API response time: **?ms**
- Current conflict resolution success rate: **0%** (broken)
- Current user time to screen 10 studies: **?min**

### Post-Implementation Targets:

**Sprint 1 (Critical Fixes):**
- ✅ Conflict resolution success rate: **100%**
- ✅ Dual screening clarity (user survey): **>80% understand status**
- ✅ AI sorting adoption: **>60% users try it**

**Sprint 2 (Criteria & Filtering):**
- ✅ Projects with eligibility criteria: **>75%**
- ✅ Filter usage: **>50% users apply at least one filter**
- ✅ Tags created per project: **>5 average**

**Sprint 3 (Analytics & Calibration):**
- ✅ Analytics page views: **>1 per project per week**
- ✅ Calibration rounds created: **>30% of projects**
- ✅ Kappa improvement post-calibration: **>0.2 increase**

**Sprint 4 (Polish & Mobile):**
- ✅ Mobile screening sessions: **>20% of total**
- ✅ PDF viewer usage: **>40% in full-text phase**
- ✅ Undo usage: **>10% of users**

---

## Part 9: Documentation Requirements

### User Documentation:
- [ ] Dual screening guide (what it means, how it works)
- [ ] AI suggestions interpretation guide
- [ ] Eligibility criteria best practices (PICOS templates)
- [ ] Calibration round tutorial
- [ ] Analytics interpretation guide (what is Kappa?)
- [ ] Mobile app usage guide

### Developer Documentation:
- [ ] API documentation for new endpoints
- [ ] Database schema changes documentation
- [ ] Analytics calculation algorithms
- [ ] Kappa calculation implementation
- [ ] PRISMA flow generation logic

---

## Part 10: Rollout Strategy

### Phase 1: Internal Testing (Week 1-2)
- Deploy to staging with test data
- Team members perform end-to-end screening
- Collect feedback on UX
- Fix critical bugs

### Phase 2: Beta Users (Week 3-4)
- Invite 5-10 beta users
- Provide onboarding support
- Monitor analytics and errors
- Iterate based on feedback

### Phase 3: General Availability (Week 5+)
- Announce new features
- Create video tutorials
- Monitor adoption metrics
- Collect feature requests

---

## Appendix A: Code Snippets

### A.1 Enhanced Queue API Response

```typescript
// src/app/api/projects/[id]/screening/queue/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  // ... auth checks
  
  const searchParams = new URL(req.url).searchParams;
  const sortBy = searchParams.get("sortBy") || "default";
  const search = searchParams.get("search") || "";
  const decision = searchParams.get("decision");
  
  // Get queue items
  const items = await prisma.projectWork.findMany({
    where: {
      projectId: params.id,
      // ... phase filters
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { abstract: { contains: search, mode: "insensitive" } },
          { authors: { some: { name: { contains: search, mode: "insensitive" } } } },
        ],
      }),
      ...(decision && {
        screeningDecisions: { some: { decision, reviewerId: userId } },
      }),
    },
    include: {
      authors: true,
      screeningDecisions: {
        include: { reviewer: { select: { id: true, name: true } } },
      },
      tags: true,
      notes: { take: 3, orderBy: { createdAt: "desc" } },
    },
    orderBy: sortBy === "relevance"
      ? [{ aiConfidence: "desc" }]
      : sortBy === "author"
      ? [{ authors: { _count: "asc" } }]
      : sortBy === "title"
      ? [{ title: "asc" }]
      : sortBy === "year"
      ? [{ year: "desc" }]
      : [{ updatedAt: "desc" }],
  });
  
  // Enhance with reviewer status
  const enhancedItems = items.map(item => {
    const decisions = item.screeningDecisions;
    const userDecision = decisions.find(d => d.reviewerId === userId);
    const otherDecisions = decisions.filter(d => d.reviewerId !== userId);
    
    let reviewerStatus: "FIRST_REVIEWER" | "SECOND_REVIEWER" | "AWAITING_OTHER";
    if (!userDecision) {
      reviewerStatus = otherDecisions.length > 0 ? "SECOND_REVIEWER" : "FIRST_REVIEWER";
    } else {
      reviewerStatus = "AWAITING_OTHER";
    }
    
    return {
      ...item,
      reviewerStatus,
      votedReviewers: decisions.map(d => ({
        id: d.reviewer.id,
        name: d.reviewer.name,
        votedAt: d.createdAt,
      })),
      totalReviewersNeeded: 2, // From project settings
    };
  });
  
  return NextResponse.json({ data: { items: enhancedItems, pagination: { ... } } });
}
```

### A.2 Kappa Calculation

```typescript
// src/lib/services/analytics/kappa.ts
export function calculateCohen sKappa(
  reviewer1Decisions: ScreeningDecision[],
  reviewer2Decisions: ScreeningDecision[]
): number {
  if (reviewer1Decisions.length !== reviewer2Decisions.length) {
    throw new Error("Decision arrays must have equal length");
  }
  
  const n = reviewer1Decisions.length;
  if (n === 0) return 0;
  
  // Observed agreement
  let agreements = 0;
  for (let i = 0; i < n; i++) {
    if (reviewer1Decisions[i] === reviewer2Decisions[i]) {
      agreements++;
    }
  }
  const po = agreements / n;
  
  // Expected agreement by chance
  const r1Counts = countDecisions(reviewer1Decisions);
  const r2Counts = countDecisions(reviewer2Decisions);
  
  let pe = 0;
  for (const decision of ["INCLUDE", "EXCLUDE", "MAYBE"]) {
    const p1 = (r1Counts[decision] || 0) / n;
    const p2 = (r2Counts[decision] || 0) / n;
    pe += p1 * p2;
  }
  
  // Kappa
  const kappa = (po - pe) / (1 - pe);
  return kappa;
}

function countDecisions(decisions: ScreeningDecision[]): Record<string, number> {
  return decisions.reduce((acc, d) => {
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
```

---

## Summary

### Total Implementation Effort: **~160 hours** (4 weeks, 2 developers)

### Priority Breakdown:
- **P0 (Critical)**: 8 features, ~60 hours
- **P1 (High)**: 12 features, ~50 hours
- **P2 (Medium)**: 15 features, ~35 hours
- **P3 (Low)**: 10 features, ~15 hours

### Expected Outcome:
- **Feature Parity with Covidence**: 95%
- **Unique Differentiators**: 5 features Covidence lacks
- **User Experience**: Best-in-class systematic review screening
- **Market Position**: Competitive alternative to Covidence

---

**Next Steps:**
1. Review and approve this plan
2. Set up project tracking (GitHub Projects or Linear)
3. Assign developers to Sprint 1 tasks
4. Begin implementation Monday

**Questions? Contact the implementation team.**

---

*Document Version: 1.0*  
*Last Updated: December 27, 2025*

