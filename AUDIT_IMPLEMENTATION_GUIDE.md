# AUDIT IMPLEMENTATION GUIDE
**Executable Scripts & Visualization Components**

---

## QUICK START

This guide provides ready-to-use scripts and components to execute the Product Audit Framework.

---

## 1. DATA EXTRACTION SCRIPTS

### 1.1 Schema Parser Script

Create `scripts/audit/parse-schema.ts`:

```typescript
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface PrismaModel {
  name: string;
  fields: Array<{
    name: string;
    type: string;
    isRequired: boolean;
    isUnique: boolean;
    relation?: string;
  }>;
  relations: string[];
}

function parseSchema(schemaPath: string): PrismaModel[] {
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  const models: PrismaModel[] = [];

  // Simple regex-based parser (enhance with proper AST parser for production)
  const modelRegex = /model\s+(\w+)\s*{([^}]*)}/g;
  let modelMatch;

  while ((modelMatch = modelRegex.exec(schemaContent)) !== null) {
    const [, modelName, fieldsBlock] = modelMatch;
    const fields: PrismaModel['fields'] = [];
    const relations: string[] = [];

    const fieldRegex = /(\w+)\s+(\w+)(\[\])?\s*(@.*)?/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(fieldsBlock)) !== null) {
      const [, fieldName, fieldType, isArray, decorators] = fieldMatch;
      
      // Detect relations
      if (decorators?.includes('@relation')) {
        const relationMatch = decorators.match(/fields:\s*\[(\w+)\]/);
        if (relationMatch) {
          relations.push(fieldType + (isArray ? '[]' : ''));
        }
      }

      fields.push({
        name: fieldName,
        type: fieldType + (isArray || ''),
        isRequired: !decorators?.includes('?'),
        isUnique: decorators?.includes('@unique') || false,
        relation: decorators?.includes('@relation') ? fieldType : undefined,
      });
    }

    models.push({ name: modelName, fields, relations });
  }

  return models;
}

function generateSchemaReport(models: PrismaModel[]) {
  const report = {
    totalModels: models.length,
    totalRelations: models.reduce((sum, m) => sum + m.relations.length, 0),
    models: models.map(m => ({
      name: m.name,
      fieldCount: m.fields.length,
      relationCount: m.relations.length,
      relations: m.relations,
    })),
  };

  writeFileSync(
    resolve(__dirname, '../../audit-output/schema-analysis.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(`✅ Analyzed ${models.length} models with ${report.totalRelations} relations`);
  console.log(`📄 Report saved to audit-output/schema-analysis.json`);
}

// Execute
const schemaPath = resolve(__dirname, '../../prisma/schema.prisma');
const models = parseSchema(schemaPath);
generateSchemaReport(models);
```

**Run**: `npx tsx scripts/audit/parse-schema.ts`

---

### 1.2 API Route Extractor

Create `scripts/audit/extract-api-routes.ts`:

