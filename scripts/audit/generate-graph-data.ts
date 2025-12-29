import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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
  const auditDir = resolve(__dirname, '../../audit-output');
  
  if (!existsSync(auditDir)) {
    console.error('Error: audit-output directory not found. Please run other audit scripts first.');
    process.exit(1);
  }

  const schemaData = JSON.parse(
    readFileSync(resolve(auditDir, 'schema-analysis.json'), 'utf-8')
  );
  const apiData = JSON.parse(
    readFileSync(resolve(auditDir, 'api-routes-analysis.json'), 'utf-8')
  );
  const frontendData = JSON.parse(
    readFileSync(resolve(auditDir, 'frontend-routes-analysis.json'), 'utf-8')
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
    const pathParts = route.path.split('/').filter(Boolean);
    const domain = pathParts[1] || 'other'; // /api/projects → projects

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

    // Create edges from DB to API
    const tables = route.tables.split(', ').filter(Boolean);
    tables.forEach((table: string) => {
      const dbId = `db_${table.toLowerCase()}`;
      if (nodes.some(n => n.data.id === dbId)) {
        edges.push({
          data: {
            source: dbId,
            target: routeId,
            type: route.methods.includes('GET') ? 'read' : 'write',
            weight: 5,
          },
        });
      }
    });
  });

  // Generate UI nodes
  frontendData.routes.forEach((route: any) => {
    if (!route.path) return;
    
    const routeId = `ui_${route.path.replace(/[/:]/g, '_')}`;
    const pathParts = route.path.split('/').filter(Boolean);
    const domain = pathParts[0] || 'root';

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

    // Create edges from API to UI
    if (route.apis) {
      const apis = route.apis.split(', ').filter(Boolean);
      apis.forEach((api: string) => {
        const apiId = `api_${api.replace(/[/:]/g, '_')}`;
        if (nodes.some(n => n.data.id === apiId)) {
          edges.push({
            data: {
              source: apiId,
              target: routeId,
              type: 'fetch',
              weight: 3,
            },
          });
        }
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
try {
  const graphData = generateGraphData();
  
  // Ensure output directory exists
  try {
    mkdirSync(resolve(__dirname, '../../audit-output'), { recursive: true });
  } catch (e) {
    // Directory already exists
  }

  writeFileSync(
    resolve(__dirname, '../../audit-output/graph-data.json'),
    JSON.stringify(graphData, null, 2)
  );

  console.log(`✅ Generated graph with ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`);
  console.log(`📊 Orphaned nodes: ${graphData.nodes.filter(n => n.data.coverage === 'orphan').length}`);
  console.log(`📄 Graph data saved to audit-output/graph-data.json`);
} catch (error) {
  console.error('Error generating graph data:', error);
  process.exit(1);
}

