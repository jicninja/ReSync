# Spec Kit & BMAD Export Formats — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `speckit` and `bmad` as export formats to ReSpec, following the existing FormatAdapter pattern.

**Architecture:** Two new FormatAdapter implementations + shared utilities (bounded context parser, framework installer). Existing FormatContext extended with `specsDir`, `config`, and `ciMode`. Both `export.ts` and `generate.ts` updated to pass new context fields.

**Tech Stack:** TypeScript ESM, vitest, @clack/prompts, node:child_process

**Spec:** `docs/superpowers/specs/2026-03-29-speckit-bmad-export-design.md`

---

### Task 1: Extend FormatContext and update callers

**Files:**
- Modify: `src/formats/types.ts`
- Modify: `src/commands/export.ts`
- Modify: `src/commands/generate.ts`
- Modify: `tests/formats/kiro.test.ts`
- Modify: `tests/formats/openspec.test.ts`
- Modify: `tests/formats/antigravity.test.ts`
- Modify: `tests/formats/superpowers.test.ts`

- [ ] **Step 1: Update FormatContext interface**

In `src/formats/types.ts`, add three new fields:

```typescript
import type { ReSpecConfig } from '../config/schema.js';

export interface FormatAdapter {
  name: string;
  package(specsDir: string, outputDir: string, context: FormatContext): Promise<void>;
}

export interface FormatContext {
  projectName: string;
  projectDescription: string;
  sddContent: string;
  analyzedDir: string;
  specsDir: string;
  config: ReSpecConfig;
  ciMode: boolean;
}
```

- [ ] **Step 2: Update export.ts to pass new fields**

In `src/commands/export.ts`, update the context object (around line 30-35):

```typescript
const context = {
  projectName: config.project.name,
  projectDescription: config.project.description ?? '',
  sddContent,
  analyzedDir: analyzedPath,
  specsDir: inputDir,
  config,
  ciMode: !!options.ci,
};
```

- [ ] **Step 3: Update generate.ts to pass new fields**

In `src/commands/generate.ts`, update the formatContext object (around line 136-141):

```typescript
const formatContext = {
  projectName: config.project.name,
  projectDescription: config.project.description ?? '',
  sddContent,
  analyzedDir: analyzedPath,
  specsDir: outputDir,
  config,
  ciMode: !!options.ci,
};
```

- [ ] **Step 4: Update all existing test baseContext objects**

In each test file, add the three new fields to the context object. Note: `kiro.test.ts` uses `baseContext`, but `openspec.test.ts`, `antigravity.test.ts`, and `superpowers.test.ts` use `context` as the variable name. Construct the config via `configSchema.parse()` to guarantee type compatibility:

```typescript
import { configSchema } from '../../src/config/schema.js';

const minimalConfig = configSchema.parse({
  project: { name: 'TestProject', description: 'A test project description' },
  sources: { repo: { path: '.' } },
  output: { format: 'kiro' },
});
```

Then add to the context object (named `baseContext` in kiro.test.ts, `context` in the others):

```typescript
  specsDir: '',
  config: minimalConfig,
  ciMode: false,
```

Adjust `format` in the parse input to match each test file's format (`'kiro'`, `'openspec'`, etc.).

- [ ] **Step 5: Run tests to verify nothing broke**

Run: `npx vitest run tests/formats/`
Expected: All existing tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/formats/types.ts src/commands/export.ts src/commands/generate.ts tests/formats/
git commit -m "refactor: extend FormatContext with specsDir, config, ciMode"
```

---

### Task 2: Add constants and update factory + CLI help

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/formats/factory.ts`
- Modify: `bin/respec.ts`

- [ ] **Step 1: Add format constants**

In `src/constants.ts`, add after the `FORMAT_SUPERPOWERS` line:

```typescript
export const FORMAT_SPECKIT = 'speckit' as const;
export const FORMAT_BMAD = 'bmad' as const;
```

Update `OUTPUT_FORMATS` to include them:

```typescript
export const OUTPUT_FORMATS = [FORMAT_KIRO, FORMAT_OPENSPEC, FORMAT_ANTIGRAVITY, FORMAT_SUPERPOWERS, FORMAT_SPECKIT, FORMAT_BMAD] as const;
```

- [ ] **Step 2: Update factory with placeholder imports**

In `src/formats/factory.ts`, add imports and cases. For now use temporary stubs that will be replaced in later tasks — create empty files first:

```typescript
import { SpecKitFormat } from './speckit.js';
import { BmadFormat } from './bmad.js';
import { FORMAT_KIRO, FORMAT_OPENSPEC, FORMAT_ANTIGRAVITY, FORMAT_SUPERPOWERS, FORMAT_SPECKIT, FORMAT_BMAD } from '../constants.js';

// In the switch:
case FORMAT_SPECKIT:
  return new SpecKitFormat();
case FORMAT_BMAD:
  return new BmadFormat();
default:
  throw new Error(`Unknown format: "${format}". Supported formats: kiro, openspec, antigravity, superpowers, speckit, bmad`);
```

- [ ] **Step 3: Create stub format files**

Create `src/formats/speckit.ts`:

```typescript
import type { FormatAdapter, FormatContext } from './types.js';

export class SpecKitFormat implements FormatAdapter {
  name = 'speckit';

  async package(_specsDir: string, _outputDir: string, _context: FormatContext): Promise<void> {
    throw new Error('SpecKitFormat not yet implemented');
  }
}
```

Create `src/formats/bmad.ts`:

```typescript
import type { FormatAdapter, FormatContext } from './types.js';

export class BmadFormat implements FormatAdapter {
  name = 'bmad';

  async package(_specsDir: string, _outputDir: string, _context: FormatContext): Promise<void> {
    throw new Error('BmadFormat not yet implemented');
  }
}
```

