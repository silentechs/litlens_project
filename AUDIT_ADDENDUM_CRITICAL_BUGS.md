# Product Audit — Critical Bugs Addendum
**Date**: December 27, 2025  
**Source**: Cross-validation with secondary audit findings

---

## Overview

This addendum documents **specific concrete bugs** discovered through cross-validation that were either missed or under-emphasized in the primary audit. These are **active runtime issues** vs. missing features.

---

## CRITICAL BUGS (Fix Immediately)

### 🔴 Bug #1: Contract Drift in Notifications API
**Severity**: Blocker  
**Status**: Production-Breaking

**Problem**: 
- Backend returns paginated wrapper: `{ success: true, data: { items: [...], pagination: {...} } }`
- Frontend expects raw shape: `res.json()` then reads `data?.items`
- **Result**: Notifications page will show empty/broken

**Evidence**:
```typescript
// Backend: src/app/api/notifications/route.ts
return paginated(notifications, total, page, limit);
// Returns: { success: true, data: { items: [...], pagination: {...} } }

// Frontend: src/app/(app)/notifications/page.tsx (lines 20-24)
const res = await fetch("/api/notifications");
const data = await res.json(); // ⚠️ Treats as raw, but it's wrapped
const notifications = data?.items || []; // ❌ WRONG: should be data.data.items
```

**Fix**:
```typescript
// Option 1: Fix frontend to unwrap
const res = await fetch("/api/notifications");
const wrapper = await res.json();
const data = wrapper.data; // Unwrap
const notifications = data?.items || [];
const pagination = data?.pagination;

// Option 2: Use api-client helper (already handles unwrapping)
import { notificationsApi } from "@/lib/api-client";
const { items, pagination } = await notificationsApi.list();
```

**Effort**: 15 minutes  
**Impact**: HIGH — Core feature completely broken

---

### 🔴 Bug #2: Contract Drift in Research Alerts API
**Severity**: Blocker  
**Status**: Production-Breaking

**Problem**: Same contract mismatch as Notifications

**Evidence**:
```typescript
// src/features/alerts/components/ResearchAlerts.tsx
const res = await fetch("/api/research/alerts");
return res.json(); // ⚠️ Returns wrapped response, treats as raw array
// Then maps over (data as any[])
```

**Additional Issues**:
1. No create/edit/delete UI (only list)
2. Mock alert mapping instead of real data
3. Hardcoded `isRead: false` in API response

**Fix**:
1. Unwrap response: `const { data } = await res.json(); return data.items;`
2. Implement CRUD UI (create alert modal, edit, delete buttons)
3. Wire to `/api/research/alerts` POST/PATCH/DELETE

**Effort**: 4-6 hours  
**Impact**: HIGH — Feature appears to work but shows wrong data

---

### 🔴 Bug #3: Hardcoded Demo Project IDs in Global Pages
**Severity**: High  
**Status**: Navigation Broken

**Problem**: Global Team and Analytics pages link to `/project/1/...` and `/project/2/...` which will 404 in real deployments

**Evidence**:
```typescript
// src/app/(app)/team/page.tsx (lines 25-60)
const DEMO_PROJECTS = [
  { 
    id: "1", // ⚠️ HARDCODED
    name: "Systematic Review: AI in Healthcare",
    // ...
  },
  {
    id: "2", // ⚠️ HARDCODED
    // ...
  }
];

// Then links to: /project/${project.id}/team
```

**Same issue in**:
- `src/app/(app)/analytics/page.tsx` (lines 20-55)

**Fix**:
```typescript
// Replace with real projects query
const { data } = useProjects({ limit: 10 });
const projects = data?.items || [];

// Then link to actual project IDs
<Link href={`/project/${project.id}/team`}>
```

**Effort**: 30 minutes  
**Impact**: HIGH — Produces 404s in production

---

### 🔴 Bug #4: Project Works API Field Name Mismatch
**Severity**: High  
**Status**: Latent Bug (Silently Fails)

**Problem**: API route uses wrong Prisma field names

**Evidence**:
```typescript
// src/app/api/projects/[id]/works/route.ts (lines 50-55)
const where: any = {
  projectId,
};

if (status) {
  where.screeningStatus = status; // ❌ WRONG: Prisma field is "status"
}

if (phase) {
  where.screeningPhase = phase; // ❌ WRONG: Prisma field is "phase"
}
```

**Actual Prisma Schema**:
```prisma
model ProjectWork {
  id       String @id
  status   ProjectWorkStatus // ✅ NOT "screeningStatus"
  phase    ScreeningPhase    // ✅ NOT "screeningPhase"
  // ...
}
```

**Impact**: 
- Filtering by status/phase silently fails (returns all records)
- Discovery "Add to Project" may not work correctly
- Internal search may return wrong results

