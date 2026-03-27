import * as fs from 'node:fs';
import * as path from 'node:path';
import { minimatch } from 'minimatch';
import { table } from '../../utils/markdown.js';

export interface DetectEndpointsOptions {
  exclude?: string[];
}

interface EndpointMatch {
  method: string;
  path: string;
  file: string;
  line: number;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all'];

// Patterns to detect:
// .get('/path'), .post("/path"), router.put('/path'), app.delete('/path')
// @Get('/path'), @Post('/path'), @Put('/path'), etc. (NestJS/TypeScript decorators)
// @app.get('/path'), @app.route('/path') (Python Flask)
// router.route('/path').get(...) — partial, we focus on route registration

const PATTERNS: Array<{ regex: RegExp; methodGroup: number; pathGroup: number }> = [
  // Express/Hapi style: .get('/path'), router.post('/path'), app.put('/path')
  {
    regex: /\.(get|post|put|patch|delete|head|options|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    methodGroup: 1,
    pathGroup: 2,
  },
  // NestJS decorators: @Get('/path'), @Post('/path')
  {
    regex: /@(Get|Post|Put|Patch|Delete|Head|Options|All)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    methodGroup: 1,
    pathGroup: 2,
  },
  // Python Flask: @app.get('/path'), @app.route('/path', methods=['GET'])
  {
    regex: /@\w+\.(get|post|put|patch|delete|route)\s*\(\s*['"]([^'"]+)['"]/gi,
    methodGroup: 1,
    pathGroup: 2,
  },
  // Python Flask route with methods: @app.route('/path', methods=['POST'])
  {
    regex: /@\w+\.route\s*\(\s*['"]([^'"]+)['"](?:[^)]*methods\s*=\s*\[['"]([A-Z]+)['"]\])?/gi,
    methodGroup: 2,
    pathGroup: 1,
  },
];

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.js', '.tsx', '.jsx', '.py']);

function getAllFiles(dir: string, excludePatterns: string[]): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(current, entry.name);
      const relative = path.relative(dir, fullPath);

      if (excludePatterns.some((p) => minimatch(relative, p, { dot: true }))) continue;

      if (entry.isDirectory()) {
        // Skip node_modules and dist by default
        if (['node_modules', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

function scanFileForEndpoints(filePath: string, repoDir: string): EndpointMatch[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const lines = content.split('\n');
  const matches: EndpointMatch[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    for (const pattern of PATTERNS) {
      // Reset regex lastIndex
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.regex.exec(line)) !== null) {
        const rawMethod = match[pattern.methodGroup];
        const rawPath = match[pattern.pathGroup];

        if (!rawMethod || !rawPath) continue;

        const method = rawMethod.toUpperCase();
        const relativePath = path.relative(repoDir, filePath);

        // Avoid duplicate matches on same line
        const alreadyAdded = matches.some(
          (m) => m.line === lineIdx + 1 && m.path === rawPath && m.method === method,
        );

        if (!alreadyAdded) {
          matches.push({
            method,
            path: rawPath,
            file: relativePath,
            line: lineIdx + 1,
          });
        }
      }
    }
  }

  return matches;
}

export function detectEndpoints(repoDir: string, options: DetectEndpointsOptions = {}): string {
  const { exclude = [] } = options;

  const files = getAllFiles(repoDir, exclude);
  const allMatches: EndpointMatch[] = [];

  for (const file of files) {
    allMatches.push(...scanFileForEndpoints(file, repoDir));
  }

  const sections: string[] = ['# Detected Endpoints', ''];

  if (allMatches.length === 0) {
    sections.push('_No HTTP route patterns detected._');
    return sections.join('\n');
  }

  sections.push(`**Total:** ${allMatches.length} endpoint(s) detected across ${files.length} file(s)`, '');

  const rows = allMatches.map((m) => [m.method, m.path, m.file, String(m.line)]);
  sections.push(table(['Method', 'Path', 'File', 'Line'], rows));

  return sections.join('\n');
}
