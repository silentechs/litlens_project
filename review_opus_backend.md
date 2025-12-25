# LitLens - Backend Implementation Plan
## Complete Systematic Review & Research Intelligence Platform

**Version:** 1.0  
**Date:** December 25, 2025  
**Architect:** Senior Avant-Garde Developer

---

## MVP Tech Stack Decisions

| Concern | MVP Choice | Future Scale |
|---------|------------|--------------|
| **File Storage** | Cloudflare R2 | Cloudflare R2 (stays) |
| **Realtime Updates** | Next.js SSE (Server-Sent Events) | Socket.IO or Ably |
| **Background Jobs** | Next.js Route Handlers + Vercel Cron | BullMQ + Redis |
| **Database** | PostgreSQL (Neon/Supabase) | PostgreSQL + pgvector |
| **Cache** | Vercel KV or Upstash Redis | Redis Cluster |

---

## MVP Implementation Details

### Cloudflare R2 Storage Service

```typescript
// lib/storage/r2-service.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export class R2StorageService {
  async getUploadUrl(key: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });
    
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    
    return { uploadUrl, publicUrl };
  }
  
  static generateKey(type: 'avatars' | 'pdfs' | 'exports', userId: string, filename: string): string {
    return `${type}/${userId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  }
}
```

### Next.js SSE for Realtime Updates

```typescript
// app/api/events/route.ts
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response('Unauthorized', { status: 401 });
  
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 30000);
      
      // Store connection for broadcasting
      addConnection(session.user.id, controller);
      
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        removeConnection(session.user.id, controller);
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// hooks/useSSE.ts (client)
export function useSSE() {
  useEffect(() => {
    const eventSource = new EventSource('/api/events');
    
    eventSource.addEventListener('import:progress', (e) => {
      const data = JSON.parse(e.data);
      // Update React Query cache
    });
    
    return () => eventSource.close();
  }, []);
}
```

### Next.js Background Jobs

```typescript
// lib/jobs/runner.ts
export async function createJob(type: JobType, payload: unknown): Promise<string> {
  const job = await prisma.job.create({
    data: { type, payload, status: 'pending', attempts: 0, maxAttempts: 3 },
  });
  
  // Trigger processing
  fetch('/api/jobs/process', {
    method: 'POST',
    headers: { 'x-job-secret': process.env.JOB_SECRET! },
  });
  
  return job.id;
}

