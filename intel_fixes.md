# LitLens Intelligence Tab - Consolidated Fix Plan
## Synthesized from 3 Comprehensive Audits

**Date:** December 25, 2025  
**Target Codebase:** `/Users/zak/Documents/litlens`  
**Scope:** Discovery, Library, Graphs, Writing pages + supporting backend

---

## ✅ IMPLEMENTATION STATUS (December 25, 2025)

The following fixes have been implemented:

| Fix | Status | Files Modified/Created |
|-----|--------|----------------------|
| Internal Search API | ✅ Done | `src/app/api/search/internal/route.ts` |
| Semantic Search API | ✅ Done | `src/app/api/search/semantic/route.ts` |
| Add to Project API | ✅ Done | `src/app/api/projects/[id]/works/route.ts` |
| Search Filters UI | ✅ Done | `src/features/discovery/components/UnifiedSearch.tsx` |
| Create Folder Button | ✅ Done | `src/features/library/components/LibraryManager.tsx` |
| Tag Input UI | ✅ Done | `src/features/library/components/LibraryManager.tsx` |
| Notes Editor | ✅ Done | `src/features/library/components/LibraryManager.tsx` |
| Folder Data Shape Fix | ✅ Done | `src/types/library.ts` |
| Graph Project Connection | ✅ Done | `src/features/graphs/components/CitationGraph.tsx` |
| Graph Controls | ✅ Done | `src/features/graphs/components/GraphControl.tsx` |
| Writing Persistence | ✅ Done | `src/features/writing/components/WritingAssistant.tsx` |
| AI Copilot Chat | ✅ Done | `src/features/writing/components/WritingAssistant.tsx` |

---

## Updated Statistics (Post-Implementation)
| Feature | Backend Exists | Frontend Works |
|---------|---------------|----------------|
| External Search | ✅ | ✅ |
| Internal Search | ✅ NEW | ✅ NEW |
| Semantic Search | ✅ NEW (keyword-based) | ✅ NEW |
| Search Filters | ✅ | ✅ NEW |
| Create Folder | ✅ | ✅ NEW |
| Add Tags | ✅ | ✅ NEW |
| Library Notes | ✅ | ✅ NEW |
| Graph Connect | ✅ | ✅ NEW |
| Graph Export | ✅ | ✅ NEW |
| Save Writing | ✅ | ✅ NEW |
| AI Copilot | ✅ | ✅ NEW |
| Research Alerts | ✅ Service exists | ❌ No UI |
| Theme Generation | ❌ Not built | ❌ Not built |

---

## Executive Summary

~~The Intelligence tab has **beautiful UI shells** but most features are either:~~
~~1. **Non-functional** (API routes don't exist)~~
~~2. **Disconnected** (backend exists but UI doesn't call it)~~
~~3. **Placeholder** (mock data, console.log handlers)~~

**UPDATE:** Most critical features have been implemented. The Intel tab is now functional with:
- Working internal and semantic search
- Full library management (folders, tags, notes)
- Real project-connected graphs
- Persistent writing with AI copilot chat

### Remaining Work
- Research Alerts UI
- Full vector-based semantic search (currently keyword-based)
- Theme generation (major feature)

---

## Part 1: Discovery Page Fixes (`/discover`)

### 1.1 CRITICAL: Internal Search Route Missing

**Current State:**
- `src/features/discovery/api/queries.ts` line 73 calls `/api/search/internal`
- **NO SUCH ROUTE EXISTS** in `src/app/api/search/`
- The "Internal" tab in UnifiedSearch is completely broken

**Fix Required:**
Create `src/app/api/search/internal/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { internalSearchSchema } from '@/lib/validators/search';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  // Search user's library items and project works
  const [libraryResults, projectResults] = await Promise.all([
    db.libraryItem.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { work: { title: { contains: query, mode: 'insensitive' } } },
          { work: { abstract: { contains: query, mode: 'insensitive' } } },
          { work: { authors: { hasSome: [query] } } },
        ],
      },
      include: { work: true },
      take: limit,
      skip: (page - 1) * limit,
    }),
    db.projectWork.findMany({
      where: {
        project: {
          members: { some: { userId: session.user.id } },
        },
        OR: [
          { work: { title: { contains: query, mode: 'insensitive' } } },
          { work: { abstract: { contains: query, mode: 'insensitive' } } },
        ],
      },
      include: { work: true, project: { select: { name: true } } },
      take: limit,
      skip: (page - 1) * limit,
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      library: libraryResults,
      projects: projectResults,
    },
    meta: { query, page, limit },
  });
}
```

**Files to create:**
- `src/app/api/search/internal/route.ts`

---

### 1.2 CRITICAL: Semantic Search Route Missing

**Current State:**
- `src/features/discovery/api/queries.ts` line 100 calls `/api/search/semantic`
- **NO SUCH ROUTE EXISTS**
- "Semantic Bridge" tab is completely non-functional
- **No embedding infrastructure exists** (no vector fields in Prisma schema)

**Fix Required (Phase 1 - Stub):**
Create `src/app/api/search/semantic/route.ts` that returns a helpful message:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Semantic search requires embeddings infrastructure
  // Return informative response until implemented
  return NextResponse.json({
    success: false,
    error: 'Semantic search is not yet available',
    message: 'This feature requires vector embeddings. Coming soon.',
    data: { results: [] },
  }, { status: 501 });
}
```

**Fix Required (Phase 2 - Full Implementation):**
See Part 6: Semantic Search Infrastructure

**Files to create:**
- `src/app/api/search/semantic/route.ts`

---

### 1.3 HIGH: "Add to Project" Route Missing

**Current State:**
- `useAddToProject` in `queries.ts` calls `POST /api/projects/${projectId}/works`
- **NO SUCH ROUTE EXISTS**
- "Add to Project" button fails silently

**Fix Required:**
Create `src/app/api/projects/[id]/works/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;
  const body = await request.json();
  const { workId, externalId, source, metadata } = body;

  // Verify user has access to project
  const membership = await db.projectMember.findFirst({
    where: { projectId, userId: session.user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Not a project member' }, { status: 403 });
  }

  // Find or create the work
  let work;
  if (workId) {
    work = await db.work.findUnique({ where: { id: workId } });
  } else if (externalId && source) {
    work = await db.work.findFirst({
      where: { externalId, source },
    });
    if (!work && metadata) {
      work = await db.work.create({
        data: { externalId, source, ...metadata },
      });
    }
  }

  if (!work) {
    return NextResponse.json({ error: 'Work not found' }, { status: 404 });
  }

  // Check if already in project
  const existing = await db.projectWork.findFirst({
    where: { projectId, workId: work.id },
  });
  if (existing) {
    return NextResponse.json({ error: 'Already in project' }, { status: 409 });
  }

  // Add to project
  const projectWork = await db.projectWork.create({
    data: {
      projectId,
      workId: work.id,
      addedById: session.user.id,
      screeningPhase: 'TITLE_ABSTRACT',
      screeningStatus: 'PENDING',
    },
    include: { work: true },
  });

  return NextResponse.json({ success: true, data: projectWork });
}
```

**Files to create:**
- `src/app/api/projects/[id]/works/route.ts`

---

### 1.4 HIGH: "Save to Library" Double-Add Bug

**Current State:**
- UI flow: `POST /api/works` → then `POST /api/library`
- But `/api/works` defaults `saveToLibrary: true`, so it **already saves to library**
- Second call to `/api/library` fails with conflict

**Fix Required:**
Option A: Remove `saveToLibrary` default from `/api/works`:
```typescript
// src/app/api/works/route.ts
// Change default to false
const { saveToLibrary = false } = body;
```

Option B: Update UI to not double-call:
```typescript
// src/features/discovery/api/queries.ts
export const useSaveToLibrary = () => {
  return useMutation({
    mutationFn: async (work: ExternalWork) => {
      // Single call that handles both work creation and library add
      const res = await fetch('/api/works', {
        method: 'POST',
        body: JSON.stringify({ ...work, saveToLibrary: true }),
      });
      return res.json();
    },
  });
};
```

**Files to modify:**
- `src/app/api/works/route.ts` OR
- `src/features/discovery/api/queries.ts`

---

### 1.5 MEDIUM: Search Filters Not Implemented

**Current State:**
- Filter button exists (UnifiedSearch line 79-84) but onClick does nothing
- Backend `/api/search/external` supports: yearFrom, yearTo, openAccess, type
- UI has no filter state or panel

**Fix Required:**
Add filter state and panel to `UnifiedSearch.tsx`:

```typescript
// Add state
const [filters, setFilters] = useState({
  yearFrom: '',
  yearTo: '',
  openAccess: false,
  type: '',
});
const [showFilters, setShowFilters] = useState(false);

// Add filter panel JSX
{showFilters && (
  <div className="p-4 border rounded-lg space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <Input
        label="Year From"
        type="number"
        value={filters.yearFrom}
        onChange={(e) => setFilters(f => ({ ...f, yearFrom: e.target.value }))}
      />
      <Input
        label="Year To"
        type="number"
        value={filters.yearTo}
        onChange={(e) => setFilters(f => ({ ...f, yearTo: e.target.value }))}
      />
    </div>
    <Select
      label="Study Type"
      value={filters.type}
      onValueChange={(v) => setFilters(f => ({ ...f, type: v }))}
    >
      <SelectItem value="">All Types</SelectItem>
      <SelectItem value="journal-article">Journal Article</SelectItem>
      <SelectItem value="review">Review</SelectItem>
      <SelectItem value="meta-analysis">Meta-Analysis</SelectItem>
    </Select>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={filters.openAccess}
        onChange={(e) => setFilters(f => ({ ...f, openAccess: e.target.checked }))}
      />
      Open Access Only
    </label>
  </div>
)}

// Update filter button
<Button variant="ghost" onClick={() => setShowFilters(!showFilters)}>
  <Filter className="w-4 h-4" />
</Button>

// Pass filters to search
useExternalSearch(query, activeTab, filters);
```

**Files to modify:**
- `src/features/discovery/components/UnifiedSearch.tsx`
- `src/features/discovery/api/queries.ts` (add filters to query params)

---

### 1.6 LOW: No Search History

**Current State:**
- No tracking of previous searches
- Users can't revisit or save searches

**Fix Required:**
Add localStorage-based search history:

```typescript
// src/features/discovery/hooks/useSearchHistory.ts
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('searchHistory');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const addToHistory = (query: string) => {
    const updated = [query, ...history.filter(h => h !== query)].slice(0, 10);
    setHistory(updated);
    localStorage.setItem('searchHistory', JSON.stringify(updated));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('searchHistory');
  };

  return { history, addToHistory, clearHistory };
}
```

**Files to create:**
- `src/features/discovery/hooks/useSearchHistory.ts`

---

## Part 2: Library Page Fixes (`/library`)

### 2.1 CRITICAL: Create Folder Button Non-Functional

**Current State:**
- `LibraryManager.tsx` line 94-96: "New Folder" button exists
- onClick just logs to console: `console.log('Create folder')`
- Full CRUD API exists at `/api/library/folders`

**Fix Required:**
Wire button to folder creation dialog:

```typescript
// Add state
const [showCreateFolder, setShowCreateFolder] = useState(false);
const [newFolderName, setNewFolderName] = useState('');

// Add mutation
const createFolderMutation = useMutation({
  mutationFn: async (name: string) => {
    const res = await fetch('/api/library/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: selectedFolder }),
    });
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['library-folders']);
    setShowCreateFolder(false);
    setNewFolderName('');
  },
});