**Fix**:
```typescript
// Correct field names
if (status) {
  where.status = status; // ✅ Correct
}

if (phase) {
  where.phase = phase; // ✅ Correct
}
```

**Effort**: 5 minutes + testing  
**Impact**: HIGH — Data integrity issue

---

## HIGH-SEVERITY ISSUES

### 🟡 Issue #5: "Self-Healing" Mutations in GET Endpoints
**Severity**: High  
**Category**: Code Quality / Observability

**Problem**: GET endpoints perform database writes (UPDATE statements) as "self-healing" logic

**Evidence**:

**Location 1**: `src/app/api/projects/[id]/screening/next-steps/route.ts`
```typescript
// GET endpoint (lines 41-121)
export async function GET(request: NextRequest, { params }: RouteParams) {
  // ... inside a GET handler:
  
  // REPAIR/SELF-HEALING BLOCK (lines 55-101)
  const stuckStudies = await db.projectWork.findMany({
    where: {
      projectId,
      phase: currentPhase,
      status: { in: ["PENDING", "SCREENING"] },
      decisions: { some: {} }
    },
    include: { decisions: true }
  });

  if (stuckStudies.length > 0) {
    for (const study of stuckStudies) {
      // ⚠️ MUTATION IN GET ENDPOINT
      await db.projectWork.update({
        where: { id: study.id },
        data: {
          status: latest.decision === "INCLUDE" ? "INCLUDED" :
                  latest.decision === "EXCLUDE" ? "EXCLUDED" : "MAYBE",
          finalDecision: latest.decision
        }
      });
    }
  }
  // ... continues with read logic
}
```

**Location 2**: `src/app/api/projects/[id]/screening/advance-phase/route.ts`
```typescript
// POST endpoint but has similar repair logic (lines 68-102)
// This one is slightly more acceptable since POST can have side effects
// But still violates separation of concerns
```

**Why This Is Bad**:
1. **Violates HTTP semantics**: GET should be idempotent and cacheable
2. **Hidden side effects**: Developers don't expect GET to mutate data
3. **Observability**: Audit logs won't show these changes (no user-initiated action)
4. **Race conditions**: Multiple concurrent GETs could conflict
5. **Caching issues**: CDN/browser cache could prevent "healing"

**Better Approach**:
1. **Option A**: Move to background job (cron) that finds and fixes inconsistent states
2. **Option B**: Create explicit POST `/api/projects/[id]/screening/repair` endpoint (admin-only)
3. **Option C**: Add invariants at decision submission time to prevent stuck states

**Fix**:
```typescript
// Remove from GET endpoint
// Create new endpoint:
// POST /api/projects/[id]/screening/repair
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Require admin/lead role
  // Perform healing
  // Return count of fixed records
  // Log in audit trail
}
```

**Effort**: 6-8 hours (includes migration script for existing stuck data)  
**Impact**: MEDIUM — Correctness/maintainability debt

---

### 🟡 Issue #6: API Key Authentication Not Implemented
**Severity**: High (if marketed) / Medium (if internal)  
**Category**: Security / False Documentation

**Problem**: 
- Docs claim API key authentication is supported
- `ApiKey` schema exists in database
- Service layer exists: `src/lib/services/api-keys.ts` with `validateApiKey()`
- **BUT**: No API route actually checks for API keys

**Evidence**:

**Documented in API.md**:
```markdown
### API Key Authentication
Authorization: Bearer litlens_xxxxxxxx...
```

**Schema Exists**:
```prisma
model ApiKey {
  id          String @id @default(cuid())
  keyHash     String @unique
  permissions Json
  rateLimit   Int
  // ...
}
```

**Service Exists**:
```typescript
// src/lib/services/api-keys.ts
export async function validateApiKey(keyHash: string) {
  // Implementation exists
}
```

**BUT**: No API route uses it
- Searched all routes: only `auth()` session checks
- No middleware checks `Authorization: Bearer` header
- No call sites to `validateApiKey()`

**Impact**:
- Third-party integrations cannot work
- False marketing claim
- Enterprise customers expecting programmatic access will be blocked

**Fix**:
```typescript
// src/lib/auth-middleware.ts (NEW)
export async function authenticateRequest(request: NextRequest) {
  // Try session first
  const session = await auth();
  if (session?.user) {
    return { type: 'session', user: session.user };
  }

  // Try API key
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const key = authHeader.substring(7);
    const apiKeyAuth = await validateApiKey(key);
    if (apiKeyAuth) {
      return { type: 'apikey', user: apiKeyAuth.user, permissions: apiKeyAuth.permissions };
    }
  }

  return null;
}

// Then update all API routes:
const auth = await authenticateRequest(request);
if (!auth) {
  throw new UnauthorizedError();
}
```