// app/api/jobs/process/route.ts
export async function POST(req: Request) {
  if (req.headers.get('x-job-secret') !== process.env.JOB_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const jobs = await prisma.job.findMany({
    where: { status: 'pending' },
    take: 10,
  });
  
  for (const job of jobs) {
    await processJob(job);
  }
  
  return Response.json({ processed: jobs.length });
}

// vercel.json (Cron triggers)
{
  "crons": [
    { "path": "/api/jobs/process", "schedule": "* * * * *" },
    { "path": "/api/jobs/alerts", "schedule": "0 * * * *" },
    { "path": "/api/jobs/digest", "schedule": "0 8 * * *" }
  ]
}
```

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current Backend Analysis](#current-backend-analysis)
3. [Best Practices from Reference Codebases](#best-practices)
4. [Database Schema Design](#database-schema)
5. [API Architecture](#api-architecture)
6. [Service Layer Design](#service-layer)
7. [Security Implementation](#security)
8. [Scalability Strategy](#scalability)
9. [Real-time Features](#realtime)
10. [AI/ML Integration](#ai-ml)
11. [Background Jobs](#background-jobs)
12. [Testing Strategy](#testing)
13. [DevOps & Infrastructure](#devops)
14. [Implementation Roadmap](#roadmap)

---

## 1. Executive Summary

This document outlines the comprehensive backend implementation plan for the LitLens systematic review & research intelligence platform. The architecture is designed for:

- **Scalability** - Handle 10,000+ concurrent users
- **Performance** - Sub-100ms API response times
- **Reliability** - 99.99% uptime target
- **Security** - Enterprise-grade data protection
- **Extensibility** - Plugin architecture for custom tools

### 1.1 Core Architectural Principles (Updated)

#### Runtime Split (3 Distinct Services)
```
┌─────────────────────────────────────────────────────────────────┐
│  SERVICE 1: Web App (Next.js App Router)                       │
│  - UI rendering + lightweight APIs                              │
│  - Session management                                           │
│  - Real-time event emission triggers                            │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────┐
│                             ▼                                  │
│  SERVICE 2: Worker Service (BullMQ)                            │
│  - Import pipeline processing                                  │
│  - AI jobs (screening, extraction, insights)                   │
│  - Export generation (PRISMA, Excel, PDF)                      │
│  - Alert scans and email digests                               │
│  - Graph processing and layout computation                     │
└────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────┐
│                             ▼                                  │
│  SERVICE 3: Realtime Service (Socket.IO)                       │
│  - User presence tracking                                      │
│  - Chat messaging                                              │
│  - Progress events (import, AI, export)                        │
│  - Live notifications                                          │
│  - Collaboration cursors                                       │
└────────────────────────────────────────────────────────────────┘
```

#### Capability-Based RBAC (Not Role-Based)
**"Code to permission, not role"** - from assetthreesixty patterns:
- Move from coarse enum roles to **capability registries** with explicit checks
- Prevent privilege escalation (tenant roles cannot assign `system:*` capabilities)
- Keep capability registry + UI + route guards synchronized (no drift)

```typescript
// ❌ OLD: Role-based (brittle)
if (user.role === 'ADMIN') { ... }

// ✅ NEW: Capability-based (explicit)
if (hasCapability(user, 'project:screening:adjudicate')) { ... }
```

#### Error Sanitization: 3-Layer Defense
1. **API Layer**: Convert exceptions → safe API errors (never expose Prisma/stack traces)
2. **Frontend Layer**: Use single `toUserMessage()` pattern for all error displays
3. **React Error Boundaries**: Wrap high-risk flows (import, export, AI, bulk operations)

---

## 2. Current Backend Analysis

### 2.1 Current API Structure

```
/src/app/api/
├── activities/
│   └── route.ts                    # Activity logging
├── ai/
│   ├── route.ts                    # AI analysis endpoint
│   ├── batch-analyze/
│   │   └── route.ts                # Batch AI processing
│   └── study-insights/
│       └── route.ts                # AI study insights
├── auth/
│   └── [...nextauth]/
│       └── route.ts                # NextAuth handler
├── debug/
│   └── screening-decisions/
│       └── route.ts                # Debug tools
├── health/
│   └── route.ts                    # Health check
├── integrations/
│   └── search/
│       └── route.ts                # External search APIs
├── invitations/
│   └── [token]/
│       └── route.ts                # Invitation handling
├── notifications/
│   ├── route.ts                    # List notifications
│   ├── [id]/read/
│   │   └── route.ts                # Mark as read
│   └── mark-all-read/
│       └── route.ts                # Bulk mark read
├── projects/
│   ├── route.ts                    # Projects CRUD
│   └── [id]/
│       ├── route.ts                # Single project
│       ├── analytics/
│       │   ├── route.ts
│       │   └── export/
│       ├── archive/
│       ├── chat/
│       ├── conflicts/
│       │   ├── route.ts
│       │   └── [conflictId]/
│       │       ├── route.ts
│       │       └── resolve/
│       ├── export/
│       ├── extraction/
│       │   ├── route.ts
│       │   ├── data/
│       │   ├── export/
│       │   └── templates/
│       ├── gamification/
│       ├── import/
│       ├── invitations/
│       ├── keywords/
│       ├── quality-assessment/
│       ├── screening/
│       │   ├── route.ts
│       │   ├── next/
│       │   └── workflow/
│       ├── settings/
│       ├── star/
│       ├── stats/
│       ├── studies/
│       │   └── [studyId]/
│       │       └── chat/
│       └── team/
│           └── [memberId]/
├── quality-assessment/
│   ├── assessments/
│   └── tools/
├── search/
│   ├── route.ts
│   └── semantic/
├── uploadthing/
│   ├── core.ts
│   └── route.ts
└── user/
    ├── delete-account/
    ├── preferences/
    ├── settings/
    └── upload-avatar/
```

### 2.2 Current Library Services

```
/src/lib/
├── ai/
│   ├── ai-service.ts               # AI utility functions
│   └── openai-service.ts           # OpenAI integration
├── analytics/
│   ├── advanced-analytics-service.ts
│   └── analytics-service.ts
├── auth.ts                          # NextAuth config
├── cache/
│   └── redis-service.ts            # Redis caching
├── collaboration/
│   └── team-management-service.ts  # Team operations
├── db.ts                            # Prisma client
├── documents/
│   └── study-document-service.ts   # Document handling
├── email/
│   ├── email-service.ts            # Email sending
│   └── reliable-email-service.ts   # Retry logic
├── errors/
│   └── systematic-review-errors.ts # Error types
├── export/
│   ├── export-formats-service.ts
│   ├── export-service.ts
│   └── pdf-export-service.ts
├── extraction/
│   ├── extraction-data-service.ts
│   └── extraction-template-service.ts
├── gamification/
│   └── achievement-system.ts
├── highlighting/
│   └── text-highlighter.ts
├── import/
│   ├── background-import-service.ts
│   ├── duplicate-detection-service.ts
│   ├── study-import-service.ts
│   └── websocket-import-service.ts
├── integrations/
│   └── ExternalAPIService.tsx
├── notifications/
│   ├── email-templates.ts
│   ├── enhanced-notification-service.ts
│   ├── integration-examples.ts
│   ├── notification-service.ts
│   └── push-service.ts
├── parsers/
│   ├── bibtex-parser.ts
│   ├── csv-parser.ts
│   ├── endnote-xml-parser.ts
│   ├── parser-factory.ts
│   └── ris-parser.ts
├── quality/
│   ├── quality-assessment-service.ts
│   └── risk-of-bias-service.ts
├── research-intelligence/
│   └── advanced-research-analytics.ts
├── screening/
│   ├── conflict-resolution-service.ts
│   └── title-abstract-screening-service.ts
├── search/
│   └── semantic-search-service.ts
├── security/
│   └── rate-limiter.ts
├── systematic-review/
│   ├── ai-engine.ts
│   ├── collaboration-engine.ts
│   └── study-manager.ts
├── validation/
│   └── study-validation.ts
└── websocket-init.ts               # WebSocket setup
```

### 2.3 Current Database Schema Summary

**Core Models (34 total):**
- User, Account, Session, VerificationToken
- Project, ProjectMember, ProjectStar
- Study, ScreeningDecision, Conflict
- ExtractionTemplate, ExtractedData
- Activity, FileUpload, AuditLog
- ChatMessage, StudyComment
- ConflictResolution, ImportJob
- Notification, UserPreferences
- TeamInvitation, QualityAssessmentTool, QualityAssessment
- AIAnalysis, ConsensusAssessment
- ImportBatch, StudyDocument, DocumentAnnotation
- StudyDuplicate, EnhancedScreeningDecision
- StudyScreeningProgress, FullTextScreeningProgress
- AIScreeningDecision, ExtractionForm, StudyExtraction
- ExtractionData, ExtractionDiscrepancy
- ExtractionQualityMetrics, CalculatedField
- ReviewerAssignment

---

## 3. Best Practices from Reference Codebases

### 3.1 From school_management_new

#### Clean Architecture Pattern
```
/lib
├── application/
│   ├── services/
│   │   ├── FinanceAnalyticsService.ts
│   │   ├── MessagingService.ts
│   │   └── TerminalReportService.ts
│   └── use-cases/
│       ├── CreateInvoice.ts
│       ├── ProcessAcademicReport.ts
│       ├── ProcessAdmission.ts
│       ├── RecordAttendance.ts
│       ├── RegisterStaff.ts
│       ├── RegisterStudent.ts
│       └── SendBroadcast.ts
├── domain/
│   ├── entities/
│   │   └── Student.ts              # With tests
│   ├── repositories/
│   │   ├── AttendanceRepository.ts # Interface
│   │   ├── ClassRepository.ts
│   │   ├── GradeRepository.ts
│   │   └── StudentRepository.ts
│   ├── services/
│   │   ├── GesGradingEngine.ts     # With tests
│   │   ├── GhanaFinanceEngine.ts   # With tests
│   │   ├── ReportGenerator.ts
│   │   └── StanineCalculator.ts
│   └── value-objects/
└── infrastructure/
    ├── database/
    │   ├── dexie.ts                # IndexedDB
    │   └── prisma.ts
    ├── external/
    │   ├── HubtelSmsService.ts
    │   └── ResendEmailService.ts
    └── repositories/
        ├── PrismaAttendanceRepository.ts
        ├── PrismaClassRepository.ts
        └── PrismaStudentRepository.ts
```

**Key Learnings:**
- Use case-driven architecture (Command pattern)
- Repository pattern for data access abstraction
- Domain services for complex business logic
- Infrastructure layer isolation
- Entity testing at domain level

### 3.2 From assetthreesixty (Enterprise-Grade)

#### Comprehensive Service Architecture (200+ Services)

```
/lib
├── Core Services
│   ├── asset-service.ts
│   ├── cache-service.ts
│   ├── prisma.ts
│   └── redis.ts
│
├── Domain Services
│   ├── asset-category-service.ts
│   ├── asset-notification-service.ts
│   ├── asset-request-service.ts
│   ├── budget-service.ts
│   ├── checkout-service.ts
│   ├── depreciation-service.ts
│   ├── inventory-service.ts
│   ├── location-hierarchy-service.ts
│   ├── maintenance-service.ts
│   ├── reservation-service.ts
│   ├── vendor-service.ts
│   └── ...
│
├── Integration Services
│   ├── email.ts
│   ├── email-template-service.ts
│   ├── push-service.ts
│   ├── sms-service.ts
│   ├── webhook-service.ts
│   └── erp-integration.ts
│
├── Analytics & Reporting
│   ├── analytics-service.ts
│   ├── report-service.ts
│   ├── report-scheduling-service.ts
│   ├── saved-report-service.ts
│   └── export-service.ts
│
├── Security Services
│   ├── auth.ts
│   ├── csrf.ts
│   ├── csrf-middleware.ts
│   ├── rate-limit-service.ts
│   ├── role-service.ts
│   ├── scoped-permission-service.ts
│   ├── security-middleware.ts
│   └── gdpr-service.ts
│
├── Workflow Engine
│   ├── workflow-engine/
│   ├── workflow-service.ts
│   ├── workflow-templates.ts
│   └── workflow-validation.ts
│
├── Real-time Services
│   ├── realtime.ts
│   ├── realtime-publisher.ts
│   ├── websocket.ts
│   └── chat-notification-service.ts
│
├── Background Jobs
│   ├── jobs/
│   ├── queue/
│   ├── workers/
│   └── scheduler/
│
├── Caching Layer
│   ├── cache-service.ts
│   ├── cache-invalidation.ts
│   ├── cache-optimization.ts
│   └── asset-table-cache.ts
│
├── Monitoring
│   ├── logger.ts
│   ├── performance-monitor.ts
│   ├── error-tracking-service.ts
│   └── monitoring/
│
└── Utilities
    ├── api-error-handler.ts
    ├── api-middleware.ts
    ├── api-versioning.ts
    ├── input-sanitization.ts
    ├── validation-schemas.ts
    └── utils.ts
```

**Key Learnings:**
- Comprehensive service layer organization
- Multi-channel notification system
- Workflow engine for approval processes
- Role-based access with scoped permissions
- Cache invalidation strategies
- Background job processing with queues
- Real-time event publishing
- API versioning
- Performance monitoring
- GDPR compliance
- Rate limiting at service level
- Input sanitization middleware

### 3.3 From researchflow

#### Research-Specific Services

```
/lib
├── ai/
│   └── openai.ts              # OpenAI integration
├── api/
│   └── openalex.ts            # Academic API
├── auth.ts                    # NextAuth config
├── cache.ts                   # Caching utilities
├── email.ts                   # Email service
├── jobs/                      # Background jobs
├── logger.ts                  # Logging
├── prisma.ts                  # DB client
├── queue.ts                   # Job queue
├── rate-limit.ts              # Rate limiting
├── redis.ts                   # Redis client
└── storage.ts                 # File storage
```

**Key Features:**
- OpenAlex API integration for paper discovery
- Research graph generation
- Citation network analysis
- Usage limit tracking
- Subscription tier management
- Alert scheduling

---

## 4. Database Schema Design

### 4.1 Enhanced Schema Strategy

#### Data Model Consolidation: Canonical "Work" Entity
**Guiding Principle**: Unify "paper/study" into a single canonical entity, then attach workflow-specific relations.

```prisma
// ============== CANONICAL WORK ENTITY ==============
// The single source of truth for any scholarly work
model Work {
  id              String   @id @default(cuid())
  
  // Universal identifiers
  doi             String?  @unique
  pmid            String?  @unique
  pmcid           String?
  openAlexId      String?  @unique
  semanticScholarId String?
  arxivId         String?
  
  // Core metadata
  title           String
  abstract        String?  @db.Text
  authors         Json     @default("[]")  // [{name, orcid, affiliation}]
  year            Int?
  publicationDate DateTime?
  journal         String?
  volume          String?
  issue           String?
  pages           String?
  publisher       String?
  url             String?
  
  // Enrichment
  keywords        String[] @default([])
  meshTerms       String[] @default([])
  subjects        String[] @default([])
  references      String[] @default([])  // DOIs of cited works
  citationCount   Int      @default(0)
  
  // Embeddings for semantic search (pgvector)
  embedding       Unsupported("vector(1536)")?
  
  // Tracking
  source          String   @default("import")  // import, openalex, pubmed, crossref
  enrichedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations to workflow-specific entities
  projectWorks    ProjectWork[]
  libraryWorks    LibraryWork[]
  graphNodes      GraphNode[]
  writingSources  WritingSource[]
  
  @@index([doi])
  @@index([pmid])
  @@index([title], type: GIN)
  @@index([abstract], type: GIN)
}

// Work inside a systematic review project
model ProjectWork {
  id              String   @id @default(cuid())
  projectId       String
  workId          String
  
  // Import metadata
  importBatchId   String?
  importSource    String?  // filename, database name
  rawRecord       Json?    // original RIS/BibTeX record
  
  // Workflow status
  status          ProjectWorkStatus @default(PENDING)
  finalDecision   ScreeningDecision?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  project         Project  @relation(...)
  work            Work     @relation(...)
  screeningDecisions ScreeningDecisionRecord[]
  extractions     Extraction[]
  qualityAssessments QualityAssessment[]
  
  @@unique([projectId, workId])
  @@index([projectId, status])
}

// Work saved to user's personal library
model LibraryWork {
  id              String   @id @default(cuid())
  userId          String
  workId          String
  folderId        String?
  collectionIds   String[] @default([])
  
  // User annotations
  tags            String[] @default([])
  notes           String?  @db.Text
  rating          Int?
  readingStatus   ReadingStatus @default(TO_READ)
  highlightColor  String?
  
  // AI-generated
  aiSummary       String?  @db.Text
  aiKeyInsights   Json?
  
  lastAccessedAt  DateTime?
  createdAt       DateTime @default(now())
  
  user            User     @relation(...)
  work            Work     @relation(...)
  folder          LibraryFolder? @relation(...)
  
  @@unique([userId, workId])
}
```

#### Multi-tenancy Approach
```sql
-- Organization-based multi-tenancy
Organization (
  id, name, slug, domain,
  settings, branding, limits
)

OrganizationMember (
  organizationId, userId, role,
  capabilities  -- JSON array of explicit capabilities
)

-- All resources scoped to organization
Project.organizationId
User.organizationId (primary)
```

#### Protocol & Governance Models (Competitor Feature Gap)
```prisma
// ============== PROTOCOL & GOVERNANCE ==============
model ReviewProtocol {
  id              String   @id @default(cuid())
  projectId       String   @unique
  
  // Protocol content
  title           String
  version         Int      @default(1)
  content         Json     @default("{}")  // Structured PRISMA-P sections
  
  // Registration
  prosperoId      String?
  registrationDate DateTime?
  
  // Versioning
  isLocked        Boolean  @default(false)
  lockedAt        DateTime?
  lockedBy        String?
  
  // Approval workflow
  status          ProtocolStatus @default(DRAFT)
  approvedAt      DateTime?
  approvedBy      String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  project         Project  @relation(...)
  versions        ProtocolVersion[]
  milestones      ProtocolMilestone[]
}

model ProtocolVersion {
  id              String   @id @default(cuid())
  protocolId      String
  version         Int
  content         Json
  changeLog       String?
  createdBy       String
  createdAt       DateTime @default(now())
  
  protocol        ReviewProtocol @relation(...)
}

model ProtocolMilestone {
  id              String   @id @default(cuid())
  protocolId      String
  
  name            String   // "Screening Complete", "Extraction Complete", etc.
  targetDate      DateTime?
  completedAt     DateTime?
  isLocked        Boolean  @default(false)
  
  protocol        ReviewProtocol @relation(...)
}

enum ProtocolStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  REGISTERED
  AMENDED
}

