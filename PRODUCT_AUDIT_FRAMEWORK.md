# LITLENS PRODUCT AUDIT FRAMEWORK
**Systematic Product Completeness & Market Readiness Assessment**

---

## AUDIT PROTOCOL ACTIVATION

Execute the following comprehensive audit framework to assess LitLens against industry standards, competitor benchmarks, and architectural integrity.

---

## PHASE 1: ARCHITECTURAL TOPOLOGY MAPPING

### 1.1 DATABASE SCHEMA AUDIT

**Objective**: Map every table, relation, and field to identify orphaned entities and unused features.

**Execution Steps**:

1. **Entity Enumeration**
   - Parse `prisma/schema.prisma`
   - Extract all models, enums, and relations
   - Generate entity count: **44 tables identified**

2. **Relation Graph Construction**
   - For each model, map:
     - Primary relations (1-to-many, many-to-many)
     - Foreign key chains
     - Cascade delete behaviors
   - Identify orphaned entities (no API or UI connection)

3. **Field Coverage Analysis**
   - For each table, verify:
     - Which fields are populated by API endpoints?
     - Which fields are displayed in UI?
     - Which fields are write-only or read-only?
   - Flag unused fields (e.g., `Job.scheduledAt` if background jobs not implemented)

**Deliverable**: Entity-Relation Diagram (ERD) with color-coded coverage:
- 🟢 Green: Full API + UI coverage
- 🟡 Yellow: Partial coverage (API exists, UI missing)
- 🔴 Red: Orphaned (no implementation)

**Visualization**: Force-directed graph (D3.js/Cytoscape style) showing:
- Nodes = DB tables (sized by relation count)
- Edges = Foreign key relations (weighted by usage frequency)
- Node color = Coverage status
- Clustering = Domain groups (Auth, Projects, Screening, etc.)

---

### 1.2 API ROUTE TOPOLOGY AUDIT

**Objective**: Inventory all backend endpoints and map to database operations and frontend consumers.

**Execution Steps**:

1. **Route Extraction**
   - Scan `src/app/api/**/*.ts` for route handlers
   - Classify by HTTP method (GET, POST, PATCH, DELETE)
   - Count: **66 API routes identified**

2. **Endpoint Functionality Matrix**
   - For each endpoint, document:
     - **Purpose**: What business logic does it serve?
     - **Auth**: Public / Session / Role-gated?
     - **Database Operations**: Which tables does it touch?
     - **Validation**: Zod schemas used?
     - **Response Format**: Success/error structure
     - **UI Consumers**: Which components call it?

3. **Orphaned Endpoint Detection**
   - Flag endpoints with zero frontend calls
   - Examples identified:
     - `/api/projects/[id]/screening/analytics` → No UI
     - `/api/projects/[id]/screening/batch` → No UI
     - `/api/organizations/[orgId]/api-keys` → No UI
     - `/api/projects/[id]/export` → No UI

4. **Contract Validation**
   - Verify request/response types match frontend expectations
   - Check for schema drift (e.g., `ConflictStatus` enum mismatch)

**Deliverable**: API Route Map (Sankey diagram):
- **Left Column**: Frontend routes (pages)
- **Middle Column**: API endpoints
- **Right Column**: Database tables
- **Flows**: Connections showing data flow
- **Orphaned nodes**: Highlighted in red

---

### 1.3 FRONTEND ROUTE AUDIT

**Objective**: Catalog all UI pages, identify stub pages, and verify data dependencies.

**Execution Steps**:

1. **Route Inventory**
   - Scan `src/app/**/*.tsx` for page components
   - Classify by route group: (app), (auth), (admin), (portal)
   - Count: **29 frontend routes identified**

2. **Implementation Status Classification**
   - **Complete**: All data fetched, interactions wired, no TODO comments
   - **Partial**: Basic UI exists, missing advanced features
   - **Stub**: Empty or placeholder-only
   - **Broken**: Errors, type mismatches, non-functional

3. **Data Dependency Mapping**
   - For each route, list:
     - Required API endpoints
     - Expected data structures
     - Loading/error states
     - User actions (CRUD operations)

4. **Gap Identification**
   - Routes missing critical actions (e.g., `/project/[id]/screening` lacks phase advancement)
   - Missing routes for existing APIs (e.g., no `/organization/[id]/settings`)

**Deliverable**: Frontend Route Tree (hierarchical diagram):
- Parent nodes = Route groups
- Child nodes = Pages
- Node styling = Implementation status
- Annotations = Missing features

---

## PHASE 2: BUSINESS LOGIC CONSISTENCY AUDIT

### 2.1 WORKFLOW STATE MACHINE VALIDATION

**Objective**: Verify systematic review workflow integrity from import to synthesis.

**Critical Workflows to Map**:

1. **Study Lifecycle**
   ```
   Import → Deduplication → Title/Abstract Screening → 
   Full-Text Screening → Data Extraction → Quality Assessment → 
   Synthesis → Export
   ```

2. **Screening Phase Progression**
   ```
   TITLE_ABSTRACT → (Advance Phase API Call) → FULL_TEXT → FINAL
   ```
   - **Verify**: Can user trigger phase advancement?
   - **Verify**: Are included studies moved correctly?
   - **Verify**: Are conflicts blocking progression?