**Effort**: L (12-16 hours — touches all 66 API routes)  
**Impact**: HIGH if marketed, MEDIUM otherwise

---

### 🟡 Issue #7: Duplicate API Client Patterns
**Severity**: Medium  
**Category**: Maintainability

**Problem**: Two parallel patterns for API calls causing duplication and confusion

**Pattern 1**: Centralized `src/lib/api-client.ts`
```typescript
export const projectsApi = {
  list: async (params) => { /* ... */ },
  get: async (id) => { /* ... */ },
  create: async (data) => { /* ... */ },
};

export const screeningApi = { /* ... */ };
// etc.
```

**Pattern 2**: Feature-level query hooks in `src/features/*/api/queries.ts`
```typescript
// src/features/projects/api/queries.ts
export function useProjects(params) {
  return useQuery(['projects', params], () => fetchProjects(params));
}

async function fetchProjects(params) {
  const res = await fetch('/api/projects');
  return res.json(); // ⚠️ Some unwrap, some don't
}
```

**Issues**:
1. Duplication: Same endpoints called from both patterns
2. Inconsistent error handling
3. Inconsistent response unwrapping (some handle `{ success, data }`, some don't)
4. Hard to maintain: Changes need to be made in 2 places

**Examples of Duplication**:
- `projectsApi.list()` in `api-client.ts`
- `fetchProjects()` in `features/projects/api/queries.ts`
- Both call `/api/projects` but with different unwrapping logic

**Fix** (Choose One):

**Option A**: Standardize on centralized `api-client.ts`
```typescript
// All features use:
import { projectsApi } from '@/lib/api-client';

export function useProjects(params) {
  return useQuery(['projects', params], () => projectsApi.list(params));
}
```

**Option B**: Standardize on feature-level hooks
```typescript
// Remove api-client.ts exports
// Each feature owns its API surface
// Create shared utility for unwrapping:
import { unwrapApiResponse } from '@/lib/api-utils';

async function fetchProjects(params) {
  const res = await fetch('/api/projects');
  return unwrapApiResponse(res);
}
```

**Recommendation**: Option A (centralized) for better type safety and consistency

**Effort**: M-L (8-12 hours refactoring + testing)  
**Impact**: MEDIUM — Reduces maintenance burden

---

### 🟡 Issue #8: Settings Page Toggles Are Visual Only
**Severity**: Medium  
**Category**: UX Debt / False Functionality

**Problem**: User preferences page has toggles but they don't persist

**Evidence**:
```typescript
// src/app/(app)/settings/page.tsx
// All state is local React state
const [emailNotifications, setEmailNotifications] = useState(true);
const [pushNotifications, setPushNotifications] = useState(false);
const [orcidLinked, setOrcidLinked] = useState(false);

// No API calls to save
// No useEffect to load from backend
// No mutation hooks
```

**Schema Exists**:
```prisma
model UserPreferences {
  id                   String  @id
  userId               String  @unique
  emailNotifications   Boolean @default(true)
  pushNotifications    Boolean @default(false)
  inAppNotifications   Boolean @default(true)
  quietHoursEnabled    Boolean
  theme                String  @default("system")
  // ...
}
```

**Fix**:
```typescript
// 1. Create API endpoint (doesn't exist yet)
// GET/PATCH /api/user/preferences

// 2. Wire settings page
const { data: prefs } = useQuery(['userPreferences'], fetchPreferences);
const updatePrefsMutation = useMutation(updatePreferences);

<Switch
  checked={prefs?.emailNotifications}
  onCheckedChange={(checked) => {
    updatePrefsMutation.mutate({ emailNotifications: checked });
  }}
/>
```

**Effort**: M (4-6 hours)  
**Impact**: MEDIUM — Users think they're saving but aren't

---

## Summary of Critical Additions

### Newly Identified Blockers (Must Fix for Beta)
1. ✅ **Notifications contract drift** (15 min)
2. ✅ **Alerts contract drift** (4-6 hrs with CRUD)
3. ✅ **Hardcoded project IDs** (30 min)
4. ✅ **Project works field names** (5 min)

### Newly Identified High-Severity Issues
5. ✅ **Self-healing in GET endpoints** (6-8 hrs)
6. ✅ **API key auth not enforced** (12-16 hrs)
7. ✅ **Duplicate API client patterns** (8-12 hrs)
8. ✅ **Settings toggles not persisted** (4-6 hrs)

---

## Updated Priority Matrix

### P0 — BLOCKERS (Must Fix for Beta Launch)
| Issue | Original Audit | New Finding | Effort | Impact |
|-------|---------------|-------------|--------|--------|
| Conflict resolution UI broken | ✅ Yes | - | 4h | HIGH |
| Phase progression controls missing | ✅ Yes | - | 6h | HIGH |
| Export functionality missing | ✅ Yes | - | 3h | HIGH |
| **Notifications contract drift** | ⚠️ Partial | ✅ **NEW** | 15min | **HIGH** |
| **Alerts contract drift** | ⚠️ Partial | ✅ **NEW** | 4-6h | **HIGH** |
| **Hardcoded project IDs** | ⚠️ "Stub" | ✅ **NEW** | 30min | **HIGH** |
| **Project works field bug** | ❌ Missed | ✅ **NEW** | 5min | **HIGH** |

**New Total P0 Time**: 19-23 hours (was 15 hours)

---

### P1 — HIGH (Critical for Production)
| Issue | Original Audit | New Finding | Effort |
|-------|---------------|-------------|--------|
| Screening analytics missing | ✅ Yes | - | 12h |
| Lead batch ops missing | ✅ Yes | - | 10h |
| Extraction workflow orphaned | ✅ Yes | - | 16h |
| Quality workflow orphaned | ✅ Yes | - | 12h |
| **Self-healing in GETs** | ❌ Missed | ✅ **NEW** | 6-8h |
| **Settings toggles visual only** | ❌ Missed | ✅ **NEW** | 4-6h |

---

### P2 — MEDIUM (Maintainability & Future-Proofing)
| Issue | Original Audit | New Finding | Effort |
|-------|---------------|-------------|--------|
| PRISMA flow generator | ✅ Yes | - | 8h |
| Calibration rounds | ✅ Yes | - | 20h |
| Organization admin panel | ✅ Yes | - | 20h |
| **API key auth implementation** | ❌ Missed | ✅ **NEW** | 12-16h |
| **Duplicate API client patterns** | ❌ Missed | ✅ **NEW** | 8-12h |

---

## Revised Immediate Actions (Top 15)

### Week 1: Critical Bugs (38-44 hours)
1. **Notifications contract drift** (15min) ← NEW
2. **Hardcoded project IDs** (30min) ← NEW  
3. **Project works field names** (5min + 1h testing) ← NEW
4. **Conflict resolution UI** (4h)
5. **Phase progression controls** (6h)
6. **Export functionality** (3h)
7. **Alerts contract drift + CRUD** (6h) ← NEW
8. **Settings toggles persistence** (6h) ← NEW
9. **Screening analytics dashboard** (12h)

### Week 2-3: Code Quality (26-36 hours)
10. **Self-healing GET endpoints** (8h) ← NEW
11. **Duplicate API client refactor** (10h) ← NEW
12. **Lead batch operations panel** (10h)
13. **PRISMA flow generator** (8h)

### Week 4+: Major Features
14. **API key auth implementation** (16h) ← NEW
15. **Extraction workflow** (16h)
16. **Quality workflow** (12h)

---

## Impact on Scorecard

### Updated Scores (with new findings)

| Dimension | Old Score | New Score | Change | Reason |
|-----------|-----------|-----------|--------|--------|
| Business Logic | 4.5/5 | **4/5** | -0.5 | Self-healing GETs reduce trust |
| UI/UX Consistency | 2.5/5 | **2/5** | -0.5 | Contract drift + visual-only toggles |
| Accessibility | 2/5 | 2/5 | - | No change |
| Performance | 3.5/5 | 3.5/5 | - | No change |
| Security/Privacy | 4/5 | **3.5/5** | -0.5 | API key false documentation |
| Maintainability | 4/5 | **3/5** | -1.0 | Duplicate patterns + field name bugs |
| Feature Completeness | 3/5 | 3/5 | - | No change |
| **OVERALL** | **3.2/5** | **2.9/5** | **-0.3** | **More bugs than initially assessed** |

---

## Conclusion

The secondary audit revealed **8 specific concrete bugs** that were either missed or under-categorized:

**Critical Runtime Bugs** (break functionality):
1. Notifications contract drift
2. Alerts contract drift  
3. Hardcoded project IDs
4. Project works field names

**High-Severity Code Issues** (reduce trustworthiness):
5. Self-healing mutations in GET endpoints
6. API key auth not enforced (false docs)
7. Duplicate API client patterns
8. Settings toggles not persisted

**Impact on Market Readiness**: **65% → 58%** (more bugs reduce confidence)

**New Beta Launch Requirement**: Fix **7 blockers** (was 3) = **19-23 hours** (was 15)

**Recommendation**: Address all P0 blockers before any beta launch. The contract drift bugs especially will create immediate user-visible failures.

---

**Updated Documents**:
- Main audit remains valid for strategic analysis
- This addendum provides tactical bug fixes
- Combined effort to production: **~200 hours** (was 150)