// Update button
<Button onClick={() => setShowCreateFolder(true)}>
  <FolderPlus className="w-4 h-4 mr-2" />
  New Folder
</Button>

// Add dialog
<Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create New Folder</DialogTitle>
    </DialogHeader>
    <Input
      placeholder="Folder name"
      value={newFolderName}
      onChange={(e) => setNewFolderName(e.target.value)}
    />
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
        Cancel
      </Button>
      <Button onClick={() => createFolderMutation.mutate(newFolderName)}>
        Create
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Files to modify:**
- `src/features/library/components/LibraryManager.tsx`

---

### 2.2 CRITICAL: Folder Data Shape Mismatch

**Current State:**
- UI types expect Prisma-like `_count` (`folder._count.items`)
- API response maps counts to `itemCount/subFolderCount` (different shape)
- This causes runtime errors when folders exist

**Fix Required:**
Option A: Update API to match UI expectations:
```typescript
// src/app/api/library/folders/route.ts
// Change response mapping to include _count
const foldersWithCounts = folders.map(folder => ({
  ...folder,
  _count: {
    items: folder._count.items,
    subFolders: folder._count.subFolders,
  },
}));
```

Option B: Update UI to use API shape:
```typescript
// src/features/library/components/LibraryManager.tsx
// Change folder.itemCount instead of folder._count.items
<span>{folder.itemCount} items</span>
```

**Files to modify:**
- `src/app/api/library/folders/route.ts` OR
- `src/features/library/components/LibraryManager.tsx`
- `src/types/library.ts` (update types)

---

### 2.3 HIGH: No Tag Input UI

**Current State:**
- Tags display on items (LibraryManager line 303-310)
- **NO WAY TO ADD TAGS**
- Backend supports tags via PATCH `/api/library/[itemId]`

**Fix Required:**
Add tag input component:

```typescript
// src/features/library/components/TagInput.tsx
export function TagInput({ 
  itemId, 
  currentTags,
  onUpdate 
}: { 
  itemId: string; 
  currentTags: string[];
  onUpdate: () => void;
}) {
  const [newTag, setNewTag] = useState('');

  const addTag = async () => {
    if (!newTag.trim()) return;
    await fetch(`/api/library/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: [...currentTags, newTag.trim()] }),
    });
    setNewTag('');
    onUpdate();
  };

  const removeTag = async (tag: string) => {
    await fetch(`/api/library/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: currentTags.filter(t => t !== tag) }),
    });
    onUpdate();
  };

  return (
    <div className="flex flex-wrap gap-2">
      {currentTags.map(tag => (
        <Badge key={tag} variant="secondary">
          {tag}
          <button onClick={() => removeTag(tag)} className="ml-1">×</button>
        </Badge>
      ))}
      <div className="flex gap-1">
        <Input
          placeholder="Add tag..."
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTag()}
          className="w-24 h-6 text-xs"
        />
        <Button size="sm" onClick={addTag}>+</Button>
      </div>
    </div>
  );
}
```

**Files to create:**
- `src/features/library/components/TagInput.tsx`

**Files to modify:**
- `src/features/library/components/LibraryManager.tsx` (integrate TagInput)

---

### 2.4 HIGH: No Notes Editor

**Current State:**
- Notes display (LibraryManager line 313-316)
- **NO WAY TO ADD/EDIT NOTES**
- Backend supports notes via PATCH `/api/library/[itemId]`

**Fix Required:**
Add notes editor modal:

```typescript
// Add to LibraryManager.tsx
const [editingNotes, setEditingNotes] = useState<string | null>(null);
const [notesContent, setNotesContent] = useState('');

const saveNotes = async () => {
  await fetch(`/api/library/${editingNotes}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: notesContent }),
  });
  queryClient.invalidateQueries(['library-items']);
  setEditingNotes(null);
};