// ============== CALIBRATION & RELIABILITY ==============
model CalibrationRound {
  id              String   @id @default(cuid())
  projectId       String
  phase           ScreeningPhase
  
  // Configuration
  sampleSize      Int      @default(20)
  targetAgreement Float    @default(0.8)  // Kappa threshold
  
  // Results
  status          CalibrationStatus @default(PENDING)
  kappScore       Float?   // Cohen's Kappa
  percentAgreement Float?
  
  startedAt       DateTime?
  completedAt     DateTime?
  
  project         Project  @relation(...)
  decisions       CalibrationDecision[]
}

model CalibrationDecision {
  id              String   @id @default(cuid())
  roundId         String
  studyId         String
  reviewerId      String
  
  decision        ScreeningDecision
  reasoning       String?
  timeSpentMs     Int?
  
  createdAt       DateTime @default(now())
  
  round           CalibrationRound @relation(...)
}

enum CalibrationStatus {
  PENDING
  IN_PROGRESS
  PASSED
  FAILED
  NEEDS_DISCUSSION
}
```

#### New Models to Add

```prisma
// ============== ORGANIZATION LAYER ==============
model Organization {
  id                String   @id @default(cuid())
  name              String
  slug              String   @unique
  domain            String?  @unique
  logoUrl           String?
  primaryColor      String   @default("#4F46E5")
  
  // Limits & Billing
  tier              OrganizationTier @default(FREE)
  maxProjects       Int      @default(3)
  maxMembers        Int      @default(5)
  maxStudiesPerProject Int   @default(500)
  
  // Stripe
  stripeCustomerId      String?  @unique
  stripeSubscriptionId  String?
  currentPeriodEnd      DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  members           OrganizationMember[]
  projects          Project[]
  apiKeys           ApiKey[]
  auditLogs         OrganizationAuditLog[]
  invitations       OrganizationInvitation[]
}

enum OrganizationTier {
  FREE
  PROFESSIONAL
  TEAM
  ENTERPRISE
}

model OrganizationMember {
  id              String   @id @default(cuid())
  organizationId  String
  userId          String
  role            OrganizationRole @default(MEMBER)
  permissions     Json     @default("{}")
  joinedAt        DateTime @default(now())
  
  organization    Organization @relation(...)
  user            User @relation(...)
  
  @@unique([organizationId, userId])
}

// ============== LIVING REVIEWS ==============
model LivingReviewConfig {
  id              String   @id @default(cuid())
  projectId       String   @unique
  isEnabled       Boolean  @default(false)
  
  // Update strategy
  updateFrequency String   @default("WEEKLY") // DAILY, WEEKLY, MONTHLY
  lastUpdateAt    DateTime?
  nextUpdateAt    DateTime?
  
  // Search configuration
  searchStrategies Json    @default("[]")
  dataSources     Json     @default("[\"openalex\", \"pubmed\"]")
  
  // Auto-screening settings
  autoScreenEnabled Boolean @default(false)
  autoExcludeThreshold Float @default(0.95)
  
  project         Project  @relation(...)
  updateHistory   LivingReviewUpdate[]
}

model LivingReviewUpdate {
  id              String   @id @default(cuid())
  configId        String
  
  newStudiesFound Int      @default(0)
  studiesAdded    Int      @default(0)
  autoExcluded    Int      @default(0)
  
  status          String   @default("COMPLETED")
  errorMessage    String?
  
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  
  config          LivingReviewConfig @relation(...)
}

// ============== RESEARCH GRAPHS ==============
model ResearchGraph {
  id              String   @id @default(cuid())
  projectId       String?
  userId          String
  
  title           String
  description     String?
  graphType       GraphType @default(CITATION_NETWORK)
  
  // Graph data
  nodes           Json     @default("[]")
  edges           Json     @default("[]")
  layoutData      Json?
  
  // Filters & Settings
  settings        Json     @default("{}")
  filters         Json     @default("{}")
  
  isPublic        Boolean  @default(false)
  shareToken      String?  @unique
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(...)
  project         Project? @relation(...)
}

enum GraphType {
  CITATION_NETWORK
  AUTHOR_COLLABORATION
  CONCEPT_CLUSTER
  TEMPORAL_EVOLUTION
}

// ============== PERSONAL LIBRARY ==============
model LibraryItem {
  id              String   @id @default(cuid())
  userId          String
  folderId        String?
  
  // Paper data
  title           String
  authors         Json     @default("[]")
  abstract        String?
  year            Int?
  journal         String?
  doi             String?
  url             String?
  
  // User additions
  tags            String[] @default([])
  notes           String?
  rating          Int?
  readingStatus   ReadingStatus @default(TO_READ)
  
  // AI-generated
  aiSummary       String?
  aiKeyInsights   String?
  
  lastAccessedAt  DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(...)
  folder          LibraryFolder? @relation(...)
}

