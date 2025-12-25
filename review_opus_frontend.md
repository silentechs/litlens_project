# LitLens - Frontend Implementation Plan
## Complete Systematic Review & Research Intelligence Platform

**Version:** 1.0  
**Date:** December 25, 2025  
**Architect:** Senior Avant-Garde Developer

---

## MVP Tech Stack (Frontend)

| Concern | MVP Choice | Notes |
|---------|------------|-------|
| **Framework** | Next.js 15 (App Router) | React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4 + shadcn/ui | Radix primitives |
| **State** | TanStack Query + Zustand | Server + client state |
| **Realtime** | SSE (EventSource) | Connects to `/api/events` |
| **Forms** | React Hook Form + Zod | Type-safe validation |
| **File Uploads** | Direct to R2 (presigned) | No server bottleneck |

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current Codebase Analysis](#current-codebase-analysis)
3. [Competitor Analysis](#competitor-analysis)
4. [Best Practices Learned from Reference Codebases](#best-practices-learned)
5. [Features from ResearchFlow to Integrate](#researchflow-features)
6. [Frontend Architecture Plan](#frontend-architecture)
7. [Component Library Design](#component-library)
8. [Feature Implementation Roadmap](#implementation-roadmap)
9. [UI/UX Design System](#design-system)
10. [Performance & Optimization](#performance)
11. [Testing Strategy](#testing)

---

## 1. Executive Summary

This document outlines the comprehensive frontend implementation plan for rebuilding the SysReview systematic review platform from scratch. The goal is to create a world-class, AI-powered systematic review tool that surpasses competitors like Covidence, Rayyan, DistillerSR, and EPPI-Reviewer.

### Vision
A beautiful, performant, accessible, and intelligent systematic review platform that researchers love to use.

### Core UX Principle: "Two Modes, One App"

The platform serves two distinct but complementary workflows:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MODE A: REVIEW OPERATIONS (sysreview core)                                │
│  Project-centric workflow for systematic reviews                            │
│                                                                             │
│  Import → Screening → Conflicts → Full-Text → Extraction → QA → Reporting  │
│                                                                             │
│  Focus: Methodology rigor, team collaboration, audit trails                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ Seamless transition
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  MODE B: RESEARCH INTELLIGENCE (researchflow features)                     │
│  Discovery-centric workflow for research exploration                        │
│                                                                             │
│  Search → Graphs → Library → Alerts → Writing                               │
│                                                                             │
│  Focus: Discovery, knowledge synthesis, personal productivity               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Bridges Between Modes:**
- Library items can be added to project pipelines
- Project studies can be saved to personal library
- Graph discoveries can seed new review projects
- Writing hub can pull from both library and project extractions

---

## 2. Current Codebase Analysis

### 2.1 Skeletal Structure of Current SysReview

```
/src
├── app/
│   ├── (auth)/                    # Authentication routes
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── analytics/                 # Analytics pages
│   │   └── premium/
│   ├── api/                       # API routes (32+ endpoints)
│   │   ├── activities/
│   │   ├── ai/                    # AI analysis endpoints
│   │   ├── auth/
│   │   ├── notifications/
│   │   ├── projects/              # Core project API
│   │   ├── quality-assessment/
│   │   ├── search/
│   │   └── user/
│   ├── dashboard/                 # Main dashboard
│   │   ├── import/
│   │   ├── projects/              # Project management
│   │   │   ├── [id]/
│   │   │   │   ├── analytics/
│   │   │   │   ├── extraction/
│   │   │   │   ├── import/
│   │   │   │   ├── screening/
│   │   │   │   ├── settings/
│   │   │   │   └── team/
│   │   │   └── new/
│   │   └── settings/
│   ├── demo/
│   ├── invite/
│   ├── search/
│   └── simulation/
├── components/
│   ├── ai/                        # AI components (3 files)
│   ├── analytics/                 # Analytics dashboards (4 files)
│   ├── charts/                    # Chart components
│   ├── collaboration/             # Real-time collaboration (9 files)
│   ├── eligibility/               # PICO framework (2 files)
│   ├── export/                    # Export functionality
│   ├── extraction/                # Data extraction (2 files)
│   ├── gamification/              # Achievement system
│   ├── highlighting/              # Text highlighting
│   ├── import/                    # Study import (4 files)
│   ├── mobile/                    # Mobile-optimized (6 files)
│   ├── notifications/             # Notifications (4 files)
│   ├── quality/                   # Quality assessment (2 files)
│   ├── screening/                 # Screening workflow (5 files)
│   ├── search/                    # Search interface
│   ├── settings/                  # Reviewer management
│   ├── study/                     # Study components (6 files)
│   ├── tables/                    # Data tables
│   └── ui/                        # Shadcn/UI components (29 files)
├── hooks/                         # Custom hooks (7 files)
│   ├── use-toast.ts
│   ├── useEnhancedSocket.ts
│   ├── useImportProgress.ts
│   ├── useOfflineStorage.ts
│   ├── useOnlineStatus.ts
│   ├── usePushNotifications.ts
│   └── useTouchGestures.ts
├── lib/                           # Utility libraries (40+ files)
└── contexts/                      # React contexts
```

### 2.2 Current Features Inventory

#### Core Features
- [x] User authentication (NextAuth with OAuth)
- [x] Project management (CRUD, archiving, starring)
- [x] Team collaboration with invitations
- [x] Study import (RIS, BibTeX, CSV, XML)
- [x] Duplicate detection
- [x] Title/Abstract screening
- [x] Full-text screening
- [x] Conflict detection and resolution
- [x] Data extraction with templates
- [x] Quality assessment (RoB, PRISMA)
- [x] Real-time collaboration (Socket.IO)
- [x] Notifications (in-app, email)
- [x] Analytics dashboards
- [x] Export (CSV, Excel, PDF)
- [x] Mobile-responsive design

#### AI Features
- [x] AI-assisted screening suggestions
- [x] Batch AI analysis
- [x] Study insights generation
- [x] Relevance scoring

#### Advanced Features
- [x] PICO framework integration
- [x] Keyword highlighting
- [x] Gamification/achievements
- [x] Semantic search
- [x] Push notifications

---

## 3. Competitor Analysis

### 3.1 Major Competitors

#### Covidence
**Strengths:**
- Industry standard for systematic reviews
- Excellent PRISMA flow diagram generation
- Strong institutional adoption
- Good conflict resolution workflow
- PDF annotation tools

**Weaknesses:**
- Expensive pricing ($240/year personal, $800+/year institutional)
- Limited AI capabilities
- No real-time collaboration
- Dated UI/UX design
- Limited customization options

#### Rayyan
**Strengths:**
- Free tier available
- AI-powered semi-automation (RAYYAN AI)
- Mobile app availability
- Good blind screening
- Quick screening interface

**Weaknesses:**
- Limited data extraction features
- No quality assessment tools built-in
- Performance issues with large datasets
- Limited export options
- Basic analytics

#### DistillerSR
**Strengths:**
- Enterprise-grade features
- AI/ML for screening automation
- Regulatory compliance (FDA, EMA)
- Extensive customization
- Strong audit trails

**Weaknesses:**
- Very expensive ($3000+/year)
- Complex setup
- Steep learning curve
- Overkill for academic research
- Dated interface

#### EPPI-Reviewer
**Strengths:**
- Free for UK academics
- Meta-analysis integration
- Text mining capabilities
- Good for complex reviews

**Weaknesses:**
- Confusing interface
- Limited collaboration features
- Slow development cycle
- Poor mobile support

### 3.2 Feature Gap Analysis - What We Must Build

| Feature | Covidence | Rayyan | DistillerSR | EPPI | **LitLens (Target)** |
|---------|-----------|--------|-------------|------|--------------------------|
| AI Screening | Basic | Good | Good | Fair | **Excellent** |
| Real-time Collab | ❌ | ❌ | Limited | ❌ | **✅ Full** |
| Modern UI | Fair | Good | Fair | Poor | **Excellent** |
| Mobile App | PWA | Native | ❌ | ❌ | **PWA + Native** |
| Pricing | $$$ | Free tier | $$$$ | Free UK | **Freemium** |
| API Access | Limited | ❌ | ✅ | Limited | **Full REST + GraphQL** |
| Living Reviews | ❌ | ❌ | ❌ | ❌ | **✅** |
| Citation Networks | ❌ | ❌ | ❌ | ❌ | **✅** |

### 3.3 Unique Features to Implement

1. **Living Systematic Reviews** - Auto-update with new publications
2. **Citation Network Analysis** - Visual citation mapping
3. **AI Co-Pilot** - ChatGPT-style research assistant
4. **Smart Screening Queue** - AI-prioritized study order
5. **Collaborative Annotation** - Real-time document markup
6. **Research Graph Visualization** - Knowledge mapping
7. **Voice Commands** - Hands-free screening
8. **Offline-First Architecture** - Work without internet
9. **White-Label Support** - Custom branding for institutions
10. **Integration Hub** - Connect with Zotero, Mendeley, EndNote

---

## 4. Best Practices Learned from Reference Codebases

### 4.1 From school_management_new

#### Architecture Patterns
```
/lib
├── application/
│   ├── services/          # Business logic services
│   └── use-cases/         # Use case implementations
├── domain/
│   ├── entities/          # Domain entities
│   ├── repositories/      # Repository interfaces
│   ├── services/          # Domain services
│   └── value-objects/     # Value objects
└── infrastructure/
    ├── database/          # DB implementations
    ├── external/          # External services
    └── repositories/      # Repository implementations
```

**Key Learnings:**
- Clean Architecture / DDD pattern for complex business logic
- Separate repository interfaces from implementations
- Use-case driven development
- Domain-specific grading engines (GesGradingEngine)
- Entity validation and testing

#### Component Patterns
- QR Scanner component for attendance
- Student ID card generation
- Terminal report generation with PDF export
- Invoice and receipt system
- Timetable grid visualization

### 4.2 From assetthreesixty

#### Enterprise-Grade Patterns

**Service Layer Organization (200+ services):**
```
/lib
├── analytics-service.ts
├── asset-service.ts
├── audit-service.ts
├── budget-service.ts
├── cache-service.ts
├── compliance-service.ts
├── depreciation-service.ts
├── email-template-service.ts
├── export-service.ts
├── feature-flag-service.ts
├── gdpr-service.ts
├── location-hierarchy-service.ts
├── maintenance-service.ts
├── notification-service.ts
├── offline-sync.ts
├── performance-monitor.ts
├── print-template-service.ts
├── push-service.ts
├── qr-code-service.ts
├── rate-limit-service.ts
├── realtime.ts
├── report-service.ts
├── reservation-service.ts
├── rfid-service.ts
├── role-service.ts
├── scanner-utils.ts
├── sla-service.ts
├── sms-service.ts
├── storage/
├── template-service.ts
├── voice-command-processor.ts
├── webhook-service.ts
├── websocket.ts
└── workflow-engine/
```

**Key Learnings:**
- Comprehensive service layer architecture
- Feature flag system for gradual rollouts
- Multi-channel notification service (email, SMS, push, in-app)
- Voice command support
- RFID/barcode/QR code integration
- Offline sync with conflict resolution
- Print template system
- Workflow engine for approval processes
- Real-time collaboration with WebSocket
- Performance monitoring
- Rate limiting
- Cache optimization
- SLA management
- GDPR compliance
- Role-based access with capabilities
- Hierarchical location/organization structure
- API versioning
- OpenAPI documentation

#### Component Library (100+ components)
```
/components
├── admin/              # Admin panels
├── analytics/          # Analytics & charts
├── approvals/          # Workflow approvals
├── assets/             # Asset management
├── audit/              # Audit tools
├── auth/               # Capability guards
├── billing/            # Subscription management
├── budgets/            # Budget tracking
├── checkout/           # Asset checkout
├── dashboard/          # Dashboard widgets
├── discovery/          # Asset discovery
├── error-boundaries/   # Error handling
├── floorplans/         # Floor plan editor
├── forms/              # Dynamic forms
├── help/               # Help system
├── inventory/          # Inventory management
├── locations/          # Location picker
├── maintenance/        # Maintenance scheduling
├── notifications/      # Notification center
├── onboarding/         # User onboarding
├── pwa/                # PWA components
├── reservations/       # Reservation system
├── rfid/               # RFID integration
├── roles/              # Role management
├── scanner/            # QR/Barcode scanner
├── search/             # Advanced search
├── security/           # Security dashboard
├── service-desk/       # Ticket system
├── settings/           # Settings panels
├── tickets/            # Ticket management
├── ui/                 # Base UI components
├── user-guide/         # Interactive guides
├── vendors/            # Vendor management
└── workflows/          # Workflow visualization
```

#### Internationalization
- Full i18n support with next-intl
- Messages in: en, de, es, fr, ja, pl

---

## 5. Features from ResearchFlow to Integrate

### 5.1 ResearchFlow Feature Analysis

```
/src/app
├── admin/                    # Admin dashboard
│   ├── analytics/            # System analytics
│   ├── system/               # System health
│   └── users/                # User management
├── author/                   # Author profiles
├── discover/                 # Paper discovery
├── graph/                    # Research graphs
│   ├── [graphId]/
│   ├── author/               # Author networks
│   ├── connector/            # Literature connector
│   └── multi/                # Multi-seed analysis
├── library/                  # Personal library
├── onboarding/              # User onboarding
├── search/                   # Paper search
├── settings/
│   ├── billing/             # Subscription management
│   └── team/                # Team settings
└── writing/                  # Writing assistant
    └── [projectId]/
```

### 5.2 Critical Features to Port

#### Research Graph Visualization
- Cytoscape.js for network visualization
- Citation network analysis
- Author collaboration networks
- Multi-seed graph exploration
- Graph sharing with public links

#### AI Capabilities
- OpenAI integration for paper analysis
- AI-generated summaries
- Research gap identification
- Key insights extraction
- Methodology analysis

#### Library Management
- Personal paper library
- Folder organization
- Collections
- Reading status tracking
- Tags and keywords

#### Research Alerts
- Custom search alerts
- Citation tracking
- Author publication alerts
- Concept trending alerts
- Email digest notifications

#### Writing Assistant
- Literature review generation
- Research gap synthesis
- Methodology sections
- TipTap rich text editor

#### Discovery Tools
- OpenAlex API integration
- Semantic paper search
- Author network exploration
- Multi-source aggregation

#### Usage & Billing
- Usage limits and tracking
- Stripe subscription integration
- Tier-based feature access

---

## 6. Frontend Architecture Plan

### 6.1 Technology Stack

```typescript
// Core Framework
Next.js 15.x (App Router)
React 19.x
TypeScript 5.x

// State Management
Zustand (global state)
TanStack Query (server state)
React Hook Form (form state)

// UI Framework
Tailwind CSS 4.x
Radix UI (headless components)
Framer Motion (animations)
Lucide React (icons)

// Data Visualization
ECharts for React (charts)
Cytoscape.js (network graphs)
D3.js (custom visualizations)
Recharts (simple charts)

// Real-time
Socket.IO Client
Zustand middleware for sync

// Rich Text
TipTap (collaborative editing)
PDF.js (document viewing)

// Mobile/PWA
next-pwa (service worker)
React Native (future mobile app)

// Internationalization
next-intl

// Testing
Vitest (unit tests)
Playwright (E2E)
Testing Library
```

### 6.2 Directory Structure (Explicit Route Grouping)

**Route Groups Strategy** (keeps codebase predictable at scale):

```
/src/app/
├── (auth)/          # Authentication pages (unauthenticated users)
├── (app)/           # Main application shell (authenticated users)
├── (project)/       # Project workspace and all project sub-routes
├── (admin)/         # Admin shell + routes (admin-only)
├── (public)/        # Public pages (landing, pricing, legal)
└── api/             # API routes
```

```
/src
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Auth group - unauthenticated
│   │   ├── layout.tsx          # Minimal auth layout
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── verify-email/
│   │   ├── verify-request/
│   │   └── error/
│   │
│   ├── (app)/                  # Main app - authenticated
│   │   ├── layout.tsx          # App shell with sidebar
│   │   ├── page.tsx            # Dashboard home
│   │   ├── projects/
│   │   │   ├── page.tsx        # Project list
│   │   │   └── new/
│   │   ├── library/            # Personal library
│   │   │   ├── page.tsx
│   │   │   ├── folders/
│   │   │   └── collections/
│   │   ├── discover/           # Research discovery
│   │   │   ├── page.tsx
│   │   │   └── author/[id]/
│   │   ├── graphs/             # Research graphs
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   ├── [graphId]/
│   │   │   ├── multi/
│   │   │   ├── author/
│   │   │   ├── connector/
│   │   │   └── shared/[token]/
│   │   ├── writing/            # Writing assistant
│   │   │   ├── page.tsx
│   │   │   └── [projectId]/
│   │   ├── alerts/             # Research alerts
│   │   │   ├── page.tsx
│   │   │   └── inbox/
│   │   ├── search/             # Unified search
│   │   ├── settings/           # User settings
│   │   │   ├── page.tsx
│   │   │   ├── profile/
│   │   │   ├── preferences/
│   │   │   ├── notifications/
│   │   │   ├── security/
│   │   │   └── billing/
│   │   └── notifications/      # Notification center
│   │
│   ├── (project)/              # Project workspace - authenticated + project access
│   │   ├── layout.tsx          # Project layout with sub-nav
│   │   └── project/[id]/
│   │       ├── page.tsx        # Project overview
│   │       ├── protocol/       # Protocol development
│   │       ├── import/         # Study import
│   │       ├── screening/      # Screening workflow
│   │       │   ├── page.tsx    # Screening queue
│   │       │   ├── title-abstract/
│   │       │   ├── full-text/
│   │       │   ├── calibration/
│   │       │   └── conflicts/
│   │       ├── extraction/     # Data extraction
│   │       │   ├── page.tsx
│   │       │   ├── templates/
│   │       │   └── discrepancies/
│   │       ├── quality/        # Quality assessment
│   │       │   ├── page.tsx
│   │       │   ├── rob/        # Risk of Bias
│   │       │   └── grade/      # GRADE certainty
│   │       ├── analytics/      # Project analytics
│   │       ├── exports/        # Export center
│   │       ├── team/           # Team management
│   │       └── settings/       # Project settings
│   │
│   ├── (admin)/                # Admin panel - admin role only
│   │   ├── layout.tsx          # Admin layout
│   │   ├── page.tsx            # Admin dashboard
│   │   ├── users/
│   │   ├── analytics/
│   │   └── system/
│   │
│   ├── (public)/               # Public pages - no auth required
│   │   ├── layout.tsx          # Marketing layout
│   │   ├── page.tsx            # Landing page
│   │   ├── pricing/
│   │   ├── docs/
│   │   ├── blog/
│   │   ├── terms/
│   │   └── privacy/
│   │
│   ├── api/                    # API routes
│   └── globals.css
│
├── components/
│   ├── ui/                     # Base UI (50+ components)
│   │   ├── button/
│   │   ├── input/
│   │   ├── dialog/
│   │   ├── table/
│   │   ├── command/
│   │   ├── calendar/
│   │   └── ...
│   ├── layout/                 # Layout components
│   │   ├── sidebar/
│   │   ├── header/
│   │   ├── footer/
│   │   ├── mobile-nav/
│   │   └── command-palette/
│   ├── auth/                   # Auth components
│   ├── project/                # Project components
│   ├── screening/              # Screening components
│   ├── extraction/             # Extraction components
│   ├── quality/                # Quality assessment
│   ├── synthesis/              # Synthesis components
│   ├── graphs/                 # Graph visualization
│   ├── library/                # Library components
│   ├── writing/                # Writing components
│   ├── analytics/              # Analytics components
│   ├── collaboration/          # Real-time collaboration
│   ├── notifications/          # Notification components
│   ├── onboarding/             # Onboarding flows
│   └── shared/                 # Shared components
│
├── features/                   # Feature modules
│   ├── auth/
│   │   ├── hooks/
│   │   ├── stores/
│   │   └── api/
│   ├── projects/
│   ├── screening/
│   ├── extraction/
│   ├── search/
│   ├── graphs/
│   └── ...
│
├── hooks/                      # Global hooks
│   ├── use-auth.ts
│   ├── use-project.ts
│   ├── use-socket.ts
│   ├── use-offline.ts
│   ├── use-keyboard-shortcuts.ts
│   ├── use-media-query.ts
│   └── ...
│
├── stores/                     # Zustand stores
│   ├── auth-store.ts
│   ├── project-store.ts
│   ├── screening-store.ts
│   ├── ui-store.ts
│   └── ...
│
├── lib/                        # Utilities
│   ├── api/                    # API clients
│   ├── utils/                  # Utility functions
│   ├── validators/             # Zod schemas
│   └── constants/              # Constants
│
├── styles/                     # Global styles
│   ├── themes/
│   └── animations/
│
└── types/                      # TypeScript types
```

### 6.3 State Management Strategy

```typescript
// 1. Server State (TanStack Query)
// - All API data
// - Caching, refetching, mutations

// 2. Global Client State (Zustand)
// - User session
// - UI preferences
// - Sidebar state
// - Modal state

// 3. Form State (React Hook Form)
// - All form data
// - Validation with Zod

// 4. Local State (useState)
// - Component-specific state

// 5. URL State (nuqs or useSearchParams)
// - Filters, pagination, sorting
```

---

## 7. Component Library Design

### 7.1 Base UI Components (50+)

```
accordion        | combobox        | navigation-menu
alert            | command         | pagination
alert-dialog     | context-menu    | popover
aspect-ratio     | date-picker     | progress
avatar           | dialog          | radio-group
badge            | drawer          | resizable
breadcrumb       | dropdown-menu   | scroll-area
button           | empty-state     | select
calendar         | error-boundary  | separator
card             | file-upload     | sheet
carousel         | form            | skeleton
chart            | hover-card      | slider
checkbox         | input           | sonner
collapsible      | input-otp       | switch
table            | textarea        | toggle
tabs             | toast           | toggle-group
tooltip          | tree-view
```

### 7.2 Domain Components

#### Screening Components
- StudyCard - Study display card
- ScreeningToolbar - Quick actions
- DecisionButtons - Include/Exclude/Maybe
- KeywordHighlighter - Highlight terms
- ConflictBanner - Conflict notification
- BatchDecisionModal - Bulk actions
- ScreeningProgress - Progress indicator
- FilterPanel - Filtering options
- SortControls - Sorting options
- StudyPreview - Full study preview

#### Extraction Components
- ExtractionForm - Dynamic form builder
- FieldEditor - Field type editor
- DataTable - Extracted data display
- DiscrepancyViewer - Compare extractions
- ValidationPanel - Data validation
- CalculatedFields - Auto-calculations

#### Graph Components
- NetworkGraph - Cytoscape wrapper
- NodeTooltip - Node hover info
- GraphControls - Zoom, pan, layout
- GraphLegend - Color coding legend
- GraphFilters - Filter nodes/edges
- GraphExport - Export options

#### Unified Search Component (Key UX Pattern)
```tsx
// components/search/UnifiedSearch.tsx
// One search interface with tabbed sources

interface UnifiedSearchProps {
  defaultTab?: 'external' | 'internal' | 'semantic';
  onSelect?: (work: Work) => void;
  projectId?: string;  // If in project context
  actions?: ('addToProject' | 'addToLibrary' | 'createGraph')[];
}

const UnifiedSearch = ({ defaultTab, onSelect, projectId, actions }) => {
  const [tab, setTab] = useState(defaultTab || 'external');
  
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="external">
          <Globe className="w-4 h-4 mr-2" />
          OpenAlex / PubMed
        </TabsTrigger>
        <TabsTrigger value="internal">
          <FolderSearch className="w-4 h-4 mr-2" />
          {projectId ? 'This Project' : 'My Library'}
        </TabsTrigger>
        <TabsTrigger value="semantic">
          <Brain className="w-4 h-4 mr-2" />
          Semantic Search
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="external">
        <ExternalSearch onSelect={onSelect} />
      </TabsContent>
      <TabsContent value="internal">
        <InternalSearch projectId={projectId} onSelect={onSelect} />
      </TabsContent>
      <TabsContent value="semantic">
        <SemanticSearch projectId={projectId} onSelect={onSelect} />
      </TabsContent>
      
      {/* Universal action buttons on each result */}
      {actions && <ResultActions actions={actions} />}
    </Tabs>
  );
};
```

**"Save to library" and "Add to project" affordances everywhere:**
- Search results → Add to Library / Add to Project
- Graph nodes → Save to Library
- Writing citations → Pull from Library
- Alert discoveries → Add to Library / Start Review

#### Project ↔ Library Bridge Component
```tsx
// components/library/LibraryProjectBridge.tsx
// Seamlessly move works between personal library and projects

interface LibraryProjectBridgeProps {
  works: Work[];
  direction: 'toProject' | 'toLibrary';
}

const LibraryProjectBridge = ({ works, direction }) => {
  const projects = useUserProjects();
  const folders = useLibraryFolders();
  
  if (direction === 'toProject') {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary">
            <FolderPlus className="w-4 h-4 mr-2" />
            Add to Project ({works.length})
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Project Pipeline</DialogTitle>
            <DialogDescription>
              {works.length} work(s) will be added for screening
            </DialogDescription>
          </DialogHeader>
          
          <ProjectSelector projects={projects} />
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            Works will enter the screening queue as pending
          </div>
          
          <DialogFooter>
            <Button onClick={handleAddToProject}>
              Add to Pipeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <BookmarkPlus className="w-4 h-4 mr-2" />
          Save to Library ({works.length})
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save to Personal Library</DialogTitle>
        </DialogHeader>
        
        <FolderSelector folders={folders} allowCreate />
        <TagInput placeholder="Add tags..." />
        
        <DialogFooter>
          <Button onClick={handleSaveToLibrary}>
            Save to Library
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

#### Collaboration Components
- PresenceIndicator - Online users
- CursorPresence - Live cursors
- ChatPanel - Study chat
- ActivityFeed - Activity timeline
- MentionInput - @mentions
- CommentThread - Threaded comments

#### Notification & Alert Settings (with Quiet Hours)
```tsx
// components/settings/NotificationPreferences.tsx

interface NotificationPreferencesProps {
  userId: string;
}

const NotificationPreferences = ({ userId }) => {
  const { preferences, updatePreferences } = useNotificationPreferences();
  
  return (
    <div className="space-y-6">
      {/* Channel Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(NOTIFICATION_TYPES).map(([type, config]) => (
            <div key={type} className="flex items-center justify-between">
              <div>
                <Label>{config.label}</Label>
                <p className="text-sm text-muted-foreground">{config.description}</p>
              </div>
              <div className="flex gap-2">
                <Toggle 
                  pressed={preferences[type]?.inApp} 
                  onPressedChange={(v) => updateChannel(type, 'inApp', v)}
                >
                  <Bell className="w-4 h-4" />
                </Toggle>
                <Toggle 
                  pressed={preferences[type]?.email}
                  onPressedChange={(v) => updateChannel(type, 'email', v)}
                >
                  <Mail className="w-4 h-4" />
                </Toggle>
                <Toggle 
                  pressed={preferences[type]?.push}
                  onPressedChange={(v) => updateChannel(type, 'push', v)}
                >
                  <Smartphone className="w-4 h-4" />
                </Toggle>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      
      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="w-5 h-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Pause non-urgent notifications during these hours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable Quiet Hours</Label>
            <Switch 
              checked={preferences.quietHours?.enabled}
              onCheckedChange={(v) => updateQuietHours('enabled', v)}
            />
          </div>
          
          {preferences.quietHours?.enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <TimeInput 
                    value={preferences.quietHours.start}
                    onChange={(v) => updateQuietHours('start', v)}
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <TimeInput 
                    value={preferences.quietHours.end}
                    onChange={(v) => updateQuietHours('end', v)}
                  />
                </div>
              </div>
              
              <div>
                <Label>Days</Label>
                <DaySelector 
                  selected={preferences.quietHours.days}
                  onChange={(v) => updateQuietHours('days', v)}
                />
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Critical notifications (conflicts requiring adjudication, 
                  security alerts) will still be delivered.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Alert Digest Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Research Alert Digests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Digest Frequency</Label>
              <p className="text-sm text-muted-foreground">
                Combine multiple alert discoveries into one email
              </p>
            </div>
            <Select 
              value={preferences.alertDigest}
              onValueChange={(v) => updatePreferences({ alertDigest: v })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <Label>One-click Unsubscribe</Label>
            <p className="text-sm text-muted-foreground">
              All alert emails include unsubscribe link
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

---

## 8. Feature Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
- [ ] Project scaffolding with Next.js 15
- [ ] Authentication system (NextAuth v5)
- [ ] Base UI component library
- [ ] Layout system (dashboard, public)
- [ ] Theme system (light/dark/custom)
- [ ] Internationalization setup
- [ ] PWA configuration
- [ ] Error boundary implementation

### Phase 2: Core Features (Weeks 5-10)
- [ ] Project management
- [ ] Team collaboration
- [ ] Study import (all formats)
- [ ] Duplicate detection UI
- [ ] Title/Abstract screening
- [ ] Full-text screening
- [ ] Conflict resolution
- [ ] Basic analytics

### Phase 3: Advanced Screening (Weeks 11-14)
- [ ] AI-assisted screening
- [ ] Smart screening queue
- [ ] Keyboard shortcuts
- [ ] Bulk operations
- [ ] PICO framework
- [ ] Eligibility criteria builder
- [ ] Screening history/audit

### Phase 4: Data Extraction (Weeks 15-18)
- [ ] Form builder
- [ ] Dynamic field types
- [ ] Validation rules
- [ ] Conditional logic
- [ ] Double extraction
- [ ] Discrepancy resolution
- [ ] Data export

### Phase 5: Quality Assessment (Weeks 19-21)
- [ ] Risk of bias tools
- [ ] GRADE framework
- [ ] Custom tools builder
- [ ] Consensus mechanism
- [ ] Quality visualizations

### Phase 6: Analytics & Synthesis (Weeks 22-25)
- [ ] PRISMA flow diagram
- [ ] Publication trends
- [ ] Geographic analysis
- [ ] Citation networks
- [ ] Meta-analysis integration
- [ ] Forest plots
- [ ] Funnel plots

### Phase 7: Research Tools (Weeks 26-30)
- [ ] Personal library
- [ ] Paper discovery
- [ ] Research graphs
- [ ] Writing assistant
- [ ] Research alerts
- [ ] Citation management

### Phase 8: Polish & Scale (Weeks 31-36)
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Mobile optimization
- [ ] Offline support
- [ ] Voice commands
- [ ] Onboarding tours
- [ ] Help system
- [ ] Documentation

---

## 9. UI/UX Design System

### 9.1 Design Tokens

```css
/* Color Palette - Inspired by Academic Excellence */
--primary-50: #EEF2FF;
--primary-100: #E0E7FF;
--primary-500: #6366F1;
--primary-600: #4F46E5;
--primary-700: #4338CA;

--success-500: #10B981;
--warning-500: #F59E0B;
--error-500: #EF4444;
--info-500: #3B82F6;

/* Typography - Scholarly & Modern */
--font-display: 'Cal Sans', system-ui;
--font-body: 'Inter', system-ui;
--font-mono: 'JetBrains Mono', monospace;

/* Spacing Scale */
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-12: 3rem;

/* Border Radius */
--radius-sm: 0.375rem;
--radius-md: 0.5rem;
--radius-lg: 0.75rem;
--radius-xl: 1rem;
--radius-full: 9999px;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
```

### 9.2 Component Patterns

#### Card Variants
- Elevated - floating with shadow
- Outlined - border, no shadow
- Filled - subtle background
- Interactive - hover states

#### Button Variants
- Primary - main actions
- Secondary - secondary actions
- Ghost - minimal style
- Destructive - dangerous actions
- Loading - with spinner
- Icon-only - compact

### 9.3 Motion Design

```typescript
// Standard transitions
const transitions = {
  fast: { duration: 0.1 },
  normal: { duration: 0.2 },
  slow: { duration: 0.3 },
}

// Page transitions
const pageVariants = {
  initial: { opacity: 0, y: 10 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

// Stagger children
const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05 } },
}
```

---

## 9.4 Error UX Pattern (Critical)

**Rule: Never surface raw API errors to users.**

```typescript
// lib/errors/toUserMessage.ts
// Single source of truth for error message sanitization

type ErrorCode = 
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

interface UserFacingError {
  title: string;
  message: string;
  action?: string;
  retryable: boolean;
}

const errorMessages: Record<ErrorCode, UserFacingError> = {
  VALIDATION_ERROR: {
    title: 'Invalid Input',
    message: 'Please check your input and try again.',
    retryable: true
  },
  UNAUTHORIZED: {
    title: 'Session Expired',
    message: 'Please sign in again to continue.',
    action: 'Sign In',
    retryable: false
  },
  FORBIDDEN: {
    title: 'Access Denied',
    message: "You don't have permission to perform this action.",
    retryable: false
  },
  NOT_FOUND: {
    title: 'Not Found',
    message: 'The requested resource could not be found.',
    retryable: false
  },
  CONFLICT: {
    title: 'Conflict Detected',
    message: 'This item has been modified. Please refresh and try again.',
    retryable: true
  },
  RATE_LIMITED: {
    title: 'Too Many Requests',
    message: 'Please wait a moment before trying again.',
    retryable: true
  },
  SERVER_ERROR: {
    title: 'Something Went Wrong',
    message: 'We encountered an issue. Our team has been notified.',
    retryable: true
  },
  NETWORK_ERROR: {
    title: 'Connection Lost',
    message: 'Please check your internet connection.',
    retryable: true
  },
  UNKNOWN: {
    title: 'Unexpected Error',
    message: 'Something unexpected happened. Please try again.',
    retryable: true
  }
};

export function toUserMessage(error: unknown): UserFacingError {
  // API error with code
  if (isApiError(error)) {
    return errorMessages[error.code] || errorMessages.UNKNOWN;
  }
  
  // Network error
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return errorMessages.NETWORK_ERROR;
  }
  
  // HTTP status codes
  if (hasStatus(error)) {
    if (error.status === 401) return errorMessages.UNAUTHORIZED;
    if (error.status === 403) return errorMessages.FORBIDDEN;
    if (error.status === 404) return errorMessages.NOT_FOUND;
    if (error.status === 409) return errorMessages.CONFLICT;
    if (error.status === 429) return errorMessages.RATE_LIMITED;
    if (error.status >= 500) return errorMessages.SERVER_ERROR;
  }
  
  return errorMessages.UNKNOWN;
}

// Usage in components
function handleError(error: unknown) {
  const userError = toUserMessage(error);
  toast({
    title: userError.title,
    description: userError.message,
    variant: 'destructive',
    action: userError.retryable ? (
      <ToastAction altText="Retry" onClick={retry}>Retry</ToastAction>
    ) : undefined
  });
}
```

**Error Boundary Wrapping** (high-risk flows):
```tsx
// Wrap these flows with error boundaries
<ErrorBoundary fallback={<ImportErrorFallback />}>
  <ImportFlow />
</ErrorBoundary>

<ErrorBoundary fallback={<ExportErrorFallback />}>
  <ExportGeneration />
</ErrorBoundary>

<ErrorBoundary fallback={<AIErrorFallback />}>
  <AIScreeningAssist />
</ErrorBoundary>

<ErrorBoundary fallback={<BulkActionErrorFallback />}>
  <BulkOperations />
</ErrorBoundary>
```

---

## 10. Performance & Optimization

### 10.1 Bundle Optimization
- Dynamic imports for heavy components
- Route-based code splitting
- Tree shaking optimization
- Image optimization with next/image
- Font optimization with next/font

### 10.2 Runtime Performance
- React.memo for expensive components
- useMemo/useCallback strategically
- Virtualization for long lists
- Debounced search inputs
- Optimistic updates

### 10.3 Loading States
- Skeleton screens
- Progressive loading
- Suspense boundaries
- Streaming SSR

### 10.4 Caching Strategy
- TanStack Query caching
- Service Worker caching
- Static page generation
- Incremental Static Regeneration

---

## 11. Testing Strategy

### 11.0 Testing Pyramid Distribution
```
┌───────────────┐  E2E (Playwright)        │ 10-20%
│               │  Critical flows only     │
└───────┬───────┘                          │
        │                                  │
┌───────┴───────┐  Integration             │ 20-30%
│               │  Hooks + API + Auth      │
└───────┬───────┘                          │
        │                                  │
┌───────┴───────┐  Unit (Vitest)           │ 60-70%
│               │  Fast, isolated          │
└───────────────┘                          │
```

### 11.0.1 Frontend-Backend Field Alignment Guardrail

**CI script to prevent "form submits but backend rejects" regressions:**

```typescript
// scripts/check-form-alignment.ts
const criticalForms = [
  { 
    name: 'CreateProject',
    formSchema: '@/lib/validators/project.form.ts',
    apiSchema: '@/lib/validators/project.api.ts'
  },
  { 
    name: 'ScreeningDecision',
    formSchema: '@/features/screening/validators.ts',
    apiSchema: '@/lib/validators/screening.api.ts'
  },
  { 
    name: 'ExtractionSubmit',
    formSchema: '@/features/extraction/validators.ts',
    apiSchema: '@/lib/validators/extraction.api.ts'
  },
  { 
    name: 'InviteMember',
    formSchema: '@/features/team/validators.ts',
    apiSchema: '@/lib/validators/team.api.ts'
  },
  { 
    name: 'ImportStudies',
    formSchema: '@/features/import/validators.ts',
    apiSchema: '@/lib/validators/import.api.ts'
  },
  { 
    name: 'QualityAssessment',
    formSchema: '@/features/quality/validators.ts',
    apiSchema: '@/lib/validators/quality.api.ts'
  }
];

// Compare and flag misalignments
// Run in CI: npx tsx scripts/check-form-alignment.ts
```

Add to CI:
```yaml
- name: Check form-API alignment
  run: npx tsx scripts/check-form-alignment.ts
```

### 11.1 Unit Tests (Vitest)
- Utility functions
- Custom hooks
- Store actions
- Validators
- Error message mapping

### 11.2 Component Tests (Testing Library)
- Component rendering
- User interactions
- Accessibility checks
- Error boundary behavior

### 11.3 E2E Tests (Playwright)
- Critical user flows (authenticated)
- Import → Screening → Extraction → Export flow
- Cross-browser testing
- Mobile testing
- Visual regression

### 11.4 Coverage Targets
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

---

## Appendix A: Keyboard Shortcuts

```
Navigation
------------------
Cmd/Ctrl + K    | Command palette
Cmd/Ctrl + /    | Keyboard shortcuts help
Cmd/Ctrl + B    | Toggle sidebar
Cmd/Ctrl + .    | Quick actions

Screening
------------------
I               | Include study
E               | Exclude study
M               | Maybe/Uncertain
N               | Next study
P               | Previous study
Space           | Toggle full abstract
C               | Open conflicts

Data Entry
------------------
Cmd/Ctrl + S    | Save
Cmd/Ctrl + Enter| Submit and next
Escape          | Cancel/Close modal
Tab             | Next field
Shift + Tab     | Previous field
```

---

## Appendix B: Accessibility Checklist

- [ ] All images have alt text
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Focus indicators visible
- [ ] Form labels present
- [ ] Error messages descriptive
- [ ] Skip links available
- [ ] Animations reduceable
- [ ] Touch targets 44px+

---

*Document prepared for LitLens systematic review & research intelligence platform.*