// Add click handler on notes display
<p 
  className="text-sm text-muted-foreground cursor-pointer hover:underline"
  onClick={() => {
    setEditingNotes(item.id);
    setNotesContent(item.notes || '');
  }}
>
  {item.notes || 'Click to add notes...'}
</p>

// Add dialog
<Dialog open={!!editingNotes} onOpenChange={() => setEditingNotes(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit Notes</DialogTitle>
    </DialogHeader>
    <Textarea
      value={notesContent}
      onChange={(e) => setNotesContent(e.target.value)}
      rows={6}
      placeholder="Add your notes here..."
    />
    <DialogFooter>
      <Button variant="outline" onClick={() => setEditingNotes(null)}>
        Cancel
      </Button>
      <Button onClick={saveNotes}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Files to modify:**
- `src/features/library/components/LibraryManager.tsx`

---

### 2.5 MEDIUM: No Bulk Operations

**Current State:**
- Can't select multiple items
- Can't batch-tag, batch-move, batch-delete

**Fix Required:**
Add selection state and bulk action bar:

```typescript
// Add state
const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
const [selectMode, setSelectMode] = useState(false);

// Add checkbox to each item
<input
  type="checkbox"
  checked={selectedItems.has(item.id)}
  onChange={(e) => {
    const newSelected = new Set(selectedItems);
    if (e.target.checked) {
      newSelected.add(item.id);
    } else {
      newSelected.delete(item.id);
    }
    setSelectedItems(newSelected);
  }}
/>

// Add bulk action bar when items selected
{selectedItems.size > 0 && (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg p-4 flex gap-4">
    <span>{selectedItems.size} selected</span>
    <Button variant="outline" onClick={bulkMoveToFolder}>
      Move to Folder
    </Button>
    <Button variant="outline" onClick={bulkAddTags}>
      Add Tags
    </Button>
    <Button variant="destructive" onClick={bulkDelete}>
      Delete
    </Button>
    <Button variant="ghost" onClick={() => setSelectedItems(new Set())}>
      Clear
    </Button>
  </div>
)}
```

**Files to modify:**
- `src/features/library/components/LibraryManager.tsx`

---

### 2.6 MEDIUM: No Export Functionality

**Current State:**
- Can't export library items to BibTeX, RIS, or other formats

**Fix Required:**
Add export API and UI:

```typescript
// src/app/api/library/export/route.ts
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'bibtex';
  const itemIds = searchParams.get('ids')?.split(',');

  const items = await db.libraryItem.findMany({
    where: {
      userId: session.user.id,
      ...(itemIds && { id: { in: itemIds } }),
    },
    include: { work: true },
  });

  let content: string;
  let contentType: string;
  let filename: string;

  switch (format) {
    case 'bibtex':
      content = items.map(item => workToBibtex(item.work)).join('\n\n');
      contentType = 'application/x-bibtex';
      filename = 'library.bib';
      break;
    case 'ris':
      content = items.map(item => workToRIS(item.work)).join('\n');
      contentType = 'application/x-research-info-systems';
      filename = 'library.ris';
      break;
    case 'json':
      content = JSON.stringify(items, null, 2);
      contentType = 'application/json';
      filename = 'library.json';
      break;
    default:
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }

  return new NextResponse(content, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
```

**Files to create:**
- `src/app/api/library/export/route.ts`
- `src/lib/services/citation-export.ts` (BibTeX/RIS formatters)

---

### 2.7 LOW: No Reading Status Filter

**Current State:**
- API supports `readingStatus` filter
- UI doesn't expose it
- Can't filter by "To Read", "Reading", "Completed"

**Fix Required:**
Add reading status filter dropdown:

```typescript
// Add to LibraryManager filter section
<Select
  value={readingStatusFilter}
  onValueChange={setReadingStatusFilter}
>
  <SelectItem value="">All Statuses</SelectItem>
  <SelectItem value="TO_READ">To Read</SelectItem>
  <SelectItem value="READING">Reading</SelectItem>
  <SelectItem value="COMPLETED">Completed</SelectItem>
</Select>
```

**Files to modify:**
- `src/features/library/components/LibraryManager.tsx`

---

## Part 3: Graphs Page Fixes (`/graphs`)

### 3.1 CRITICAL: Connect Project is Fake

**Current State:**
- `CitationGraph.tsx` line 96-97: onClick just loads `MOCK_ELEMENTS`
- Doesn't actually connect to any project or fetch real data
- Full graph API exists at `/api/research/graphs`

**Fix Required:**
Wire "Connect Project" to real API:

```typescript
// Add project selector state
const [showProjectSelect, setShowProjectSelect] = useState(false);
const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

// Fetch user's projects
const { data: projects } = useQuery({
  queryKey: ['projects'],
  queryFn: async () => {
    const res = await fetch('/api/projects');
    return res.json();
  },
});

// Generate graph from project
const generateGraph = async (projectId: string) => {
  const res = await fetch('/api/research/graphs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      type: 'TOPIC_CLUSTER', // or 'CO_AUTHORSHIP'
      name: `Graph for ${projectId}`,
    }),
  });
  const { data } = await res.json();
  
  // Transform to Cytoscape elements
  const elements = transformGraphToElements(data);
  setElements(elements);
};

// Update button
<Button onClick={() => setShowProjectSelect(true)}>
  <Link className="w-4 h-4 mr-2" />
  Connect Project
</Button>

// Add project selector dialog
<Dialog open={showProjectSelect} onOpenChange={setShowProjectSelect}>
  <DialogContent>
    <DialogTitle>Select Project</DialogTitle>
    <Select onValueChange={(id) => {
      generateGraph(id);
      setShowProjectSelect(false);
    }}>
      {projects?.data?.map(p => (
        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
      ))}
    </Select>
  </DialogContent>
</Dialog>
```

**Files to modify:**
- `src/features/graphs/components/CitationGraph.tsx`

---

### 3.2 CRITICAL: Import Bibliography Does Nothing

**Current State:**
- Line 102-103: onClick just logs to console
- No file upload, no RIS/BibTeX parsing

**Fix Required:**
Add file upload and parsing:

```typescript
// Add file input ref
const fileInputRef = useRef<HTMLInputElement>(null);

// Handle file upload
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/research/graphs/import', {
    method: 'POST',
    body: formData,
  });
  const { data } = await res.json();
  setElements(transformGraphToElements(data));
};

// Update button
<Button onClick={() => fileInputRef.current?.click()}>
  <Upload className="w-4 h-4 mr-2" />
  Import Bibliography
</Button>
<input
  ref={fileInputRef}
  type="file"
  accept=".bib,.ris,.xml"
  className="hidden"
  onChange={handleFileUpload}
/>
```

**Files to modify:**
- `src/features/graphs/components/CitationGraph.tsx`

**Files to create:**
- `src/app/api/research/graphs/import/route.ts`

---

### 3.3 HIGH: Graph Controls Non-Functional

**Current State:**
- Zoom In/Out/Fit buttons exist but have no onClick handlers
- GraphControl component renders but does nothing

**Fix Required:**
Wire controls to Cytoscape instance:

```typescript
// src/features/graphs/components/GraphControl.tsx
interface GraphControlProps {
  cyRef: React.RefObject<cytoscape.Core>;
  icon: React.ComponentType;
  label: string;
  action: 'zoom-in' | 'zoom-out' | 'fit' | 'center';
}

export function GraphControl({ cyRef, icon: Icon, label, action }: GraphControlProps) {
  const handleClick = () => {
    const cy = cyRef.current;
    if (!cy) return;

    switch (action) {
      case 'zoom-in':
        cy.zoom(cy.zoom() * 1.2);
        break;
      case 'zoom-out':
        cy.zoom(cy.zoom() / 1.2);
        break;
      case 'fit':
        cy.fit(undefined, 50);
        break;
      case 'center':
        cy.center();
        break;
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleClick} title={label}>
      <Icon className="w-4 h-4" />
    </Button>
  );
}
```

**Files to modify:**
- `src/features/graphs/components/GraphControl.tsx`
- `src/features/graphs/components/CitationGraph.tsx` (pass cyRef)

---

### 3.4 HIGH: Search Node is Cosmetic

**Current State:**
- Search input exists (line 124-130) but has no onChange or search logic
- Can't actually find nodes in the graph

**Fix Required:**
```typescript
// Add search state and handler
const [nodeSearch, setNodeSearch] = useState('');

const handleNodeSearch = (query: string) => {
  setNodeSearch(query);
  if (!cyRef.current || !query) {
    cyRef.current?.elements().removeClass('dimmed highlighted');
    return;
  }

  const cy = cyRef.current;
  const matching = cy.nodes().filter(node => 
    node.data('label')?.toLowerCase().includes(query.toLowerCase())
  );

  cy.elements().addClass('dimmed');
  matching.removeClass('dimmed').addClass('highlighted');
  
  if (matching.length === 1) {
    cy.animate({
      center: { eles: matching },
      zoom: 2,
    }, { duration: 300 });
  }
};

// Update input
<Input
  placeholder="Search nodes..."
  value={nodeSearch}
  onChange={(e) => handleNodeSearch(e.target.value)}
/>
```

**Files to modify:**
- `src/features/graphs/components/CitationGraph.tsx`

---

### 3.5 MEDIUM: Graph Insights are Hardcoded

**Current State:**
- Line 219: "growing 4x faster than traditional meta-analysis"
- Pure placeholder text, not calculated from actual data

**Fix Required:**
Calculate insights from graph data:

```typescript
const calculateInsights = (elements: ElementDefinition[]) => {
  const nodes = elements.filter(e => !e.data.source);
  const edges = elements.filter(e => e.data.source);
  
  // Calculate metrics
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const avgDegree = edgeCount * 2 / nodeCount;
  const density = (2 * edgeCount) / (nodeCount * (nodeCount - 1));
  
  // Find most connected node
  const nodeDegrees = new Map<string, number>();
  edges.forEach(e => {
    nodeDegrees.set(e.data.source, (nodeDegrees.get(e.data.source) || 0) + 1);
    nodeDegrees.set(e.data.target, (nodeDegrees.get(e.data.target) || 0) + 1);
  });
  const mostConnected = [...nodeDegrees.entries()]
    .sort((a, b) => b[1] - a[1])[0];

  return {
    nodeCount,
    edgeCount,
    avgDegree: avgDegree.toFixed(1),
    density: (density * 100).toFixed(1),
    mostConnected: mostConnected ? nodes.find(n => n.data.id === mostConnected[0])?.data.label : null,
  };
};

// Use in UI
const insights = useMemo(() => calculateInsights(elements), [elements]);

<div className="space-y-2">
  <p>{insights.nodeCount} papers, {insights.edgeCount} connections</p>
  <p>Average connections: {insights.avgDegree}</p>
  <p>Network density: {insights.density}%</p>
  {insights.mostConnected && (
    <p>Most connected: {insights.mostConnected}</p>
  )}
</div>
```

**Files to modify:**
- `src/features/graphs/components/CitationGraph.tsx`

---

### 3.6 MEDIUM: No Graph Export

**Current State:**
- Can't export graph as image or data
- No share functionality

**Fix Required:**
```typescript
const exportGraph = async (format: 'png' | 'svg' | 'json') => {
  const cy = cyRef.current;
  if (!cy) return;

  let content: string;
  let filename: string;
  let type: string;

  switch (format) {
    case 'png':
      content = cy.png({ full: true, scale: 2 });
      filename = 'graph.png';
      type = 'image/png';
      break;
    case 'svg':
      content = cy.svg({ full: true });
      filename = 'graph.svg';
      type = 'image/svg+xml';
      break;
    case 'json':
      content = JSON.stringify(cy.json(), null, 2);
      filename = 'graph.json';
      type = 'application/json';
      break;
  }

  const blob = format === 'png' 
    ? await (await fetch(content)).blob()
    : new Blob([content], { type });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Add export buttons
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Export</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => exportGraph('png')}>
      Export as PNG
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => exportGraph('svg')}>
      Export as SVG
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => exportGraph('json')}>
      Export as JSON
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Files to modify:**
- `src/features/graphs/components/CitationGraph.tsx`

---

## Part 4: Writing Page Fixes (`/writing`)

### 4.1 CRITICAL: Drafts Not Persisted

**Current State:**
- All drafts are in local state (line 51-52)
- API routes exist (`/api/writing`) but **UI DOESN'T USE THEM**
- Refresh page = lose all changes

**Fix Required:**
Wire to backend API:

```typescript
// Replace INITIAL_DRAFTS with API query
const { data: drafts, isLoading } = useQuery({
  queryKey: ['writing-projects'],
  queryFn: async () => {
    const res = await fetch('/api/writing');
    const json = await res.json();
    return json.data;
  },
});

// Add save mutation
const saveMutation = useMutation({
  mutationFn: async (draft: { id?: string; title: string; content: string; type: string }) => {
    const url = draft.id ? `/api/writing/${draft.id}` : '/api/writing';
    const method = draft.id ? 'PATCH' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['writing-projects']);
  },
});

// Auto-save on content change (debounced)
const debouncedSave = useDebouncedCallback((content: string) => {
  if (selectedDraft) {
    saveMutation.mutate({ id: selectedDraft.id, content });
  }
}, 2000);

// Wire editor onChange
<RichTextEditor
  content={selectedDraft?.content}
  onChange={(content) => {
    setLocalContent(content);
    debouncedSave(content);
  }}
/>
```

**Files to modify:**
- `src/features/writing/components/WritingAssistant.tsx`

---

### 4.2 CRITICAL: AI Copilot is Fake

**Current State:**
- Line 168-179: Static "Suggested Synthesis" and "Research Gap Detected"
- Send button does nothing (line 191)
- No actual AI integration

**Fix Required:**
Wire to AI assistant API:

```typescript
// Add chat state
const [messages, setMessages] = useState<Array<{role: string; content: string}>>([]);
const [input, setInput] = useState('');
const [isThinking, setIsThinking] = useState(false);

// Send message to AI
const sendMessage = async () => {
  if (!input.trim() || isThinking) return;
  
  const userMessage = { role: 'user', content: input };
  setMessages(prev => [...prev, userMessage]);
  setInput('');
  setIsThinking(true);

  try {
    const res = await fetch('/api/ai/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [...messages, userMessage],
        context: {
          currentContent: selectedDraft?.content,
          projectId: currentProjectId,
        },
      }),
    });
    const { data } = await res.json();
    setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
  } catch (error) {
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: 'Sorry, I encountered an error. Please try again.' 
    }]);
  } finally {
    setIsThinking(false);
  }
};