model LibraryFolder {
  id              String   @id @default(cuid())
  userId          String
  name            String
  color           String   @default("#3B82F6")
  icon            String   @default("folder")
  parentId        String?
  
  createdAt       DateTime @default(now())
  
  user            User     @relation(...)
  parent          LibraryFolder? @relation("SubFolders")
  subFolders      LibraryFolder[] @relation("SubFolders")
  items           LibraryItem[]
  
  @@unique([userId, name, parentId])
}

// ============== RESEARCH ALERTS ==============
model ResearchAlert {
  id              String   @id @default(cuid())
  userId          String
  projectId       String?
  
  name            String
  description     String?
  alertType       AlertType
  
  // Search config
  searchQuery     String?
  keywords        String[] @default([])
  authors         String[] @default([])
  journals        String[] @default([])
  
  // Settings
  frequency       AlertFrequency @default(DAILY)
  isActive        Boolean  @default(true)
  
  // Delivery
  emailEnabled    Boolean  @default(true)
  inAppEnabled    Boolean  @default(true)
  
  lastTriggeredAt DateTime?
  nextCheckAt     DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(...)
  project         Project? @relation(...)
  discoveries     AlertDiscovery[]
}

enum AlertType {
  NEW_PUBLICATION
  CITATION_UPDATE
  AUTHOR_ACTIVITY
  KEYWORD_TREND
  CUSTOM_QUERY
}

enum AlertFrequency {
  REAL_TIME
  HOURLY
  DAILY
  WEEKLY
}

// ============== WRITING ASSISTANT ==============
model WritingProject {
  id              String   @id @default(cuid())
  userId          String
  projectId       String?
  
  title           String
  type            WritingType
  content         Json     @default("{}")
  
  // AI settings
  citationStyle   String   @default("APA")
  targetLength    Int?
  
  status          WritingStatus @default(DRAFT)
  wordCount       Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(...)
  project         Project? @relation(...)
  sources         WritingSource[]
}

enum WritingType {
  LITERATURE_REVIEW
  BACKGROUND
  METHODS
  RESULTS
  DISCUSSION
  ABSTRACT
}

enum WritingStatus {
  DRAFT
  IN_PROGRESS
  REVIEW
  COMPLETE
}

// ============== API KEYS ==============
model ApiKey {
  id              String   @id @default(cuid())
  organizationId  String
  
  name            String
  keyHash         String   @unique
  keyPrefix       String   // First 8 chars for display
  
  permissions     Json     @default("[]")
  rateLimit       Int      @default(1000) // per hour
  
  lastUsedAt      DateTime?
  expiresAt       DateTime?
  isActive        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  
  organization    Organization @relation(...)
  usageLogs       ApiKeyUsage[]
}

model ApiKeyUsage {
  id              String   @id @default(cuid())
  apiKeyId        String
  
  endpoint        String
  method          String
  statusCode      Int
  responseTime    Int      // ms
  
  createdAt       DateTime @default(now())
  
  apiKey          ApiKey   @relation(...)
  
  @@index([apiKeyId, createdAt])
}

// ============== WEBHOOKS ==============
model Webhook {
  id              String   @id @default(cuid())
  organizationId  String
  
  url             String
  secret          String
  events          String[] @default([])
  
  isActive        Boolean  @default(true)
  failureCount    Int      @default(0)
  lastTriggeredAt DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  organization    Organization @relation(...)
  deliveries      WebhookDelivery[]
}

model WebhookDelivery {
  id              String   @id @default(cuid())
  webhookId       String
  
  eventType       String
  payload         Json
  
  statusCode      Int?
  responseBody    String?
  responseTime    Int?     // ms
  
  status          String   @default("PENDING")
  attempts        Int      @default(1)
  lastAttemptAt   DateTime @default(now())
  
  createdAt       DateTime @default(now())
  
  webhook         Webhook  @relation(...)
}
```

### 4.2 Database Indexing Strategy

```prisma
// Performance indexes
@@index([projectId, status])           // Project filtering
@@index([projectId, createdAt])        // Pagination
@@index([userId, createdAt])           // User activity
@@index([doi])                         // Deduplication
@@index([pmid])                        // PubMed lookup
@@index([organizationId, isActive])    // Tenant filtering

// Full-text search (PostgreSQL)
@@index([title], type: GIN)
@@index([abstract], type: GIN)

// Composite indexes for common queries
@@index([projectId, finalStatus, createdAt])
@@index([reviewerId, phase, decision])
```

### 4.3 Data Migration Strategy

```typescript
// Phase 1: Add new columns with defaults
// Phase 2: Backfill data
// Phase 3: Add constraints
// Phase 4: Remove deprecated columns

// Example migration sequence
1. 20250101_add_organization_support
2. 20250102_add_living_review_tables
3. 20250103_add_research_graphs
4. 20250104_add_library_system
5. 20250105_add_alerts_system
6. 20250106_add_writing_assistant
7. 20250107_add_api_webhooks
8. 20250108_migrate_existing_data
9. 20250109_add_indexes
10. 20250110_cleanup_deprecated
```

---

## 5. API Architecture

### 5.1 API Versioning Strategy

```
/api/v1/...    # Current stable
/api/v2/...    # Next version (preview)
/api/beta/...  # Experimental features
```

### 5.2 RESTful API Design

```
# Projects
GET     /api/v1/projects
POST    /api/v1/projects
GET     /api/v1/projects/:id
PATCH   /api/v1/projects/:id
DELETE  /api/v1/projects/:id

# Nested Resources
GET     /api/v1/projects/:id/studies
POST    /api/v1/projects/:id/studies/import
GET     /api/v1/projects/:id/studies/:studyId
PATCH   /api/v1/projects/:id/studies/:studyId

# Screening
GET     /api/v1/projects/:id/screening/queue
POST    /api/v1/projects/:id/screening/decisions
GET     /api/v1/projects/:id/screening/conflicts
POST    /api/v1/projects/:id/screening/conflicts/:conflictId/resolve

# Extraction
GET     /api/v1/projects/:id/extraction/forms
POST    /api/v1/projects/:id/extraction/forms
GET     /api/v1/projects/:id/extraction/data
POST    /api/v1/projects/:id/extraction/data

# Analytics
GET     /api/v1/projects/:id/analytics/overview
GET     /api/v1/projects/:id/analytics/prisma
GET     /api/v1/projects/:id/analytics/progress
POST    /api/v1/projects/:id/analytics/export

# Research Tools
GET     /api/v1/library
POST    /api/v1/library
GET     /api/v1/graphs
POST    /api/v1/graphs
GET     /api/v1/alerts
POST    /api/v1/alerts

# User
GET     /api/v1/user/me
PATCH   /api/v1/user/me
GET     /api/v1/user/preferences
PATCH   /api/v1/user/preferences

# Organization
GET     /api/v1/organization
PATCH   /api/v1/organization
GET     /api/v1/organization/members
POST    /api/v1/organization/members/invite

# Admin
GET     /api/v1/admin/users
GET     /api/v1/admin/analytics
GET     /api/v1/admin/system
```

### 5.3 GraphQL API (Optional)

```graphql
type Query {
  # Projects
  project(id: ID!): Project
  projects(
    filter: ProjectFilter
    orderBy: ProjectOrderBy
    first: Int
    after: String
  ): ProjectConnection!
  
  # Studies
  study(id: ID!): Study
  studies(
    projectId: ID!
    filter: StudyFilter
    first: Int
    after: String
  ): StudyConnection!
  
  # Screening Queue
  screeningQueue(
    projectId: ID!
    phase: ScreeningPhase!
  ): ScreeningQueue!
  
  # Analytics
  projectAnalytics(projectId: ID!): ProjectAnalytics!
  
  # Research
  searchPapers(query: String!, limit: Int): [Paper!]!
  researchGraph(id: ID!): ResearchGraph
}

type Mutation {
  # Projects
  createProject(input: CreateProjectInput!): Project!
  updateProject(id: ID!, input: UpdateProjectInput!): Project!
  
  # Screening
  submitDecision(input: ScreeningDecisionInput!): ScreeningDecision!
  resolveConflict(id: ID!, input: ResolveConflictInput!): Conflict!
  
  # Extraction
  saveExtractionData(input: ExtractionDataInput!): ExtractionData!
  
  # Research
  createGraph(input: CreateGraphInput!): ResearchGraph!
  addToLibrary(input: AddToLibraryInput!): LibraryItem!
}