- [ ] **Step 4: Update CLI help text**

In `bin/respec.ts`, update the export command's `--format` option (line 75):

```typescript
.option('--format <format>', 'Output format (kiro, openspec, antigravity, superpowers, speckit, bmad)')
```

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/constants.ts src/formats/factory.ts src/formats/speckit.ts src/formats/bmad.ts bin/respec.ts
git commit -m "feat: register speckit and bmad format stubs"
```

---

### Task 3: Add speckit mapping to config schema

**Files:**
- Modify: `src/config/schema.ts`
- Test: `tests/config/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/config/schema.test.ts`:

```typescript
describe('speckit mapping in output schema', () => {
  it('accepts output.speckit with mapping array', () => {
    const config = {
      project: { name: 'test' },
      sources: { repo: { path: '.' } },
      output: {
        format: 'speckit',
        speckit: {
          mapping: [
            { name: 'auth', contexts: ['authentication', 'authorization'] },
            { name: 'billing', contexts: ['payments'] },
          ],
        },
      },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output.speckit?.mapping).toHaveLength(2);
      expect(result.data.output.speckit?.mapping?.[0].name).toBe('auth');
    }
  });

  it('accepts output without speckit field', () => {
    const config = {
      project: { name: 'test' },
      sources: { repo: { path: '.' } },
      output: { format: 'openspec' },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output.speckit).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config/schema.test.ts`
Expected: FAIL — `speckit` not recognized in output schema

- [ ] **Step 3: Add speckit mapping schema**

In `src/config/schema.ts`, add before `outputSchema`:

```typescript
const speckitMappingSchema = z.object({
  mapping: z.array(z.object({
    name: z.string(),
    contexts: z.array(z.string()),
  })).optional(),
}).optional();
```

Update `outputSchema` to include it:

```typescript
const outputSchema = z.object({
  dir: z.string().default(DEFAULT_OUTPUT_DIR),
  format: outputFormatEnum.default(DEFAULT_OUTPUT_FORMAT),
  diagrams: z.enum(['mermaid', 'none']).default(DEFAULT_DIAGRAM_TYPE),
  tasks: z.boolean().default(true),
  speckit: speckitMappingSchema,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/config/schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/schema.ts tests/config/schema.test.ts
git commit -m "feat: add speckit mapping schema to output config"
```

---

### Task 4: Bounded context parser

**Files:**
- Create: `src/formats/context-parser.ts`
- Create: `tests/formats/context-parser.test.ts`
- Modify: `src/formats/kiro.ts` (replace local `parseSectionHeaders` + `toKebabCase`)

- [ ] **Step 1: Write the failing tests**

Create `tests/formats/context-parser.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseBoundedContexts } from '../../src/formats/context-parser.js';

let tmpDir: string;
let analyzedDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-ctx-parser-'));
  analyzedDir = join(tmpDir, 'analyzed');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relativePath: string, content: string): void {
  const filePath = join(analyzedDir, relativePath);
  fs.mkdirSync(join(filePath, '..'), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('parseBoundedContexts', () => {
  it('returns empty array when bounded-contexts.md does not exist', () => {
    fs.mkdirSync(analyzedDir, { recursive: true });
    expect(parseBoundedContexts(analyzedDir)).toEqual([]);
  });

  it('returns empty array when file has no ## headers', () => {
    writeFile('domain/bounded-contexts.md', '# Overview\n\nSome text without sections.\n');
    expect(parseBoundedContexts(analyzedDir)).toEqual([]);
  });

  it('parses contexts with name, slug, and description', () => {
    writeFile('domain/bounded-contexts.md', [
      '## OrderManagement',
      'Handles orders and fulfillment.',
      '',
      '## UserAuth',
      'Handles authentication and authorization.',
      '',
    ].join('\n'));
    const contexts = parseBoundedContexts(analyzedDir);
    expect(contexts).toHaveLength(2);
    expect(contexts[0].name).toBe('OrderManagement');
    expect(contexts[0].slug).toBe('order-management');
    expect(contexts[0].description).toContain('Handles orders');
    expect(contexts[1].name).toBe('UserAuth');
    expect(contexts[1].slug).toBe('user-auth');
  });

  it('extracts entity names by cross-referencing entities.md', () => {
    writeFile('domain/bounded-contexts.md', [
      '## Billing',
      'Manages Invoice and Payment entities.',
      '',
    ].join('\n'));
    writeFile('domain/entities.md', [
      '## Invoice',
      'An invoice entity.',
      '',
      '## Payment',
      'A payment entity.',
      '',
      '## User',
      'A user entity.',
      '',
    ].join('\n'));
    const contexts = parseBoundedContexts(analyzedDir);
    expect(contexts[0].entities).toContain('Invoice');
    expect(contexts[0].entities).toContain('Payment');
    expect(contexts[0].entities).not.toContain('User');
  });

  it('returns empty entities when entities.md does not exist', () => {
    writeFile('domain/bounded-contexts.md', '## Billing\nManages invoices.\n');
    const contexts = parseBoundedContexts(analyzedDir);
    expect(contexts[0].entities).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/formats/context-parser.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement context-parser.ts**

Create `src/formats/context-parser.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BoundedContext {
  name: string;
  slug: string;
  description: string;
  entities: string[];
}

function readIfExists(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
}

/**
 * Parse ## headers from markdown, returning header text array.
 */
export function parseSectionHeaders(content: string): string[] {
  const headers: string[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      headers.push(match[1].trim());
    }
  }
  return headers;
}

/**
 * Parse bounded contexts from domain/bounded-contexts.md.
 * Each ## header is a context. Description is content between headers.
 * Entities cross-referenced from domain/entities.md.
 */
export function parseBoundedContexts(analyzedDir: string): BoundedContext[] {
  const bcPath = path.join(analyzedDir, 'domain', 'bounded-contexts.md');
  const bcContent = readIfExists(bcPath);
  if (!bcContent) return [];

  const entitiesContent = readIfExists(path.join(analyzedDir, 'domain', 'entities.md'));
  const allEntityNames = parseSectionHeaders(entitiesContent);

  const contexts: BoundedContext[] = [];
  const lines = bcContent.split('\n');
  let currentName = '';
  let currentLines: string[] = [];

  function flush(): void {
    if (!currentName) return;
    const description = currentLines.join('\n').trim();
    const entities = allEntityNames.filter(
      (entity) => description.toLowerCase().includes(entity.toLowerCase())
    );
    contexts.push({
      name: currentName,
      slug: toKebabCase(currentName),
      description,
      entities,
    });
  }

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      flush();
      currentName = match[1].trim();
      currentLines = [];
    } else if (currentName) {
      currentLines.push(line);
    }
  }
  flush();

  return contexts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/formats/context-parser.test.ts`
Expected: PASS

- [ ] **Step 5: Refactor kiro.ts to use shared parser**

In `src/formats/kiro.ts`, remove the local `parseSectionHeaders` and `toKebabCase` functions. Import from the shared module:

```typescript
import { parseSectionHeaders, toKebabCase } from './context-parser.js';
```

Remove the `readIfExists` function and import from this module pattern (or keep it local since it's also used elsewhere — kiro has its own).

- [ ] **Step 6: Run kiro tests to verify refactor didn't break anything**

Run: `npx vitest run tests/formats/kiro.test.ts`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/formats/context-parser.ts tests/formats/context-parser.test.ts src/formats/kiro.ts
git commit -m "feat: extract shared bounded context parser, refactor kiro to use it"
```

---

### Task 5: Framework installer utility

**Files:**
- Create: `src/formats/framework-installer.ts`
- Create: `tests/formats/framework-installer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/formats/framework-installer.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Mock @clack/prompts and child_process before importing
vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  log: { warn: vi.fn(), info: vi.fn() },
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { offerFrameworkInstall } from '../../src/formats/framework-installer.js';
import * as clack from '@clack/prompts';
import { execSync } from 'node:child_process';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-installer-'));
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('offerFrameworkInstall', () => {
  it('returns false without prompting when checkPath already exists', async () => {
    const checkPath = join(tmpDir, 'framework');
    fs.mkdirSync(checkPath, { recursive: true });
    const result = await offerFrameworkInstall({
      name: 'TestFramework',
      checkPath,
      installCommand: 'echo install',
      cwd: tmpDir,
      ciMode: false,
    });
    expect(result).toBe(false);
    expect(clack.confirm).not.toHaveBeenCalled();
  });

  it('returns false without prompting in CI mode', async () => {
    const result = await offerFrameworkInstall({
      name: 'TestFramework',
      checkPath: join(tmpDir, 'nonexistent'),
      installCommand: 'echo install',
      cwd: tmpDir,
      ciMode: true,
    });
    expect(result).toBe(false);
    expect(clack.confirm).not.toHaveBeenCalled();
    expect(clack.log.info).toHaveBeenCalled();
  });

  it('returns false when user declines', async () => {
    vi.mocked(clack.confirm).mockResolvedValue(false);
    const result = await offerFrameworkInstall({
      name: 'TestFramework',
      checkPath: join(tmpDir, 'nonexistent'),
      installCommand: 'echo install',
      cwd: tmpDir,
      ciMode: false,
    });
    expect(result).toBe(false);
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs install command and returns true on success', async () => {
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));
    const result = await offerFrameworkInstall({
      name: 'TestFramework',
      checkPath: join(tmpDir, 'nonexistent'),
      installCommand: 'echo install',
      cwd: tmpDir,
      ciMode: false,
    });
    expect(result).toBe(true);
    expect(execSync).toHaveBeenCalledWith('echo install', { cwd: tmpDir, stdio: 'inherit' });
  });

  it('returns false and warns on install failure', async () => {
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(execSync).mockImplementation(() => { throw new Error('command not found'); });
    const result = await offerFrameworkInstall({
      name: 'TestFramework',
      checkPath: join(tmpDir, 'nonexistent'),
      installCommand: 'bad-command',
      cwd: tmpDir,
      ciMode: false,
    });
    expect(result).toBe(false);
    expect(clack.log.warn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/formats/framework-installer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement framework-installer.ts**

Create `src/formats/framework-installer.ts`:

```typescript
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import * as clack from '@clack/prompts';

export interface FrameworkInstallOptions {
  name: string;
  checkPath: string;
  installCommand: string;
  cwd: string;
  ciMode: boolean;
}

export async function offerFrameworkInstall(options: FrameworkInstallOptions): Promise<boolean> {
  const { name, checkPath, installCommand, cwd, ciMode } = options;

  if (fs.existsSync(checkPath)) {
    return false;
  }

  if (ciMode) {
    clack.log.info(`Skipping ${name} install (CI mode). Run \`${installCommand}\` manually.`);
    return false;
  }

  const shouldInstall = await clack.confirm({
    message: `Install ${name} framework? This runs \`${installCommand}\`.`,
  });

  if (!shouldInstall || clack.isCancel(shouldInstall)) {
    clack.log.info(`Skipping ${name} install. Run \`${installCommand}\` manually to set up the framework.`);
    return false;
  }

  try {
    execSync(installCommand, { cwd, stdio: 'inherit' });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    clack.log.warn(`${name} install failed: ${message}. Run \`${installCommand}\` manually.`);
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/formats/framework-installer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/formats/framework-installer.ts tests/formats/framework-installer.test.ts
git commit -m "feat: add shared framework installer utility"
```

---

### Task 6: SpecKitFormat implementation

**Files:**
- Modify: `src/formats/speckit.ts` (replace stub)
- Create: `tests/formats/speckit.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/formats/speckit.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SpecKitFormat } from '../../src/formats/speckit.js';
import type { FormatContext } from '../../src/formats/types.js';
import { configSchema } from '../../src/config/schema.js';

// Mock framework installer to avoid interactive prompts in tests
vi.mock('../../src/formats/framework-installer.js', () => ({
  offerFrameworkInstall: vi.fn().mockResolvedValue(false),
}));

let tmpDir: string;
let outputDir: string;
let analyzedDir: string;
let specsDir: string;
const adapter = new SpecKitFormat();

const minimalConfig = configSchema.parse({
  project: { name: 'TestProject', description: 'A test project' },
  sources: { repo: { path: '.' } },
  output: { format: 'speckit' },
});

const baseContext: FormatContext = {
  projectName: 'TestProject',
  projectDescription: 'A test project',
  sddContent: '# System Design Document\n\n## 1. Introduction\n\nOverview.\n\n## 5. Architecture\n\nMicroservices.',
  analyzedDir: '',
  specsDir: '',
  config: minimalConfig,
  ciMode: true,
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-speckit-test-'));
  outputDir = join(tmpDir, 'output');
  analyzedDir = join(tmpDir, '.respec', 'analyzed');
  specsDir = join(tmpDir, 'specs');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function ctx(overrides: Partial<FormatContext> = {}): FormatContext {
  return { ...baseContext, ...overrides };
}

function writeAnalyzedFile(relativePath: string, content: string): void {
  const filePath = join(analyzedDir, relativePath);
  fs.mkdirSync(join(filePath, '..'), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('SpecKitFormat', () => {
  it('has the correct name', () => {
    expect(adapter.name).toBe('speckit');
  });

  it('creates constitution.md with project info', async () => {
    await adapter.package('', outputDir, ctx());
    const content = fs.readFileSync(join(outputDir, '.specify', 'memory', 'constitution.md'), 'utf-8');
    expect(content).toContain('TestProject');
  });

  describe('fallback mode (no bounded contexts)', () => {
    it('creates 001-full-reimplementation/ with all artefacts', async () => {
      await adapter.package('', outputDir, ctx());
      const featureDir = join(outputDir, '.specify', 'specs', '001-full-reimplementation');
      expect(fs.existsSync(join(featureDir, 'spec.md'))).toBe(true);
      expect(fs.existsSync(join(featureDir, 'plan.md'))).toBe(true);
      expect(fs.existsSync(join(featureDir, 'research.md'))).toBe(true);
      expect(fs.existsSync(join(featureDir, 'data-model.md'))).toBe(true);
      expect(fs.existsSync(join(featureDir, 'tasks.md'))).toBe(true);
    });
  });

  describe('bounded context mode', () => {
    it('creates numbered directories per context', async () => {
      writeAnalyzedFile('domain/bounded-contexts.md', '## Auth\nHandles auth.\n\n## Billing\nHandles billing.\n');
      await adapter.package('', outputDir, ctx({ analyzedDir }));

      expect(fs.existsSync(join(outputDir, '.specify', 'specs', '001-auth', 'spec.md'))).toBe(true);
      expect(fs.existsSync(join(outputDir, '.specify', 'specs', '002-billing', 'spec.md'))).toBe(true);
    });

    it('plan.md contains architecture content', async () => {
      writeAnalyzedFile('domain/bounded-contexts.md', '## Auth\nHandles auth.\n');
      writeAnalyzedFile('infra/architecture.md', '## Architecture\n\nUses Express on AWS.');
      await adapter.package('', outputDir, ctx({ analyzedDir }));

      const content = fs.readFileSync(join(outputDir, '.specify', 'specs', '001-auth', 'plan.md'), 'utf-8');
      expect(content).toContain('Uses Express on AWS');
    });

    it('data-model.md contains entity content', async () => {
      writeAnalyzedFile('domain/bounded-contexts.md', '## Billing\nManages Invoice entities.\n');
      writeAnalyzedFile('domain/entities.md', '## Invoice\nAn invoice.\n\n## User\nA user.\n');
      await adapter.package('', outputDir, ctx({ analyzedDir }));

      const content = fs.readFileSync(join(outputDir, '.specify', 'specs', '001-billing', 'data-model.md'), 'utf-8');
      expect(content).toContain('Invoice');
    });

    it('creates contracts/api-spec.md when contracts exist', async () => {
      writeAnalyzedFile('domain/bounded-contexts.md', '## Auth\nHandles auth.\n');
      writeAnalyzedFile('api/contracts.md', '## POST /login\n\nAuthenticate user.');
      await adapter.package('', outputDir, ctx({ analyzedDir }));

      const content = fs.readFileSync(join(outputDir, '.specify', 'specs', '001-auth', 'contracts', 'api-spec.md'), 'utf-8');
      expect(content).toContain('POST /login');
    });
  });

  describe('manual mapping mode', () => {
    it('uses config mapping to group contexts', async () => {
      writeAnalyzedFile('domain/bounded-contexts.md', '## Auth\nHandles auth.\n\n## Users\nUser management.\n\n## Payments\nPayment processing.\n');
      const configWithMapping = {
        ...minimalConfig,
        output: {
          ...minimalConfig.output,
          speckit: {
            mapping: [
              { name: 'identity', contexts: ['Auth', 'Users'] },
              { name: 'billing', contexts: ['Payments'] },
            ],
          },
        },
      };
      await adapter.package('', outputDir, ctx({ analyzedDir, config: configWithMapping as any }));

      expect(fs.existsSync(join(outputDir, '.specify', 'specs', '001-identity', 'spec.md'))).toBe(true);
      expect(fs.existsSync(join(outputDir, '.specify', 'specs', '002-billing', 'spec.md'))).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/formats/speckit.test.ts`
Expected: FAIL — `SpecKitFormat not yet implemented`

- [ ] **Step 3: Implement SpecKitFormat**

Replace the stub in `src/formats/speckit.ts` with full implementation. The adapter should:

1. Call `offerFrameworkInstall` with `checkPath: path.join(outputDir, '.specify', 'templates')`, `installCommand: 'specify init'`
2. Generate `constitution.md` from SDD intro + project info + business rules summary
3. Determine mapping mode:
   - If `config.output.speckit?.mapping` exists → manual mode (group contexts per mapping)
   - Else call `parseBoundedContexts(analyzedDir)` → if results, bounded context mode
   - Else → fallback to `001-full-reimplementation/`
4. For each feature directory, generate: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `tasks.md`, `contracts/api-spec.md`

**Note on per-context filtering:** The spec mentions filtering flows, rules, and contracts to the relevant context. Full semantic filtering would require AI or structured metadata that doesn't exist in the analyzed markdown. The pragmatic approach (matching kiro.ts) is to include full content in each feature directory — entities are filtered by cross-referencing `bounded-contexts.md` mentions, but prose content like flows and rules is included in full. This is accurate enough for the use case (providing context to AI agents) and avoids lossy heuristic filtering.

Key file reads from `analyzedDir`:
- `domain/bounded-contexts.md`, `domain/entities.md`, `domain/glossary.md`
- `flows/user-flows.md`, `flows/data-flows.md`
- `rules/business-rules.md`, `rules/validation-rules.md`
- `api/contracts.md`, `api/external-deps.md`
- `infra/architecture.md`, `infra/data-storage.md`

Key file reads from `specsDir` (context.specsDir):
- `tasks.md` or `epics.md` (task-gen output)

Use `readIfExists` pattern (same as kiro.ts) for all file reads. Use `writeMarkdown` from `../utils/fs.js` for all writes.

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeMarkdown } from '../utils/fs.js';
import { parseBoundedContexts, toKebabCase } from './context-parser.js';
import { offerFrameworkInstall } from './framework-installer.js';
import type { FormatAdapter, FormatContext } from './types.js';

function readIfExists(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

interface FeatureGroup {
  name: string;
  slug: string;
  descriptions: string[];
  entities: string[];
}

export class SpecKitFormat implements FormatAdapter {
  name = 'speckit';

  async package(specsDir: string, outputDir: string, context: FormatContext): Promise<void> {
    const { projectName, projectDescription, sddContent, analyzedDir, config, ciMode } = context;
    const specifyDir = path.join(outputDir, '.specify');

    // Offer framework install
    await offerFrameworkInstall({
      name: 'GitHub Spec Kit',
      checkPath: path.join(specifyDir, 'templates'),
      installCommand: 'specify init',
      cwd: outputDir,
      ciMode,
    });

    // Read analyzed files
    const businessRules = analyzedDir ? readIfExists(path.join(analyzedDir, 'rules', 'business-rules.md')) : '';
    const validationRules = analyzedDir ? readIfExists(path.join(analyzedDir, 'rules', 'validation-rules.md')) : '';
    const userFlows = analyzedDir ? readIfExists(path.join(analyzedDir, 'flows', 'user-flows.md')) : '';
    const dataFlows = analyzedDir ? readIfExists(path.join(analyzedDir, 'flows', 'data-flows.md')) : '';
    const architecture = analyzedDir ? readIfExists(path.join(analyzedDir, 'infra', 'architecture.md')) : '';
    const dataStorage = analyzedDir ? readIfExists(path.join(analyzedDir, 'infra', 'data-storage.md')) : '';
    const entities = analyzedDir ? readIfExists(path.join(analyzedDir, 'domain', 'entities.md')) : '';
    const contracts = analyzedDir ? readIfExists(path.join(analyzedDir, 'api', 'contracts.md')) : '';
    const externalDeps = analyzedDir ? readIfExists(path.join(analyzedDir, 'api', 'external-deps.md')) : '';
    const dependencies = analyzedDir ? readIfExists(path.join(path.join(analyzedDir, '..', 'raw'), 'repo', 'dependencies.md')) : '';
    const tasksContent = context.specsDir ? readIfExists(path.join(context.specsDir, 'tasks.md')) : '';

    // Constitution
    writeMarkdown(
      path.join(specifyDir, 'memory', 'constitution.md'),
      `# Project Constitution — ${projectName}\n\n## Overview\n\n${projectDescription}\n\n## Architecture\n\n${architecture || 'Not yet analyzed.'}\n\n## Business Rules\n\n${businessRules || 'Not yet analyzed.'}\n`,
    );

    // Determine feature groups
    const features = this.resolveFeatures(analyzedDir, config);

    // Generate per-feature directories
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const num = String(i + 1).padStart(3, '0');
      const featureDir = path.join(specifyDir, 'specs', `${num}-${feature.slug}`);

      // spec.md
      const flowSection = userFlows || dataFlows
        ? `## User Flows\n\n${userFlows}\n\n${dataFlows}`
        : '';
      const rulesSection = businessRules || validationRules
        ? `## Acceptance Criteria\n\n${businessRules}\n\n${validationRules}`
        : '';
      writeMarkdown(
        path.join(featureDir, 'spec.md'),
        `# ${feature.name}\n\n## Description\n\n${feature.descriptions.join('\n\n')}\n\n${flowSection}\n\n${rulesSection}\n`,
      );

      // plan.md
      writeMarkdown(
        path.join(featureDir, 'plan.md'),
        `# ${feature.name} — Technical Plan\n\n## Architecture\n\n${architecture || 'Not yet analyzed.'}\n\n## Data Storage\n\n${dataStorage || 'Not yet analyzed.'}\n\n## From SDD\n\n${sddContent}\n`,
      );

      // research.md
      writeMarkdown(
        path.join(featureDir, 'research.md'),
        `# ${feature.name} — Research\n\n## Dependencies\n\n${dependencies || 'Not available.'}\n\n## External APIs\n\n${externalDeps || 'Not available.'}\n`,
      );

      // data-model.md — filter entities to this feature if possible
      const entityContent = feature.entities.length > 0
        ? `Relevant entities: ${feature.entities.join(', ')}\n\n${entities}`
        : entities || 'Not yet analyzed.';
      writeMarkdown(
        path.join(featureDir, 'data-model.md'),
        `# ${feature.name} — Data Model\n\n${entityContent}\n`,
      );

      // tasks.md
      writeMarkdown(
        path.join(featureDir, 'tasks.md'),
        `# ${feature.name} — Tasks\n\n${tasksContent || '- [ ] Define implementation tasks'}\n`,
      );

      // contracts/api-spec.md
      if (contracts) {
        writeMarkdown(
          path.join(featureDir, 'contracts', 'api-spec.md'),
          `# ${feature.name} — API Contracts\n\n${contracts}\n`,
        );
      }
    }
  }

  private resolveFeatures(analyzedDir: string, config: FormatContext['config']): FeatureGroup[] {
    // Mode 3: Manual mapping
    const mapping = config.output.speckit?.mapping;
    if (mapping && mapping.length > 0) {
      const allContexts = analyzedDir ? parseBoundedContexts(analyzedDir) : [];
      return mapping.map((m) => {
        const matched = allContexts.filter((c) =>
          m.contexts.some((name) => c.name.toLowerCase() === name.toLowerCase()),
        );
        return {
          name: m.name,
          slug: toKebabCase(m.name),
          descriptions: matched.map((c) => c.description),
          entities: matched.flatMap((c) => c.entities),
        };
      });
    }

    // Mode 1: Bounded contexts
    if (analyzedDir) {
      const contexts = parseBoundedContexts(analyzedDir);
      if (contexts.length > 0) {
        return contexts.map((c) => ({
          name: c.name,
          slug: c.slug,
          descriptions: [c.description],
          entities: c.entities,
        }));
      }
    }

    // Mode 2: Fallback
    return [{
      name: 'Full Reimplementation',
      slug: 'full-reimplementation',
      descriptions: ['Complete system reimplementation.'],
      entities: [],
    }];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/formats/speckit.test.ts`
Expected: PASS

- [ ] **Step 5: Run all format tests**

Run: `npx vitest run tests/formats/`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/formats/speckit.ts tests/formats/speckit.test.ts
git commit -m "feat: implement SpecKitFormat export adapter"
```

---

### Task 7: BmadFormat implementation

**Files:**
- Modify: `src/formats/bmad.ts` (replace stub)
- Create: `tests/formats/bmad.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/formats/bmad.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BmadFormat } from '../../src/formats/bmad.js';
import type { FormatContext } from '../../src/formats/types.js';
import { configSchema } from '../../src/config/schema.js';

vi.mock('../../src/formats/framework-installer.js', () => ({
  offerFrameworkInstall: vi.fn().mockResolvedValue(false),
}));

let tmpDir: string;
let outputDir: string;
let analyzedDir: string;
const adapter = new BmadFormat();

const minimalConfig = configSchema.parse({
  project: { name: 'TestProject', description: 'A test project' },
  sources: { repo: { path: '.' } },
  output: { format: 'bmad' },
});

const baseContext: FormatContext = {
  projectName: 'TestProject',
  projectDescription: 'A test project',
  sddContent: '# SDD\n\n## 1. Introduction\n\nOverview.\n\n## 5. Architecture\n\nMicroservices.',
  analyzedDir: '',
  specsDir: '',
  config: minimalConfig,
  ciMode: true,
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-bmad-test-'));
  outputDir = join(tmpDir, 'output');
  analyzedDir = join(tmpDir, '.respec', 'analyzed');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function ctx(overrides: Partial<FormatContext> = {}): FormatContext {
  return { ...baseContext, ...overrides };
}

function writeAnalyzedFile(relativePath: string, content: string): void {
  const filePath = join(analyzedDir, relativePath);
  fs.mkdirSync(join(filePath, '..'), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('BmadFormat', () => {
  it('has the correct name', () => {
    expect(adapter.name).toBe('bmad');
  });

  it('creates PRD.md with SDD content and business rules', async () => {
    writeAnalyzedFile('rules/business-rules.md', '## BR-001\nOrders must have total > 0.');
    await adapter.package('', outputDir, ctx({ analyzedDir }));
    const content = fs.readFileSync(join(outputDir, '_bmad-output', 'planning-artifacts', 'PRD.md'), 'utf-8');
    expect(content).toContain('TestProject');
    expect(content).toContain('Orders must have total > 0');
  });

  it('creates architecture.md with infra content', async () => {
    writeAnalyzedFile('infra/architecture.md', '## Arch\n\nUses AWS Lambda.');
    await adapter.package('', outputDir, ctx({ analyzedDir }));
    const content = fs.readFileSync(join(outputDir, '_bmad-output', 'planning-artifacts', 'architecture.md'), 'utf-8');
    expect(content).toContain('Uses AWS Lambda');
  });

  it('creates ux-spec.md with flows', async () => {
    writeAnalyzedFile('flows/user-flows.md', '## Login Flow\n\nUser enters credentials.');
    await adapter.package('', outputDir, ctx({ analyzedDir }));
    const content = fs.readFileSync(join(outputDir, '_bmad-output', 'planning-artifacts', 'ux-spec.md'), 'utf-8');
    expect(content).toContain('Login Flow');
  });

  it('creates epic files from bounded contexts', async () => {
    writeAnalyzedFile('domain/bounded-contexts.md', '## Auth\nHandles auth.\n\n## Billing\nHandles billing.\n');
    await adapter.package('', outputDir, ctx({ analyzedDir }));
    const epicsDir = join(outputDir, '_bmad-output', 'planning-artifacts', 'epics');
    expect(fs.existsSync(join(epicsDir, 'epic-1-auth.md'))).toBe(true);
    expect(fs.existsSync(join(epicsDir, 'epic-2-billing.md'))).toBe(true);
    const content = fs.readFileSync(join(epicsDir, 'epic-1-auth.md'), 'utf-8');
    expect(content).toContain('Epic 1: Auth');
  });

  it('creates project-context.md', async () => {
    writeAnalyzedFile('domain/glossary.md', '## Terms\n\n- SKU: Stock Keeping Unit');
    await adapter.package('', outputDir, ctx({ analyzedDir }));
    const content = fs.readFileSync(join(outputDir, '_bmad-output', 'project-context.md'), 'utf-8');
    expect(content).toContain('TestProject');
    expect(content).toContain('SKU');
  });

  it('creates empty sprint-status.yaml', async () => {
    await adapter.package('', outputDir, ctx());
    const content = fs.readFileSync(join(outputDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'), 'utf-8');
    expect(content).toContain('status: not_started');
  });

  it('creates fallback PRD when no analyzed dir', async () => {
    await adapter.package('', outputDir, ctx());
    expect(fs.existsSync(join(outputDir, '_bmad-output', 'planning-artifacts', 'PRD.md'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/formats/bmad.test.ts`
Expected: FAIL — `BmadFormat not yet implemented`

- [ ] **Step 3: Implement BmadFormat**

Replace stub in `src/formats/bmad.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureDir, writeMarkdown } from '../utils/fs.js';
import { parseBoundedContexts, toKebabCase } from './context-parser.js';
import { offerFrameworkInstall } from './framework-installer.js';
import type { FormatAdapter, FormatContext } from './types.js';

function readIfExists(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

export class BmadFormat implements FormatAdapter {
  name = 'bmad';

  async package(_specsDir: string, outputDir: string, context: FormatContext): Promise<void> {
    const { projectName, projectDescription, sddContent, analyzedDir, ciMode } = context;
    const bmadOutput = path.join(outputDir, '_bmad-output');

    // Offer framework install
    await offerFrameworkInstall({
      name: 'BMAD Method',
      checkPath: path.join(outputDir, '_bmad'),
      installCommand: 'npx bmad-method install',
      cwd: outputDir,
      ciMode,
    });

    // Read analyzed files
    const businessRules = analyzedDir ? readIfExists(path.join(analyzedDir, 'rules', 'business-rules.md')) : '';
    const validationRules = analyzedDir ? readIfExists(path.join(analyzedDir, 'rules', 'validation-rules.md')) : '';
    const userFlows = analyzedDir ? readIfExists(path.join(analyzedDir, 'flows', 'user-flows.md')) : '';
    const dataFlows = analyzedDir ? readIfExists(path.join(analyzedDir, 'flows', 'data-flows.md')) : '';
    const architecture = analyzedDir ? readIfExists(path.join(analyzedDir, 'infra', 'architecture.md')) : '';
    const dataStorage = analyzedDir ? readIfExists(path.join(analyzedDir, 'infra', 'data-storage.md')) : '';
    const entities = analyzedDir ? readIfExists(path.join(analyzedDir, 'domain', 'entities.md')) : '';
    const contracts = analyzedDir ? readIfExists(path.join(analyzedDir, 'api', 'contracts.md')) : '';
    const externalDeps = analyzedDir ? readIfExists(path.join(analyzedDir, 'api', 'external-deps.md')) : '';
    const glossary = analyzedDir ? readIfExists(path.join(analyzedDir, 'domain', 'glossary.md')) : '';
    const permissions = analyzedDir ? readIfExists(path.join(analyzedDir, 'rules', 'permissions.md')) : '';
    const tasksContent = context.specsDir ? readIfExists(path.join(context.specsDir, 'tasks.md')) : '';

    // PRD.md
    writeMarkdown(
      path.join(bmadOutput, 'planning-artifacts', 'PRD.md'),
      [
        `# Product Requirements Document — ${projectName}`,
        '',
        '## Project Overview',
        '',
        projectDescription,
        '',
        '## From SDD',
        '',
        sddContent,
        '',
        '## Functional Requirements',
        '',
        businessRules || 'Not yet analyzed.',
        '',
        '## Validation Rules',
        '',
        validationRules || 'Not yet analyzed.',
        '',
        '## External Integrations',
        '',
        externalDeps || 'None identified.',
        '',
      ].join('\n'),
    );

    // architecture.md
    writeMarkdown(
      path.join(bmadOutput, 'planning-artifacts', 'architecture.md'),
      [
        `# Architecture — ${projectName}`,
        '',
        '## Architecture Overview',
        '',
        architecture || 'Not yet analyzed.',
        '',
        '## Data Storage',
        '',
        dataStorage || 'Not yet analyzed.',
        '',
        '## Data Model',
        '',
        entities || 'Not yet analyzed.',
        '',
        '## API Design',
        '',
        contracts || 'Not yet analyzed.',
        '',
        '## Security',
        '',
        permissions || 'Not yet analyzed.',
        '',
      ].join('\n'),
    );

    // ux-spec.md
    writeMarkdown(
      path.join(bmadOutput, 'planning-artifacts', 'ux-spec.md'),
      [
        `# UX Specification — ${projectName}`,
        '',
        '## User Flows',
        '',
        userFlows || 'Not yet analyzed.',
        '',
        '## Data Flows',
        '',
        dataFlows || 'Not yet analyzed.',
        '',
      ].join('\n'),
    );

    // Epics and stories from bounded contexts
    const contexts = analyzedDir ? parseBoundedContexts(analyzedDir) : [];
    const epicsList: string[] = [];

    for (let i = 0; i < contexts.length; i++) {
      const ctx = contexts[i];
      const epicNum = i + 1;
      const epicFileName = `epic-${epicNum}-${ctx.slug}.md`;
      epicsList.push(`- ${epicFileName}`);

      // Generate story files from tasks content if available
      const storyNames: string[] = [];
      if (tasksContent) {
        // Parse task lines (- [ ] or - lines) as stories
        const taskLines = tasksContent.split('\n').filter((l) => l.match(/^-\s+(\[.\])?\s*.+/));
        for (const taskLine of taskLines) {
          const title = taskLine.replace(/^-\s+(\[.\])?\s*/, '').trim();
          if (!title) continue;
          const storySlug = toKebabCase(title).slice(0, 50);
          const storyFileName = `story-${storySlug}.md`;
          storyNames.push(storyFileName);
          writeMarkdown(
            path.join(bmadOutput, 'planning-artifacts', 'epics', storyFileName),
            [
              `# Story: ${title}`,
              '',
              '## Description',
              '',
              title,
              '',
              '## Acceptance Criteria',
              '',
              '- [ ] Implementation complete',
              '- [ ] Tests passing',
              '',
            ].join('\n'),
          );
        }
      }

      writeMarkdown(
        path.join(bmadOutput, 'planning-artifacts', 'epics', epicFileName),
        [
          `# Epic ${epicNum}: ${ctx.name}`,
          '',
          '## Description',
          '',
          ctx.description,
          '',
          '## Entities',
          '',
          ctx.entities.length > 0 ? ctx.entities.map((e) => `- ${e}`).join('\n') : 'None identified.',
          '',
          '## Stories',
          '',
          storyNames.length > 0 ? storyNames.map((s) => `- ${s}`).join('\n') : '<!-- No tasks available to derive stories -->',
          '',
          '## Acceptance Criteria',
          '',
          '<!-- Derived from business rules for this context -->',
          '',
        ].join('\n'),
      );
    }

    // project-context.md
    writeMarkdown(
      path.join(bmadOutput, 'project-context.md'),
      [
        `# Project Context — ${projectName}`,
        '',
        '## Overview',
        '',
        projectDescription,
        '',
        '## Glossary',
        '',
        glossary || 'Not available.',
        '',
        '## Permissions & Access Control',
        '',
        permissions || 'Not available.',
        '',
        '## Epics',
        '',
        epicsList.length > 0 ? epicsList.join('\n') : 'No bounded contexts detected.',
        '',
      ].join('\n'),
    );

    // sprint-status.yaml
    const epicsYaml = contexts.length > 0
      ? contexts.map((c, i) => `  - name: "${c.name}"\n    status: not_started`).join('\n')
      : '  - name: "Full Implementation"\n    status: not_started';

    // Use ensureDir + writeFileSync for YAML (not writeMarkdown which is for .md files)
    const yamlPath = path.join(bmadOutput, 'implementation-artifacts', 'sprint-status.yaml');
    ensureDir(path.dirname(yamlPath));
    fs.writeFileSync(yamlPath,
      [
        `# Sprint Status — ${projectName}`,
        '',
        'status: not_started',
        'current_sprint: 0',
        'epics:',
        epicsYaml,
        '',
      ].join('\n'),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/formats/bmad.test.ts`
Expected: PASS

- [ ] **Step 5: Run all format tests**

Run: `npx vitest run tests/formats/`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/formats/bmad.ts tests/formats/bmad.test.ts
git commit -m "feat: implement BmadFormat export adapter"
```

---

### Task 8: Full integration test and final verification

**Files:**
- All modified files from previous tasks

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: TypeScript compilation check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual smoke test — speckit export**

Create a temp directory with sample analyzed data and test the export:

```bash
mkdir -p /tmp/respec-smoke/.respec/analyzed/domain
mkdir -p /tmp/respec-smoke/.respec/analyzed/flows
mkdir -p /tmp/respec-smoke/.respec/analyzed/rules
mkdir -p /tmp/respec-smoke/.respec/analyzed/infra
mkdir -p /tmp/respec-smoke/.respec/analyzed/api
mkdir -p /tmp/respec-smoke/specs

echo '## Auth\nHandles auth.\n\n## Billing\nHandles billing.' > /tmp/respec-smoke/.respec/analyzed/domain/bounded-contexts.md
echo '## User\nA user entity.' > /tmp/respec-smoke/.respec/analyzed/domain/entities.md
echo '# SDD\n\nSystem design.' > /tmp/respec-smoke/specs/sdd.md

# Create a minimal config
cat > /tmp/respec-smoke/respec.config.yaml << 'YAML'
project:
  name: SmokeTest
  description: Testing speckit export
sources:
  repo:
    path: .
output:
  format: speckit
YAML

cd /tmp/respec-smoke && node /path/to/respec/bin/respec.ts export --ci
```

Verify `.specify/specs/001-auth/` and `.specify/specs/002-billing/` directories exist with all expected files.

- [ ] **Step 4: Manual smoke test — bmad export**

Same directory, change format:

```bash
cd /tmp/respec-smoke && node /path/to/respec/bin/respec.ts export --format bmad --ci
```

Verify `_bmad-output/planning-artifacts/PRD.md`, `architecture.md`, `ux-spec.md`, `epics/epic-1-auth.md`, `epics/epic-2-billing.md` exist.

- [ ] **Step 5: Commit (if any fixes were needed)**

```bash
git add -A && git commit -m "fix: integration test fixes for speckit/bmad export"
```