// Update copilot panel
<div className="flex flex-col h-full">
  <div className="flex-1 overflow-auto space-y-4 p-4">
    {messages.map((msg, i) => (
      <div key={i} className={cn(
        "p-3 rounded-lg",
        msg.role === 'user' ? 'bg-primary/10 ml-8' : 'bg-muted mr-8'
      )}>
        {msg.content}
      </div>
    ))}
    {isThinking && (
      <div className="bg-muted p-3 rounded-lg mr-8 animate-pulse">
        Thinking...
      </div>
    )}
  </div>
  <div className="p-4 border-t flex gap-2">
    <Input
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
      placeholder="Ask for writing help..."
    />
    <Button onClick={sendMessage} disabled={isThinking}>
      Send
    </Button>
  </div>
</div>
```

**Files to modify:**
- `src/features/writing/components/WritingAssistant.tsx`
- `src/app/api/ai/assistant/route.ts` (enhance to actually use OpenAI)

---

### 4.3 HIGH: Citations Not Integrated

**Current State:**
- CITATIONS array is static (line 44-48)
- "Cite" button exists but does nothing
- No way to add citations from library or search

**Fix Required:**
Wire citations to library and enable insertion:

```typescript
// Fetch citations from project sources
const { data: sources } = useQuery({
  queryKey: ['writing-sources', selectedDraft?.id],
  queryFn: async () => {
    if (!selectedDraft?.id) return [];
    const res = await fetch(`/api/writing/${selectedDraft.id}/sources`);
    const json = await res.json();
    return json.data;
  },
  enabled: !!selectedDraft?.id,
});