type Subscription {
  # Real-time updates
  projectUpdated(id: ID!): Project!
  screeningProgress(projectId: ID!): ScreeningProgress!
  collaboratorActivity(projectId: ID!): CollaboratorActivity!
  notificationReceived: Notification!
}
```

### 5.4 Response Format Standards

```typescript
// Success Response
{
  success: true,
  data: T,
  meta?: {
    pagination?: {
      total: number
      page: number
      limit: number
      hasMore: boolean
    }
    timestamp: string
    requestId: string
  }
}

// Error Response
{
  success: false,
  error: {
    code: string        // e.g., "VALIDATION_ERROR"
    message: string     // Human-readable
    details?: object    // Field-level errors
    requestId: string
  }
}

// Pagination (cursor-based)
{
  data: T[],
  pageInfo: {
    hasNextPage: boolean
    hasPreviousPage: boolean
    startCursor: string
    endCursor: string
  }
}
```

---

## 6. Service Layer Design

### 6.1 Service Architecture

```
/lib/services
├── core/
│   ├── base-service.ts             # Base service class
│   ├── service-container.ts        # DI container
│   └── service-registry.ts         # Service registry
│
├── domain/
│   ├── project/
│   │   ├── project-service.ts
│   │   ├── project-repository.ts
│   │   └── project-validator.ts
│   │
│   ├── study/
│   │   ├── study-service.ts
│   │   ├── study-import-service.ts
│   │   ├── duplicate-detection-service.ts
│   │   └── study-validator.ts
│   │
│   ├── screening/
│   │   ├── screening-service.ts
│   │   ├── screening-queue-service.ts
│   │   ├── conflict-detection-service.ts
│   │   └── conflict-resolution-service.ts
│   │
│   ├── extraction/
│   │   ├── extraction-service.ts
│   │   ├── form-builder-service.ts
│   │   ├── validation-engine.ts
│   │   └── discrepancy-service.ts
│   │
│   ├── quality/
│   │   ├── quality-assessment-service.ts
│   │   ├── rob-tool-service.ts
│   │   └── grade-service.ts
│   │
│   ├── analytics/
│   │   ├── analytics-service.ts
│   │   ├── prisma-generator-service.ts
│   │   └── report-service.ts
│   │
│   ├── research/
│   │   ├── library-service.ts
│   │   ├── graph-service.ts
│   │   ├── alert-service.ts
│   │   └── discovery-service.ts
│   │
│   └── collaboration/
│       ├── team-service.ts
│       ├── invitation-service.ts
│       └── activity-service.ts
│
├── infrastructure/
│   ├── database/
│   │   ├── prisma.ts
│   │   └── transaction-manager.ts
│   │
│   ├── cache/
│   │   ├── redis-service.ts
│   │   ├── cache-manager.ts
│   │   └── cache-invalidator.ts
│   │
│   ├── queue/
│   │   ├── queue-service.ts
│   │   ├── job-processor.ts
│   │   └── job-scheduler.ts
│   │
│   ├── storage/
│   │   ├── storage-service.ts
│   │   ├── s3-provider.ts
│   │   └── local-provider.ts
│   │
│   ├── email/
│   │   ├── email-service.ts
│   │   ├── template-service.ts
│   │   └── providers/
│   │
│   └── external/
│       ├── openalex-client.ts
│       ├── pubmed-client.ts
│       ├── crossref-client.ts
│       └── openai-client.ts
│
├── ai/
│   ├── ai-service.ts
│   ├── screening-ai-service.ts
│   ├── extraction-ai-service.ts
│   ├── summary-ai-service.ts
│   └── embedding-service.ts
│
├── realtime/
│   ├── websocket-service.ts
│   ├── presence-service.ts
│   ├── collaboration-service.ts
│   └── event-publisher.ts
│
└── security/
    ├── auth-service.ts
    ├── permission-service.ts
    ├── rate-limit-service.ts
    ├── audit-service.ts
    └── encryption-service.ts
```

### 6.2 Base Service Pattern

```typescript
// lib/services/core/base-service.ts
export abstract class BaseService {
  protected prisma: PrismaClient;
  protected cache: CacheService;
  protected logger: Logger;
  protected eventBus: EventBus;
  
  constructor(container: ServiceContainer) {
    this.prisma = container.get('prisma');
    this.cache = container.get('cache');
    this.logger = container.get('logger');
    this.eventBus = container.get('eventBus');
  }
  
  protected async withTransaction<T>(
    fn: (tx: PrismaTransaction) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(fn);
  }
  
  protected async cached<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    return this.cache.getOrSet(key, fn, ttl);
  }
  
  protected emit(event: string, payload: unknown): void {
    this.eventBus.emit(event, payload);
  }
}
```

### 6.3 Use Case Pattern

```typescript
// lib/use-cases/screening/submit-decision.ts
export class SubmitDecisionUseCase {
  constructor(
    private screeningService: ScreeningService,
    private conflictService: ConflictDetectionService,
    private notificationService: NotificationService,
    private activityService: ActivityService
  ) {}
  
  async execute(input: SubmitDecisionInput): Promise<ScreeningDecision> {
    // 1. Validate input
    const validated = SubmitDecisionSchema.parse(input);
    
    // 2. Save decision
    const decision = await this.screeningService.submitDecision(validated);
    
    // 3. Check for conflicts
    const conflict = await this.conflictService.detectConflict(
      validated.studyId,
      validated.phase
    );
    
    // 4. Handle conflict if detected
    if (conflict) {
      await this.notificationService.notifyConflict(conflict);
    }
    
    // 5. Log activity
    await this.activityService.log({
      type: 'SCREENING_DECISION',
      userId: validated.reviewerId,
      studyId: validated.studyId,
      data: { decision: decision.decision }
    });
    
    // 6. Emit event for real-time updates
    this.screeningService.emit('decision:submitted', decision);
    
    return decision;
  }
}
```

---

## 7. Security Implementation

### 7.1 Authentication Strategy

```typescript
// NextAuth v5 Configuration
export const authConfig = {
  providers: [
    // OAuth Providers
    GoogleProvider({...}),
    GitHubProvider({...}),
    OrcidProvider({...}),  // Academic identity
    InstitutionalSAML({...}), // University SSO
    
    // Credentials
    CredentialsProvider({
      credentials: {
        email: {},
        password: {}
      },
      authorize: async (credentials) => {
        // Password validation with argon2
        // MFA check if enabled
        // Rate limiting
      }
    })
  ],
  
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Add custom claims
      if (user) {
        token.organizationId = user.organizationId;
        token.role = user.role;
        token.permissions = user.permissions;
      }
      return token;
    },
    
    async session({ session, token }) {
      session.user.organizationId = token.organizationId;
      session.user.role = token.role;
      session.user.permissions = token.permissions;
      return session;
    }
  },
  
  events: {
    async signIn({ user }) {
      await auditLog.create({
        type: 'AUTH_SIGNIN',
        userId: user.id,
        metadata: { provider: 'oauth' }
      });
    }
  }
};
```

### 7.2 Authorization System

```typescript
// Role-Based Access Control with Permissions
type Permission = 
  | 'project:create'
  | 'project:read'
  | 'project:update'
  | 'project:delete'
  | 'study:import'
  | 'study:screen'
  | 'study:extract'
  | 'team:invite'
  | 'team:manage'
  | 'settings:update'
  | 'admin:access';

interface RoleDefinition {
  name: string;
  permissions: Permission[];
  inherits?: string[];
}

const roles: Record<string, RoleDefinition> = {
  OWNER: {
    permissions: ['*'], // All permissions
  },
  ADMIN: {
    permissions: [
      'project:*',
      'study:*',
      'team:*',
      'settings:update'
    ]
  },
  REVIEWER: {
    permissions: [
      'project:read',
      'study:screen',
      'study:extract'
    ]
  },
  OBSERVER: {
    permissions: ['project:read']
  }
};

// Permission middleware
export function requirePermission(permission: Permission) {
  return async (req: Request, ctx: Context) => {
    const user = await getUser(req);
    
    if (!user) {
      throw new UnauthorizedError();
    }
    
    const hasPermission = await checkPermission(
      user.id,
      ctx.params.projectId,
      permission
    );
    
    if (!hasPermission) {
      throw new ForbiddenError();
    }
  };
}
```

### 7.3 Security Middleware Stack

```typescript
// Applied in order
const securityMiddleware = [
  // 1. Rate Limiting
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,            // 100 requests
    keyGenerator: (req) => getUserId(req) || getIP(req)
  }),
  
  // 2. CORS
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true
  }),
  
  // 3. CSRF Protection
  csrf({
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    }
  }),
  
  // 4. Input Sanitization
  sanitize({
    trim: true,
    stripTags: true,
    escape: true
  }),
  
  // 5. Request Validation
  validate(schema),
  
  // 6. Authentication
  authenticate(),
  
  // 7. Authorization
  authorize(requiredPermissions),
  
  // 8. Audit Logging
  auditLog()
];
```

### 7.4 Data Protection

```typescript
// Encryption at rest
const encryptedFields = [
  'apiKey.keyHash',
  'webhook.secret',
  'user.mfaSecret'
];

