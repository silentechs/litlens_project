import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
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
  
  try {
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
  } catch (error) {
    console.warn(`Warning: Could not scan directory ${dir}`);
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

  // Ensure output directory exists
  try {
    mkdirSync(resolve(__dirname, '../../audit-output'), { recursive: true });
  } catch (e) {
    // Directory already exists
  }

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