// Insert citation at cursor
const insertCitation = (source: Source) => {
  if (!editorRef.current) return;
  
  const citation = `[${source.citationKey}]`;
  editorRef.current.chain().focus().insertContent(citation).run();
  
  // Track citation usage
  fetch(`/api/writing/${selectedDraft.id}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workId: source.workId }),
  });
};

// Add citation button handler
<Button size="sm" onClick={() => insertCitation(source)}>
  Cite
</Button>
```

**Files to modify:**
- `src/features/writing/components/WritingAssistant.tsx`

---

### 4.4 HIGH: No Export Options

**Current State:**
- `exportWritingProject()` service supports markdown, HTML, DOCX
- No export button or menu in UI

**Fix Required:**
Add export dropdown:

```typescript
const exportDraft = async (format: 'markdown' | 'html' | 'docx') => {
  const res = await fetch(`/api/writing/${selectedDraft.id}?format=${format}`);
  const blob = await res.blob();
  
  const filename = `${selectedDraft.title}.${format === 'markdown' ? 'md' : format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Add to toolbar
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">
      <Download className="w-4 h-4 mr-2" />
      Export
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => exportDraft('markdown')}>
      Markdown (.md)
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => exportDraft('html')}>
      HTML (.html)
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => exportDraft('docx')}>
      Word (.docx)
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Files to modify:**
- `src/features/writing/components/WritingAssistant.tsx`

---

### 4.5 MEDIUM: No Word Count/Progress

**Current State:**
- Service calculates wordCount, targetLength, progress
- UI doesn't display any progress metrics

**Fix Required:**
```typescript
// Calculate word count from content
const wordCount = useMemo(() => {
  if (!selectedDraft?.content) return 0;
  const text = selectedDraft.content.replace(/<[^>]*>/g, '');
  return text.split(/\s+/).filter(Boolean).length;
}, [selectedDraft?.content]);

// Add to UI
<div className="flex items-center gap-4 text-sm text-muted-foreground">
  <span>{wordCount} words</span>
  <span>~{Math.ceil(wordCount / 200)} min read</span>
  {selectedDraft?.targetLength && (
    <span>{Math.round(wordCount / selectedDraft.targetLength * 100)}% of target</span>
  )}
</div>
```

**Files to modify:**
- `src/features/writing/components/WritingAssistant.tsx`

---

## Part 5: Research Alerts Page Fixes (`/alerts`)

### 5.1 CRITICAL: Response Shape Mismatch

**Current State:**
- UI does `return res.json()` and then uses `alerts.map(...)`
- API returns `{ success, data, meta }` wrapper
- **UI likely crashes after loading**

**Fix Required:**
```typescript
// src/features/alerts/components/ResearchAlerts.tsx
const { data, isLoading } = useQuery({
  queryKey: ['research-alerts'],
  queryFn: async () => {
    const res = await fetch('/api/research/alerts');
    const json = await res.json();
    return json.data; // Extract data from wrapper
  },
});

// Use data.items instead of data directly
{data?.items?.map(alert => (
  // ...
))}
```

**Files to modify:**
- `src/features/alerts/components/ResearchAlerts.tsx`

---

### 5.2 HIGH: No Alert Creation UI

**Current State:**
- Backend supports creating alerts
- No UI to create new alerts

**Fix Required:**
Add alert creation form:

```typescript
// Add to ResearchAlerts.tsx
const [showCreate, setShowCreate] = useState(false);
const [newAlert, setNewAlert] = useState({
  name: '',
  type: 'KEYWORD',
  keywords: [],
  journals: [],
  frequency: 'WEEKLY',
});

const createAlert = async () => {
  await fetch('/api/research/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newAlert),
  });
  queryClient.invalidateQueries(['research-alerts']);
  setShowCreate(false);
};

// Add create dialog
<Dialog open={showCreate} onOpenChange={setShowCreate}>
  <DialogContent>
    <DialogTitle>Create Research Alert</DialogTitle>
    <div className="space-y-4">
      <Input
        label="Alert Name"
        value={newAlert.name}
        onChange={(e) => setNewAlert(a => ({ ...a, name: e.target.value }))}
      />
      <Select
        label="Alert Type"
        value={newAlert.type}
        onValueChange={(v) => setNewAlert(a => ({ ...a, type: v }))}
      >
        <SelectItem value="KEYWORD">Keyword Match</SelectItem>
        <SelectItem value="AUTHOR">Author</SelectItem>
        <SelectItem value="JOURNAL">Journal</SelectItem>
      </Select>
      {/* Add keyword/journal inputs based on type */}
    </div>
    <DialogFooter>
      <Button onClick={createAlert}>Create Alert</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Files to create:**
- Update `src/features/alerts/components/ResearchAlerts.tsx`

---

## Part 6: Semantic Search Infrastructure (Major Feature)

This is required for the "Semantic Bridge" tab and AI theme generation.

### 6.1 Database Schema Updates

```prisma
// Add to prisma/schema.prisma