```typescript
import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

interface APIRoute {
  path: string;
  methods: string[];
  file: string;
  lineCount: number;
  hasAuth: boolean;
  hasValidation: boolean;
  databaseTables: string[];
}

function scanDirectory(dir: string, baseDir: string = ''): APIRoute[] {
  const routes: APIRoute[] = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      routes.push(...scanDirectory(fullPath, baseDir || dir));
    } else if (item === 'route.ts') {
      const content = readFileSync(fullPath, 'utf-8');
      const relativePath = fullPath.replace(baseDir || dir, '').replace('/route.ts', '');
      
      // Extract HTTP methods
      const methods: string[] = [];
      if (content.includes('export async function GET')) methods.push('GET');
      if (content.includes('export async function POST')) methods.push('POST');
      if (content.includes('export async function PATCH')) methods.push('PATCH');
      if (content.includes('export async function DELETE')) methods.push('DELETE');
      if (content.includes('export async function PUT')) methods.push('PUT');

      // Check for auth
      const hasAuth = content.includes('getServerSession') || 
                       content.includes('requireAuth') ||
                       content.includes('verifySession');

      // Check for validation
      const hasValidation = content.includes('.parse(') || 
                            content.includes('.safeParse(') ||
                            content.includes('zod');

      // Extract database table usage (simple regex)
      const tableMatches = content.matchAll(/prisma\.(\w+)\./g);
      const databaseTables = Array.from(new Set(
        Array.from(tableMatches).map(m => m[1])
      ));

      // Line count
      const lineCount = content.split('\n').length;

      routes.push({
        path: relativePath.replace(/\[(\w+)\]/g, ':$1'), // Convert [id] to :id
        methods,
        file: fullPath.replace(process.cwd(), ''),
        lineCount,
        hasAuth,
        hasValidation,
        databaseTables,
      });
    }
  }

  return routes;
}

function generateAPIReport(routes: APIRoute[]) {
  const report = {
    totalRoutes: routes.length,
    totalMethods: routes.reduce((sum, r) => sum + r.methods.length, 0),
    authProtectedCount: routes.filter(r => r.hasAuth).length,
    validatedCount: routes.filter(r => r.hasValidation).length,
    routes: routes.map(r => ({
      path: r.path,
      methods: r.methods.join(', '),
      auth: r.hasAuth ? '✅' : '❌',
      validation: r.hasValidation ? '✅' : '❌',
      tables: r.databaseTables.join(', '),
      complexity: r.lineCount > 200 ? '🔴 High' : r.lineCount > 100 ? '🟡 Medium' : '🟢 Low',
    })),
  };

  writeFileSync(
    resolve(__dirname, '../../audit-output/api-routes-analysis.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(`✅ Found ${routes.length} API routes`);
  console.log(`🔒 ${report.authProtectedCount} routes with authentication`);
  console.log(`✔️  ${report.validatedCount} routes with validation`);
  console.log(`📄 Report saved to audit-output/api-routes-analysis.json`);
}

// Execute
const apiDir = resolve(__dirname, '../../src/app/api');
const routes = scanDirectory(apiDir);
generateAPIReport(routes);
```

**Run**: `npx tsx scripts/audit/extract-api-routes.ts`

---

### 1.3 Frontend Route Scanner

Create `scripts/audit/scan-frontend-routes.ts`:

```typescript
import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

interface FrontendRoute {
  path: string;
  file: string;
  type: 'page' | 'layout' | 'error' | 'loading';
  apiCalls: string[];
  componentCount: number;
  hasLoading: boolean;
  hasError: boolean;
  lineCount: number;
}

function scanAppDirectory(dir: string, basePath: string = ''): FrontendRoute[] {
  const routes: FrontendRoute[] = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip route groups (folders starting with parentheses)
      const newPath = item.startsWith('(') 
        ? basePath 
        : `${basePath}/${item}`.replace(/\[(\w+)\]/g, ':$1');
      
      routes.push(...scanAppDirectory(fullPath, newPath));
    } else if (item.match(/^(page|layout|loading|error|not-found)\.tsx$/)) {
      const content = readFileSync(fullPath, 'utf-8');
      const type = item.replace('.tsx', '') as FrontendRoute['type'];

      // Extract API calls
      const apiCallMatches = content.matchAll(/['"`]\/api\/([^'"`]+)['"`]/g);
      const apiCalls = Array.from(new Set(
        Array.from(apiCallMatches).map(m => `/api/${m[1]}`)
      ));

      // Count components (rough estimate)
      const componentMatches = content.match(/function\s+\w+|const\s+\w+\s*=/g);
      const componentCount = componentMatches?.length || 0;

      // Check for loading/error states
      const hasLoading = content.includes('isLoading') || 
                         content.includes('isPending') ||
                         content.includes('Spinner');
      const hasError = content.includes('isError') || 
                       content.includes('error') ||
                       content.includes('Error');

      const lineCount = content.split('\n').length;

      routes.push({
        path: basePath || '/',
        file: fullPath.replace(process.cwd(), ''),
        type,
        apiCalls,
        componentCount,
        hasLoading,
        hasError,
        lineCount,
      });
    }
  }

  return routes;
}

