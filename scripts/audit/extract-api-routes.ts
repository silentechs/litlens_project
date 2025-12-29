import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
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

  try {
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
          content.includes('verifySession') ||
          content.includes('authenticateRequest') ||
          content.includes('auth(');

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
  } catch (error) {
    console.warn(`Warning: Could not scan directory ${dir}`);
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

  // Ensure output directory exists
  try {
    mkdirSync(resolve(__dirname, '../../audit-output'), { recursive: true });
  } catch (e) {
    // Directory already exists
  }

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