// Field-level encryption
export function encryptField(value: string): string {
  return crypto
    .createCipheriv('aes-256-gcm', masterKey, iv)
    .update(value, 'utf8', 'base64');
}

// Data anonymization for exports
export function anonymizeData(study: Study): AnonymizedStudy {
  return {
    ...study,
    id: hashId(study.id),
    decisions: study.decisions.map(d => ({
      ...d,
      reviewerId: hashId(d.reviewerId)
    }))
  };
}
```

---

## 8. Scalability Strategy

### 8.1 Horizontal Scaling Architecture

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────┐         ┌─────────┐         ┌─────────┐
   │ Web     │         │ Web     │         │ Web     │
   │ Server 1│         │ Server 2│         │ Server 3│
   └────┬────┘         └────┬────┘         └────┬────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ▼                             ▼
      ┌─────────────┐              ┌─────────────┐
      │   Redis     │              │  PostgreSQL │
      │   Cluster   │              │  (Primary)  │
      └─────────────┘              └──────┬──────┘
                                          │
                                   ┌──────┴──────┐
                                   ▼             ▼
                              ┌────────┐   ┌────────┐
                              │Replica │   │Replica │
                              └────────┘   └────────┘
```

### 8.2 Caching Strategy (Enterprise Patterns from assetthreesixty)

```typescript
// Multi-level caching with SWR patterns
class CacheManager {
  private l1: LRUCache;      // In-memory (fastest)
  private l2: RedisCache;    // Distributed cache
  
  async get<T>(key: string): Promise<T | null> {
    // Try L1 first
    const l1Result = this.l1.get(key);
    if (l1Result) return l1Result;
    
    // Try L2
    const l2Result = await this.l2.get(key);
    if (l2Result) {
      this.l1.set(key, l2Result); // Populate L1
      return l2Result;
    }
    
    return null;
  }
  
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    await Promise.all([
      this.l1.set(key, value, ttl / 2), // Shorter TTL for L1
      this.l2.set(key, value, ttl)
    ]);
  }
  
  async invalidate(pattern: string): Promise<void> {
    await Promise.all([
      this.l1.clear(pattern),
      this.l2.clear(pattern)
    ]);
  }
}

// ============== ENTERPRISE CACHE PATTERNS ==============

// 1. Versioned Keys (prevent stale data after schema changes)
const cacheKeys = {
  version: 'v3', // Bump on breaking changes
  project: (id: string) => `v3:project:${id}`,
  projectStudies: (id: string) => `v3:project:${id}:studies`,
  projectStats: (id: string) => `v3:project:${id}:stats`,
  userProjects: (userId: string) => `v3:user:${userId}:projects`,
  screeningQueue: (projectId: string, phase: string) => 
    `v3:project:${projectId}:queue:${phase}`
};

// 2. Tag-Based Invalidation
class TaggedCache {
  async setWithTags<T>(
    key: string, 
    value: T, 
    tags: string[], 
    ttl: number
  ): Promise<void> {
    await this.cache.set(key, value, ttl);
    
    // Track key under each tag for bulk invalidation
    for (const tag of tags) {
      await this.redis.sadd(`tag:${tag}`, key);
    }
  }
  
  async invalidateByTag(tag: string): Promise<void> {
    const keys = await this.redis.smembers(`tag:${tag}`);
    if (keys.length > 0) {
      await this.cache.del(...keys);
      await this.redis.del(`tag:${tag}`);
    }
  }
}

// Usage: Invalidate all project-related caches at once
await cache.setWithTags(
  `v3:project:${id}:stats`, 
  stats, 
  [`project:${id}`, 'stats'], 
  300
);
await cache.invalidateByTag(`project:${id}`); // Clears all project caches

// 3. SWR (Stale-While-Revalidate) Pattern
class SWRCache {
  async getOrRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    staleTime: number,  // Return stale data if within this window
    maxAge: number      // Hard expiry
  ): Promise<T> {
    const cached = await this.get(key);
    
    if (cached) {
      const age = Date.now() - cached.timestamp;
      
      // Fresh: return immediately
      if (age < staleTime) return cached.value;
      
      // Stale but usable: return stale, revalidate in background
      if (age < maxAge) {
        this.revalidateInBackground(key, fetcher); // Non-blocking
        return cached.value;
      }
    }
    
    // Expired or missing: fetch synchronously
    const fresh = await fetcher();
    await this.set(key, { value: fresh, timestamp: Date.now() }, maxAge);
    return fresh;
  }
}

// 4. Monitor Hit Rate + Fail-Open Strategy
class MonitoredCache {
  private hits = 0;
  private misses = 0;
  
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cache.get(key);
      value ? this.hits++ : this.misses++;
      return value;
    } catch (error) {
      // Fail-open: cache failure should not break the app
      this.logger.warn('Cache read failed, falling through', { key, error });
      return null;
    }
  }
  
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
}
```

### 8.3 Database Optimization

```sql
-- Read replicas for analytics queries
-- Connection: PRIMARY for writes, REPLICA for reads

-- Partitioning large tables
CREATE TABLE studies (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE studies_2024 PARTITION OF studies
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE studies_2025 PARTITION OF studies
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- Materialized views for analytics
CREATE MATERIALIZED VIEW project_daily_stats AS
SELECT 
  project_id,
  DATE(created_at) as date,
  COUNT(*) as decisions_count,
  SUM(CASE WHEN decision = 'INCLUDE' THEN 1 ELSE 0 END) as includes,
  SUM(CASE WHEN decision = 'EXCLUDE' THEN 1 ELSE 0 END) as excludes
FROM screening_decisions
GROUP BY project_id, DATE(created_at);

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY project_daily_stats;
```

### 8.4 Queue-Based Processing

```typescript
// BullMQ job queues
const queues = {
  // High priority - user-facing
  import: new Queue('import', { priority: 1 }),
  notification: new Queue('notification', { priority: 1 }),
  
  // Medium priority - background
  ai: new Queue('ai', { priority: 5 }),
  analytics: new Queue('analytics', { priority: 5 }),
  
  // Low priority - batch
  export: new Queue('export', { priority: 10 }),
  cleanup: new Queue('cleanup', { priority: 10 })
};

// Worker configuration
const importWorker = new Worker('import', async (job) => {
  const { projectId, file, userId } = job.data;
  
  // Process import in chunks
  const parser = ParserFactory.create(file.format);
  let processed = 0;
  
  for await (const batch of parser.parseStream(file.path, 100)) {
    await studyService.bulkCreate(projectId, batch);
    processed += batch.length;
    
    // Update progress
    await job.updateProgress(processed / file.totalRecords * 100);
    
    // Emit real-time update
    socketService.emit(`project:${projectId}`, 'import:progress', {
      processed,
      total: file.totalRecords
    });
  }
  
  return { processed };
}, {
  concurrency: 5,
  limiter: { max: 10, duration: 1000 }
});
```

---

## 9. Real-time Features

### 9.1 WebSocket Architecture

```typescript
// Socket.IO with Redis adapter for scaling
const io = new Server(server, {
  cors: corsOptions,
  adapter: createAdapter(pubClient, subClient)
});

// Namespace organization
io.of('/projects').on('connection', handleProjectConnection);
io.of('/collaboration').on('connection', handleCollaborationConnection);
io.of('/notifications').on('connection', handleNotificationConnection);

// Room structure
// project:{id}           - All project updates
// project:{id}:screening - Screening progress
// project:{id}:team      - Team presence
// user:{id}              - User notifications
```

### 9.2 Real-time Events