3. **Conflict Resolution Flow**
   ```
   Dual Screening → Disagreement Detected → Conflict Created (PENDING) →
   Lead Adjudicates → Resolution Saved → Conflict Status = RESOLVED
   ```
   - **Verify**: UI correctly queries `status=PENDING`
   - **Verify**: Resolution mutation updates both `Conflict` and `ProjectWork`

4. **Extraction Discrepancy Resolution**
   ```
   Extractor 1 Submits → Extractor 2 Submits → Compare Values →
   If Mismatch → Create Discrepancy → Lead Resolves → Mark Validated
   ```
   - **Verify**: API endpoint exists (`/extraction/discrepancies`)
   - **Verify**: UI for resolution exists (❌ MISSING)

**Deliverable**: State Machine Diagrams (Mermaid.js):
- One diagram per critical workflow
- Highlight broken transitions in red
- Annotate with "Backend Ready" vs "UI Missing" labels

---

### 2.2 AUTHORIZATION & PERMISSIONS AUDIT

**Objective**: Ensure role-based access control is consistently enforced.

**Role Hierarchy**:
- **System Level**: SUPER_ADMIN > ADMIN > USER
- **Organization Level**: OWNER > ADMIN > MEMBER > GUEST
- **Project Level**: OWNER > LEAD > REVIEWER > OBSERVER

**Verification Matrix**:

| Action | Required Role | Backend Check? | Frontend Check? | Issues |
|--------|---------------|----------------|-----------------|--------|
| Create Project | Org MEMBER | ✅ | ✅ | None |
| Delete Project | Project OWNER | ✅ | ✅ | None |
| Advance Phase | Project LEAD | ✅ | ❌ Missing UI | UI doesn't expose action |
| Batch Operations | Project LEAD | ✅ | ❌ Missing UI | No batch panel |
| View Audit Logs | Org OWNER | ✅ | ❌ Missing UI | No audit page |
| Generate API Keys | Org ADMIN | ✅ | ❌ Missing UI | No API key UI |

**Deliverable**: Permission Audit Report
- Table showing action → required role → implementation status
- Flag inconsistencies (e.g., backend allows but UI hides)

---

### 2.3 DATA VALIDATION & INTEGRITY AUDIT

**Objective**: Verify data validation is comprehensive and consistent.

**Validation Layer Checklist**:

1. **Frontend Validation** (React Hook Form + Zod)
   - ✅ User input forms use `zod` schemas
   - ✅ Error messages displayed inline
   - ⚠️ Some forms lack client-side validation (check extraction forms)

2. **API Validation** (Zod schemas in route handlers)
   - ✅ All POST/PATCH endpoints validate request body
   - ✅ Invalid requests return 400 with error details
   - ✅ SQL injection protection via Prisma

3. **Database Constraints**
   - ✅ Unique constraints on critical fields (email, DOI, slug)
   - ✅ Foreign key constraints prevent orphaned records
   - ✅ Enums enforce valid values
   - ⚠️ Check: Are nullability constraints correctly set?

**Deliverable**: Validation Coverage Matrix
- List of all user inputs
- Check: Frontend validation? API validation? DB constraint?
- Flag missing validation layers

---

## PHASE 3: UI/UX CONSISTENCY AUDIT

### 3.1 VISUAL DESIGN SYSTEM AUDIT

**Objective**: Assess design consistency, component reuse, and accessibility.

**Design Token Verification**:

1. **Typography**
   - Verify usage of design system fonts (Playfair Display, Inter, monospace)
   - Check for rogue inline font styles
   - Verify heading hierarchy (H1 → H2 → H3 semantic correctness)

2. **Color System**
   - Extract all color values from codebase
   - Verify usage of TailwindCSS theme colors
   - Flag hardcoded hex values (e.g., `#4F46E5` should be `primary`)

3. **Spacing System**
   - Verify consistent use of spacing scale (0.5rem increments)
   - Check for magic numbers in padding/margin

4. **Component Library Usage**
   - Inventory all Radix UI components
   - Check for custom implementations of primitives (e.g., custom dropdown when Radix exists)
   - **CRITICAL RULE**: If Radix/Shadcn UI provides a component, it MUST be used

**Deliverable**: Design System Audit Report
- Component usage statistics
- List of design inconsistencies
- Recommendations for consolidation

---

### 3.2 INTERACTION PATTERN AUDIT

**Objective**: Ensure consistent user interactions across the app.

**Pattern Checklist**:

1. **Loading States**
   - ✅ React Query provides loading states
   - ⚠️ Check: Are all data-fetching components showing spinners?
   - ⚠️ Check: Long operations (AI extraction, import) show progress?

2. **Error Handling**
   - ✅ Toast notifications for errors (Sonner)
   - ⚠️ Check: Are all API errors caught and displayed?
   - ⚠️ Check: Network errors handled gracefully?

3. **Empty States**
   - ⚠️ Issue: "Pipeline Exhausted" message lacks actionable guidance
   - ⚠️ Check: Do all list views have helpful empty states?

