import { existsSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

export interface ProjectInfo {
  name: string;
  description: string;
  version?: string;
  includes: string[];
  excludes: string[];
}

const SOURCE_ROOTS = ['src', 'lib', 'app', 'packages'];
const DEFAULT_EXCLUDES = ['node_modules/**', 'dist/**', '.git/**'];

function readJson(filePath: string): Record<string, unknown> | null {
  try { return JSON.parse(readFileSync(filePath, 'utf-8')); } catch { return null; }
}

function readTextFile(filePath: string): string | null {
  try { return readFileSync(filePath, 'utf-8'); } catch { return null; }
}

function parseTomlValue(content: string, key: string): string | undefined {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm'));
  return match?.[1];
}

function detectFrameworks(dir: string): string[] {
  const frameworks: string[] = [];
  const pkg = readJson(join(dir, 'package.json')) as Record<string, Record<string, string>> | null;
  if (!pkg) return frameworks;
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (allDeps.react || allDeps['react-dom']) frameworks.push('React');
  if (allDeps.next) frameworks.push('Next.js');
  if (allDeps.vue) frameworks.push('Vue');
  if (allDeps['@angular/core']) frameworks.push('Angular');
  if (allDeps.svelte) frameworks.push('Svelte');
  if (allDeps.express) frameworks.push('Express');
  if (allDeps['@nestjs/core']) frameworks.push('NestJS');
  if (allDeps.fastify) frameworks.push('Fastify');
  if (allDeps.vite) frameworks.push('Vite');
  if (allDeps.typescript) frameworks.push('TypeScript');
  return frameworks;
}

function detectIncludes(dir: string): string[] {
  const includes: string[] = [];
  for (const root of SOURCE_ROOTS) {
    if (existsSync(join(dir, root))) includes.push(`${root}/**`);
  }
  return includes.length > 0 ? includes : ['**'];
}

function detectExcludes(dir: string): string[] {
  const excludes = new Set(DEFAULT_EXCLUDES);
  const gitignore = readTextFile(join(dir, '.gitignore'));
  if (gitignore) {
    for (const line of gitignore.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const clean = trimmed.replace(/^\//, '').replace(/\/$/, '');
      if (clean && !clean.includes('*')) excludes.add(`${clean}/**`);
    }
  }
  return [...excludes];
}

export function detectProject(dir: string): ProjectInfo {
  const fallbackName = basename(dir);
  let name = fallbackName;
  let description = '';
  let version: string | undefined;

  // package.json (highest priority)
  const pkg = readJson(join(dir, 'package.json'));
  if (pkg) {
    if (typeof pkg.name === 'string') name = pkg.name;
    if (typeof pkg.description === 'string') description = pkg.description;
    if (typeof pkg.version === 'string') version = pkg.version;
  }

  // go.mod
  if (!pkg) {
    const gomod = readTextFile(join(dir, 'go.mod'));
    if (gomod) {
      const match = gomod.match(/^module\s+(\S+)/m);
      if (match) name = match[1].split('/').pop() ?? fallbackName;
    }
  }

  // pyproject.toml
  if (!pkg && !existsSync(join(dir, 'go.mod'))) {
    const pyproject = readTextFile(join(dir, 'pyproject.toml'));
    if (pyproject) {
      name = parseTomlValue(pyproject, 'name') ?? fallbackName;
      description = parseTomlValue(pyproject, 'description') ?? '';
      version = parseTomlValue(pyproject, 'version');
    }
  }

  // Cargo.toml
  if (!pkg && !existsSync(join(dir, 'go.mod')) && !existsSync(join(dir, 'pyproject.toml'))) {
    const cargo = readTextFile(join(dir, 'Cargo.toml'));
    if (cargo) {
      name = parseTomlValue(cargo, 'name') ?? fallbackName;
      description = parseTomlValue(cargo, 'description') ?? '';
      version = parseTomlValue(cargo, 'version');
    }
  }

  // composer.json
  if (!pkg && !existsSync(join(dir, 'go.mod')) && !existsSync(join(dir, 'pyproject.toml')) && !existsSync(join(dir, 'Cargo.toml'))) {
    const composer = readJson(join(dir, 'composer.json'));
    if (composer) {
      const composerName = typeof composer.name === 'string' ? composer.name : '';
      name = composerName.includes('/') ? composerName.split('/').pop()! : composerName || fallbackName;
      if (typeof composer.description === 'string') description = composer.description;
    }
  }

  // Enrich with frameworks
  const frameworks = detectFrameworks(dir);
  if (frameworks.length > 0 && !description) {
    description = `${frameworks.join(' + ')} project`;
  } else if (frameworks.length > 0) {
    description = `${description} (${frameworks.join(', ')})`;
  }

  return {
    name,
    description: description || `Project: ${name}`,
    version,
    includes: detectIncludes(dir),
    excludes: detectExcludes(dir),
  };
}