```typescript
// Event types
type RealtimeEvent = 
  // Screening events
  | 'screening:decision'
  | 'screening:conflict'
  | 'screening:progress'
  
  // Study events
  | 'study:imported'
  | 'study:updated'
  | 'study:deleted'
  
  // Collaboration events
  | 'team:joined'
  | 'team:left'
  | 'team:typing'
  
  // Chat events
  | 'chat:message'
  | 'chat:reaction'
  
  // Notification events
  | 'notification:new'
  | 'notification:read';

// ============== CRITICAL: SAFE PAYLOADS ONLY ==============
// Server MUST emit only sanitized payloads (no raw errors, no PII leaks)

class RealtimePublisher {
  // Sanitize all payloads before emission
  private sanitize(data: unknown): unknown {
    if (data instanceof Error) {
      return { message: 'An error occurred', code: 'INTERNAL_ERROR' };
    }
    
    // Strip sensitive fields
    const sanitized = { ...data as object };
    delete (sanitized as any).email;
    delete (sanitized as any).password;
    delete (sanitized as any).apiKey;
    delete (sanitized as any).token;
    delete (sanitized as any).stackTrace;
    delete (sanitized as any).prismaError;
    
    return sanitized;
  }
  
  publish(room: string, event: RealtimeEvent, data: unknown): void {
    this.io.to(room).emit(event, {
      ...this.sanitize(data),
      timestamp: Date.now()
    });
  }
  
  publishToUser(userId: string, event: RealtimeEvent, data: unknown): void {
    this.publish(`user:${userId}`, event, data);
  }
  
  publishToProject(projectId: string, event: RealtimeEvent, data: unknown): void {
    this.publish(`project:${projectId}`, event, data);
  }
  
  // Safe error emission
  publishError(room: string, event: RealtimeEvent, error: Error): void {
    this.io.to(room).emit(event, {
      success: false,
      error: {
        message: this.toUserSafeMessage(error),
        code: error.name || 'UNKNOWN_ERROR'
      },
      timestamp: Date.now()
    });
  }
  
  private toUserSafeMessage(error: Error): string {
    // Map internal errors to user-safe messages
    const errorMap: Record<string, string> = {
      'PrismaClientKnownRequestError': 'A database error occurred',
      'ValidationError': 'Invalid input provided',
      'UnauthorizedError': 'You are not authorized for this action',
      'NotFoundError': 'The requested resource was not found',
    };
    return errorMap[error.name] || 'An unexpected error occurred';
  }
}
```

### 9.3 Presence System

```typescript
// Track online users per project
class PresenceService {
  private redis: Redis;
  
  async setUserPresence(
    userId: string,
    projectId: string,
    status: 'online' | 'away' | 'busy'
  ): Promise<void> {
    const key = `presence:project:${projectId}`;
    await this.redis.hset(key, userId, JSON.stringify({
      status,
      lastSeen: Date.now()
    }));
    await this.redis.expire(key, 300); // 5 min TTL
  }
  
  async getProjectPresence(projectId: string): Promise<UserPresence[]> {
    const key = `presence:project:${projectId}`;
    const presence = await this.redis.hgetall(key);
    
    return Object.entries(presence).map(([userId, data]) => ({
      userId,
      ...JSON.parse(data)
    }));
  }
  
  async removeUserPresence(userId: string, projectId: string): Promise<void> {
    await this.redis.hdel(`presence:project:${projectId}`, userId);
  }
}
```

---

## 10. AI/ML Integration

### 10.1 AI Service Architecture

```typescript
// lib/ai/ai-service.ts
class AIService {
  private openai: OpenAI;
  private embeddingCache: EmbeddingCache;
  
  // Screening assistance
  async assessRelevance(
    study: Study,
    criteria: EligibilityCriteria
  ): Promise<RelevanceAssessment> {
    const prompt = this.buildRelevancePrompt(study, criteria);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // Low temperature for consistency
      response_format: { type: 'json_object' }
    });
    
    return this.parseRelevanceResponse(response);
  }
  
  // Data extraction assistance
  async extractData(
    document: string,
    form: ExtractionForm
  ): Promise<ExtractedValues> {
    const schema = this.formToJsonSchema(form);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'Extract structured data from the research paper.' 
        },
        { role: 'user', content: document }
      ],
      functions: [{ name: 'extract_data', parameters: schema }],
      function_call: { name: 'extract_data' }
    });
    
    return JSON.parse(
      response.choices[0].message.function_call.arguments
    );
  }
  
  // Semantic search
  async semanticSearch(
    query: string,
    projectId: string
  ): Promise<Study[]> {
    const queryEmbedding = await this.getEmbedding(query);
    
    // Vector similarity search in PostgreSQL with pgvector
    const results = await prisma.$queryRaw`
      SELECT *, embedding <=> ${queryEmbedding} as distance
      FROM studies
      WHERE project_id = ${projectId}
      ORDER BY distance
      LIMIT 20
    `;
    
    return results;
  }
  
  // Generate embeddings
  private async getEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding:${hashText(text)}`;
    const cached = await this.embeddingCache.get(cacheKey);
    if (cached) return cached;
    
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    
    const embedding = response.data[0].embedding;
    await this.embeddingCache.set(cacheKey, embedding, 86400);
    
    return embedding;
  }
}
```

### 10.2 Batch Processing

```typescript
// lib/ai/batch-processor.ts
class AIBatchProcessor {
  async processStudiesInBatches(
    studies: Study[],
    criteria: EligibilityCriteria,
    batchSize: number = 10
  ): Promise<RelevanceAssessment[]> {
    const results: RelevanceAssessment[] = [];
    
    for (let i = 0; i < studies.length; i += batchSize) {
      const batch = studies.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(study => 
          this.aiService.assessRelevance(study, criteria)
        )
      );
      
      results.push(...batchResults);
      
      // Rate limiting
      await delay(1000);
      
      // Progress callback
      this.onProgress?.(i + batch.length, studies.length);
    }
    
    return results;
  }
}
```

### 10.3 Model Configuration

```typescript
// AI model selection based on task and tier
const modelConfig = {
  screening: {
    free: 'gpt-3.5-turbo',
    professional: 'gpt-4o-mini',
    enterprise: 'gpt-4o'
  },
  extraction: {
    free: null,
    professional: 'gpt-4o-mini',
    enterprise: 'gpt-4o'
  },
  summarization: {
    free: 'gpt-3.5-turbo',
    professional: 'gpt-4o-mini',
    enterprise: 'gpt-4o'
  },
  embedding: 'text-embedding-3-small'
};
```

---

## 11. Background Jobs

### 11.1 Job Types

```typescript
// Job definitions
const jobs = {
  // Import jobs
  'import:process': {
    handler: processImport,
    options: { attempts: 3, backoff: 'exponential' }
  },
  'import:duplicate-detection': {
    handler: detectDuplicates,
    options: { attempts: 2 }
  },
  
  // AI jobs
  'ai:batch-screening': {
    handler: batchAIScreening,
    options: { attempts: 3, timeout: 600000 }
  },
  'ai:generate-embeddings': {
    handler: generateEmbeddings,
    options: { attempts: 2 }
  },
  
  // Notification jobs
  'notification:send-email': {
    handler: sendEmail,
    options: { attempts: 5, backoff: 'exponential' }
  },
  'notification:send-digest': {
    handler: sendDigest,
    options: { attempts: 3 }
  },
  
  // Export jobs
  'export:generate': {
    handler: generateExport,
    options: { attempts: 2, timeout: 300000 }
  },
  
  // Living review jobs
  'living-review:update': {
    handler: updateLivingReview,
    options: { attempts: 2 }
  },
  
  // Alert jobs
  'alert:check': {
    handler: checkAlerts,
    options: { attempts: 2 }
  },
  
  // Cleanup jobs
  'cleanup:expired-sessions': {
    handler: cleanupSessions,
    options: { attempts: 1 }
  },
  'cleanup:orphan-files': {
    handler: cleanupFiles,
    options: { attempts: 1 }
  }
};
```

### 11.2 Scheduled Jobs

```typescript
// Cron schedule definitions
const schedules = {
  // Every hour
  'living-review:check': '0 * * * *',
  'alert:process': '0 * * * *',
  
  // Every 6 hours
  'analytics:aggregate': '0 */6 * * *',
  
  // Daily at 2 AM
  'digest:send': '0 2 * * *',
  'cleanup:sessions': '0 2 * * *',
  'cleanup:files': '0 2 * * *',
  
  // Weekly on Sunday
  'report:weekly': '0 0 * * 0',
  'backup:database': '0 3 * * 0'
};
```

---

## 12. Testing Strategy

### 12.0 Testing Pyramid (Enterprise Distribution)

```
                    ┌───────────────┐
                    │     E2E       │  10-20% of tests
                    │   (Playwright)│  Critical user flows only
                    └───────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              │       Integration         │  20-30% of tests
              │   (API + DB + Services)   │  Authenticated workflows
              └─────────────┬─────────────┘
                            │
    ┌───────────────────────┴───────────────────────┐
    │                    Unit                        │  60-70% of tests
    │   (Services, Validators, Utils, Domain Logic) │  Fast, isolated
    └────────────────────────────────────────────────┘
