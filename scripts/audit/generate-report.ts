import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

function generateMarkdownReport() {
  const auditDir = resolve(__dirname, '../../audit-output');
  
  if (!existsSync(auditDir)) {
    console.error('Error: audit-output directory not found. Please run other audit scripts first.');
    process.exit(1);
  }

  const schema = JSON.parse(readFileSync(resolve(auditDir, 'schema-analysis.json'), 'utf-8'));
  const api = JSON.parse(readFileSync(resolve(auditDir, 'api-routes-analysis.json'), 'utf-8'));
  const frontend = JSON.parse(readFileSync(resolve(auditDir, 'frontend-routes-analysis.json'), 'utf-8'));
  const graph = JSON.parse(readFileSync(resolve(auditDir, 'graph-data.json'), 'utf-8'));

  const orphanedNodes = graph.nodes.filter((n: any) => n.data.coverage === 'orphan');

  const report = `# LitLens Product Audit Report
**Generated**: ${new Date().toLocaleString()}

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

${orphanedNodes.length === 0 ? '*No orphaned entities found!*' : orphanedNodes.map((node: any) => `- **${node.data.label}** (${node.data.type}) - ${node.data.domain} domain`).join('\n')}

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

#### Routes Missing Authentication
${api.routes.filter((r: any) => r.auth === '❌').length === 0 ? '*All routes are authenticated!*' : api.routes.filter((r: any) => r.auth === '❌').slice(0, 10).map((r: any) => `- ${r.methods} ${r.path}`).join('\n')}

#### Routes Missing Validation
${api.routes.filter((r: any) => r.validation === '❌').length === 0 ? '*All routes have validation!*' : api.routes.filter((r: any) => r.validation === '❌').slice(0, 10).map((r: any) => `- ${r.methods} ${r.path}`).join('\n')}

---

## Frontend Route Analysis

### Total Pages: ${frontend.totalPages}
### With Loading States: ${frontend.pagesWithLoading} (${((frontend.pagesWithLoading / frontend.totalPages) * 100).toFixed(1)}%)
### With Error Handling: ${frontend.pagesWithError} (${((frontend.pagesWithError / frontend.totalPages) * 100).toFixed(1)}%)

#### Pages Missing Loading States
${frontend.routes.filter((r: any) => r.loading === '❌').length === 0 ? '*All pages have loading states!*' : frontend.routes.filter((r: any) => r.loading === '❌').slice(0, 10).map((r: any) => `- ${r.path}`).join('\n')}

#### Pages Missing Error Handling
${frontend.routes.filter((r: any) => r.error === '❌').length === 0 ? '*All pages have error handling!*' : frontend.routes.filter((r: any) => r.error === '❌').slice(0, 10).map((r: any) => `- ${r.path}`).join('\n')}

---

## Graph Statistics

### Node Distribution
- **Database Nodes**: ${graph.nodes.filter((n: any) => n.data.type === 'database').length}
- **API Nodes**: ${graph.nodes.filter((n: any) => n.data.type === 'api').length}
- **UI Nodes**: ${graph.nodes.filter((n: any) => n.data.type === 'ui').length}

### Coverage Distribution
- **Full Coverage**: ${graph.nodes.filter((n: any) => n.data.coverage === 'full').length}
- **Partial Coverage**: ${graph.nodes.filter((n: any) => n.data.coverage === 'partial').length}
- **Orphaned**: ${graph.nodes.filter((n: any) => n.data.coverage === 'orphan').length}

---

## Recommended Actions

### Priority 1: Fix Orphaned Entities
${orphanedNodes.length} entities have no connection to the UI. Consider:
- Delete unused database tables/API routes
- Build missing UI components for implemented backend features

### Priority 2: Add Authentication
${api.totalRoutes - api.authProtectedCount} routes lack authentication. Review security model.

### Priority 3: Implement Loading States
${frontend.totalPages - frontend.pagesWithLoading} pages need loading UX improvements.

### Priority 4: Add Error Handling
${frontend.totalPages - frontend.pagesWithError} pages need error handling improvements.

---

## Next Steps

1. **Review Orphaned Entities** - Decide: Delete or Implement?
2. **Fix Critical Routes** - Add auth/validation to unprotected endpoints
3. **Enhance UX** - Add loading/error states to all pages
4. **Update Documentation** - Document all API routes and UI patterns

---

**View interactive graph**: Run \`npm run dev\` and navigate to \`/audit\`

**Generated by**: LitLens Audit Framework
`;

  writeFileSync(resolve(auditDir, 'AUDIT_REPORT.md'), report);
  console.log('✅ Audit report generated: audit-output/AUDIT_REPORT.md');
}

try {
  generateMarkdownReport();
} catch (error) {
  console.error('Error generating report:', error);
  process.exit(1);
}