4. **Form Interactions**
   - ✅ Validation errors shown inline
   - ⚠️ Check: Are forms disabled during submission?
   - ⚠️ Check: Success feedback after saves?

5. **Confirmation Dialogs**
   - ⚠️ Check: Destructive actions (delete, archive) show confirmations?
   - ⚠️ Check: Phase advancement shows summary before proceeding?

**Deliverable**: Interaction Pattern Audit
- Checklist of patterns with compliance status
- Screenshots of inconsistent implementations

---

### 3.3 ACCESSIBILITY AUDIT (WCAG 2.1 AA)

**Objective**: Verify compliance with accessibility standards.

**Automated Checks** (use axe-core or Lighthouse):

1. **Color Contrast**
   - Verify all text meets 4.5:1 ratio (normal text)
   - Verify all text meets 3:1 ratio (large text, 18pt+)
   - **Concern**: Ink/paper theme may fail in some contexts

2. **Keyboard Navigation**
   - ✅ Radix components support keyboard nav
   - ⚠️ Custom components (screening queue) need verification
   - ❌ Keyboard shortcuts mentioned but not implemented

3. **ARIA Labels**
   - ✅ Radix provides ARIA by default
   - ⚠️ Custom components lack labels (e.g., graph nodes)

4. **Focus Management**
   - ⚠️ Check: Focus trapped in modals?
   - ⚠️ Check: Focus visible styles on all interactive elements?

5. **Screen Reader Support**
   - ⚠️ Check: Alt text on all images?
   - ⚠️ Check: Form labels properly associated?
   - ⚠️ Check: Dynamic content announced?

**Manual Testing**:
- Navigate entire app using keyboard only
- Test with screen reader (NVDA/VoiceOver)
- Test with 200% zoom

**Deliverable**: Accessibility Audit Report
- WCAG compliance score
- List of violations with severity
- Remediation recommendations

---

## PHASE 4: FEATURE COMPLETENESS VS. MARKET BASELINE

### 4.1 COMPETITOR FEATURE MATRIX

**Objective**: Benchmark LitLens against market leaders.

**Competitors to Analyze**:
1. **Covidence** (Market leader, academic focus)
2. **Rayyan** (Mobile-first, AI-powered)
3. **DistillerSR** (Enterprise, advanced features)
4. **ASReview** (Open-source, active learning)
5. **ResearchRabbit** (Discovery-focused, network graphs) ← From screenshots
6. **SciSpace** (AI research assistant) ← From screenshots
7. **Semantic Scholar** (Academic search engine) ← From screenshots
8. **CiteTrue** (Citation verification) ← From screenshots

**Feature Categories**:

#### **Table Stakes (Must Have)**
| Feature | LitLens | Covidence | Rayyan | DistillerSR | ASReview |
|---------|---------|-----------|--------|-------------|----------|
| Study Import (RIS/BibTeX) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Duplicate Detection | ✅ | ✅ | ✅ | ✅ | ❌ |
| Dual Screening | ✅ | ✅ | ✅ | ✅ | ❌ |
| Conflict Resolution | ⚠️ Broken | ✅ | ✅ | ✅ | N/A |
| Data Extraction | ⚠️ Partial | ✅ | ✅ | ✅ | ❌ |
| Quality Assessment | ⚠️ Partial | ✅ | ✅ | ✅ | ❌ |
| PRISMA Flow | ❌ Missing UI | ✅ | ✅ | ✅ | ⚠️ |
| Export (CSV/Excel) | ❌ Missing UI | ✅ | ✅ | ✅ | ✅ |

#### **Advanced Features**
| Feature | LitLens | Competitors | Opportunity |
|---------|---------|-------------|-------------|
| AI Screening | ✅ GPT-4 | Rayyan (ML), ASReview (Active Learning) | **STRONG** |
| Citation Network Graphs | ⚠️ Partial | ResearchRabbit ✅ | **UNIQUE IF POLISHED** |
| AI Writing Assistant | ⚠️ Partial | None | **DIFFERENTIATOR** |
| AI Theme Discussion | ❌ Not Implemented | None | **MAJOR DIFFERENTIATOR** |
| Semantic Search | ❌ Backend Only | SciSpace ✅ | **DIFFERENTIATOR** |
| Citation Verification | ❌ | CiteTrue ✅ | Consider adding |
| Literature Discovery | ✅ (Discover page) | SciSpace ✅, ResearchRabbit ✅ | **GOOD** |
| Paper Chat/Q&A | ❌ | SciSpace ✅ | **DIFFERENTIATOR** |
| Mind Maps / Concept Graphs | ❌ | ResearchRabbit ✅ | **DIFFERENTIATOR** |
| Living Reviews | ❌ Schema Only | Covidence ✅ | **NEEDED** |
| Meta-Analysis | ❌ | Covidence ✅, DistillerSR ✅ | **NEEDED** |
| Mobile App | ⚠️ Incomplete | Rayyan ✅ (Excellent) | **CONSIDER** |

**Unique Features from Competitor Screenshots**:

**From ResearchRabbit**:
- ✨ **Citation Timeline Visualization** (publication year vs citation network)
- ✨ **Similar Papers by Date** (chronological clustering)
- ✨ **Author Collaboration Networks**
- ✨ **Collections with Smart Suggestions** ("Papers similar to...")

**From SciSpace**:
- ✨ **AI Chat with Papers** (Ask questions about uploaded PDFs)
- ✨ **Multi-Source Deep Search** (21+ sources)
- ✨ **Auto Literature Review Generation**
- ✨ **Data Visualization Builder** (from paper data)
- ✨ **LaTeX Export**

**From Semantic Scholar**:
- ✨ **Highly Influential Citations** (weighted citation analysis)
- ✨ **Paper Recommendations** (ML-based)
- ✨ **Field of Study Tagging**
- ✨ **Citation Context** (shows where paper was cited)

**From CiteTrue**:
- ✨ **Citation Verification** (check if citation matches actual paper)
- ✨ **Confidence Scores** (HIGH/MEDIUM/LOW)
- ✨ **Fake Citation Detection**

**Deliverable**: Feature Parity Matrix + Opportunity Analysis
- Score LitLens vs competitors (% feature coverage)
- Identify "quick win" features (backend exists, needs UI)
- Prioritize differentiators

---

### 4.2 FEATURE GAP PRIORITIZATION FRAMEWORK

**Objective**: Categorize missing features by impact and effort.

**Prioritization Matrix** (Impact vs Effort):

```
High Impact, Low Effort (DO FIRST):
├─ P0: Fix conflict resolution UI (2 hours)
├─ P0: Add phase progression controls (6 hours)
├─ P0: Add export functionality (3 hours)
├─ P1: Screening analytics dashboard (12 hours)
└─ P1: Lead batch operations panel (10 hours)

High Impact, High Effort (PLAN FOR):
├─ P1: Data extraction workflow integration (16 hours)
├─ P1: Quality assessment workflow integration (12 hours)
├─ P2: AI theme discussion feature (80-100 hours) ← MAJOR DIFFERENTIATOR
├─ P2: Calibration rounds (16 hours)
└─ P2: Living reviews (40 hours)

Low Impact, Low Effort (NICE TO HAVE):
├─ P3: Activity timeline (4 hours)
├─ P3: Keyword configuration UI (3 hours)
└─ P3: Notification improvements (4 hours)

Low Impact, High Effort (DEFER):
├─ P4: Mobile swipe interface completion (10 hours)
└─ P4: Custom branding (20 hours)
```

**Deliverable**: Prioritized Feature Roadmap
- 3 phases: Beta Launch Prep (3-4 weeks), Production Readiness (4-6 weeks), Differentiation (6-8 weeks)
- Each phase has clear deliverables and exit criteria

---

## PHASE 5: CODE QUALITY & MAINTAINABILITY AUDIT

### 5.1 CODEBASE HEALTH METRICS

**Objective**: Measure code quality and identify refactoring needs.

**Metrics to Calculate**:

1. **Lines of Code**
   - Total LOC by directory (features/, components/, lib/)
   - Identify files >500 lines (candidates for splitting)

2. **Cyclomatic Complexity**
   - Use ESLint complexity rule
   - Flag functions with complexity >10

3. **Code Duplication**
   - Search for repeated logic (e.g., membership checks in API routes)
   - Calculate duplication percentage

4. **Test Coverage**
   - Run `npm run test:coverage`
   - **Current**: Minimal (only validator tests)
   - **Target**: 60% for critical paths

5. **Type Safety**
   - Check for `any` types
   - Verify strict mode enabled
   - Check for `@ts-ignore` comments

6. **Dead Code**
   - Unused imports
   - Unused exports
   - Unused components (e.g., `MobileScreeningCard`)

**Deliverable**: Code Quality Dashboard
- Metrics visualization
- List of refactoring recommendations
- Technical debt score

---

### 5.2 ARCHITECTURAL DEBT ASSESSMENT

**Objective**: Identify architectural issues that will hinder scalability.

**Review Areas**:

1. **State Management**
   - ✅ Zustand for global state (minimal)
   - ✅ React Query for server state
   - ⚠️ Check: Is local state overused? (prop drilling?)

2. **Service Layer Abstraction**
   - ✅ Services in `lib/services/`
   - ⚠️ Check: Are API routes too thick? (business logic should be in services)

3. **Error Handling**
   - ✅ Custom error classes
   - ⚠️ Check: Consistent error response format?
   - ⚠️ Check: Error boundaries in place?

4. **Performance Optimization**
   - ✅ React Query caching
   - ✅ Redis caching
   - ❌ No virtualization for long lists
   - ❌ No lazy loading for large datasets

5. **Security**
   - ✅ NextAuth.js
   - ✅ Row-level security via Prisma
   - ⚠️ No CSP headers mentioned
   - ⚠️ No rate limiting on all endpoints

**Deliverable**: Architectural Debt Report
- List of design flaws
- Scalability concerns
- Recommended refactors (with effort estimates)

---

## PHASE 6: SCHEMA-ROUTE-UI MAPPING & GAP VISUALIZATION