function generateFrontendReport(routes: FrontendRoute[]) {
  const pages = routes.filter(r => r.type === 'page');
  
  const report = {
    totalPages: pages.length,
    totalLayouts: routes.filter(r => r.type === 'layout').length,
    pagesWithLoading: pages.filter(r => r.hasLoading).length,
    pagesWithError: pages.filter(r => r.hasError).length,
    routes: pages.map(r => ({
      path: r.path,
      apiCalls: r.apiCalls.length,
      apis: r.apiCalls.join(', '),
      loading: r.hasLoading ? '✅' : '❌',
      error: r.hasError ? '✅' : '❌',
      complexity: r.lineCount > 300 ? '🔴 High' : r.lineCount > 150 ? '🟡 Medium' : '🟢 Low',
    })),
  };

  writeFileSync(
    resolve(__dirname, '../../audit-output/frontend-routes-analysis.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(`✅ Found ${pages.length} pages`);
  console.log(`⏳ ${report.pagesWithLoading} pages with loading states`);
  console.log(`❌ ${report.pagesWithError} pages with error handling`);
  console.log(`📄 Report saved to audit-output/frontend-routes-analysis.json`);
}

// Execute
const appDir = resolve(__dirname, '../../src/app');
const routes = scanAppDirectory(appDir);
generateFrontendReport(routes);
```

**Run**: `npx tsx scripts/audit/scan-frontend-routes.ts`

---

## 2. GRAPH DATA GENERATOR

### 2.1 Create Mapping Graph Data

Create `scripts/audit/generate-graph-data.ts`:

```typescript
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface GraphNode {
  data: {
    id: string;
    label: string;
    type: 'database' | 'api' | 'ui';
    coverage: 'full' | 'partial' | 'orphan';
    size: number;
    domain: string;
    metadata?: Record<string, any>;
  };
}

interface GraphEdge {
  data: {
    source: string;
    target: string;
    type: 'read' | 'write' | 'fetch';
    weight: number;
  };
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function loadAnalysisData() {
  const schemaData = JSON.parse(
    readFileSync(resolve(__dirname, '../../audit-output/schema-analysis.json'), 'utf-8')
  );
  const apiData = JSON.parse(
    readFileSync(resolve(__dirname, '../../audit-output/api-routes-analysis.json'), 'utf-8')
  );
  const frontendData = JSON.parse(
    readFileSync(resolve(__dirname, '../../audit-output/frontend-routes-analysis.json'), 'utf-8')
  );

  return { schemaData, apiData, frontendData };
}

function generateGraphData(): GraphData {
  const { schemaData, apiData, frontendData } = loadAnalysisData();
  
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Domain classification
  const domainMap: Record<string, string> = {
    User: 'auth',
    Account: 'auth',
    Session: 'auth',
    Organization: 'organization',
    Project: 'project',
    ProjectWork: 'screening',
    Screening: 'screening',
    Conflict: 'screening',
    Extraction: 'extraction',
    Quality: 'quality',
    Library: 'library',
    Research: 'research',
    Writing: 'writing',
  };

  // Generate DB nodes
  schemaData.models.forEach((model: any) => {
    const domain = Object.keys(domainMap).find(key => model.name.includes(key)) || 'other';
    
    nodes.push({
      data: {
        id: `db_${model.name.toLowerCase()}`,
        label: model.name,
        type: 'database',
        coverage: 'partial', // Will be updated based on API/UI connections
        size: model.relationCount,
        domain: domainMap[model.name] || domain,
        metadata: {
          fieldCount: model.fieldCount,
          relations: model.relations,
        },
      },
    });
  });

  // Generate API nodes
  apiData.routes.forEach((route: any) => {
    const routeId = `api_${route.path.replace(/[/:]/g, '_')}`;
    const domain = route.path.split('/')[2] || 'other'; // /api/projects → projects

    nodes.push({
      data: {
        id: routeId,
        label: `${route.methods} ${route.path}`,
        type: 'api',
        coverage: route.auth === '✅' && route.validation === '✅' ? 'full' : 'partial',
        size: route.complexity === '🔴 High' ? 3 : route.complexity === '🟡 Medium' ? 2 : 1,
        domain,
        metadata: {
          methods: route.methods,
          auth: route.auth === '✅',
          validation: route.validation === '✅',
          tables: route.tables.split(', ').filter(Boolean),
        },
      },
    });

    // Create edges from API to DB
    const tables = route.tables.split(', ').filter(Boolean);
    tables.forEach((table: string) => {
      edges.push({
        data: {
          source: `db_${table.toLowerCase()}`,
          target: routeId,
          type: route.methods.includes('GET') ? 'read' : 'write',
          weight: 5,
        },
      });
    });
  });

  // Generate UI nodes
  frontendData.routes.forEach((route: any) => {
    if (!route.path) return;
    
    const routeId = `ui_${route.path.replace(/[/:]/g, '_')}`;
    const domain = route.path.split('/')[1] || 'root';

    nodes.push({
      data: {
        id: routeId,
        label: route.path,
        type: 'ui',
        coverage: route.loading === '✅' && route.error === '✅' ? 'full' : 'partial',
        size: route.complexity === '🔴 High' ? 3 : route.complexity === '🟡 Medium' ? 2 : 1,
        domain,
        metadata: {
          apiCalls: route.apiCalls || 0,
          hasLoading: route.loading === '✅',
          hasError: route.error === '✅',
        },
      },
    });

    // Create edges from UI to API (simplified - would need API call extraction)
    if (route.apis) {
      const apis = route.apis.split(', ').filter(Boolean);
      apis.forEach((api: string) => {
        const apiId = `api_${api.replace(/[/:]/g, '_')}`;
        edges.push({
          data: {
            source: apiId,
            target: routeId,
            type: 'fetch',
            weight: 3,
          },
        });
      });
    }
  });

  // Update coverage based on connections
  nodes.forEach(node => {
    const hasOutgoing = edges.some(e => e.data.source === node.data.id);
    const hasIncoming = edges.some(e => e.data.target === node.data.id);
    
    if (!hasOutgoing && !hasIncoming) {
      node.data.coverage = 'orphan';
    } else if (hasOutgoing && hasIncoming) {
      node.data.coverage = 'full';
    }
  });

  return { nodes, edges };
}

// Execute
const graphData = generateGraphData();
writeFileSync(
  resolve(__dirname, '../../audit-output/graph-data.json'),
  JSON.stringify(graphData, null, 2)
);

console.log(`✅ Generated graph with ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`);
console.log(`📊 Orphaned nodes: ${graphData.nodes.filter(n => n.data.coverage === 'orphan').length}`);
console.log(`📄 Graph data saved to audit-output/graph-data.json`);
```

**Run**: `npx tsx scripts/audit/generate-graph-data.ts`

---

## 3. VISUALIZATION COMPONENT

### 3.1 Network Graph Component

Create `src/app/(app)/audit/page.tsx`:

```typescript
'use client';

import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import graphData from '@/../audit-output/graph-data.json';

cytoscape.use(fcose);

export default function AuditGraphPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cy, setCy] = useState<cytoscape.Core | null>(null);
  const [stats, setStats] = useState({
    totalNodes: 0,
    orphanedNodes: 0,
    dbNodes: 0,
    apiNodes: 0,
    uiNodes: 0,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const instance = cytoscape({
      container: containerRef.current,
      elements: graphData as any,
      style: [
        // Database nodes (circular)
        {
          selector: 'node[type="database"]',
          style: {
            'background-color': (ele) => {
              const coverage = ele.data('coverage');
              if (coverage === 'full') return '#10B981';
              if (coverage === 'partial') return '#F59E0B';
              return '#EF4444';
            },
            'shape': 'ellipse',
            'width': (ele) => Math.max(30, ele.data('size') * 15),
            'height': (ele) => Math.max(30, ele.data('size') * 15),
            'label': 'data(label)',
            'font-size': '11px',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#fff',
            'text-outline-color': '#000',
            'text-outline-width': 1,
            'border-width': 2,
            'border-color': '#fff',
          },
        },
        // API nodes (rectangular)
        {
          selector: 'node[type="api"]',
          style: {
            'background-color': (ele) => {
              const coverage = ele.data('coverage');
              if (coverage === 'full') return '#3B82F6';
              if (coverage === 'partial') return '#8B5CF6';
              return '#EF4444';
            },
            'shape': 'roundrectangle',
            'width': (ele) => Math.max(80, ele.data('size') * 40),
            'height': 35,
            'label': 'data(label)',
            'font-size': '9px',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#fff',
            'text-outline-color': '#000',
            'text-outline-width': 1,
            'text-wrap': 'wrap',
            'text-max-width': 120,
          },
        },
        // UI nodes (hexagonal)
        {
          selector: 'node[type="ui"]',
          style: {
            'background-color': (ele) => {
              const coverage = ele.data('coverage');
              if (coverage === 'full') return '#10B981';
              if (coverage === 'partial') return '#F59E0B';
              return '#6B7280';
            },
            'shape': 'hexagon',
            'width': (ele) => Math.max(60, ele.data('size') * 30),
            'height': (ele) => Math.max(60, ele.data('size') * 30),
            'label': 'data(label)',
            'font-size': '10px',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#fff',
            'text-outline-color': '#000',
            'text-outline-width': 1,
            'text-wrap': 'wrap',
            'text-max-width': 100,
          },
        },
        // Edges
        {
          selector: 'edge',
          style: {
            'width': (ele) => Math.max(1, ele.data('weight') / 2),
            'line-color': (ele) => {
              const type = ele.data('type');
              if (type === 'read') return '#3B82F6';
              if (type === 'write') return '#10B981';
              return '#8B5CF6';
            },
            'target-arrow-color': (ele) => {
              const type = ele.data('type');
              if (type === 'read') return '#3B82F6';
              if (type === 'write') return '#10B981';
              return '#8B5CF6';
            },
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.6,
          },
        },
        // Highlighted state
        {
          selector: '.highlighted',
          style: {
            'opacity': 1,
            'z-index': 999,
          },
        },
        {
          selector: '.faded',
          style: {
            'opacity': 0.15,
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
        padding: 50,
        nodeSeparation: 120,
        idealEdgeLength: 150,
        edgeElasticity: 0.45,
        nestingFactor: 0.1,
        gravity: 0.25,
        numIter: 2500,
        tile: true,
      },
    });

    // Calculate stats
    const nodes = instance.nodes();
    setStats({
      totalNodes: nodes.length,
      orphanedNodes: nodes.filter(n => n.data('coverage') === 'orphan').length,
      dbNodes: nodes.filter(n => n.data('type') === 'database').length,
      apiNodes: nodes.filter(n => n.data('type') === 'api').length,
      uiNodes: nodes.filter(n => n.data('type') === 'ui').length,
    });

    // Interactivity
    instance.on('tap', 'node', (evt) => {
      const node = evt.target;
      const connected = node.neighborhood().add(node);
      instance.elements().removeClass('highlighted').addClass('faded');
      connected.removeClass('faded').addClass('highlighted');
      
      // Show details panel
      console.log('Node data:', node.data());
    });

    instance.on('tap', (evt) => {
      if (evt.target === instance) {
        instance.elements().removeClass('highlighted faded');
      }
    });

    setCy(instance);

    return () => instance.destroy();
  }, []);

  const handleExportPNG = () => {
    if (!cy) return;
    const png = cy.png({ scale: 2 });
    const link = document.createElement('a');
    link.href = png;
    link.download = 'litlens-audit-graph.png';
    link.click();
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(graphData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'graph-data.json';
    link.click();
  };

  const handleResetView = () => {
    if (!cy) return;
    cy.fit(undefined, 50);
    cy.elements().removeClass('highlighted faded');
  };

  return (
    <div className="relative w-full h-screen bg-slate-950">
      {/* Graph Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Stats Panel */}
      <div className="absolute top-4 left-4 bg-slate-900/95 text-white p-6 rounded-lg shadow-2xl border border-slate-700 backdrop-blur">
        <h2 className="text-xl font-semibold mb-4 text-blue-400">LitLens Audit Graph</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-8">
            <span className="text-slate-400">Total Nodes:</span>
            <span className="font-mono font-semibold">{stats.totalNodes}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-slate-400">DB Tables:</span>
            <span className="font-mono text-green-400">{stats.dbNodes}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-slate-400">API Endpoints:</span>
            <span className="font-mono text-blue-400">{stats.apiNodes}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-slate-400">UI Routes:</span>
            <span className="font-mono text-purple-400">{stats.uiNodes}</span>
          </div>
          <div className="flex justify-between gap-8 pt-2 border-t border-slate-700">
            <span className="text-slate-400">Orphaned:</span>
            <span className="font-mono text-red-400 font-bold">{stats.orphanedNodes}</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-slate-900/95 text-white p-6 rounded-lg shadow-2xl border border-slate-700 backdrop-blur">
        <h3 className="font-semibold mb-3 text-blue-400">Legend</h3>
        
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-400 mb-2">Node Types</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500" />
                <span>Database Tables</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-3 rounded bg-blue-500" />
                <span>API Endpoints</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 hexagon bg-purple-500" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
                <span>UI Routes</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-2">Coverage Status</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500" />
                <span>Full</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500" />
                <span>Partial</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500" />
                <span>Orphaned</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-2">Edge Types</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-blue-500" />
                <span>Read</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-green-500" />
                <span>Write</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-purple-500" />
                <span>Fetch</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 bg-slate-900/95 text-white p-4 rounded-lg shadow-2xl border border-slate-700 backdrop-blur">
        <div className="space-y-2">
          <button
            onClick={handleExportPNG}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
          >
            Export PNG
          </button>
          <button
            onClick={handleExportJSON}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={handleResetView}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium transition-colors"
          >
            Reset View
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-slate-900/95 text-white p-4 rounded-lg shadow-2xl border border-slate-700 backdrop-blur max-w-xs">
        <p className="text-xs text-slate-400">
          <strong className="text-white">Click</strong> a node to highlight connections<br />
          <strong className="text-white">Scroll</strong> to zoom<br />
          <strong className="text-white">Drag</strong> to pan
        </p>
      </div>
    </div>
  );
}
```

---

## 4. EXECUTION WORKFLOW

### Step-by-Step Audit Execution

1. **Create Output Directory**
   ```bash
   mkdir -p audit-output
   ```

2. **Run Data Extraction Scripts**
   ```bash
   # Parse Prisma schema
   npx tsx scripts/audit/parse-schema.ts
   
   # Extract API routes
   npx tsx scripts/audit/extract-api-routes.ts
   
   # Scan frontend routes
   npx tsx scripts/audit/scan-frontend-routes.ts
   ```

3. **Generate Graph Data**
   ```bash
   npx tsx scripts/audit/generate-graph-data.ts
   ```

4. **View Interactive Graph**
   ```bash
   # Start dev server
   npm run dev
   
   # Navigate to http://localhost:3000/audit
   ```

5. **Export Visualizations**
   - Click "Export PNG" for high-res image
   - Click "Export JSON" for raw data
   - Use for presentations and documentation

---

## 5. COMPETITOR FEATURE EXTRACTION

### Automated Screenshot Analysis (Manual Process)

Create a checklist to systematically review competitor screenshots:

**ResearchRabbit Features Checklist**:
- [ ] Citation timeline visualization (year-based layout)
- [ ] Similar papers recommendation engine
- [ ] Author collaboration networks
- [ ] Collections with smart suggestions
- [ ] Interactive graph with pan/zoom
- [ ] Export as image option

**SciSpace Features Checklist**:
- [ ] Chat interface for papers (Q&A)
- [ ] Multi-source deep search (21+ sources)
- [ ] Auto literature review generation
- [ ] Data visualization builder
- [ ] LaTeX export
- [ ] Paper annotation tools

**Semantic Scholar Features Checklist**:
- [ ] Highly influential citations metric
- [ ] ML-based paper recommendations
- [ ] Citation context snippets
- [ ] TLDR AI summaries
- [ ] Field of study tagging
- [ ] Author profiles with publication history

**CiteTrue Features Checklist**:
- [ ] Citation verification system
- [ ] Confidence scoring (HIGH/MEDIUM/LOW)
- [ ] Fake citation detection
- [ ] Source validation

---

## 6. AUDIT REPORT GENERATION

### Markdown Report Generator

Create `scripts/audit/generate-report.ts`:

```typescript
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function generateMarkdownReport() {
  const schema = JSON.parse(readFileSync(resolve(__dirname, '../../audit-output/schema-analysis.json'), 'utf-8'));
  const api = JSON.parse(readFileSync(resolve(__dirname, '../../audit-output/api-routes-analysis.json'), 'utf-8'));
  const frontend = JSON.parse(readFileSync(resolve(__dirname, '../../audit-output/frontend-routes-analysis.json'), 'utf-8'));
  const graph = JSON.parse(readFileSync(resolve(__dirname, '../../audit-output/graph-data.json'), 'utf-8'));

  const orphanedNodes = graph.nodes.filter((n: any) => n.data.coverage === 'orphan');

  const report = `# LitLens Product Audit Report
**Generated**: ${new Date().toLocaleDateString()}

---

## Executive Summary

### Overall Statistics
- **Database Tables**: ${schema.totalModels}
- **API Endpoints**: ${api.totalRoutes}
- **Frontend Pages**: ${frontend.totalPages}
- **Orphaned Entities**: ${orphanedNodes.length}

### Coverage Scores
- **API Coverage**: ${((api.authProtectedCount / api.totalRoutes) * 100).toFixed(1)}% authenticated
- **Validation Coverage**: ${((api.validatedCount / api.totalRoutes) * 100).toFixed(1)}% validated
- **UI Loading States**: ${((frontend.pagesWithLoading / frontend.totalPages) * 100).toFixed(1)}% complete
- **UI Error Handling**: ${((frontend.pagesWithError / frontend.totalPages) * 100).toFixed(1)}% complete

---

## Critical Findings

### Orphaned Entities (${orphanedNodes.length})

${orphanedNodes.map((node: any) => `- **${node.data.label}** (${node.data.type})`).join('\n')}

---

## Database Schema Analysis

### Total Tables: ${schema.totalModels}
### Total Relations: ${schema.totalRelations}

#### Top Tables by Relation Count
${schema.models
  .sort((a: any, b: any) => b.relationCount - a.relationCount)
  .slice(0, 10)
  .map((m: any, i: number) => `${i + 1}. **${m.name}** - ${m.relationCount} relations`)
  .join('\n')}

---

## API Endpoint Analysis

### Total Routes: ${api.totalRoutes}
### Authenticated: ${api.authProtectedCount} (${((api.authProtectedCount / api.totalRoutes) * 100).toFixed(1)}%)
### Validated: ${api.validatedCount} (${((api.validatedCount / api.totalRoutes) * 100).toFixed(1)}%)

#### Missing Authentication
${api.routes.filter((r: any) => r.auth === '❌').map((r: any) => `- ${r.methods} ${r.path}`).join('\n')}

---

## Frontend Route Analysis

### Total Pages: ${frontend.totalPages}
### With Loading States: ${frontend.pagesWithLoading}
### With Error Handling: ${frontend.pagesWithError}

#### Missing Loading States
${frontend.routes.filter((r: any) => r.loading === '❌').map((r: any) => `- ${r.path}`).join('\n')}

---

## Recommended Actions

1. **Fix Orphaned Entities**: ${orphanedNodes.length} entities have no UI connection
2. **Add Authentication**: ${api.totalRoutes - api.authProtectedCount} routes lack auth
3. **Implement Loading States**: ${frontend.totalPages - frontend.pagesWithLoading} pages need loading UX
4. **Add Error Handling**: ${frontend.totalPages - frontend.pagesWithError} pages need error UX

---

**End of Report**
`;

  writeFileSync(resolve(__dirname, '../../audit-output/AUDIT_REPORT.md'), report);
  console.log('✅ Audit report generated: audit-output/AUDIT_REPORT.md');
}

generateMarkdownReport();
```

**Run**: `npx tsx scripts/audit/generate-report.ts`

---

## 7. PACKAGE.JSON SCRIPTS

Add to `package.json`:

```json
{
  "scripts": {
    "audit:schema": "tsx scripts/audit/parse-schema.ts",
    "audit:api": "tsx scripts/audit/extract-api-routes.ts",
    "audit:frontend": "tsx scripts/audit/scan-frontend-routes.ts",
    "audit:graph": "tsx scripts/audit/generate-graph-data.ts",
    "audit:report": "tsx scripts/audit/generate-report.ts",
    "audit:all": "npm run audit:schema && npm run audit:api && npm run audit:frontend && npm run audit:graph && npm run audit:report"
  }
}
```

**Usage**:
```bash
npm run audit:all
```

---

## 8. FINAL DELIVERABLES

After running all scripts, you'll have:

1. **JSON Data Files** (`audit-output/`):
   - `schema-analysis.json`
   - `api-routes-analysis.json`
   - `frontend-routes-analysis.json`
   - `graph-data.json`

2. **Markdown Report**:
   - `AUDIT_REPORT.md`

3. **Interactive Visualization**:
   - `/audit` page (Cytoscape graph)

4. **Export Assets**:
   - PNG graph image
   - JSON graph data

---

## TROUBLESHOOTING

**Issue**: Graph is too cluttered
- **Solution**: Add domain filter (show only "screening" domain)

**Issue**: Some API routes not detected
- **Solution**: Enhance regex in `extract-api-routes.ts`

**Issue**: Graph layout is messy
- **Solution**: Adjust `fcose` layout parameters (increase `nodeSeparation`)

**Issue**: Missing edges between UI and API
- **Solution**: Improve API call detection in `scan-frontend-routes.ts`

---

**END OF IMPLEMENTATION GUIDE**