```

**Key Principle**: Authenticated workflows must be first-class in tests (most "real" bugs happen there).

### 12.0.1 Frontend-Backend Field Alignment Automation

**Critical CI Guardrail** (from school_management_new patterns):

```typescript
// scripts/check-field-alignment.ts
// Runs in CI to prevent "form submits but backend rejects" regressions

import { z } from 'zod';
import * as frontendSchemas from '../src/lib/validators/frontend';
import * as backendSchemas from '../src/lib/validators/backend';

const criticalForms = [
  { name: 'createProject', frontend: frontendSchemas.CreateProjectForm, backend: backendSchemas.CreateProjectInput },
  { name: 'importStudies', frontend: frontendSchemas.ImportForm, backend: backendSchemas.ImportInput },
  { name: 'screeningDecision', frontend: frontendSchemas.DecisionForm, backend: backendSchemas.ScreeningDecisionInput },
  { name: 'extractionSubmit', frontend: frontendSchemas.ExtractionForm, backend: backendSchemas.ExtractionDataInput },
  { name: 'qualitySubmit', frontend: frontendSchemas.QualityForm, backend: backendSchemas.QualityAssessmentInput },
  { name: 'inviteMember', frontend: frontendSchemas.InviteForm, backend: backendSchemas.InvitationInput },
];

function compareSchemas(frontend: z.ZodType, backend: z.ZodType): string[] {
  const issues: string[] = [];
  
  const frontendShape = getSchemaShape(frontend);
  const backendShape = getSchemaShape(backend);
  
  // Check for missing required fields
  for (const [key, type] of Object.entries(backendShape)) {
    if (!frontendShape[key]) {
      issues.push(`Missing field in frontend: ${key}`);
    } else if (!typesCompatible(frontendShape[key], type)) {
      issues.push(`Type mismatch for ${key}: frontend=${frontendShape[key]}, backend=${type}`);
    }
  }
  
  return issues;
}

// Run check
let hasErrors = false;
for (const form of criticalForms) {
  const issues = compareSchemas(form.frontend, form.backend);
  if (issues.length > 0) {
    console.error(`❌ ${form.name}:`, issues);
    hasErrors = true;
  } else {
    console.log(`✅ ${form.name}: aligned`);
  }
}

process.exit(hasErrors ? 1 : 0);
```

Add to CI pipeline:
```yaml
# .github/workflows/ci.yml
- name: Check field alignment
  run: npx tsx scripts/check-field-alignment.ts
```

### 12.1 Unit Tests

```typescript
// Service testing pattern
describe('ScreeningService', () => {
  let service: ScreeningService;
  let prisma: MockPrismaClient;
  let cache: MockCacheService;
  
  beforeEach(() => {
    prisma = createMockPrisma();
    cache = createMockCache();
    service = new ScreeningService({ prisma, cache });
  });
  
  describe('submitDecision', () => {
    it('should create a decision', async () => {
      const input = createMockDecisionInput();
      
      const result = await service.submitDecision(input);
      
      expect(result.decision).toBe(input.decision);
      expect(prisma.screeningDecision.create).toHaveBeenCalled();
    });
    
    it('should throw if study already decided', async () => {
      prisma.screeningDecision.findFirst.mockResolvedValue(
        createMockDecision()
      );
      
      await expect(
        service.submitDecision(createMockDecisionInput())
      ).rejects.toThrow('Already decided');
    });
  });
});
```

### 12.2 Integration Tests

```typescript
// API integration testing
describe('POST /api/v1/projects/:id/screening/decisions', () => {
  let app: Express;
  let prisma: PrismaClient;
  let user: User;
  let project: Project;
  
  beforeAll(async () => {
    prisma = await setupTestDatabase();
    app = createApp(prisma);
    user = await createTestUser(prisma);
    project = await createTestProject(prisma, user.id);
  });
  
  afterAll(async () => {
    await cleanupTestDatabase(prisma);
  });
  
  it('should submit a screening decision', async () => {
    const study = await createTestStudy(prisma, project.id);
    
    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/screening/decisions`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        studyId: study.id,
        decision: 'INCLUDE',
        phase: 'TITLE_ABSTRACT'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.data.decision).toBe('INCLUDE');
  });
});
```

### 12.3 E2E Tests

```typescript
// Playwright E2E tests
test.describe('Screening workflow', () => {
  test('complete screening flow', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to project
    await page.goto('/dashboard/projects/test-project/screening');
    
    // Make decisions
    await expect(page.locator('.study-card')).toBeVisible();
    await page.click('[data-decision="include"]');
    await page.click('[data-action="next"]');
    
    // Verify progress
    await expect(page.locator('.progress-indicator'))
      .toContainText('1 / 100');
  });
});
```

### 12.4 Load Testing

```javascript
// k6 load test
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Sustain
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% < 500ms
    http_req_failed: ['rate<0.01'],   // <1% errors
  },
};

export default function () {
  const response = http.get(
    'http://localhost:3000/api/v1/projects',
    { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } }
  );
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  sleep(1);
}
```

---

## 13. DevOps & Infrastructure

### 13.1 Docker Configuration

```dockerfile
# Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

# Builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Runner
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

### 13.2 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/litlens
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    deploy:
      replicas: 3

  worker:
    build: .
    command: npm run worker
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/litlens
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    deploy:
      replicas: 2

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=litlens

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf

volumes:
  postgres_data:
  redis_data:
```

### 13.3 Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: litlens-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: litlens
  template:
    metadata:
      labels:
        app: litlens
    spec:
      containers:
      - name: app
        image: litlens/app:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: litlens-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 13.4 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
      - run: npm run test:coverage
      - run: npm run test:e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t litlens/app:${{ github.sha }} .
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push litlens/app:${{ github.sha }}

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          kubectl set image deployment/litlens-app app=litlens/app:${{ github.sha }}
```

---

## 14. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
- [ ] Project structure setup
- [ ] Database schema migration
- [ ] Authentication system
- [ ] Base API structure
- [ ] Core services implementation
- [ ] Testing infrastructure

### Phase 2: Core Features (Weeks 5-10)
- [ ] Project management API
- [ ] Study import system
- [ ] Duplicate detection
- [ ] Basic screening workflow
- [ ] Team collaboration
- [ ] Notification system

### Phase 3: Advanced Screening (Weeks 11-14)
- [ ] AI-assisted screening
- [ ] Smart queue optimization
- [ ] Conflict detection & resolution
- [ ] Batch operations
- [ ] Screening analytics

### Phase 4: Data Extraction (Weeks 15-18)
- [ ] Form builder API
- [ ] Validation engine
- [ ] Double extraction workflow
- [ ] Discrepancy resolution
- [ ] AI extraction assistance

### Phase 5: Quality & Synthesis (Weeks 19-22)
- [ ] Quality assessment tools
- [ ] Risk of bias integration
- [ ] GRADE framework
- [ ] PRISMA generation
- [ ] Meta-analysis integration

### Phase 6: Research Tools (Weeks 23-28)
- [ ] Personal library
- [ ] Research graphs
- [ ] Paper discovery
- [ ] Research alerts
- [ ] Writing assistant

### Phase 7: Enterprise Features (Weeks 29-32)
- [ ] Multi-tenancy
- [ ] API keys & webhooks
- [ ] Audit logging
- [ ] White-label support
- [ ] SSO integration

### Phase 8: Scale & Polish (Weeks 33-36)
- [ ] Performance optimization
- [ ] Load testing
- [ ] Security audit
- [ ] Documentation
- [ ] Production deployment

---

## Appendix A: Environment Variables

```env
# Database
DATABASE_URL=postgresql://...
DATABASE_REPLICA_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# Authentication
NEXTAUTH_URL=https://litlens.com
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# AI
OPENAI_API_KEY=...
OPENAI_ORG_ID=...

# Storage
S3_BUCKET=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# Email
RESEND_API_KEY=...
EMAIL_FROM=noreply@litlens.com

# Monitoring
SENTRY_DSN=...

# Feature Flags
FEATURES_AI_SCREENING=true
FEATURES_LIVING_REVIEWS=true
```

---

## Appendix B: API Rate Limits

| Endpoint Category | Free Tier | Professional | Enterprise |
|-------------------|-----------|--------------|------------|
| General API | 100/min | 500/min | 2000/min |
| AI Endpoints | 10/min | 50/min | 200/min |
| Import | 5/min | 20/min | 100/min |
| Export | 5/hour | 20/hour | Unlimited |
| WebSocket | 10 connections | 50 connections | Unlimited |

---

*Document prepared for LitLens systematic review & research intelligence platform.*