### 6.1 COMPREHENSIVE MAPPING GRAPH

**Objective**: Create a visual representation of the entire data flow from database to UI.

**Graph Structure** (Network Visualization like Greptile):

**Nodes** (3 layers):
1. **Database Layer** (Bottom)
   - Node type: DB tables
   - Node size: Proportional to relation count
   - Node color: Coverage status (green/yellow/red)
   - Node label: Table name + record count estimate

2. **API Layer** (Middle)
   - Node type: API endpoints
   - Node size: Proportional to complexity (LOC)
   - Node color: Usage status (active/partial/unused)
   - Node label: Endpoint path + HTTP method

3. **UI Layer** (Top)
   - Node type: Frontend routes
   - Node size: Proportional to component count
   - Node color: Implementation status (complete/partial/stub)
   - Node label: Route path

**Edges** (Connections):
- **DB → API**: Which tables does each endpoint read/write?
- **API → UI**: Which endpoints does each page call?
- **Edge weight**: Frequency of usage (based on typical user flow)
- **Edge color**: Data flow direction (read=blue, write=green, both=purple)

**Orphaned Node Detection**:
- Highlight nodes with no incoming/outgoing edges
- Examples:
  - `CalibrationRound` table → No API edges → No UI edges → **ORPHANED**
  - `/api/export` endpoint → No UI edges → **ORPHANED**

**Deliverable**: Interactive Network Graph (D3.js / Cytoscape.js)
- Force-directed layout with clustering by domain
- Hover tooltips showing details
- Click to highlight connected paths
- Filter by coverage status
- Export as SVG/PNG

**Example Visualization Structure**:

```javascript
// Pseudocode for graph data
const graphData = {
  nodes: [
    // DB Layer
    { id: 'db_user', type: 'database', label: 'User', coverage: 'full', relations: 18 },
    { id: 'db_project', type: 'database', label: 'Project', coverage: 'full', relations: 14 },
    { id: 'db_calibration', type: 'database', label: 'CalibrationRound', coverage: 'orphan', relations: 2 },
    
    // API Layer
    { id: 'api_projects_get', type: 'api', label: 'GET /projects', usage: 'active', complexity: 150 },
    { id: 'api_export_get', type: 'api', label: 'GET /export', usage: 'unused', complexity: 200 },
    
    // UI Layer
    { id: 'ui_projects', type: 'ui', label: '/projects', status: 'complete', components: 5 },
    { id: 'ui_screening', type: 'ui', label: '/screening', status: 'partial', components: 12 },
  ],
  edges: [
    { source: 'db_project', target: 'api_projects_get', type: 'read', weight: 10 },
    { source: 'api_projects_get', target: 'ui_projects', type: 'fetch', weight: 10 },
    { source: 'db_calibration', target: null, type: 'orphan' }, // No connections
  ]
}
```

---

### 6.2 WORKFLOW COVERAGE HEAT MAP

**Objective**: Visualize which parts of the systematic review workflow are fully implemented.

**Workflow Stages** (Horizontal Axis):
1. Import
2. Deduplication
3. Title/Abstract Screening
4. Full-Text Screening
5. Data Extraction
6. Quality Assessment
7. Synthesis
8. Export

**Implementation Layers** (Vertical Axis):
1. Database Schema
2. API Endpoints
3. Frontend UI
4. User Documentation

**Heat Map Values**:
- **Green (100%)**: Fully implemented
- **Yellow (50-99%)**: Partially implemented
- **Red (0-49%)**: Missing or broken
- **Gray (0%)**: Not started

**Example**:

| Stage | Schema | API | UI | Docs | Overall |
|-------|--------|-----|----|----|---------|
| Import | 🟢 100% | 🟢 100% | 🟢 100% | 🟢 100% | 🟢 **100%** |
| Dedup | 🟢 100% | 🟢 100% | 🟢 100% | 🟡 50% | 🟢 **88%** |
| T/A Screen | 🟢 100% | 🟢 100% | 🟡 85% | 🟡 60% | 🟡 **86%** |
| FT Screen | 🟢 100% | 🟢 100% | 🟡 85% | 🟡 60% | 🟡 **86%** |
| Extraction | 🟢 100% | 🟡 75% | 🟡 60% | 🔴 30% | 🟡 **66%** |
| Quality | 🟢 100% | 🟢 90% | 🟡 50% | 🔴 30% | 🟡 **68%** |
| Synthesis | 🟢 100% | 🟡 60% | 🔴 0% | 🔴 0% | 🔴 **40%** |
| Export | 🟢 100% | 🟢 100% | 🔴 0% | 🔴 0% | 🟡 **50%** |

**Deliverable**: Interactive Heat Map
- Click cell to see details
- Show gap analysis for each stage
- Export as PNG for reports

---

## PHASE 7: UNIQUE FEATURE EXTRACTION FROM COMPETITORS

### 7.1 COMPETITOR SCREENSHOT ANALYSIS

**Objective**: Analyze provided competitor screenshots to identify unique features worth replicating.

**Competitors from Screenshots**:

#### **Greptile** (Code Intelligence)
- **Unique Feature**: Force-directed codebase graph
  - Shows file relationships as network
  - Color-coded by file type
  - Interactive zoom/pan
- **Application to LitLens**: 
  - Create **Citation Network Graph** with similar interaction
  - Color nodes by publication year, study type, or inclusion status
  - Show co-citation clusters
  - Interactive exploration of literature landscape

#### **SciSpace** (AI Research Assistant)
- **Unique Features**:
  - **Chat with PDF**: Ask questions about uploaded papers
  - **Deep Search**: 21+ academic sources
  - **Auto Literature Review**: Generate review sections
  - **Data Visualization Builder**: Extract data → create charts
- **Application to LitLens**:
  - **High Priority**: Add "Chat with Study" in extraction phase
  - **Medium Priority**: Multi-source search already exists (enhance UI)
  - **Major Differentiator**: AI theme discussion (planned feature)

#### **Semantic Scholar**
- **Unique Features**:
  - **Highly Influential Citations**: Weighted citation analysis
  - **Paper Recommendations**: ML-based similar papers
  - **Citation Context**: Show where paper was cited (excerpt)
  - **TLDR Summaries**: AI-generated abstracts
- **Application to LitLens**:
  - **High Priority**: Add "Influential Citations" metric in graphs
  - **Medium Priority**: "Similar Studies" recommendation in screening
  - **Low Priority**: Citation context (nice-to-have)

#### **CiteTrue** (Citation Verification)
- **Unique Features**:
  - **Citation Verification**: Check if citation matches actual paper
  - **Confidence Scores**: HIGH/MEDIUM/LOW
  - **Fake Citation Detection**
- **Application to LitLens**:
  - **Medium Priority**: Add citation verification in writing phase
  - **Low Priority**: Detect mismatches between metadata and full text

#### **ResearchRabbit** (Discovery Tool)
- **Unique Features**:
  - **Citation Timeline**: Publication year on network graph
  - **Similar Papers by Date**: Chronological clustering
  - **Author Collaboration Networks**
  - **Collections with Smart Suggestions**
- **Application to LitLens**:
  - **High Priority**: Enhance graphs page with timeline view
  - **High Priority**: Add "Similar Studies" to discover page
  - **Medium Priority**: Author network (for team-based reviews)

---

### 7.2 FEATURE EXTRACTION RECOMMENDATIONS

**Tier 1 (Implement in Phase 2-3)**: Quick wins with high impact

1. **Enhanced Citation Network Graph** (from Greptile + ResearchRabbit)
   - Force-directed layout with better physics
   - Timeline slider (filter by publication year)
   - Cluster detection (automatic grouping by theme)
   - Export as image/interactive HTML
   - **Effort**: 20-30 hours
   - **Impact**: Major differentiator

2. **AI Chat with Studies** (from SciSpace)
   - RAG-based chat scoped to project
   - Ask questions like "What extraction methods were used?"
   - Show source citations in responses
   - **Effort**: 40-50 hours
   - **Impact**: Major differentiator

3. **Influential Citation Analysis** (from Semantic Scholar)
   - Calculate citation weights (recent, high-impact journals)
   - Show "key papers" in project
   - Highlight foundational vs derivative works
   - **Effort**: 10-15 hours
   - **Impact**: Moderate differentiator

**Tier 2 (Implement in Phase 4+)**: Advanced features

4. **Auto Literature Review Generation** (from SciSpace)
   - Generate draft sections (Background, Methods, Results)
   - Use extracted data + AI writing
   - Citation integration
   - **Effort**: 60-80 hours
   - **Impact**: Major differentiator

5. **Citation Verification** (from CiteTrue)
   - Verify metadata matches full text
   - Detect fake/misattributed citations
   - Confidence scores
   - **Effort**: 30-40 hours
   - **Impact**: Niche differentiator

---

## PHASE 8: FINAL AUDIT DELIVERABLES

### 8.1 EXECUTIVE SUMMARY REPORT

**Structure**:
1. **Product Classification**
   - Category: Research Management Software (Systematic Review Tools)
   - Comparable Products: Covidence, Rayyan, DistillerSR, ASReview

2. **Overall Readiness Assessment**
   - Market Readiness Score: X/5
   - Feature Completeness: X%
   - Technical Debt Score: X/10
   - Recommended Launch Timeline: X weeks

3. **Strengths**
   - Exceptional backend architecture
   - Modern tech stack
   - Unique AI capabilities

4. **Critical Gaps**
   - X% of features unexposed in UI
   - Broken workflows (list)
   - Missing market baseline features (list)

5. **Immediate Actions**
   - Top 10 priorities with effort estimates
   - 3-phase roadmap (Beta → Production → Differentiation)

---

### 8.2 VISUAL AUDIT DASHBOARD

**Components**:

1. **Coverage Dashboard**
   - Pie charts: DB coverage, API coverage, UI coverage
   - Bar chart: Feature completeness by domain
   - Timeline: Projected completion dates

2. **Network Graph** (Primary Visualization)
   - Schema-Route-UI mapping graph
   - Interactive, filterable
   - Export as PNG/SVG