model Work {
  // ... existing fields
  embedding          String?   @db.Text // JSON array of floats
  embeddingModel     String?   // e.g., "text-embedding-3-small"
  embeddingUpdatedAt DateTime?
}
```

### 6.2 Embedding Service

```typescript
// src/lib/services/embeddings.ts
import OpenAI from 'openai';
import { db } from '@/lib/db';

const openai = new OpenAI();

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // Token limit
  });
  return response.data[0].embedding;
}

export async function embedWork(workId: string): Promise<void> {
  const work = await db.work.findUnique({ where: { id: workId } });
  if (!work) throw new Error('Work not found');

  const text = `${work.title}\n\n${work.abstract || ''}`;
  const embedding = await generateEmbedding(text);

  await db.work.update({
    where: { id: workId },
    data: {
      embedding: JSON.stringify(embedding),
      embeddingModel: 'text-embedding-3-small',
      embeddingUpdatedAt: new Date(),
    },
  });
}

export async function batchEmbedWorks(workIds: string[]): Promise<void> {
  for (const workId of workIds) {
    await embedWork(workId);
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function semanticSearch(
  query: string,
  workIds: string[],
  limit: number = 20
): Promise<Array<{ workId: string; score: number }>> {
  const queryEmbedding = await generateEmbedding(query);

  const works = await db.work.findMany({
    where: {
      id: { in: workIds },
      embedding: { not: null },
    },
    select: { id: true, embedding: true },
  });

  const scored = works.map(work => ({
    workId: work.id,
    score: cosineSimilarity(queryEmbedding, JSON.parse(work.embedding!)),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

### 6.3 Semantic Search API Route

```typescript
// src/app/api/search/semantic/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { semanticSearch } from '@/lib/services/embeddings';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const projectId = searchParams.get('projectId');

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  // Get works to search (from project or library)
  let workIds: string[];
  
  if (projectId) {
    const projectWorks = await db.projectWork.findMany({
      where: { projectId },
      select: { workId: true },
    });
    workIds = projectWorks.map(pw => pw.workId);
  } else {
    const libraryItems = await db.libraryItem.findMany({
      where: { userId: session.user.id },
      select: { workId: true },
    });
    workIds = libraryItems.map(li => li.workId);
  }

  if (workIds.length === 0) {
    return NextResponse.json({
      success: true,
      data: { results: [] },
      meta: { message: 'No works to search' },
    });
  }

  const results = await semanticSearch(query, workIds);

  // Fetch full work data for results
  const works = await db.work.findMany({
    where: { id: { in: results.map(r => r.workId) } },
  });

  const enrichedResults = results.map(r => ({
    ...works.find(w => w.id === r.workId),
    relevanceScore: r.score,
  }));

  return NextResponse.json({
    success: true,
    data: { results: enrichedResults },
  });
}
```

---

## Part 7: AI Theme Generation (Partner's Request)

**What partners want:**
> "After cleaning extracted data, AI model discusses included documents with self-described or automatic theme generation"

### 7.1 Theme Database Schema

```prisma
// Add to prisma/schema.prisma

model Theme {
  id          String   @id @default(cuid())
  projectId   String
  name        String
  description String   @db.Text
  isAutomatic Boolean  @default(false)
  keywords    String[]
  confidence  Float?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String

  project     Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy   User           @relation(fields: [createdById], references: [id])
  studies     ThemeStudy[]
  messages    ThemeMessage[]
}

model ThemeStudy {
  id        String   @id @default(cuid())
  themeId   String
  studyId   String
  relevance Float?
  createdAt DateTime @default(now())

  theme Theme       @relation(fields: [themeId], references: [id], onDelete: Cascade)
  study ProjectWork @relation(fields: [studyId], references: [id], onDelete: Cascade)

  @@unique([themeId, studyId])
}

model ThemeMessage {
  id        String   @id @default(cuid())
  themeId   String?
  projectId String
  userId    String
  role      String   // 'user' | 'assistant'
  content   String   @db.Text
  citations Json?
  createdAt DateTime @default(now())

  theme   Theme?  @relation(fields: [themeId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id])
}
```

### 7.2 Theme Generation Service

```typescript
// src/lib/services/thematic-analysis.ts
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { cosineSimilarity } from './embeddings';

const openai = new OpenAI();

interface GeneratedTheme {
  name: string;
  description: string;
  keywords: string[];
  studyIds: string[];
  confidence: number;
}

export async function generateThemes(projectId: string): Promise<GeneratedTheme[]> {
  // 1. Get included studies with embeddings
  const studies = await db.projectWork.findMany({
    where: {
      projectId,
      screeningStatus: 'INCLUDED',
      work: { embedding: { not: null } },
    },
    include: { work: true },
  });

  if (studies.length < 3) {
    throw new Error('Need at least 3 included studies to generate themes');
  }

  // 2. Cluster studies by embedding similarity (simple k-means)
  const k = Math.min(5, Math.ceil(studies.length / 3));
  const clusters = kMeansClustering(
    studies.map(s => ({
      id: s.id,
      embedding: JSON.parse(s.work.embedding!),
      title: s.work.title,
      abstract: s.work.abstract,
    })),
    k
  );

  // 3. Generate theme labels using GPT-4
  const themes: GeneratedTheme[] = [];

  for (const cluster of clusters) {
    const studyTexts = cluster.items
      .slice(0, 5)
      .map(s => `- ${s.title}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a research synthesis expert. Generate a concise theme name and description based on the provided studies.',
        },
        {
          role: 'user',
          content: `Based on these related studies, generate a theme:\n\n${studyTexts}\n\nRespond in JSON format: { "name": "...", "description": "...", "keywords": ["...", "..."] }`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const themeData = JSON.parse(response.choices[0].message.content!);

    themes.push({
      name: themeData.name,
      description: themeData.description,
      keywords: themeData.keywords,
      studyIds: cluster.items.map(s => s.id),
      confidence: cluster.coherence,
    });
  }

  return themes;
}

function kMeansClustering(
  items: Array<{ id: string; embedding: number[]; title: string; abstract: string | null }>,
  k: number
): Array<{ items: typeof items; coherence: number }> {
  // Simple k-means implementation
  // Initialize centroids randomly
  const centroids = items
    .sort(() => Math.random() - 0.5)
    .slice(0, k)
    .map(item => item.embedding);

  let clusters: Map<number, typeof items> = new Map();
  
  // Iterate until convergence (max 10 iterations)
  for (let iter = 0; iter < 10; iter++) {
    clusters = new Map();
    
    // Assign items to nearest centroid
    for (const item of items) {
      let bestCluster = 0;
      let bestSimilarity = -1;
      
      for (let i = 0; i < centroids.length; i++) {
        const similarity = cosineSimilarity(item.embedding, centroids[i]);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = i;
        }
      }
      
      if (!clusters.has(bestCluster)) {
        clusters.set(bestCluster, []);
      }
      clusters.get(bestCluster)!.push(item);
    }
    
    // Update centroids
    for (let i = 0; i < centroids.length; i++) {
      const clusterItems = clusters.get(i) || [];
      if (clusterItems.length > 0) {
        const newCentroid = new Array(centroids[i].length).fill(0);
        for (const item of clusterItems) {
          for (let j = 0; j < item.embedding.length; j++) {
            newCentroid[j] += item.embedding[j];
          }
        }
        centroids[i] = newCentroid.map(v => v / clusterItems.length);
      }
    }
  }

  // Calculate cluster coherence
  return Array.from(clusters.entries()).map(([idx, items]) => {
    const centroid = centroids[idx];
    const similarities = items.map(item => 
      cosineSimilarity(item.embedding, centroid)
    );
    const coherence = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    
    return { items, coherence };
  });
}
```

### 7.3 Theme Chat Service (RAG)

```typescript
// src/lib/services/theme-chat.ts
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { semanticSearch } from './embeddings';

const openai = new OpenAI();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{ studyId: string; title: string; quote: string }>;
}

export async function chatWithTheme(
  projectId: string,
  themeId: string | null,
  messages: ChatMessage[],
  userId: string
): Promise<ChatMessage> {
  // 1. Get relevant studies
  let studyIds: string[];
  
  if (themeId) {
    const themeStudies = await db.themeStudy.findMany({
      where: { themeId },
      select: { studyId: true },
    });
    studyIds = themeStudies.map(ts => ts.studyId);
  } else {
    const projectWorks = await db.projectWork.findMany({
      where: { projectId, screeningStatus: 'INCLUDED' },
      select: { id: true },
    });
    studyIds = projectWorks.map(pw => pw.id);
  }

  // 2. Semantic search for relevant context
  const userQuery = messages[messages.length - 1].content;
  const workIds = await db.projectWork.findMany({
    where: { id: { in: studyIds } },
    select: { workId: true },
  }).then(pws => pws.map(pw => pw.workId));

  const relevantWorks = await semanticSearch(userQuery, workIds, 5);

  // 3. Build context from relevant studies
  const studies = await db.work.findMany({
    where: { id: { in: relevantWorks.map(r => r.workId) } },
  });

  const context = studies
    .map(s => `[${s.id}] ${s.title}\nAbstract: ${s.abstract || 'N/A'}`)
    .join('\n\n---\n\n');

  // 4. Generate response with citations
  const systemPrompt = `You are a research synthesis assistant helping analyze a systematic review.
You have access to the following studies:

${context}

When answering questions:
1. Base your answers on the provided studies
2. Cite specific studies using their IDs in brackets, e.g., [study-id]
3. If information is not in the studies, say so
4. Be concise but thorough`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
  });

  const assistantContent = response.choices[0].message.content!;

  // 5. Extract citations from response
  const citationPattern = /\[([^\]]+)\]/g;
  const citedIds = [...assistantContent.matchAll(citationPattern)]
    .map(m => m[1])
    .filter(id => studies.some(s => s.id === id));

  const citations = citedIds.map(id => {
    const study = studies.find(s => s.id === id)!;
    return {
      studyId: id,
      title: study.title,
      quote: study.abstract?.slice(0, 200) || '',
    };
  });

  // 6. Save message to database
  await db.themeMessage.create({
    data: {
      themeId,
      projectId,
      userId,
      role: 'assistant',
      content: assistantContent,
      citations: citations,
    },
  });

  return {
    role: 'assistant',
    content: assistantContent,
    citations,
  };
}
```

### 7.4 Theme API Routes

```typescript
// src/app/api/projects/[id]/themes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateThemes } from '@/lib/services/thematic-analysis';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const themes = await db.theme.findMany({
    where: { projectId: params.id },
    include: {
      studies: { include: { study: { include: { work: true } } } },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ success: true, data: themes });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === 'generate') {
    // Auto-generate themes
    const generatedThemes = await generateThemes(params.id);

    const createdThemes = await Promise.all(
      generatedThemes.map(async (theme) => {
        const created = await db.theme.create({
          data: {
            projectId: params.id,
            name: theme.name,
            description: theme.description,
            keywords: theme.keywords,
            confidence: theme.confidence,
            isAutomatic: true,
            createdById: session.user.id,
          },
        });

        // Link studies to theme
        await db.themeStudy.createMany({
          data: theme.studyIds.map(studyId => ({
            themeId: created.id,
            studyId,
          })),
        });

        return created;
      })
    );

    return NextResponse.json({ success: true, data: createdThemes });
  }

  // Manual theme creation
  const { name, description, studyIds } = body;

  const theme = await db.theme.create({
    data: {
      projectId: params.id,
      name,
      description,
      isAutomatic: false,
      createdById: session.user.id,
    },
  });

  if (studyIds?.length) {
    await db.themeStudy.createMany({
      data: studyIds.map((studyId: string) => ({
        themeId: theme.id,
        studyId,
      })),
    });
  }

  return NextResponse.json({ success: true, data: theme });
}
```

```typescript
// src/app/api/projects/[id]/themes/[themeId]/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { chatWithTheme } from '@/lib/services/theme-chat';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; themeId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messages } = await request.json();
  const themeId = params.themeId === 'all' ? null : params.themeId;

  const response = await chatWithTheme(
    params.id,
    themeId,
    messages,
    session.user.id
  );

  return NextResponse.json({ success: true, data: response });
}
```

### 7.5 Themes UI Page

```typescript
// src/app/(app)/project/[id]/themes/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sparkles, MessageSquare, Plus } from 'lucide-react';

