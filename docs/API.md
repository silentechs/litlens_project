# LitLens API Documentation

> **Version**: 1.0.0  
> **Base URL**: `/api`

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Projects](#projects)
- [Study Import](#study-import)
- [Screening](#screening)
- [Data Extraction](#data-extraction)
- [Quality Assessment](#quality-assessment)
- [Library](#library)
- [Organizations](#organizations)
- [Research Tools](#research-tools)
- [Notifications](#notifications)
- [Health & Metrics](#health--metrics)

---

## Authentication

All API endpoints (except `/api/health`) require authentication via session cookie or API key.

### Session Authentication
Automatically handled via NextAuth.js session cookies.

### API Key Authentication
```http
Authorization: Bearer litlens_xxxxxxxx...
```

---

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "hasMore": true,
      "totalPages": 5
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": { "field": ["error message"] }
  }
}
```

### Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Projects

### List Projects
```http
GET /api/projects
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `status` | string | Filter by status (ACTIVE, COMPLETED, ARCHIVED) |
| `search` | string | Search in title/description |
| `sortBy` | string | Sort field |
| `sortOrder` | string | asc or desc |

### Get Project
```http
GET /api/projects/:id
```

### Create Project
```http
POST /api/projects
```

**Request Body:**
```json
{
  "title": "My Review Project",
  "description": "Description...",
  "population": "Adults with condition X",
  "intervention": "Treatment Y",
  "comparison": "Standard care",
  "outcome": "Symptom reduction",
  "isPublic": false,
  "requireDualScreening": true,
  "organizationId": "cuid..."
}
```

### Update Project
```http
PATCH /api/projects/:id
```

### Delete Project
```http
DELETE /api/projects/:id
```

### Get Project Stats
```http
GET /api/projects/:id/stats
```

**Response:**
```json
{
  "totalStudies": 150,
  "includedStudies": 45,
  "excludedStudies": 80,
  "pendingStudies": 20,
  "conflicts": 5
}
```

---

## Project Members

### List Members
```http
GET /api/projects/:id/members
```

### Add Member
```http
POST /api/projects/:id/members
```

**Request Body:**
```json
{
  "userId": "cuid...",
  "role": "REVIEWER"
}
```

**Roles:** `OWNER`, `LEAD`, `REVIEWER`, `OBSERVER`

### Update Member
```http
PATCH /api/projects/:id/members/:memberId
```

### Remove Member
```http
DELETE /api/projects/:id/members/:memberId
```

---

## Study Import

### Create Import Batch
```http
POST /api/projects/:id/import
```

**Request Body:**
```json
{
  "filename": "export.ris",
  "fileType": "RIS",
  "content": "base64 or text content..."
}
```

**Supported formats:** `RIS`, `BIBTEX`, `CSV`, `TSV`

### Get Import Batch
```http
GET /api/projects/:id/import/:batchId
```

### Process Import
```http
POST /api/projects/:id/import/:batchId/process
```

### List Import History
```http
GET /api/projects/:id/import
```

---

## Screening

### Get Screening Queue
```http
GET /api/projects/:id/screening/queue
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `phase` | string | TITLE_ABSTRACT or FULL_TEXT |
| `status` | string | Filter by status |
| `search` | string | Search studies |
| `page` | number | Page number |
| `limit` | number | Items per page |

### Submit Decision
```http
POST /api/projects/:id/screening/decisions
```

**Request Body:**
```json
{
  "projectWorkId": "cuid...",
  "phase": "TITLE_ABSTRACT",
  "decision": "INCLUDE",
  "reasoning": "Meets criteria...",
  "exclusionReason": null,
  "timeSpentMs": 45000,
  "followedAi": true
}
```

**Decisions:** `INCLUDE`, `EXCLUDE`, `MAYBE`

### Batch Decision
```http
POST /api/projects/:id/screening/batch
```

**Request Body:**
```json
{
  "projectWorkIds": ["id1", "id2", "id3"],
  "phase": "TITLE_ABSTRACT",
  "decision": "EXCLUDE"
}
```

### Get AI Suggestion
```http
GET /api/projects/:id/screening/ai-suggestions?projectWorkId=xxx
```

### Get Progress
```http
GET /api/projects/:id/screening/progress
```

### Get Analytics
```http
GET /api/projects/:id/screening/analytics
```

---

## Conflicts

### List Conflicts
```http
GET /api/projects/:id/conflicts
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | PENDING, IN_DISCUSSION, RESOLVED |
| `page` | number | Page number |
| `limit` | number | Items per page |

### Get Conflict
```http
GET /api/projects/:id/conflicts/:conflictId
```

### Resolve Conflict
```http
PATCH /api/projects/:id/conflicts/:conflictId
```

**Request Body:**
```json
{
  "action": "resolve",
  "finalDecision": "INCLUDE",
  "reasoning": "After discussion..."
}
```

### Escalate Conflict
```http
PATCH /api/projects/:id/conflicts/:conflictId
```

**Request Body:**
```json
{
  "action": "escalate",
  "reason": "Need senior reviewer input"
}
```

---

## Data Extraction

### List Templates
```http
GET /api/projects/:id/extraction/templates
```

### Create Template
```http
POST /api/projects/:id/extraction/templates
```

**Request Body:**
```json
{
  "name": "RCT Extraction Form",
  "description": "Standard extraction for RCTs",
  "fields": [
    {
      "id": "sample_size",
      "name": "Sample Size",
      "type": "number",
      "required": true,
      "validation": { "min": 1 }
    },
    {
      "id": "intervention",
      "name": "Intervention Details",
      "type": "text",
      "required": true
    }
  ],
  "isActive": true
}
```

**Field Types:** `text`, `number`, `select`, `multiselect`, `date`, `boolean`, `textarea`, `email`, `url`

### Submit Extraction Data
```http
POST /api/projects/:id/extraction/data
```

**Request Body:**
```json
{
  "projectWorkId": "cuid...",
  "templateId": "cuid...",
  "data": {
    "sample_size": 150,
    "intervention": "Cognitive behavioral therapy"
  }
}
```

### Get AI Extraction Assist
```http
GET /api/projects/:id/extraction/ai-assist?projectWorkId=xxx&templateId=yyy
```

### List Discrepancies
```http
GET /api/projects/:id/extraction/discrepancies
```

---

## Quality Assessment

### List Tools
```http
GET /api/projects/:id/quality/tools
```

### Create Tool
```http
POST /api/projects/:id/quality/tools
```

**Tool Types:** `ROB2`, `ROBINS_I`, `NEWCASTLE_OTTAWA`, `GRADE`, `CUSTOM`

### Submit Assessment
```http
POST /api/projects/:id/quality/assessments
```

### Get PRISMA Flow
```http
GET /api/projects/:id/synthesis?type=prisma
```

### Get Meta-Analysis
```http
GET /api/projects/:id/synthesis?type=meta-analysis
```

---

## Library

### List Library Items
```http
GET /api/library
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `folderId` | string | Filter by folder |
| `tags` | string | Filter by tags (comma-separated) |
| `status` | string | TO_READ, READING, READ, ARCHIVED |
| `page` | number | Page number |
| `limit` | number | Items per page |

### Add to Library
```http
POST /api/library
```

**Request Body:**
```json
{
  "workId": "cuid...",
  "folderId": "cuid...",
  "tags": ["important", "methodology"],
  "notes": "Key reference for discussion"
}
```

### Update Library Item
```http
PATCH /api/library/:itemId
```

### Remove from Library
```http
DELETE /api/library/:itemId
```

### List Folders
```http
GET /api/library/folders
```

### Create Folder
```http
POST /api/library/folders
```

---

## Organizations

### List Organizations
```http
GET /api/organizations
```

### Create Organization
```http
POST /api/organizations
```

**Request Body:**
```json
{
  "name": "My Research Lab",
  "slug": "my-research-lab"
}
```

### Get Organization
```http
GET /api/organizations/:orgId
```

### Update Organization
```http
PATCH /api/organizations/:orgId
```

### Delete Organization
```http
DELETE /api/organizations/:orgId
```

### Organization Members
```http
GET /api/organizations/:orgId/members
POST /api/organizations/:orgId/members
PATCH /api/organizations/:orgId/members
DELETE /api/organizations/:orgId/members?userId=xxx
```

### API Keys
```http
GET /api/organizations/:orgId/api-keys
POST /api/organizations/:orgId/api-keys
PATCH /api/organizations/:orgId/api-keys
DELETE /api/organizations/:orgId/api-keys?keyId=xxx
```

### Webhooks
```http
GET /api/organizations/:orgId/webhooks
POST /api/organizations/:orgId/webhooks
PATCH /api/organizations/:orgId/webhooks
DELETE /api/organizations/:orgId/webhooks?webhookId=xxx
```

### Audit Logs
```http
GET /api/organizations/:orgId/audit-logs
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | Filter by action type |
| `resource` | string | Filter by resource type |
| `userId` | string | Filter by user |
| `startDate` | string | ISO date |
| `endDate` | string | ISO date |
| `page` | number | Page number |
| `limit` | number | Items per page |

---

## Research Tools

### Research Graphs
```http
GET /api/research/graphs
POST /api/research/graphs
GET /api/research/graphs/:graphId
PATCH /api/research/graphs/:graphId
DELETE /api/research/graphs/:graphId
```

### Research Alerts
```http
GET /api/research/alerts
POST /api/research/alerts
GET /api/research/alerts/:alertId
PATCH /api/research/alerts/:alertId
DELETE /api/research/alerts/:alertId
```

### Writing Projects
```http
GET /api/writing
POST /api/writing
GET /api/writing/:writingId
PATCH /api/writing/:writingId
DELETE /api/writing/:writingId
GET /api/writing/:writingId/sources
POST /api/writing/:writingId/sources
```

---

## Notifications

### List Notifications
```http
GET /api/notifications
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `unread` | boolean | Filter unread only |
| `projectId` | string | Filter by project |

### Mark as Read
```http
PATCH /api/notifications/:notificationId
```

### Mark All as Read
```http
POST /api/notifications/read-all
```

---

## Health & Metrics

### Health Check
```http
GET /api/health
HEAD /api/health
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `detailed` | boolean | Include metrics |

### Metrics (Admin Only)
```http
GET /api/metrics
POST /api/metrics
```

**Actions:** `reset_metrics`, `clear_errors`, `clear_cache`

---

## Rate Limits

| Endpoint Category | Limit |
|-------------------|-------|
| Standard API | 100 requests/minute |
| Auth endpoints | 10 requests/15 minutes |
| Import operations | 10 requests/hour |
| AI operations | 20 requests/minute |
| Export operations | 50 requests/hour |

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-15T10:31:00Z
```

---

## Webhook Events

| Event | Description |
|-------|-------------|
| `project.created` | New project created |
| `project.updated` | Project settings changed |
| `project.deleted` | Project deleted |
| `study.imported` | Studies imported |
| `study.screened` | Screening decision made |
| `study.included` | Study included |
| `study.excluded` | Study excluded |
| `extraction.completed` | Data extraction completed |
| `conflict.created` | New screening conflict |
| `conflict.resolved` | Conflict resolved |
| `member.added` | Team member added |
| `member.removed` | Team member removed |
| `review.completed` | Review phase completed |

### Webhook Payload Format
```json
{
  "event": "study.screened",
  "timestamp": "2024-01-15T10:30:00Z",
  "organizationId": "cuid...",
  "data": {
    "projectId": "cuid...",
    "workId": "cuid...",
    "title": "Study title...",
    "decision": "INCLUDE"
  }
}
```

### Webhook Security
Payloads are signed with HMAC SHA-256. Verify the signature:
```
X-Webhook-Signature: <hmac-sha256>
X-Webhook-Timestamp: <iso-timestamp>
```

---

## SDK Usage

### React Query Hooks

```typescript
import { useProjects, useCreateProject } from "@/hooks/api";

// List projects
const { data, isLoading } = useProjects({ page: 1, limit: 20 });

// Create project
const createProject = useCreateProject();
createProject.mutate({ title: "New Project" });
```

### API Client

```typescript
import { projectsApi, screeningApi } from "@/lib/api-client";

// Direct API calls
const project = await projectsApi.get("project-id");
const queue = await screeningApi.getQueue("project-id", { phase: "TITLE_ABSTRACT" });
```