3. **Heat Maps**
   - Workflow coverage heat map
   - Feature parity vs competitors

4. **Gap Analysis**
   - List of orphaned entities (table)
   - List of missing features (prioritized)
   - List of broken components

---

### 8.3 ACTIONABLE ROADMAP

**Phase 1: Beta Launch Prep** (3-4 weeks)
- Goal: Fix blockers, ship functional workflow
- Deliverables: (list from audit)
- Exit Criteria: Users can complete full review without broken flows

**Phase 2: Production Readiness** (4-6 weeks)
- Goal: Feature parity with competitors
- Deliverables: (list from audit)
- Exit Criteria: Professional UX, accessible, performant

**Phase 3: Differentiation** (6-8 weeks)
- Goal: Unique features competitors lack
- Deliverables: AI theme discussion, enhanced graphs, AI writing
- Exit Criteria: Clear differentiators justify premium pricing

---

## AUDIT EXECUTION CHECKLIST

### Week 1: Data Collection
- [ ] Export Prisma schema to JSON
- [ ] Extract all API routes to spreadsheet
- [ ] Catalog all frontend routes
- [ ] Document all components
- [ ] Run automated code quality tools (ESLint, complexity analysis)

### Week 2: Analysis
- [ ] Create entity coverage matrix
- [ ] Create API endpoint matrix
- [ ] Map workflow state machines
- [ ] Run accessibility audit (axe-core)
- [ ] Benchmark against competitors

### Week 3: Visualization
- [ ] Build network graph (D3.js or Cytoscape.js)
- [ ] Create heat maps
- [ ] Generate ERD diagrams
- [ ] Create workflow diagrams (Mermaid.js)

### Week 4: Synthesis
- [ ] Write executive summary
- [ ] Prioritize gap list
- [ ] Create roadmap
- [ ] Present findings to team
- [ ] Get stakeholder buy-in on priorities

---

## TOOLS & TECHNOLOGIES FOR AUDIT

**Analysis Tools**:
- **ESLint**: Code quality metrics
- **TypeScript Compiler**: Type safety analysis
- **Prisma Studio**: Database inspection
- **React Query Devtools**: API call tracking
- **axe-core**: Accessibility testing
- **Lighthouse**: Performance audit

**Visualization Tools**:
- **D3.js**: Custom network graphs
- **Cytoscape.js**: Citation network visualization
- **Mermaid.js**: Workflow diagrams
- **Excalidraw**: Quick sketches
- **Figma**: Professional diagrams

**Competitor Analysis**:
- **Manual Testing**: Sign up for Covidence, Rayyan trials
- **Screenshot Analysis**: From provided images
- **Web Research**: Feature comparison tables
- **Academic Papers**: Systematic review methodology standards (PRISMA 2020, Cochrane)

---

## GREPTILE-STYLE GRAPH SPECIFICATIONS

**Objective**: Create an interactive, visually stunning network graph like Greptile's codebase visualization.

### Graph Technical Spec:

**Library**: Cytoscape.js (already in dependencies) or D3.js force simulation

**Node Types**:
1. **Database Tables** (circular nodes)
   - Color: By coverage (green/yellow/red/gray)
   - Size: By relation count (5-50px radius)
   - Label: Table name
   - Badge: Record count estimate

2. **API Endpoints** (rectangular nodes)
   - Color: By usage (active=blue, partial=yellow, unused=red)
   - Size: By complexity (10-60px width)
   - Label: HTTP method + path
   - Badge: Response time metric

3. **UI Routes** (hexagonal nodes)
   - Color: By status (complete=green, partial=yellow, stub=red)
   - Size: By component count (10-60px)
   - Label: Route path
   - Badge: Implementation %