export default function ThemesPage({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient();
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{role: string; content: string}>>([]);
  const [input, setInput] = useState('');

  const { data: themes, isLoading } = useQuery({
    queryKey: ['themes', params.id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${params.id}/themes`);
      const json = await res.json();
      return json.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${params.id}/themes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['themes', params.id]);
    },
  });

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setChatMessages(prev => [...prev, userMessage]);
    setInput('');

    const themeId = selectedTheme || 'all';
    const res = await fetch(`/api/projects/${params.id}/themes/${themeId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...chatMessages, userMessage] }),
    });
    const { data } = await res.json();
    setChatMessages(prev => [...prev, data]);
  };

  return (
    <div className="flex h-full">
      {/* Theme List */}
      <div className="w-1/3 border-r p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Themes</h2>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {generateMutation.isPending ? 'Generating...' : 'Auto-Generate'}
          </Button>
        </div>

        {themes?.map((theme: any) => (
          <Card
            key={theme.id}
            className={`p-4 cursor-pointer ${selectedTheme === theme.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedTheme(theme.id)}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{theme.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {theme.description}
                </p>
              </div>
              {theme.isAutomatic && (
                <Badge variant="secondary">Auto</Badge>
              )}
            </div>
            <div className="mt-2 flex gap-1 flex-wrap">
              {theme.keywords?.slice(0, 3).map((kw: string) => (
                <Badge key={kw} variant="outline" className="text-xs">
                  {kw}
                </Badge>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {theme.studies?.length || 0} studies
            </div>
          </Card>
        ))}

        <Button variant="outline" className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Create Manual Theme
        </Button>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">
            {selectedTheme
              ? `Discussing: ${themes?.find((t: any) => t.id === selectedTheme)?.name}`
              : 'Discuss All Included Studies'}
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {chatMessages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Ask questions about the studies in this theme</p>
              <p className="text-sm mt-2">
                e.g., "What are the main findings?" or "How do these studies compare?"
              </p>
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-primary/10 ml-8'
                  : 'bg-muted mr-8'
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>

        <div className="p-4 border-t flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about the studies..."
          />
          <Button onClick={sendMessage}>Send</Button>
        </div>
      </div>
    </div>
  );
}
```

---

## Part 8: Implementation Priority Matrix

### P0 - Critical (Blocking Basic Functionality)
**Timeline: 1 week**

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Create `/api/search/internal` route | 4h | HIGH | New route |
| Create `/api/search/semantic` stub | 2h | MEDIUM | New route |
| Create `/api/projects/[id]/works` route | 4h | HIGH | New route |
| Fix "Save to Library" double-add | 2h | HIGH | works/route.ts or queries.ts |
| Wire "Create Folder" button | 3h | HIGH | LibraryManager.tsx |
| Fix folder data shape mismatch | 2h | HIGH | API or UI types |
| Wire drafts to backend API | 4h | HIGH | WritingAssistant.tsx |
| Fix alerts response shape | 2h | HIGH | ResearchAlerts.tsx |

**Total: ~3 days**

---

### P1 - High Priority (Core Feature Completion)
**Timeline: 2 weeks**

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Add tag input UI | 4h | MEDIUM | New component + LibraryManager |
| Add notes editor | 3h | MEDIUM | LibraryManager.tsx |
| Wire graph "Connect Project" | 6h | HIGH | CitationGraph.tsx |
| Wire graph controls | 4h | MEDIUM | GraphControl.tsx |
| Add graph node search | 3h | MEDIUM | CitationGraph.tsx |
| Wire AI copilot to real API | 8h | HIGH | WritingAssistant.tsx |
| Wire citations to library | 6h | HIGH | WritingAssistant.tsx |
| Add export options to writing | 4h | MEDIUM | WritingAssistant.tsx |
| Add search filters UI | 6h | MEDIUM | UnifiedSearch.tsx |

**Total: ~6 days**

---

### P2 - Medium Priority (Feature Enhancement)
**Timeline: 3-4 weeks**

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Bulk operations in library | 8h | MEDIUM | LibraryManager.tsx |
| Library export (BibTeX/RIS) | 8h | MEDIUM | New API + service |
| Graph export (PNG/SVG) | 4h | LOW | CitationGraph.tsx |
| Graph insights calculation | 6h | MEDIUM | CitationGraph.tsx |
| Word count/progress in writing | 3h | LOW | WritingAssistant.tsx |
| Search history | 4h | LOW | New hook |
| Alert creation UI | 6h | MEDIUM | ResearchAlerts.tsx |
| Reading status filter | 2h | LOW | LibraryManager.tsx |

**Total: ~5 days**

---

### P3 - Major Features (Semantic/AI)
**Timeline: 4-6 weeks**

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Embedding service | 16h | HIGH | New service |
| Semantic search implementation | 16h | HIGH | New service + API |
| Theme database schema | 4h | HIGH | Prisma migration |
| Theme generation service | 24h | HIGH | New service |
| Theme chat (RAG) service | 20h | HIGH | New service |
| Themes UI page | 16h | HIGH | New page + components |
| Evidence linking | 8h | MEDIUM | Theme enhancement |

**Total: ~13 days**

---

## Part 9: Database Migrations Required

### Migration 1: Embeddings Support
```sql
ALTER TABLE "Work" ADD COLUMN "embedding" TEXT;
ALTER TABLE "Work" ADD COLUMN "embeddingModel" TEXT;
ALTER TABLE "Work" ADD COLUMN "embeddingUpdatedAt" TIMESTAMP;
```

### Migration 2: Themes System
```sql
CREATE TABLE "Theme" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "isAutomatic" BOOLEAN DEFAULT false,
  "keywords" TEXT[],
  "confidence" FLOAT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP,
  "createdById" TEXT NOT NULL REFERENCES "User"("id")
);

CREATE TABLE "ThemeStudy" (
  "id" TEXT PRIMARY KEY,
  "themeId" TEXT NOT NULL REFERENCES "Theme"("id") ON DELETE CASCADE,
  "studyId" TEXT NOT NULL REFERENCES "ProjectWork"("id") ON DELETE CASCADE,
  "relevance" FLOAT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("themeId", "studyId")
);

CREATE TABLE "ThemeMessage" (
  "id" TEXT PRIMARY KEY,
  "themeId" TEXT REFERENCES "Theme"("id") ON DELETE CASCADE,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "citations" JSONB,
  "createdAt" TIMESTAMP DEFAULT NOW()
);
```

---

## Part 10: Quick Wins (< 4 hours each)

1. **Create internal search stub** (2h)
   - Return empty results with helpful message until full implementation

2. **Wire folder creation** (3h)
   - Just connect existing button to existing API

3. **Fix alerts response parsing** (1h)
   - Change `data` to `data.items` in component

4. **Add word count to writing** (2h)
   - Simple calculation from content

5. **Add graph export as PNG** (3h)
   - Cytoscape has built-in png() method

6. **Add reading status filter** (2h)
   - Just a dropdown wired to existing API param

7. **Wire graph zoom controls** (2h)
   - Just call cy.zoom() methods

8. **Add search history to localStorage** (3h)
   - Simple hook with localStorage persistence

---

## Part 11: Success Metrics

### Functionality Metrics
- **Internal search works**: Can find items in library
- **Semantic search works**: Returns relevant results by meaning
- **Folders work**: Can create, rename, delete folders
- **Tags work**: Can add/remove tags from items
- **Graphs show real data**: Connected to actual project studies
- **Writing saves**: Drafts persist across sessions
- **AI copilot responds**: Real AI responses, not static text
- **Themes generate**: Can auto-generate themes from studies
- **Theme chat works**: Can discuss studies with AI

### Quality Metrics
- **Theme relevance**: User satisfaction with auto-generated themes
- **Chat accuracy**: Citations match actual study content
- **Search precision**: Relevant results in top 10

### Performance Metrics
- **Embedding generation**: < 5s for 100 studies
- **Semantic search**: < 2s response time
- **Theme generation**: < 30s for 50 studies
- **Chat response**: < 5s per message

---

## Part 12: Dependencies & Infrastructure

### Required API Keys
- **OpenAI API Key**: For embeddings + chat
  - Model: `text-embedding-3-small` (embeddings)
  - Model: `gpt-4-turbo-preview` (chat/themes)
  - Estimated cost: ~$0.10 per 1000 studies embedded, ~$0.03 per chat message

### No Additional Infrastructure Needed
- Embeddings stored as JSON strings in PostgreSQL (no vector DB needed initially)
- Cosine similarity calculated in JavaScript
- Can migrate to pgvector or Pinecone later if scale requires

---

## Conclusion

The Intelligence tab has **excellent UI design** but is currently a **presentation prototype** with most features non-functional. The fixes are organized into:

1. **P0 (1 week)**: Fix broken routes and wire existing buttons
2. **P1 (2 weeks)**: Complete core feature functionality
3. **P2 (3-4 weeks)**: Enhance with secondary features
4. **P3 (4-6 weeks)**: Add semantic search and AI themes

The partner's requested feature (AI theme discussion) requires the full P3 implementation including:
- Embedding infrastructure
- Clustering algorithms
- RAG-based chat system
- Theme management UI

**Recommended approach**: Start with P0 fixes to make the app usable, then prioritize P3 if AI themes are a hard requirement for partners.