**Edge Styling**:
- **Width**: Proportional to usage frequency
- **Color**: Data flow direction
  - Read: Blue (#3B82F6)
  - Write: Green (#10B981)
  - Bidirectional: Purple (#8B5CF6)
- **Style**: Dashed for partial connections, solid for full

**Layout Algorithm**: Force-directed (fCoSE)
- Clustered by domain (Auth, Projects, Screening, Library, etc.)
- Hierarchical layers (DB bottom, API middle, UI top)
- Physics: Attractive force for connected nodes, repulsive for others

**Interactivity**:
- **Hover**: Show tooltip with details
- **Click**: Highlight connected path (depth-first search)
- **Double-click**: Open file in IDE (if local dev)
- **Zoom/Pan**: Mouse wheel + drag
- **Filter**: Checkboxes for coverage status, domain
- **Search**: Text input to find nodes

**Export**:
- PNG (screenshot)
- SVG (vector)
- JSON (data export)
- Interactive HTML (shareable)

**Example Implementation**:

```typescript
// src/features/audit/components/SchemaRouteUIGraph.tsx

import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';

cytoscape.use(fcose);

interface GraphData {
  nodes: Array<{
    data: {
      id: string;
      label: string;
      type: 'database' | 'api' | 'ui';
      coverage: 'full' | 'partial' | 'orphan';
      size: number;
      domain: string;
    };
  }>;
  edges: Array<{
    data: {
      source: string;
      target: string;
      type: 'read' | 'write' | 'fetch';
      weight: number;
    };
  }>;
}

export function SchemaRouteUIGraph({ data }: { data: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: data,
      style: [
        {
          selector: 'node[type="database"]',
          style: {
            'background-color': (ele) => {
              const coverage = ele.data('coverage');
              if (coverage === 'full') return '#10B981'; // green
              if (coverage === 'partial') return '#F59E0B'; // yellow
              return '#EF4444'; // red
            },
            'shape': 'ellipse',
            'width': (ele) => ele.data('size') * 10,
            'height': (ele) => ele.data('size') * 10,
            'label': 'data(label)',
            'font-size': '12px',
            'text-valign': 'center',
            'color': '#fff',
          },
        },
        {
          selector: 'node[type="api"]',
          style: {
            'background-color': (ele) => {
              const coverage = ele.data('coverage');
              if (coverage === 'full') return '#3B82F6'; // blue
              if (coverage === 'partial') return '#F59E0B'; // yellow
              return '#EF4444'; // red
            },
            'shape': 'rectangle',
            'width': (ele) => ele.data('size') * 15,
            'height': 40,
            'label': 'data(label)',
            'font-size': '10px',
            'text-valign': 'center',
            'color': '#fff',
          },
        },
        {
          selector: 'node[type="ui"]',
          style: {
            'background-color': (ele) => {
              const coverage = ele.data('coverage');
              if (coverage === 'full') return '#10B981'; // green
              if (coverage === 'partial') return '#F59E0B'; // yellow
              return '#EF4444'; // red
            },
            'shape': 'hexagon',
            'width': (ele) => ele.data('size') * 12,
            'height': (ele) => ele.data('size') * 12,
            'label': 'data(label)',
            'font-size': '11px',
            'text-valign': 'center',
            'color': '#fff',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': (ele) => ele.data('weight') / 2,
            'line-color': (ele) => {
              const type = ele.data('type');
              if (type === 'read') return '#3B82F6'; // blue
              if (type === 'write') return '#10B981'; // green
              return '#8B5CF6'; // purple
            },
            'target-arrow-color': (ele) => {
              const type = ele.data('type');
              if (type === 'read') return '#3B82F6';
              if (type === 'write') return '#10B981';
              return '#8B5CF6';
            },
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
      ],
      layout: {
        name: 'fcose',
        quality: 'proof',
        randomize: false,
        animate: true,
        animationDuration: 1000,
        fit: true,
        padding: 30,
        nodeSeparation: 100,
        idealEdgeLength: 150,
        edgeElasticity: 0.45,
        nestingFactor: 0.1,
        gravity: 0.25,
        numIter: 2500,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10,
      },
    });

    // Interactivity
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      // Highlight connected nodes
      const connected = node.neighborhood().add(node);
      cy.elements().removeClass('highlighted').addClass('faded');
      connected.removeClass('faded').addClass('highlighted');
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        // Clicked background, reset
        cy.elements().removeClass('highlighted faded');
      }
    });

    return () => cy.destroy();
  }, [data]);

  return (
    <div className="relative w-full h-screen">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg">
        <h3 className="font-semibold mb-2">Legend</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span>Full Coverage</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500" />
            <span>Partial Coverage</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span>Orphaned / Missing</span>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg">
        <div className="space-y-2">
          <button className="px-3 py-2 bg-blue-500 text-white rounded">
            Export PNG
          </button>
          <button className="px-3 py-2 bg-green-500 text-white rounded">
            Export SVG
          </button>
          <button className="px-3 py-2 bg-purple-500 text-white rounded">
            Reset View
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## FINAL NOTES

**Audit Duration**: 4-6 weeks for comprehensive audit (1 dedicated engineer)

**Audit Output**:
1. **Executive Summary** (5-10 pages)
2. **Detailed Audit Report** (50-100 pages)
3. **Interactive Dashboard** (web app)
4. **Network Graph Visualization** (interactive)
5. **Prioritized Roadmap** (Gantt chart)
6. **Presentation Deck** (20-30 slides)

**Success Criteria**:
- ✅ All orphaned entities identified
- ✅ All missing features cataloged
- ✅ All broken components documented
- ✅ Clear roadmap with timelines
- ✅ Stakeholder alignment on priorities

---

## APPENDIX: RESEARCH RESOURCES

**Industry Standards**:
- PRISMA 2020 Guidelines
- Cochrane Handbook for Systematic Reviews
- ROBINS-I Tool Documentation
- RoB 2.0 Tool Documentation

**Competitor Resources**:
- Covidence Help Center
- Rayyan Documentation
- DistillerSR User Guide
- ASReview Documentation
- ResearchRabbit Blog
- SciSpace Feature Tour

**Technical References**:
- Cytoscape.js Documentation
- D3.js Force Simulation Examples
- React Query Best Practices
- Next.js App Router Performance Guide
- WCAG 2.1 Guidelines

---

**END OF AUDIT FRAMEWORK**

This framework provides a systematic, comprehensive approach to auditing LitLens for completeness, consistency, and market readiness. Execute phase by phase, document findings rigorously, and use visualizations to communicate gaps effectively.

