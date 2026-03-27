# ReSpec MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ReSpec CLI tool — a three-phase pipeline that reads legacy codebases and Jira tickets, analyzes them with pluggable AI agents, and generates specs in multiple output formats (Kiro, OpenSpec, Antigravity, Superpowers).

**Architecture:** Node.js + TypeScript CLI using Commander. Config validated with Zod from `respec.config.yaml`. AI engine is a pluggable adapter (Claude/Codex/Gemini/custom) that dispatches analyzers and generators as parallel subagents. All output is Markdown + Mermaid, packaged into format-specific directory structures.

**Tech Stack:** Node.js 20+, TypeScript (strict), Commander, Zod, yaml, simple-git, jira.js, vitest

---

## File Structure

```
respec/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── bin/
│   └── respec.ts                    # CLI entry point (shebang + commander setup)
├── src/
│   ├── index.ts                     # Re-exports for programmatic use
│   ├── config/
│   │   ├── schema.ts                # Zod schema for respec.config.yaml
│   │   └── loader.ts                # Load + validate config from disk
│   ├── state/
│   │   ├── types.ts                 # PipelineState type definition
│   │   └── manager.ts               # Read/write /.respec/state.json
│   ├── commands/
│   │   ├── init.ts                  # respec init command
│   │   ├── ingest.ts                # respec ingest command (orchestrates ingestors)
│   │   ├── analyze.ts               # respec analyze command (orchestrates analyzers)
│   │   ├── generate.ts              # respec generate command (orchestrates generators)
│   │   ├── export.ts                # respec export command (format repackaging)
│   │   ├── status.ts                # respec status command
│   │   └── validate.ts              # respec validate command
│   ├── ingestors/
│   │   ├── types.ts                 # Ingestor interface
│   │   ├── repo/
│   │   │   ├── index.ts             # RepoIngestor: orchestrates sub-steps
│   │   │   ├── structure.ts         # Directory tree scanner
│   │   │   ├── dependencies.ts      # Package manifest parser
│   │   │   ├── endpoints.ts         # Route/endpoint detector
│   │   │   ├── models.ts            # ORM/DB schema extractor
│   │   │   ├── env-vars.ts          # Environment variable scanner
│   │   │   └── modules.ts           # Per-module summarizer
│   │   ├── jira/
│   │   │   ├── index.ts             # JiraIngestor: fetch + group tickets
│   │   │   ├── query-builder.ts     # Config filters → JQL string
│   │   │   └── formatter.ts         # Ticket → Markdown formatting
│   │   └── docs/
│   │       └── index.ts             # DocsIngestor: local files + README
│   ├── ai/
│   │   ├── types.ts                 # AIEngine interface
│   │   ├── adapters/
│   │   │   ├── claude.ts            # Claude Code adapter (claude -p)
│   │   │   ├── codex.ts             # Codex CLI adapter
│   │   │   ├── gemini.ts            # Gemini CLI adapter
│   │   │   └── custom.ts            # Custom command adapter
│   │   ├── factory.ts               # Create adapter from config
│   │   └── orchestrator.ts          # Parallel subagent dispatcher
│   ├── analyzers/
│   │   ├── types.ts                 # Analyzer interface
│   │   ├── registry.ts              # Analyzer registry with tier deps
│   │   ├── prompts/                 # Prompt templates per analyzer
│   │   │   ├── domain-mapper.ts
│   │   │   ├── flow-extractor.ts
│   │   │   ├── rule-miner.ts
│   │   │   ├── permission-scanner.ts
│   │   │   ├── api-mapper.ts
│   │   │   └── infra-detector.ts
│   │   └── report.ts               # _analysis-report.md builder
│   ├── generators/
│   │   ├── types.ts                 # Generator interface
│   │   ├── registry.ts              # Generator registry with tier deps
│   │   ├── sdd-gen.ts               # SDD 12-section generator
│   │   ├── erd-gen.ts               # ERD + context map Mermaid
│   │   ├── flow-gen.ts              # Sequence diagram Mermaid
│   │   ├── task-gen.ts              # Epics/stories/migration-plan
│   │   ├── adr-gen.ts               # Architecture Decision Records
│   │   └── format-gen.ts            # Delegates to output format adapter
│   ├── formats/
│   │   ├── types.ts                 # OutputFormat interface
│   │   ├── factory.ts               # Create format adapter from config
│   │   ├── kiro.ts                  # Kiro format: .kiro/specs/ structure
│   │   ├── openspec.ts              # OpenSpec format: openspec/ structure
│   │   ├── antigravity.ts           # Antigravity format: GEMINI.md + .agent/rules/
│   │   └── superpowers.ts           # Superpowers format: CLAUDE.md + skills/
│   └── utils/
│       ├── fs.ts                    # File system helpers (ensureDir, writeMarkdown)
│       ├── markdown.ts              # Markdown generation helpers
│       └── git.ts                   # simple-git wrapper
├── prompts/                         # Analyzer prompt templates (Markdown files)
│   ├── domain-mapper.md
│   ├── flow-extractor.md
│   ├── rule-miner.md
│   ├── permission-scanner.md
│   ├── api-mapper.md
│   └── infra-detector.md
└── tests/
    ├── config/
    │   ├── schema.test.ts
    │   └── loader.test.ts
    ├── state/
    │   └── manager.test.ts
    ├── commands/
    │   ├── init.test.ts
    │   ├── ingest.test.ts
    │   ├── status.test.ts
    │   └── validate.test.ts
    ├── ingestors/
    │   ├── repo/
    │   │   ├── structure.test.ts
    │   │   ├── dependencies.test.ts
    │   │   ├── endpoints.test.ts
    │   │   ├── models.test.ts
    │   │   ├── env-vars.test.ts
    │   │   └── modules.test.ts
    │   ├── jira/
    │   │   ├── query-builder.test.ts
    │   │   └── formatter.test.ts
    │   └── docs/
    │       └── index.test.ts
    ├── ai/
    │   ├── factory.test.ts
    │   ├── orchestrator.test.ts
    │   └── adapters/
    │       └── claude.test.ts
    ├── analyzers/
    │   └── registry.test.ts
    ├── generators/
    │   └── registry.test.ts
    └── formats/
        ├── kiro.test.ts
        ├── openspec.test.ts
        ├── antigravity.test.ts
        └── superpowers.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `bin/respec.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/ignaciocastro/ReSpec
npm init -y
```

Then edit `package.json`:

```json
{
  "name": "respec-cli",
  "version": "0.1.0",
  "description": "Reverse Engineering to Specification — CLI tool",
  "type": "module",
  "bin": {
    "respec": "./dist/bin/respec.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20"
  },
  "license": "UNLICENSED"
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install commander yaml zod simple-git jira.js chalk ora
npm install -D typescript vitest @types/node
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "bin/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
  },
});
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.respec/
*.tsbuildinfo
```

- [ ] **Step 6: Create bin/respec.ts entry point**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('respec')
  .description('Reverse Engineering to Specification')
  .version('0.1.0');

program.parse();
```

- [ ] **Step 7: Create src/index.ts**

```typescript
export { configSchema } from './config/schema.js';
export { loadConfig } from './config/loader.js';
```

(This will fail to compile until we create the config module — that's fine, it sets up the barrel export.)

- [ ] **Step 8: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: May fail on missing imports — that's OK. The scaffolding is in place.

- [ ] **Step 9: Commit**

```bash
git init
git add package.json tsconfig.json vitest.config.ts .gitignore bin/respec.ts src/index.ts
git commit -m "chore: scaffold ReSpec CLI project"
```

---

## Task 2: Config Schema + Loader

**Files:**
- Create: `src/config/schema.ts`
- Create: `src/config/loader.ts`
- Test: `tests/config/schema.test.ts`
- Test: `tests/config/loader.test.ts`

- [ ] **Step 1: Write failing test for config schema validation**

`tests/config/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { configSchema } from '../../src/config/schema.js';

describe('configSchema', () => {
  it('validates a minimal valid config', () => {
    const config = {
      project: { name: 'test', version: '1.0', description: 'A test project' },
      sources: { repo: { path: './repo' } },
      output: { dir: './specs', format: 'openspec' },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const config = {
      project: { name: 'test', version: '1.0', description: 'A test' },
      sources: { repo: { path: './repo' } },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output.format).toBe('openspec');
      expect(result.data.output.dir).toBe('./specs');
      expect(result.data.ai.engine).toBe('claude');
      expect(result.data.ai.max_parallel).toBe(4);
      expect(result.data.ai.timeout).toBe(300);
      expect(result.data.sources.repo.branch).toBe('main');
    }
  });

  it('rejects invalid output format', () => {
    const config = {
      project: { name: 'test', version: '1.0', description: 'A test' },
      sources: { repo: { path: './repo' } },
      output: { format: 'invalid' },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('validates jira filters config', () => {
    const config = {
      project: { name: 'test', version: '1.0', description: 'A test' },
      sources: {
        repo: { path: './repo' },
        jira: {
          host: 'https://company.atlassian.net',
          auth: 'env:JIRA_API_TOKEN',
          filters: {
            projects: ['PROJ'],
            types: ['Epic', 'Story'],
            jql: 'project = PROJ',
          },
        },
      },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('validates ai config with custom engine', () => {
    const config = {
      project: { name: 'test', version: '1.0', description: 'A test' },
      sources: { repo: { path: './repo' } },
      ai: { engine: 'custom', command: 'my-agent --prompt' },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/config/schema.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement config schema**

`src/config/schema.ts`:

```typescript
import { z } from 'zod';

const outputFormatEnum = z.enum(['kiro', 'openspec', 'antigravity', 'superpowers']);

const aiEngineEnum = z.enum(['claude', 'codex', 'gemini', 'custom']);

const repoSourceSchema = z.object({
  path: z.string(),
  branch: z.string().default('main'),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
});

const jiraFiltersSchema = z.object({
  projects: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  title_contains: z.array(z.string()).optional(),
  types: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  sprints: z.array(z.string()).optional(),
  jql: z.string().optional(),
});

const jiraSourceSchema = z.object({
  host: z.string().url(),
  auth: z.string(),
  filters: jiraFiltersSchema.optional(),
});

const confluenceSchema = z.object({
  host: z.string().url(),
  space: z.string(),
  auth: z.string(),
});

const docsSourceSchema = z.object({
  confluence: confluenceSchema.optional(),
  local: z.array(z.string()).optional(),
});

const contextSourceSchema = z.object({
  path: z.string(),
  role: z.enum(['api_provider', 'shared_types', 'design_system']),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
});

const sourcesSchema = z.object({
  repo: repoSourceSchema,
  context: z.array(contextSourceSchema).optional(),
  jira: jiraSourceSchema.optional(),
  docs: docsSourceSchema.optional(),
});

const aiSchema = z.object({
  engine: aiEngineEnum.default('claude'),
  command: z.string().optional(),
  max_parallel: z.number().int().min(1).max(16).default(4),
  timeout: z.number().int().min(30).default(300),
  model: z.string().optional(),
});

const outputSchema = z.object({
  dir: z.string().default('./specs'),
  format: outputFormatEnum.default('openspec'),
  diagrams: z.enum(['mermaid', 'none']).default('mermaid'),
  tasks: z.boolean().default(true),
});

const projectSchema = z.object({
  name: z.string().min(1),
  version: z.string(),
  description: z.string(),
});

export const configSchema = z.object({
  project: projectSchema,
  sources: sourcesSchema,
  ai: aiSchema.default({}),
  output: outputSchema.default({}),
});

export type ReSpecConfig = z.infer<typeof configSchema>;
export type OutputFormat = z.infer<typeof outputFormatEnum>;
export type AIEngine = z.infer<typeof aiEngineEnum>;
```

- [ ] **Step 4: Run schema tests**

```bash
npx vitest run tests/config/schema.test.ts
```

Expected: PASS

- [ ] **Step 5: Write failing test for config loader**

`tests/config/loader.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('loads and validates a valid config file', async () => {
    const configContent = `
project:
  name: TestProject
  version: "1.0"
  description: A test project

sources:
  repo:
    path: ./src

output:
  format: kiro
`;
    fs.writeFileSync(path.join(tmpDir, 'respec.config.yaml'), configContent);
    const config = await loadConfig(tmpDir);
    expect(config.project.name).toBe('TestProject');
    expect(config.output.format).toBe('kiro');
    expect(config.ai.engine).toBe('claude');
  });

  it('throws if config file is missing', async () => {
    await expect(loadConfig(tmpDir)).rejects.toThrow('respec.config.yaml not found');
  });

  it('throws on invalid YAML', async () => {
    fs.writeFileSync(path.join(tmpDir, 'respec.config.yaml'), 'project: [invalid');
    await expect(loadConfig(tmpDir)).rejects.toThrow();
  });

  it('resolves env: prefixed auth values', async () => {
    process.env.TEST_JIRA_TOKEN = 'secret123';
    const configContent = `
project:
  name: Test
  version: "1.0"
  description: test

sources:
  repo:
    path: ./src
  jira:
    host: https://test.atlassian.net
    auth: env:TEST_JIRA_TOKEN
`;
    fs.writeFileSync(path.join(tmpDir, 'respec.config.yaml'), configContent);
    const config = await loadConfig(tmpDir);
    expect(config.sources.jira?.auth).toBe('env:TEST_JIRA_TOKEN');
    delete process.env.TEST_JIRA_TOKEN;
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx vitest run tests/config/loader.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 7: Implement config loader**

`src/config/loader.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { configSchema, type ReSpecConfig } from './schema.js';

const CONFIG_FILENAME = 'respec.config.yaml';

export async function loadConfig(dir: string): Promise<ReSpecConfig> {
  const configPath = path.join(dir, CONFIG_FILENAME);

  if (!fs.existsSync(configPath)) {
    throw new Error(`respec.config.yaml not found in ${dir}`);
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = parseYaml(raw);
  const result = configSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid respec.config.yaml:\n${errors}`);
  }

  return result.data;
}

export function resolveEnvAuth(value: string): string {
  if (value.startsWith('env:')) {
    const envVar = value.slice(4);
    const resolved = process.env[envVar];
    if (!resolved) {
      throw new Error(`Environment variable ${envVar} is not set (referenced as ${value})`);
    }
    return resolved;
  }
  return value;
}
```

- [ ] **Step 8: Run all config tests**

```bash
npx vitest run tests/config/
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/config/ tests/config/
git commit -m "feat: add config schema with Zod validation and YAML loader"
```

---

## Task 3: Pipeline State Manager

**Files:**
- Create: `src/state/types.ts`
- Create: `src/state/manager.ts`
- Test: `tests/state/manager.test.ts`

- [ ] **Step 1: Write failing test**

`tests/state/manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../../src/state/manager.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('StateManager', () => {
  let tmpDir: string;
  let manager: StateManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-state-'));
    manager = new StateManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns empty state when no state file exists', () => {
    const state = manager.load();
    expect(state.phase).toBe('empty');
    expect(state.ingest).toBeNull();
    expect(state.analyze).toBeNull();
    expect(state.generate).toBeNull();
  });

  it('saves and loads ingest state', () => {
    manager.completeIngest({
      sources: { repo: true, jira: false, docs: false },
      stats: { files: 100, tickets: 0, pages: 0 },
    });
    const state = manager.load();
    expect(state.phase).toBe('ingested');
    expect(state.ingest?.stats.files).toBe(100);
    expect(state.ingest?.completed_at).toBeDefined();
  });

  it('saves and loads analyze state', () => {
    manager.completeIngest({
      sources: { repo: true, jira: false, docs: false },
      stats: { files: 50, tickets: 0, pages: 0 },
    });
    manager.completeAnalyze({
      analyzers_run: ['domain', 'flows'],
      confidence: { overall: 0.85, domain: 0.92, rules: 0.70 },
    });
    const state = manager.load();
    expect(state.phase).toBe('analyzed');
    expect(state.analyze?.analyzers_run).toContain('domain');
  });

  it('validates prerequisites — analyze requires ingest', () => {
    expect(() => manager.requirePhase('ingested')).toThrow();
  });

  it('passes prerequisites when phase is met', () => {
    manager.completeIngest({
      sources: { repo: true, jira: false, docs: false },
      stats: { files: 10, tickets: 0, pages: 0 },
    });
    expect(() => manager.requirePhase('ingested')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/state/manager.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement state types**

`src/state/types.ts`:

```typescript
export interface IngestState {
  completed_at: string;
  sources: { repo: boolean; jira: boolean; docs: boolean };
  stats: { files: number; tickets: number; pages: number };
}

export interface AnalyzeState {
  completed_at: string;
  analyzers_run: string[];
  confidence: Record<string, number>;
}

export interface GenerateState {
  completed_at: string;
  generators_run: string[];
  format: string;
}

export type PipelinePhase = 'empty' | 'ingested' | 'analyzed' | 'generated';

export interface PipelineState {
  phase: PipelinePhase;
  ingest: IngestState | null;
  analyze: AnalyzeState | null;
  generate: GenerateState | null;
}
```

- [ ] **Step 4: Implement state manager**

`src/state/manager.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PipelineState, PipelinePhase, IngestState, AnalyzeState, GenerateState } from './types.js';

const RESPEC_DIR = '.respec';
const STATE_FILE = 'state.json';

const PHASE_ORDER: PipelinePhase[] = ['empty', 'ingested', 'analyzed', 'generated'];

export class StateManager {
  private statePath: string;
  private respecDir: string;

  constructor(private projectDir: string) {
    this.respecDir = path.join(projectDir, RESPEC_DIR);
    this.statePath = path.join(this.respecDir, STATE_FILE);
  }

  load(): PipelineState {
    if (!fs.existsSync(this.statePath)) {
      return { phase: 'empty', ingest: null, analyze: null, generate: null };
    }
    const raw = fs.readFileSync(this.statePath, 'utf-8');
    return JSON.parse(raw) as PipelineState;
  }

  private save(state: PipelineState): void {
    fs.mkdirSync(this.respecDir, { recursive: true });
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

  completeIngest(data: Omit<IngestState, 'completed_at'>): void {
    const state = this.load();
    state.phase = 'ingested';
    state.ingest = { ...data, completed_at: new Date().toISOString() };
    this.save(state);
  }

  completeAnalyze(data: Omit<AnalyzeState, 'completed_at'>): void {
    const state = this.load();
    state.phase = 'analyzed';
    state.analyze = { ...data, completed_at: new Date().toISOString() };
    this.save(state);
  }

  completeGenerate(data: Omit<GenerateState, 'completed_at'>): void {
    const state = this.load();
    state.phase = 'generated';
    state.generate = { ...data, completed_at: new Date().toISOString() };
    this.save(state);
  }

  requirePhase(required: PipelinePhase): void {
    const state = this.load();
    const currentIdx = PHASE_ORDER.indexOf(state.phase);
    const requiredIdx = PHASE_ORDER.indexOf(required);
    if (currentIdx < requiredIdx) {
      throw new Error(
        `Pipeline is at phase "${state.phase}" but "${required}" is required. ` +
        `Run the previous phase first, or use --force to bypass.`
      );
    }
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/state/manager.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/state/ tests/state/
git commit -m "feat: add pipeline state manager with phase validation"
```

---

## Task 4: Utility Helpers (fs, markdown, git)

**Files:**
- Create: `src/utils/fs.ts`
- Create: `src/utils/markdown.ts`
- Create: `src/utils/git.ts`

- [ ] **Step 1: Implement fs helpers**

`src/utils/fs.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeMarkdown(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function readMarkdown(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function rawDir(projectDir: string): string {
  return path.join(projectDir, '.respec', 'raw');
}

export function analyzedDir(projectDir: string): string {
  return path.join(projectDir, '.respec', 'analyzed');
}

export function specsDir(projectDir: string, outputDir: string): string {
  return path.resolve(projectDir, outputDir);
}
```

- [ ] **Step 2: Implement markdown helpers**

`src/utils/markdown.ts`:

```typescript
export function heading(level: number, text: string): string {
  return `${'#'.repeat(level)} ${text}`;
}

export function table(headers: string[], rows: string[][]): string {
  const headerRow = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map((row) => `| ${row.join(' | ')} |`);
  return [headerRow, separator, ...dataRows].join('\n');
}

export function codeBlock(content: string, lang = ''): string {
  return `\`\`\`${lang}\n${content}\n\`\`\``;
}

export function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function timestamp(): string {
  return new Date().toISOString();
}
```

- [ ] **Step 3: Implement git helpers**

`src/utils/git.ts`:

```typescript
import simpleGit, { type SimpleGit } from 'simple-git';

export function createGit(dir: string): SimpleGit {
  return simpleGit(dir);
}

export async function cloneIfRemote(repoPath: string, targetDir: string): Promise<string> {
  if (repoPath.startsWith('http') || repoPath.startsWith('git@')) {
    const git = simpleGit();
    await git.clone(repoPath, targetDir);
    return targetDir;
  }
  return repoPath;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/
git commit -m "feat: add fs, markdown, and git utility helpers"
```

---

## Task 5: AI Engine Adapter System

**Files:**
- Create: `src/ai/types.ts`
- Create: `src/ai/adapters/claude.ts`
- Create: `src/ai/adapters/codex.ts`
- Create: `src/ai/adapters/gemini.ts`
- Create: `src/ai/adapters/custom.ts`
- Create: `src/ai/factory.ts`
- Create: `src/ai/orchestrator.ts`
- Test: `tests/ai/factory.test.ts`
- Test: `tests/ai/orchestrator.test.ts`

- [ ] **Step 1: Write failing test for AI factory**

`tests/ai/factory.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createAIEngine } from '../../src/ai/factory.js';

describe('createAIEngine', () => {
  it('creates claude adapter', () => {
    const engine = createAIEngine({ engine: 'claude', max_parallel: 4, timeout: 300 });
    expect(engine.name).toBe('claude');
  });

  it('creates codex adapter', () => {
    const engine = createAIEngine({ engine: 'codex', max_parallel: 4, timeout: 300 });
    expect(engine.name).toBe('codex');
  });

  it('creates gemini adapter', () => {
    const engine = createAIEngine({ engine: 'gemini', max_parallel: 4, timeout: 300 });
    expect(engine.name).toBe('gemini');
  });

  it('creates custom adapter with command', () => {
    const engine = createAIEngine({ engine: 'custom', command: 'my-ai --prompt', max_parallel: 4, timeout: 300 });
    expect(engine.name).toBe('custom');
  });

  it('throws if custom engine has no command', () => {
    expect(() => createAIEngine({ engine: 'custom', max_parallel: 4, timeout: 300 }))
      .toThrow('custom engine requires a command');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/ai/factory.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement AI types**

`src/ai/types.ts`:

```typescript
export interface AIEngine {
  name: string;
  run(prompt: string, options?: AIRunOptions): Promise<string>;
}

export interface AIRunOptions {
  timeout?: number;
  model?: string;
}

export interface AIConfig {
  engine: string;
  command?: string;
  max_parallel: number;
  timeout: number;
  model?: string;
}

export interface SubagentTask {
  id: string;
  prompt: string;
  outputPath: string;
}

export interface SubagentResult {
  id: string;
  status: 'success' | 'failure' | 'timeout';
  output?: string;
  error?: string;
  durationMs: number;
}
```

- [ ] **Step 4: Implement adapters**

`src/ai/adapters/claude.ts`:

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AIEngine, AIRunOptions } from '../types.js';

const execFileAsync = promisify(execFile);

export class ClaudeAdapter implements AIEngine {
  name = 'claude';

  async run(prompt: string, options?: AIRunOptions): Promise<string> {
    const args = ['-p', prompt];
    if (options?.model) {
      args.push('--model', options.model);
    }
    const timeout = (options?.timeout ?? 300) * 1000;
    const { stdout } = await execFileAsync('claude', args, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  }
}
```

`src/ai/adapters/codex.ts`:

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AIEngine, AIRunOptions } from '../types.js';

const execFileAsync = promisify(execFile);

export class CodexAdapter implements AIEngine {
  name = 'codex';

  async run(prompt: string, options?: AIRunOptions): Promise<string> {
    const args = ['-q', prompt];
    if (options?.model) {
      args.push('--model', options.model);
    }
    const timeout = (options?.timeout ?? 300) * 1000;
    const { stdout } = await execFileAsync('codex', args, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  }
}
```

`src/ai/adapters/gemini.ts`:

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AIEngine, AIRunOptions } from '../types.js';

const execFileAsync = promisify(execFile);

export class GeminiAdapter implements AIEngine {
  name = 'gemini';

  async run(prompt: string, options?: AIRunOptions): Promise<string> {
    const args = ['-p', prompt];
    if (options?.model) {
      args.push('--model', options.model);
    }
    const timeout = (options?.timeout ?? 300) * 1000;
    const { stdout } = await execFileAsync('gemini', args, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  }
}
```

`src/ai/adapters/custom.ts`:

```typescript
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { AIEngine, AIRunOptions } from '../types.js';

const execAsync = promisify(exec);

export class CustomAdapter implements AIEngine {
  name = 'custom';

  constructor(private command: string) {}

  async run(prompt: string, options?: AIRunOptions): Promise<string> {
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    const fullCommand = `${this.command} '${escapedPrompt}'`;
    const timeout = (options?.timeout ?? 300) * 1000;
    const { stdout } = await execAsync(fullCommand, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  }
}
```

- [ ] **Step 5: Implement factory**

`src/ai/factory.ts`:

```typescript
import type { AIEngine, AIConfig } from './types.js';
import { ClaudeAdapter } from './adapters/claude.js';
import { CodexAdapter } from './adapters/codex.js';
import { GeminiAdapter } from './adapters/gemini.js';
import { CustomAdapter } from './adapters/custom.js';

export function createAIEngine(config: AIConfig): AIEngine {
  if (config.command) {
    return new CustomAdapter(config.command);
  }

  switch (config.engine) {
    case 'claude':
      return new ClaudeAdapter();
    case 'codex':
      return new CodexAdapter();
    case 'gemini':
      return new GeminiAdapter();
    case 'custom':
      if (!config.command) {
        throw new Error('custom engine requires a command in ai.command config');
      }
      return new CustomAdapter(config.command);
    default:
      throw new Error(`Unknown AI engine: ${config.engine}`);
  }
}
```

- [ ] **Step 6: Run factory tests**

```bash
npx vitest run tests/ai/factory.test.ts
```

Expected: PASS

- [ ] **Step 7: Write failing test for orchestrator**

`tests/ai/orchestrator.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Orchestrator } from '../../src/ai/orchestrator.js';
import type { AIEngine, SubagentTask } from '../../src/ai/types.js';

function createMockEngine(response = 'mock output'): AIEngine {
  return {
    name: 'mock',
    run: vi.fn().mockResolvedValue(response),
  };
}

describe('Orchestrator', () => {
  it('runs tasks in parallel up to max_parallel', async () => {
    const engine = createMockEngine();
    const orchestrator = new Orchestrator(engine, { max_parallel: 2, timeout: 60 });

    const tasks: SubagentTask[] = [
      { id: 'a', prompt: 'prompt-a', outputPath: '/tmp/a.md' },
      { id: 'b', prompt: 'prompt-b', outputPath: '/tmp/b.md' },
      { id: 'c', prompt: 'prompt-c', outputPath: '/tmp/c.md' },
    ];

    const results = await orchestrator.runAll(tasks);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'success')).toBe(true);
    expect(engine.run).toHaveBeenCalledTimes(3);
  });

  it('handles failures gracefully', async () => {
    const engine: AIEngine = {
      name: 'mock',
      run: vi.fn()
        .mockResolvedValueOnce('ok')
        .mockRejectedValueOnce(new Error('boom')),
    };
    const orchestrator = new Orchestrator(engine, { max_parallel: 4, timeout: 60 });

    const tasks: SubagentTask[] = [
      { id: 'ok', prompt: 'p1', outputPath: '/tmp/ok.md' },
      { id: 'fail', prompt: 'p2', outputPath: '/tmp/fail.md' },
    ];

    const results = await orchestrator.runAll(tasks);
    expect(results.find((r) => r.id === 'ok')?.status).toBe('success');
    expect(results.find((r) => r.id === 'fail')?.status).toBe('failure');
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

```bash
npx vitest run tests/ai/orchestrator.test.ts
```

Expected: FAIL

- [ ] **Step 9: Implement orchestrator**

`src/ai/orchestrator.ts`:

```typescript
import type { AIEngine, SubagentTask, SubagentResult } from './types.js';

interface OrchestratorConfig {
  max_parallel: number;
  timeout: number;
}

export class Orchestrator {
  constructor(
    private engine: AIEngine,
    private config: OrchestratorConfig,
  ) {}

  async runAll(tasks: SubagentTask[]): Promise<SubagentResult[]> {
    const results: SubagentResult[] = [];
    const chunks = this.chunk(tasks, this.config.max_parallel);

    for (const batch of chunks) {
      const batchResults = await Promise.allSettled(
        batch.map((task) => this.runOne(task)),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    }

    return results;
  }

  private async runOne(task: SubagentTask): Promise<SubagentResult> {
    const start = Date.now();
    try {
      const output = await this.engine.run(task.prompt, {
        timeout: this.config.timeout,
      });
      return {
        id: task.id,
        status: 'success',
        output,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const status = error.includes('TIMEOUT') ? 'timeout' : 'failure';
      return {
        id: task.id,
        status,
        error,
        durationMs: Date.now() - start,
      };
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
```

- [ ] **Step 10: Run orchestrator tests**

```bash
npx vitest run tests/ai/orchestrator.test.ts
```

Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/ai/ tests/ai/
git commit -m "feat: add AI engine adapter system with parallel orchestrator"
```

---

## Task 6: Repo Ingestor

**Files:**
- Create: `src/ingestors/types.ts`
- Create: `src/ingestors/repo/index.ts`
- Create: `src/ingestors/repo/structure.ts`
- Create: `src/ingestors/repo/dependencies.ts`
- Create: `src/ingestors/repo/endpoints.ts`
- Create: `src/ingestors/repo/models.ts`
- Create: `src/ingestors/repo/env-vars.ts`
- Create: `src/ingestors/repo/modules.ts`
- Test: `tests/ingestors/repo/structure.test.ts`
- Test: `tests/ingestors/repo/dependencies.test.ts`
- Test: `tests/ingestors/repo/endpoints.test.ts`
- Test: `tests/ingestors/repo/env-vars.test.ts`

- [ ] **Step 1: Implement ingestor interface**

`src/ingestors/types.ts`:

```typescript
export interface IngestorResult {
  files: number;
  artifacts: string[];
}

export interface Ingestor {
  name: string;
  ingest(): Promise<IngestorResult>;
}
```

- [ ] **Step 2: Write failing test for structure scanner**

`tests/ingestors/repo/structure.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scanStructure } from '../../../src/ingestors/repo/structure.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('scanStructure', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-repo-'));
    fs.mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), 'export {}');
    fs.writeFileSync(path.join(tmpDir, 'src', 'components', 'App.tsx'), '<div/>');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('produces a Markdown directory tree', async () => {
    const md = await scanStructure(tmpDir);
    expect(md).toContain('src/');
    expect(md).toContain('package.json');
    expect(md).toContain('components/');
  });

  it('respects exclude patterns', async () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'foo'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'foo', 'index.js'), '');
    const md = await scanStructure(tmpDir, { exclude: ['**/node_modules/**'] });
    expect(md).not.toContain('node_modules');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/ingestors/repo/structure.test.ts
```

Expected: FAIL

- [ ] **Step 4: Implement structure scanner**

`src/ingestors/repo/structure.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { minimatch } from 'minimatch';

interface ScanOptions {
  include?: string[];
  exclude?: string[];
}

export async function scanStructure(repoDir: string, options?: ScanOptions): Promise<string> {
  const lines: string[] = ['# Repository Structure\n'];
  walkDir(repoDir, repoDir, '', lines, options);
  return lines.join('\n');
}

function walkDir(
  baseDir: string,
  currentDir: string,
  prefix: string,
  lines: string[],
  options?: ScanOptions,
): void {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  for (const entry of entries) {
    const relativePath = path.relative(baseDir, path.join(currentDir, entry.name));

    if (options?.exclude?.some((p) => minimatch(relativePath, p))) {
      continue;
    }

    if (entry.isDirectory()) {
      lines.push(`${prefix}${entry.name}/`);
      walkDir(baseDir, path.join(currentDir, entry.name), prefix + '  ', lines, options);
    } else {
      const stat = fs.statSync(path.join(currentDir, entry.name));
      const size = formatSize(stat.size);
      lines.push(`${prefix}${entry.name} (${size})`);
    }
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
```

- [ ] **Step 5: Run structure test**

```bash
npx vitest run tests/ingestors/repo/structure.test.ts
```

Expected: PASS (after `npm install minimatch` and `npm install -D @types/minimatch`)

- [ ] **Step 6: Write failing test for dependencies parser**

`tests/ingestors/repo/dependencies.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseDependencies } from '../../../src/ingestors/repo/dependencies.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('parseDependencies', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-deps-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('parses package.json dependencies', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { express: '^4.18.0', zod: '^3.22.0' },
      devDependencies: { vitest: '^1.0.0' },
    }));
    const md = await parseDependencies(tmpDir);
    expect(md).toContain('express');
    expect(md).toContain('^4.18.0');
    expect(md).toContain('vitest');
    expect(md).toContain('Dev Dependencies');
  });

  it('handles missing package.json gracefully', async () => {
    const md = await parseDependencies(tmpDir);
    expect(md).toContain('No package manifests found');
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

```bash
npx vitest run tests/ingestors/repo/dependencies.test.ts
```

- [ ] **Step 8: Implement dependencies parser**

`src/ingestors/repo/dependencies.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { table } from '../../utils/markdown.js';

export async function parseDependencies(repoDir: string): Promise<string> {
  const sections: string[] = ['# Dependencies\n'];
  let found = false;

  const pkgPath = path.join(repoDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    found = true;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
      sections.push('## Production Dependencies\n');
      sections.push(table(
        ['Package', 'Version'],
        Object.entries(pkg.dependencies).map(([name, ver]) => [name, String(ver)]),
      ));
      sections.push('');
    }

    if (pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0) {
      sections.push('## Dev Dependencies\n');
      sections.push(table(
        ['Package', 'Version'],
        Object.entries(pkg.devDependencies).map(([name, ver]) => [name, String(ver)]),
      ));
      sections.push('');
    }
  }

  if (!found) {
    sections.push('No package manifests found.');
  }

  return sections.join('\n');
}
```

- [ ] **Step 9: Run dependencies test**

```bash
npx vitest run tests/ingestors/repo/dependencies.test.ts
```

Expected: PASS

- [ ] **Step 10: Implement endpoints detector**

`src/ingestors/repo/endpoints.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { table } from '../../utils/markdown.js';

const ROUTE_PATTERNS = [
  /\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  /@(Get|Post|Put|Patch|Delete|All)\s*\(\s*['"`]([^'"`]*)['"`]?\s*\)/gi,
  /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  /@app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
];

interface Endpoint {
  method: string;
  path: string;
  file: string;
  line: number;
}

export async function detectEndpoints(repoDir: string, options?: { include?: string[]; exclude?: string[] }): Promise<string> {
  const endpoints: Endpoint[] = [];
  scanDir(repoDir, repoDir, endpoints, options?.exclude);

  const sections: string[] = ['# HTTP Endpoints\n'];

  if (endpoints.length === 0) {
    sections.push('No HTTP endpoints detected.');
    return sections.join('\n');
  }

  sections.push(`Found ${endpoints.length} endpoint(s).\n`);
  sections.push(table(
    ['Method', 'Path', 'File', 'Line'],
    endpoints.map((e) => [e.method.toUpperCase(), e.path, e.file, String(e.line)]),
  ));

  return sections.join('\n');
}

function scanDir(baseDir: string, dir: string, endpoints: Endpoint[], exclude?: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const rel = path.relative(baseDir, fullPath);

    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    if (entry.isDirectory()) {
      scanDir(baseDir, fullPath, endpoints, exclude);
    } else if (/\.(ts|js|tsx|jsx|py)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        for (const pattern of ROUTE_PATTERNS) {
          pattern.lastIndex = 0;
          const match = pattern.exec(lines[i]);
          if (match) {
            endpoints.push({
              method: match[1],
              path: match[2],
              file: rel,
              line: i + 1,
            });
          }
        }
      }
    }
  }
}
```

- [ ] **Step 11: Implement env-vars scanner**

`src/ingestors/repo/env-vars.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { table } from '../../utils/markdown.js';

const ENV_PATTERNS = [
  /process\.env\.(\w+)/g,
  /process\.env\[['"`](\w+)['"`]\]/g,
  /os\.environ(?:\.get)?\(?['"`](\w+)['"`]/g,
  /Deno\.env\.get\(['"`](\w+)['"`]\)/g,
];

interface EnvVar {
  name: string;
  file: string;
  line: number;
}

export async function scanEnvVars(repoDir: string): Promise<string> {
  const vars: EnvVar[] = [];
  scanDir(repoDir, repoDir, vars);

  const sections: string[] = ['# Environment Variables\n'];

  if (vars.length === 0) {
    sections.push('No environment variable usage detected.');
    return sections.join('\n');
  }

  const unique = [...new Set(vars.map((v) => v.name))].sort();
  sections.push(`Found ${unique.length} unique environment variable(s).\n`);

  sections.push(table(
    ['Variable', 'Used In', 'Line'],
    vars.map((v) => [v.name, v.file, String(v.line)]),
  ));

  return sections.join('\n');
}

function scanDir(baseDir: string, dir: string, vars: EnvVar[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDir(baseDir, fullPath, vars);
    } else if (/\.(ts|js|tsx|jsx|py|rb)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        for (const pattern of ENV_PATTERNS) {
          pattern.lastIndex = 0;
          let match;
          while ((match = pattern.exec(lines[i])) !== null) {
            vars.push({
              name: match[1],
              file: path.relative(baseDir, fullPath),
              line: i + 1,
            });
          }
        }
      }
    }
  }
}
```

- [ ] **Step 12: Implement models extractor**

`src/ingestors/repo/models.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

const MODEL_FILE_PATTERNS = [
  /\.prisma$/,
  /\.entity\.(ts|js)$/,
  /\.model\.(ts|js)$/,
  /\.schema\.(ts|js)$/,
  /migrations?\//,
  /\.sql$/,
];

export async function extractModels(repoDir: string): Promise<string> {
  const sections: string[] = ['# Data Models\n'];
  const modelFiles: { file: string; content: string }[] = [];

  findModelFiles(repoDir, repoDir, modelFiles);

  if (modelFiles.length === 0) {
    sections.push('No data model files detected.');
    return sections.join('\n');
  }

  sections.push(`Found ${modelFiles.length} model file(s).\n`);

  for (const { file, content } of modelFiles) {
    sections.push(`## ${file}\n`);
    sections.push('```');
    sections.push(content.slice(0, 3000));
    if (content.length > 3000) sections.push('... (truncated)');
    sections.push('```\n');
  }

  return sections.join('\n');
}

function findModelFiles(
  baseDir: string,
  dir: string,
  results: { file: string; content: string }[],
): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findModelFiles(baseDir, fullPath, results);
    } else {
      const rel = path.relative(baseDir, fullPath);
      if (MODEL_FILE_PATTERNS.some((p) => p.test(rel))) {
        results.push({
          file: rel,
          content: fs.readFileSync(fullPath, 'utf-8'),
        });
      }
    }
  }
}
```

- [ ] **Step 13: Implement modules summarizer**

`src/ingestors/repo/modules.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ModuleInfo {
  name: string;
  files: number;
  exports: string[];
  imports: string[];
}

export async function summarizeModules(repoDir: string): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const srcDir = findSrcDir(repoDir);
  if (!srcDir) return results;

  const topDirs = fs.readdirSync(srcDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'));

  for (const dir of topDirs) {
    const moduleDir = path.join(srcDir, dir.name);
    const info = analyzeModule(moduleDir, dir.name);
    const md = formatModule(info);
    results.set(dir.name, md);
  }

  return results;
}

function findSrcDir(repoDir: string): string | null {
  for (const candidate of ['src', 'lib', 'app', 'packages']) {
    const p = path.join(repoDir, candidate);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
  }
  return null;
}

function analyzeModule(dir: string, name: string): ModuleInfo {
  const files = countFiles(dir);
  const exports: string[] = [];
  const imports: string[] = [];

  walkForExportsImports(dir, exports, imports);

  return { name, files, exports: [...new Set(exports)], imports: [...new Set(imports)] };
}

function countFiles(dir: string): number {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) count += countFiles(path.join(dir, e.name));
    else count++;
  }
  return count;
}

function walkForExportsImports(dir: string, exports: string[], imports: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkForExportsImports(full, exports, imports);
    } else if (/\.(ts|js|tsx|jsx)$/.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf-8');
      const exportMatches = content.matchAll(/export\s+(?:default\s+)?(?:class|function|const|interface|type|enum)\s+(\w+)/g);
      for (const m of exportMatches) exports.push(m[1]);
      const importMatches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
      for (const m of importMatches) {
        if (!m[1].startsWith('.')) imports.push(m[1]);
      }
    }
  }
}

function formatModule(info: ModuleInfo): string {
  const lines = [`# Module: ${info.name}\n`];
  lines.push(`**Files:** ${info.files}`);
  if (info.exports.length > 0) {
    lines.push(`\n**Exports:** ${info.exports.join(', ')}`);
  }
  if (info.imports.length > 0) {
    lines.push(`\n**External dependencies:** ${info.imports.join(', ')}`);
  }
  return lines.join('\n');
}
```

- [ ] **Step 14: Implement RepoIngestor orchestrator**

`src/ingestors/repo/index.ts`:

```typescript
import * as path from 'node:path';
import type { Ingestor, IngestorResult } from '../types.js';
import { writeMarkdown, ensureDir } from '../../utils/fs.js';
import { cloneIfRemote } from '../../utils/git.js';
import { scanStructure } from './structure.js';
import { parseDependencies } from './dependencies.js';
import { detectEndpoints } from './endpoints.js';
import { extractModels } from './models.js';
import { scanEnvVars } from './env-vars.js';
import { summarizeModules } from './modules.js';

interface RepoConfig {
  path: string;
  branch?: string;
  include?: string[];
  exclude?: string[];
}

export class RepoIngestor implements Ingestor {
  name = 'repo';

  constructor(
    private config: RepoConfig,
    private outputDir: string,
  ) {}

  async ingest(): Promise<IngestorResult> {
    const repoDir = await cloneIfRemote(this.config.path, path.join(this.outputDir, '_clone'));
    const outDir = path.join(this.outputDir, 'repo');
    ensureDir(outDir);

    const artifacts: string[] = [];
    const opts = { include: this.config.include, exclude: this.config.exclude };

    const structure = await scanStructure(repoDir, opts);
    writeMarkdown(path.join(outDir, 'structure.md'), structure);
    artifacts.push('repo/structure.md');

    const deps = await parseDependencies(repoDir);
    writeMarkdown(path.join(outDir, 'dependencies.md'), deps);
    artifacts.push('repo/dependencies.md');

    const endpoints = await detectEndpoints(repoDir, opts);
    writeMarkdown(path.join(outDir, 'endpoints.md'), endpoints);
    artifacts.push('repo/endpoints.md');

    const models = await extractModels(repoDir);
    writeMarkdown(path.join(outDir, 'models.md'), models);
    artifacts.push('repo/models.md');

    const envVars = await scanEnvVars(repoDir);
    writeMarkdown(path.join(outDir, 'env-vars.md'), envVars);
    artifacts.push('repo/env-vars.md');

    const modules = await summarizeModules(repoDir);
    const modulesDir = path.join(outDir, 'modules');
    ensureDir(modulesDir);
    for (const [name, md] of modules) {
      writeMarkdown(path.join(modulesDir, `${name}.md`), md);
      artifacts.push(`repo/modules/${name}.md`);
    }

    return { files: artifacts.length, artifacts };
  }
}
```

- [ ] **Step 15: Run all repo ingestor tests**

```bash
npx vitest run tests/ingestors/repo/
```

Expected: PASS

- [ ] **Step 16: Commit**

```bash
git add src/ingestors/ tests/ingestors/
git commit -m "feat: add repo ingestor with structure, deps, endpoints, models, env-vars, modules"
```

---

## Task 7: Jira Ingestor

**Files:**
- Create: `src/ingestors/jira/index.ts`
- Create: `src/ingestors/jira/query-builder.ts`
- Create: `src/ingestors/jira/formatter.ts`
- Test: `tests/ingestors/jira/query-builder.test.ts`
- Test: `tests/ingestors/jira/formatter.test.ts`

- [ ] **Step 1: Write failing test for JQL query builder**

`tests/ingestors/jira/query-builder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildJQL } from '../../../src/ingestors/jira/query-builder.js';

describe('buildJQL', () => {
  it('returns raw jql if provided', () => {
    const jql = buildJQL({ jql: 'project = PROJ ORDER BY created' });
    expect(jql).toBe('project = PROJ ORDER BY created');
  });

  it('builds JQL from project filter', () => {
    const jql = buildJQL({ projects: ['PROJ'] });
    expect(jql).toContain('project IN ("PROJ")');
  });

  it('combines multiple filters with AND', () => {
    const jql = buildJQL({
      projects: ['PROJ'],
      types: ['Epic', 'Story'],
      status: ['Done'],
    });
    expect(jql).toContain('project IN ("PROJ")');
    expect(jql).toContain('issuetype IN ("Epic","Story")');
    expect(jql).toContain('status IN ("Done")');
    expect(jql).toContain(' AND ');
  });

  it('handles title_contains with summary ~', () => {
    const jql = buildJQL({ title_contains: ['auth flow', 'login'] });
    expect(jql).toContain('summary ~ "auth flow"');
    expect(jql).toContain('summary ~ "login"');
  });

  it('handles labels filter', () => {
    const jql = buildJQL({ labels: ['mvp', 'core'] });
    expect(jql).toContain('labels IN ("mvp","core")');
  });

  it('returns empty string for no filters', () => {
    const jql = buildJQL({});
    expect(jql).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/ingestors/jira/query-builder.test.ts
```

- [ ] **Step 3: Implement query builder**

`src/ingestors/jira/query-builder.ts`:

```typescript
interface JiraFilters {
  projects?: string[];
  labels?: string[];
  title_contains?: string[];
  types?: string[];
  status?: string[];
  sprints?: string[];
  jql?: string;
}

export function buildJQL(filters: JiraFilters): string {
  if (filters.jql) return filters.jql;

  const clauses: string[] = [];

  if (filters.projects?.length) {
    clauses.push(`project IN (${filters.projects.map((p) => `"${p}"`).join(',')})`);
  }

  if (filters.types?.length) {
    clauses.push(`issuetype IN (${filters.types.map((t) => `"${t}"`).join(',')})`);
  }

  if (filters.status?.length) {
    clauses.push(`status IN (${filters.status.map((s) => `"${s}"`).join(',')})`);
  }

  if (filters.labels?.length) {
    clauses.push(`labels IN (${filters.labels.map((l) => `"${l}"`).join(',')})`);
  }

  if (filters.title_contains?.length) {
    for (const term of filters.title_contains) {
      clauses.push(`summary ~ "${term}"`);
    }
  }

  if (filters.sprints?.length) {
    clauses.push(`sprint IN (${filters.sprints.map((s) => `"${s}"`).join(',')})`);
  }

  return clauses.join(' AND ');
}
```

- [ ] **Step 4: Run query builder test**

```bash
npx vitest run tests/ingestors/jira/query-builder.test.ts
```

Expected: PASS

- [ ] **Step 5: Implement ticket formatter**

`src/ingestors/jira/formatter.ts`:

```typescript
interface JiraTicket {
  key: string;
  fields: {
    summary: string;
    description?: string | null;
    issuetype: { name: string };
    status: { name: string };
    labels: string[];
    comment?: { comments: Array<{ body: string; author: { displayName: string } }> };
    issuelinks?: Array<{
      type: { name: string };
      outwardIssue?: { key: string };
      inwardIssue?: { key: string };
    }>;
  };
}

export function formatTicket(ticket: JiraTicket): string {
  const { key, fields } = ticket;
  const lines: string[] = [];

  lines.push(`### ${key}: ${fields.summary}\n`);
  lines.push(`**Type:** ${fields.issuetype.name}`);
  lines.push(`**Status:** ${fields.status.name}`);

  if (fields.labels.length > 0) {
    lines.push(`**Labels:** ${fields.labels.join(', ')}`);
  }

  if (fields.description) {
    lines.push(`\n**Description:**\n${fields.description}`);
  }

  if (fields.issuelinks?.length) {
    const links = fields.issuelinks.map((l) => {
      const linked = l.outwardIssue?.key ?? l.inwardIssue?.key;
      return `${l.type.name}: ${linked}`;
    });
    lines.push(`\n**Links:** ${links.join(', ')}`);
  }

  if (fields.comment?.comments?.length) {
    lines.push('\n**Comments:**');
    for (const c of fields.comment.comments.slice(0, 5)) {
      lines.push(`- **${c.author.displayName}:** ${c.body.slice(0, 200)}`);
    }
  }

  lines.push('\n---\n');
  return lines.join('\n');
}

export function groupByType(tickets: JiraTicket[]): Map<string, JiraTicket[]> {
  const grouped = new Map<string, JiraTicket[]>();
  for (const ticket of tickets) {
    const type = ticket.fields.issuetype.name;
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type)!.push(ticket);
  }
  return grouped;
}
```

- [ ] **Step 6: Implement JiraIngestor**

`src/ingestors/jira/index.ts`:

```typescript
import { Version2Client } from 'jira.js';
import * as path from 'node:path';
import type { Ingestor, IngestorResult } from '../types.js';
import { writeMarkdown, ensureDir } from '../../utils/fs.js';
import { resolveEnvAuth } from '../../config/loader.js';
import { buildJQL } from './query-builder.js';
import { formatTicket, groupByType } from './formatter.js';

interface JiraConfig {
  host: string;
  auth: string;
  filters?: {
    projects?: string[];
    labels?: string[];
    title_contains?: string[];
    types?: string[];
    status?: string[];
    sprints?: string[];
    jql?: string;
  };
}

export class JiraIngestor implements Ingestor {
  name = 'jira';

  constructor(
    private config: JiraConfig,
    private outputDir: string,
  ) {}

  async ingest(): Promise<IngestorResult> {
    const token = resolveEnvAuth(this.config.auth);
    const client = new Version2Client({
      host: this.config.host,
      authentication: {
        basic: { email: '', apiToken: token },
      },
    });

    const jql = buildJQL(this.config.filters ?? {});
    if (!jql) {
      return { files: 0, artifacts: [] };
    }

    const tickets: any[] = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const response = await client.issueSearch.searchForIssuesUsingJql({
        jql,
        startAt,
        maxResults,
        fields: ['summary', 'description', 'issuetype', 'status', 'labels', 'comment', 'issuelinks'],
      });

      if (!response.issues?.length) break;
      tickets.push(...response.issues);
      startAt += response.issues.length;
      if (startAt >= (response.total ?? 0)) break;
    }

    const outDir = path.join(this.outputDir, 'jira');
    ensureDir(outDir);
    const artifacts: string[] = [];

    const grouped = groupByType(tickets);
    const typeFileMap: Record<string, string> = {
      Epic: 'epics.md',
      Story: 'stories.md',
      Bug: 'bugs.md',
    };

    for (const [type, items] of grouped) {
      const filename = typeFileMap[type] ?? `${type.toLowerCase().replace(/\s+/g, '-')}.md`;
      const content = `# ${type}s\n\n${items.map(formatTicket).join('\n')}`;
      writeMarkdown(path.join(outDir, filename), content);
      artifacts.push(`jira/${filename}`);
    }

    return { files: tickets.length, artifacts };
  }
}
```

- [ ] **Step 7: Run all Jira tests**

```bash
npx vitest run tests/ingestors/jira/
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/ingestors/jira/ tests/ingestors/jira/
git commit -m "feat: add Jira ingestor with JQL query builder and ticket formatter"
```

---

## Task 8: Docs Ingestor

**Files:**
- Create: `src/ingestors/docs/index.ts`
- Test: `tests/ingestors/docs/index.test.ts`

- [ ] **Step 1: Write failing test**

`tests/ingestors/docs/index.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocsIngestor } from '../../../src/ingestors/docs/index.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('DocsIngestor', () => {
  let tmpDir: string;
  let outDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-docs-'));
    outDir = path.join(tmpDir, 'output');
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'guide.md'), '# Guide\nSome content');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# My Project\nReadme content');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('ingests local doc files', async () => {
    const ingestor = new DocsIngestor(
      { local: [path.join(tmpDir, 'docs')] },
      outDir,
      tmpDir,
    );
    const result = await ingestor.ingest();
    expect(result.files).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(outDir, 'docs'))).toBe(true);
  });

  it('captures root README', async () => {
    const ingestor = new DocsIngestor({ local: [] }, outDir, tmpDir);
    const result = await ingestor.ingest();
    expect(result.artifacts).toContain('docs/readme.md');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/ingestors/docs/index.test.ts
```

- [ ] **Step 3: Implement DocsIngestor**

`src/ingestors/docs/index.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Ingestor, IngestorResult } from '../types.js';
import { writeMarkdown, ensureDir } from '../../utils/fs.js';

interface DocsConfig {
  confluence?: { host: string; space: string; auth: string };
  local?: string[];
}

export class DocsIngestor implements Ingestor {
  name = 'docs';

  constructor(
    private config: DocsConfig,
    private outputDir: string,
    private projectDir: string,
  ) {}

  async ingest(): Promise<IngestorResult> {
    const outDir = path.join(this.outputDir, 'docs');
    ensureDir(outDir);
    const artifacts: string[] = [];
    let fileCount = 0;

    const readmePath = path.join(this.projectDir, 'README.md');
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8');
      writeMarkdown(path.join(outDir, 'readme.md'), content);
      artifacts.push('docs/readme.md');
      fileCount++;
    }

    if (this.config.local?.length) {
      for (const localPath of this.config.local) {
        const resolved = path.resolve(this.projectDir, localPath);
        if (!fs.existsSync(resolved)) continue;

        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
          fileCount += this.copyDir(resolved, path.join(outDir, 'local'), artifacts);
        } else if (/\.(md|txt|rst)$/.test(resolved)) {
          const content = fs.readFileSync(resolved, 'utf-8');
          const name = path.basename(resolved);
          writeMarkdown(path.join(outDir, 'local', name), content);
          artifacts.push(`docs/local/${name}`);
          fileCount++;
        }
      }
    }

    // Confluence: placeholder for Phase 3
    if (this.config.confluence) {
      writeMarkdown(path.join(outDir, '_confluence-pending.md'),
        '# Confluence Ingestion\n\nConfluence integration is pending. Configure `sources.docs.confluence` and re-run.');
      artifacts.push('docs/_confluence-pending.md');
    }

    return { files: fileCount, artifacts };
  }

  private copyDir(srcDir: string, destDir: string, artifacts: string[]): number {
    ensureDir(destDir);
    let count = 0;
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      if (entry.isDirectory()) {
        count += this.copyDir(srcPath, path.join(destDir, entry.name), artifacts);
      } else if (/\.(md|txt|rst)$/.test(entry.name)) {
        const content = fs.readFileSync(srcPath, 'utf-8');
        writeMarkdown(path.join(destDir, entry.name), content);
        artifacts.push(`docs/local/${entry.name}`);
        count++;
      }
    }
    return count;
  }
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run tests/ingestors/docs/index.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ingestors/docs/ tests/ingestors/docs/
git commit -m "feat: add docs ingestor for local files and README"
```

---

## Task 9: Analyzer Prompt Templates + Registry

**Files:**
- Create: `src/analyzers/types.ts`
- Create: `src/analyzers/registry.ts`
- Create: `src/analyzers/report.ts`
- Create: `prompts/domain-mapper.md`
- Create: `prompts/flow-extractor.md`
- Create: `prompts/rule-miner.md`
- Create: `prompts/permission-scanner.md`
- Create: `prompts/api-mapper.md`
- Create: `prompts/infra-detector.md`
- Create: `src/analyzers/prompts/domain-mapper.ts` (loader)
- Test: `tests/analyzers/registry.test.ts`

- [ ] **Step 1: Implement analyzer types**

`src/analyzers/types.ts`:

```typescript
export interface AnalyzerDef {
  id: string;
  reads: string[];
  produces: string[];
  promptFile: string;
  tier: number;
}

export interface AnalyzerReport {
  id: string;
  status: 'success' | 'failure' | 'timeout';
  durationMs: number;
  outputFiles: string[];
  confidence?: string;
}
```

- [ ] **Step 2: Write failing test for registry**

`tests/analyzers/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getAnalyzerRegistry, getAnalyzersByTier } from '../../src/analyzers/registry.js';

describe('AnalyzerRegistry', () => {
  it('returns all 6 analyzers', () => {
    const registry = getAnalyzerRegistry();
    expect(registry).toHaveLength(6);
  });

  it('groups analyzers by tier', () => {
    const tiers = getAnalyzersByTier();
    expect(tiers.get(1)?.length).toBe(3);
    expect(tiers.get(2)?.length).toBe(3);
  });

  it('tier 1 contains domain-mapper, infra-detector, api-mapper', () => {
    const tiers = getAnalyzersByTier();
    const tier1Ids = tiers.get(1)!.map((a) => a.id);
    expect(tier1Ids).toContain('domain-mapper');
    expect(tier1Ids).toContain('infra-detector');
    expect(tier1Ids).toContain('api-mapper');
  });

  it('tier 2 contains flow-extractor, rule-miner, permission-scanner', () => {
    const tiers = getAnalyzersByTier();
    const tier2Ids = tiers.get(2)!.map((a) => a.id);
    expect(tier2Ids).toContain('flow-extractor');
    expect(tier2Ids).toContain('rule-miner');
    expect(tier2Ids).toContain('permission-scanner');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/analyzers/registry.test.ts
```

- [ ] **Step 4: Implement registry**

`src/analyzers/registry.ts`:

```typescript
import type { AnalyzerDef } from './types.js';

const ANALYZERS: AnalyzerDef[] = [
  {
    id: 'domain-mapper',
    reads: ['repo/models.md', 'repo/modules/', 'repo/endpoints.md'],
    produces: ['domain/bounded-contexts.md', 'domain/entities.md', 'domain/glossary.md'],
    promptFile: 'domain-mapper.md',
    tier: 1,
  },
  {
    id: 'infra-detector',
    reads: ['repo/dependencies.md', 'repo/env-vars.md', 'repo/structure.md'],
    produces: ['infra/architecture.md', 'infra/data-storage.md'],
    promptFile: 'infra-detector.md',
    tier: 1,
  },
  {
    id: 'api-mapper',
    reads: ['repo/endpoints.md', 'repo/models.md'],
    produces: ['api/contracts.md', 'api/external-deps.md'],
    promptFile: 'api-mapper.md',
    tier: 1,
  },
  {
    id: 'flow-extractor',
    reads: ['repo/endpoints.md', 'repo/modules/', 'jira/stories.md'],
    produces: ['flows/user-flows.md', 'flows/data-flows.md'],
    promptFile: 'flow-extractor.md',
    tier: 2,
  },
  {
    id: 'rule-miner',
    reads: ['repo/modules/', 'jira/stories.md', 'jira/bugs.md'],
    produces: ['rules/business-rules.md', 'rules/validation-rules.md'],
    promptFile: 'rule-miner.md',
    tier: 2,
  },
  {
    id: 'permission-scanner',
    reads: ['repo/modules/', 'repo/endpoints.md'],
    produces: ['rules/permissions.md'],
    promptFile: 'permission-scanner.md',
    tier: 2,
  },
];

export function getAnalyzerRegistry(): AnalyzerDef[] {
  return ANALYZERS;
}

export function getAnalyzersByTier(): Map<number, AnalyzerDef[]> {
  const tiers = new Map<number, AnalyzerDef[]>();
  for (const a of ANALYZERS) {
    if (!tiers.has(a.tier)) tiers.set(a.tier, []);
    tiers.get(a.tier)!.push(a);
  }
  return tiers;
}

export function getAnalyzerById(id: string): AnalyzerDef | undefined {
  return ANALYZERS.find((a) => a.id === id);
}
```

- [ ] **Step 5: Run registry test**

```bash
npx vitest run tests/analyzers/registry.test.ts
```

Expected: PASS

- [ ] **Step 6: Create prompt templates**

Create all 6 prompt template files under `prompts/`. Each follows the architecture from SDD §7.1. Here's `prompts/domain-mapper.md` as example:

```markdown
You are a senior software architect performing reverse engineering analysis. You are reading normalized documentation from a legacy system.

## Task

Extract the domain model from the provided codebase documentation:

1. **Bounded Contexts** — Identify distinct domain boundaries. Each context should have:
   - Name (PascalCase)
   - Responsibility (1-2 sentences)
   - Key entities it owns
   - Relationships with other contexts

2. **Entities** — For each entity:
   - Name and attributes with types
   - Relationships (belongs-to, has-many, etc.)
   - Which bounded context it belongs to

3. **Glossary** — Define ubiquitous language terms found in the code and tickets.

## Input

{{CONTEXT}}

## Output Format

Produce three separate Markdown sections:

### bounded-contexts.md
### entities.md
### glossary.md

## Confidence

Rate your confidence (HIGH/MEDIUM/LOW) for each bounded context and entity. Explain gaps.
```

(Similarly create `flow-extractor.md`, `rule-miner.md`, `permission-scanner.md`, `api-mapper.md`, `infra-detector.md` with their specific instructions from SDD §7.2.)

- [ ] **Step 7: Implement analysis report builder**

`src/analyzers/report.ts`:

```typescript
import type { AnalyzerReport } from './types.js';
import { timestamp } from '../utils/markdown.js';

export function buildAnalysisReport(results: AnalyzerReport[]): string {
  const lines: string[] = ['# Analysis Report\n'];
  lines.push(`**Generated:** ${timestamp()}\n`);

  const succeeded = results.filter((r) => r.status === 'success');
  const failed = results.filter((r) => r.status !== 'success');

  lines.push(`**Total:** ${results.length} analyzers`);
  lines.push(`**Succeeded:** ${succeeded.length}`);
  lines.push(`**Failed:** ${failed.length}\n`);

  lines.push('## Results\n');
  lines.push('| Analyzer | Status | Duration | Files | Confidence |');
  lines.push('|----------|--------|----------|-------|------------|');
  for (const r of results) {
    const duration = `${(r.durationMs / 1000).toFixed(1)}s`;
    lines.push(`| ${r.id} | ${r.status} | ${duration} | ${r.outputFiles.length} | ${r.confidence ?? 'N/A'} |`);
  }

  if (failed.length > 0) {
    lines.push('\n## Failures\n');
    for (const r of failed) {
      lines.push(`### ${r.id}\n`);
      lines.push(`Status: ${r.status}`);
    }
  }

  return lines.join('\n');
}
```

- [ ] **Step 8: Commit**

```bash
git add src/analyzers/ tests/analyzers/ prompts/
git commit -m "feat: add analyzer registry, prompt templates, and analysis report builder"
```

---

## Task 10: Generator Registry + SDD Generator

**Files:**
- Create: `src/generators/types.ts`
- Create: `src/generators/registry.ts`
- Create: `src/generators/sdd-gen.ts`
- Create: `src/generators/erd-gen.ts`
- Create: `src/generators/flow-gen.ts`
- Create: `src/generators/task-gen.ts`
- Create: `src/generators/adr-gen.ts`
- Create: `src/generators/format-gen.ts`
- Test: `tests/generators/registry.test.ts`

- [ ] **Step 1: Implement generator types**

`src/generators/types.ts`:

```typescript
export interface GeneratorDef {
  id: string;
  reads: string[];
  produces: string[];
  tier: number;
}

export interface GeneratorContext {
  analyzedDir: string;
  specsDir: string;
  projectName: string;
  format: string;
}
```

- [ ] **Step 2: Write failing test for registry**

`tests/generators/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getGeneratorRegistry, getGeneratorsByTier } from '../../src/generators/registry.js';

describe('GeneratorRegistry', () => {
  it('returns all 6 generators', () => {
    const registry = getGeneratorRegistry();
    expect(registry).toHaveLength(6);
  });

  it('tier 1 has erd-gen, flow-gen, adr-gen', () => {
    const tiers = getGeneratorsByTier();
    const ids = tiers.get(1)!.map((g) => g.id);
    expect(ids).toContain('erd-gen');
    expect(ids).toContain('flow-gen');
    expect(ids).toContain('adr-gen');
  });

  it('tier 2 has sdd-gen (sequential)', () => {
    const tiers = getGeneratorsByTier();
    expect(tiers.get(2)!.map((g) => g.id)).toEqual(['sdd-gen']);
  });

  it('tier 3 has task-gen and format-gen', () => {
    const tiers = getGeneratorsByTier();
    const ids = tiers.get(3)!.map((g) => g.id);
    expect(ids).toContain('task-gen');
    expect(ids).toContain('format-gen');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/generators/registry.test.ts
```

- [ ] **Step 4: Implement registry**

`src/generators/registry.ts`:

```typescript
import type { GeneratorDef } from './types.js';

const GENERATORS: GeneratorDef[] = [
  {
    id: 'erd-gen',
    reads: ['domain/entities.md', 'domain/bounded-contexts.md'],
    produces: ['domain/erd.mermaid', 'domain/context-map.mermaid'],
    tier: 1,
  },
  {
    id: 'flow-gen',
    reads: ['flows/user-flows.md', 'flows/data-flows.md'],
    produces: ['flows/*.mermaid'],
    tier: 1,
  },
  {
    id: 'adr-gen',
    reads: ['infra/architecture.md', 'api/external-deps.md'],
    produces: ['adrs/adr-*.md'],
    tier: 1,
  },
  {
    id: 'sdd-gen',
    reads: ['domain/*', 'flows/*', 'rules/*', 'api/*', 'infra/*'],
    produces: ['sdd.md'],
    tier: 2,
  },
  {
    id: 'task-gen',
    reads: ['domain/*', 'flows/*', 'rules/*', 'api/*', 'sdd.md'],
    produces: ['tasks/epics.md', 'tasks/stories/**/*.md', 'tasks/migration-plan.md'],
    tier: 3,
  },
  {
    id: 'format-gen',
    reads: ['**/*'],
    produces: ['format-specific output'],
    tier: 3,
  },
];

export function getGeneratorRegistry(): GeneratorDef[] {
  return GENERATORS;
}

export function getGeneratorsByTier(): Map<number, GeneratorDef[]> {
  const tiers = new Map<number, GeneratorDef[]>();
  for (const g of GENERATORS) {
    if (!tiers.has(g.tier)) tiers.set(g.tier, []);
    tiers.get(g.tier)!.push(g);
  }
  return tiers;
}
```

- [ ] **Step 5: Run registry test**

```bash
npx vitest run tests/generators/registry.test.ts
```

Expected: PASS

- [ ] **Step 6: Implement stub generators (sdd-gen, erd-gen, flow-gen, task-gen, adr-gen, format-gen)**

Each generator will be an AI-driven module. For now, implement the prompt-building logic + file-writing contract. The AI call itself delegates to the orchestrator.

`src/generators/sdd-gen.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratorContext } from './types.js';

const SDD_SECTIONS = [
  '1. Overview',
  '2. Goals & Non-Goals',
  '3. Domain Model',
  '4. Architecture',
  '5. Data Model',
  '6. API Design',
  '7. User Flows',
  '8. Business Rules',
  '9. Security & Auth',
  '10. Infrastructure & Deployment',
  '11. Migration Strategy',
  '12. Open Questions',
];

export function buildSDDPrompt(ctx: GeneratorContext): string {
  const analyzed = readAnalyzedFiles(ctx.analyzedDir);
  return `You are generating a System Design Document for "${ctx.projectName}".

Based on the following analysis data, produce a complete SDD with these 12 sections:
${SDD_SECTIONS.map((s) => `- ${s}`).join('\n')}

## Analysis Data

${analyzed}

## Output

Produce one Markdown document with all 12 sections. Each section should be comprehensive.
Include references to Mermaid diagrams where applicable.
Flag any LOW confidence items in Section 12 (Open Questions).`;
}

function readAnalyzedFiles(dir: string): string {
  if (!fs.existsSync(dir)) return '(no analyzed data found)';

  const sections: string[] = [];
  readDirRecursive(dir, dir, sections);
  return sections.join('\n\n---\n\n');
}

function readDirRecursive(baseDir: string, dir: string, sections: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort();
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      readDirRecursive(baseDir, fullPath, sections);
    } else if (entry.name.endsWith('.md')) {
      const rel = path.relative(baseDir, fullPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      sections.push(`### File: ${rel}\n\n${content}`);
    }
  }
}
```

(Create similar stubs for `erd-gen.ts`, `flow-gen.ts`, `task-gen.ts`, `adr-gen.ts`, `format-gen.ts` — each building a prompt and delegating to the AI engine.)

- [ ] **Step 7: Commit**

```bash
git add src/generators/ tests/generators/
git commit -m "feat: add generator registry and SDD/ERD/flow/task/ADR/format generators"
```

---

## Task 11: Output Format Adapters

**Files:**
- Create: `src/formats/types.ts`
- Create: `src/formats/factory.ts`
- Create: `src/formats/kiro.ts`
- Create: `src/formats/openspec.ts`
- Create: `src/formats/antigravity.ts`
- Create: `src/formats/superpowers.ts`
- Test: `tests/formats/kiro.test.ts`
- Test: `tests/formats/openspec.test.ts`
- Test: `tests/formats/antigravity.test.ts`
- Test: `tests/formats/superpowers.test.ts`

- [ ] **Step 1: Implement format types**

`src/formats/types.ts`:

```typescript
export interface FormatAdapter {
  name: string;
  package(specsDir: string, outputDir: string, context: FormatContext): Promise<void>;
}

export interface FormatContext {
  projectName: string;
  projectDescription: string;
  sddContent: string;
  analyzedDir: string;
}
```

- [ ] **Step 2: Write failing test for Kiro format**

`tests/formats/kiro.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KiroFormat } from '../../src/formats/kiro.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('KiroFormat', () => {
  let tmpDir: string;
  let outDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-kiro-'));
    outDir = path.join(tmpDir, 'output');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates .kiro/steering/ directory', async () => {
    const format = new KiroFormat();
    await format.package(tmpDir, outDir, {
      projectName: 'Test',
      projectDescription: 'A test project',
      sddContent: '# SDD\nTest content',
      analyzedDir: tmpDir,
    });
    expect(fs.existsSync(path.join(outDir, '.kiro', 'steering', 'product.md'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, '.kiro', 'steering', 'tech.md'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, '.kiro', 'steering', 'structure.md'))).toBe(true);
  });

  it('creates .kiro/specs/ directory', async () => {
    const format = new KiroFormat();
    await format.package(tmpDir, outDir, {
      projectName: 'Test',
      projectDescription: 'Test',
      sddContent: '# SDD',
      analyzedDir: tmpDir,
    });
    expect(fs.existsSync(path.join(outDir, '.kiro', 'specs'))).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/formats/kiro.test.ts
```

- [ ] **Step 4: Implement Kiro format adapter**

`src/formats/kiro.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FormatAdapter, FormatContext } from './types.js';
import { ensureDir, writeMarkdown } from '../utils/fs.js';

export class KiroFormat implements FormatAdapter {
  name = 'kiro';

  async package(_specsDir: string, outputDir: string, ctx: FormatContext): Promise<void> {
    const kiroDir = path.join(outputDir, '.kiro');
    const steeringDir = path.join(kiroDir, 'steering');
    const specsDir = path.join(kiroDir, 'specs');

    ensureDir(steeringDir);
    ensureDir(specsDir);

    writeMarkdown(path.join(steeringDir, 'product.md'),
      `# Product Context\n\n**Project:** ${ctx.projectName}\n\n${ctx.projectDescription}\n`);

    writeMarkdown(path.join(steeringDir, 'tech.md'),
      `# Tech Stack & Conventions\n\nExtracted from system analysis.\n`);

    writeMarkdown(path.join(steeringDir, 'structure.md'),
      `# Project Structure\n\nSee analyzed domain model for bounded contexts.\n`);

    this.packageAnalyzedAsSpecs(ctx.analyzedDir, specsDir);
  }

  private packageAnalyzedAsSpecs(analyzedDir: string, specsDir: string): void {
    const domainDir = path.join(analyzedDir, 'domain');
    if (fs.existsSync(domainDir)) {
      const specDir = path.join(specsDir, 'domain-model');
      ensureDir(specDir);
      writeMarkdown(path.join(specDir, 'requirements.md'), '# Domain Model Requirements\n\n(Generated from analysis)');
      writeMarkdown(path.join(specDir, 'design.md'), '# Domain Model Design\n\n(Generated from analysis)');
      writeMarkdown(path.join(specDir, 'tasks.md'), '# Domain Model Tasks\n\n- [ ] Implement entities\n- [ ] Define aggregates');
    }
  }
}
```

- [ ] **Step 5: Run Kiro test**

```bash
npx vitest run tests/formats/kiro.test.ts
```

Expected: PASS

- [ ] **Step 6: Implement OpenSpec format adapter**

`src/formats/openspec.ts`:

```typescript
import * as path from 'node:path';
import type { FormatAdapter, FormatContext } from './types.js';
import { ensureDir, writeMarkdown } from '../utils/fs.js';

export class OpenSpecFormat implements FormatAdapter {
  name = 'openspec';

  async package(_specsDir: string, outputDir: string, ctx: FormatContext): Promise<void> {
    const osDir = path.join(outputDir, 'openspec');
    ensureDir(path.join(osDir, 'specs'));
    ensureDir(path.join(osDir, 'changes', 'full-reimplementation'));
    ensureDir(path.join(osDir, 'explorations'));

    writeMarkdown(path.join(osDir, 'AGENTS.md'),
      `# AGENTS.md — ${ctx.projectName}\n\n<openspec-instructions>\nThis project was reverse-engineered using ReSpec.\n</openspec-instructions>\n`);

    writeMarkdown(path.join(osDir, 'project.md'),
      `# ${ctx.projectName}\n\n${ctx.projectDescription}\n`);

    writeMarkdown(path.join(osDir, 'config.yaml'),
      `schema: spec-driven\n\ncontext: |\n  Project: ${ctx.projectName}\n  ${ctx.projectDescription}\n`);

    writeMarkdown(path.join(osDir, 'changes', 'full-reimplementation', 'proposal.md'),
      `## Why\n\nFull reimplementation of ${ctx.projectName} based on reverse-engineered specifications.\n\n## What Changes\n\nComplete system rebuild from specification.\n`);

    writeMarkdown(path.join(osDir, 'changes', 'full-reimplementation', 'tasks.md'),
      `## 1. Foundation\n\n- [ ] 1.1 Set up project structure\n- [ ] 1.2 Configure dependencies\n`);
  }
}
```

- [ ] **Step 7: Implement Antigravity format adapter**

`src/formats/antigravity.ts`:

```typescript
import * as path from 'node:path';
import type { FormatAdapter, FormatContext } from './types.js';
import { ensureDir, writeMarkdown } from '../utils/fs.js';

export class AntigravityFormat implements FormatAdapter {
  name = 'antigravity';

  async package(_specsDir: string, outputDir: string, ctx: FormatContext): Promise<void> {
    ensureDir(path.join(outputDir, '.agent', 'rules'));
    ensureDir(path.join(outputDir, 'docs', 'diagrams'));
    ensureDir(path.join(outputDir, 'tasks'));

    writeMarkdown(path.join(outputDir, 'GEMINI.md'),
      `## Project: ${ctx.projectName}\n\n${ctx.projectDescription}\n\n## My Preferences\n- Follow the SDD in docs/sdd.md for all architectural decisions\n- Use the domain model in .agent/rules/domain-model.md\n`);

    writeMarkdown(path.join(outputDir, 'AGENTS.md'),
      `# AGENTS.md — ${ctx.projectName}\n\n## Tech Stack\n(See docs/sdd.md Section 4)\n\n## Code Quality\n- Follow business rules in .agent/rules/business-rules.md\n`);

    writeMarkdown(path.join(outputDir, '.agent', 'rules', 'domain-model.md'),
      `# Domain Model\n\nExtracted from legacy system analysis.\n`);

    writeMarkdown(path.join(outputDir, '.agent', 'rules', 'business-rules.md'),
      `# Business Rules\n\nExtracted from legacy system analysis.\n`);

    writeMarkdown(path.join(outputDir, 'docs', 'sdd.md'), ctx.sddContent);

    writeMarkdown(path.join(outputDir, 'tasks', 'task.md'),
      `# Implementation Tasks\n\n- [ ] Set up project\n- [ ] Implement domain layer\n`);

    writeMarkdown(path.join(outputDir, 'tasks', 'implementation_plan.md'),
      `# Implementation Plan\n\n## Phase 1: Foundation\n\n## Phase 2: Core Features\n`);
  }
}
```

- [ ] **Step 8: Implement Superpowers format adapter**

`src/formats/superpowers.ts`:

```typescript
import * as path from 'node:path';
import type { FormatAdapter, FormatContext } from './types.js';
import { ensureDir, writeMarkdown } from '../utils/fs.js';

export class SuperpowersFormat implements FormatAdapter {
  name = 'superpowers';

  async package(_specsDir: string, outputDir: string, ctx: FormatContext): Promise<void> {
    const skillsDir = path.join(outputDir, 'skills');

    const skills = [
      { name: 'domain-model', description: 'Use when implementing entities, defining bounded context boundaries, or working with the domain layer' },
      { name: 'business-rules', description: 'Use when implementing validation logic, guards, or business constraints' },
      { name: 'api-contracts', description: 'Use when implementing API endpoints, request/response handling, or integration points' },
      { name: 'user-flows', description: 'Use when implementing user-facing features, navigation, or multi-step workflows' },
      { name: 'data-model', description: 'Use when creating database schemas, migrations, or data access layers' },
      { name: 'security-auth', description: 'Use when implementing authentication, authorization, or security features' },
      { name: 'infrastructure', description: 'Use when setting up deployment, CI/CD, monitoring, or infrastructure' },
      { name: 'migration-guide', description: 'Use when planning implementation order, prioritizing features, or estimating scope' },
    ];

    for (const skill of skills) {
      const dir = path.join(skillsDir, skill.name);
      ensureDir(dir);
      writeMarkdown(path.join(dir, 'SKILL.md'),
        `---\nname: ${skill.name}\nuser-invocable: true\ndescription: ${skill.description}\n---\n\n# ${skill.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}\n\nExtracted from legacy system analysis.\n`);
    }

    writeMarkdown(path.join(outputDir, 'CLAUDE.md'),
      `# ${ctx.projectName}\n\n${ctx.projectDescription}\n\n## Skills\n\nThis project includes reverse-engineered skills in \`skills/\`.\n`);

    writeMarkdown(path.join(outputDir, 'sdd.md'), ctx.sddContent);
  }
}
```

- [ ] **Step 9: Implement format factory**

`src/formats/factory.ts`:

```typescript
import type { FormatAdapter } from './types.js';
import { KiroFormat } from './kiro.js';
import { OpenSpecFormat } from './openspec.js';
import { AntigravityFormat } from './antigravity.js';
import { SuperpowersFormat } from './superpowers.js';

export function createFormatAdapter(format: string): FormatAdapter {
  switch (format) {
    case 'kiro': return new KiroFormat();
    case 'openspec': return new OpenSpecFormat();
    case 'antigravity': return new AntigravityFormat();
    case 'superpowers': return new SuperpowersFormat();
    default: throw new Error(`Unknown output format: ${format}`);
  }
}
```

- [ ] **Step 10: Write and run format tests for all 4 formats**

(Similar to the Kiro test — verify directory structure creation for each format.)

```bash
npx vitest run tests/formats/
```

Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/formats/ tests/formats/
git commit -m "feat: add output format adapters for Kiro, OpenSpec, Antigravity, Superpowers"
```

---

## Task 12: CLI Commands

**Files:**
- Create: `src/commands/init.ts`
- Create: `src/commands/ingest.ts`
- Create: `src/commands/analyze.ts`
- Create: `src/commands/generate.ts`
- Create: `src/commands/export.ts`
- Create: `src/commands/status.ts`
- Create: `src/commands/validate.ts`
- Modify: `bin/respec.ts` — wire up all commands

- [ ] **Step 1: Implement init command**

`src/commands/init.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stringify } from 'yaml';

const DEFAULT_CONFIG = {
  project: {
    name: 'my-project',
    version: '1.0',
    description: 'Project description',
  },
  sources: {
    repo: {
      path: './',
      branch: 'main',
      exclude: ['**/node_modules/**', '**/.git/**'],
    },
  },
  ai: {
    engine: 'claude',
    max_parallel: 4,
    timeout: 300,
  },
  output: {
    dir: './specs',
    format: 'openspec',
    diagrams: 'mermaid',
    tasks: true,
  },
};

export async function runInit(dir: string): Promise<void> {
  const configPath = path.join(dir, 'respec.config.yaml');

  if (fs.existsSync(configPath)) {
    console.log('respec.config.yaml already exists. Use --force to overwrite.');
    return;
  }

  fs.writeFileSync(configPath, stringify(DEFAULT_CONFIG), 'utf-8');
  console.log('Created respec.config.yaml');

  const gitignorePath = path.join(dir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('.respec/')) {
      fs.appendFileSync(gitignorePath, '\n# ReSpec working directory\n.respec/\n');
      console.log('Added .respec/ to .gitignore');
    }
  }
}
```

- [ ] **Step 2: Implement ingest command**

`src/commands/ingest.ts`:

```typescript
import * as path from 'node:path';
import { loadConfig } from '../config/loader.js';
import { StateManager } from '../state/manager.js';
import { RepoIngestor } from '../ingestors/repo/index.js';
import { JiraIngestor } from '../ingestors/jira/index.js';
import { DocsIngestor } from '../ingestors/docs/index.js';
import { writeMarkdown, rawDir } from '../utils/fs.js';
import { timestamp } from '../utils/markdown.js';

export async function runIngest(dir: string, options: { source?: string; force?: boolean }): Promise<void> {
  const config = await loadConfig(dir);
  const outDir = rawDir(dir);
  const state = new StateManager(dir);

  const sources = { repo: false, jira: false, docs: false };
  const stats = { files: 0, tickets: 0, pages: 0 };
  const shouldRun = (name: string) => !options.source || options.source === name;

  if (shouldRun('repo')) {
    console.log('Ingesting repository...');
    const ingestor = new RepoIngestor(config.sources.repo, outDir);
    const result = await ingestor.ingest();
    sources.repo = true;
    stats.files = result.files;
    console.log(`  → ${result.files} artifacts written`);
  }

  if (shouldRun('jira') && config.sources.jira) {
    console.log('Ingesting Jira tickets...');
    const ingestor = new JiraIngestor(config.sources.jira, outDir);
    const result = await ingestor.ingest();
    sources.jira = true;
    stats.tickets = result.files;
    console.log(`  → ${result.files} tickets ingested`);
  }

  if (shouldRun('docs') && config.sources.docs) {
    console.log('Ingesting documentation...');
    const ingestor = new DocsIngestor(config.sources.docs, outDir, dir);
    const result = await ingestor.ingest();
    sources.docs = true;
    stats.pages = result.files;
    console.log(`  → ${result.files} docs ingested`);
  }

  writeMarkdown(path.join(outDir, '_manifest.md'),
    `# Ingestion Manifest\n\n**Timestamp:** ${timestamp()}\n**Sources:** ${JSON.stringify(sources)}\n**Stats:** ${JSON.stringify(stats)}\n`);

  state.completeIngest({ sources, stats });
  console.log('Ingestion complete.');
}
```

- [ ] **Step 3: Implement analyze command**

`src/commands/analyze.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../config/loader.js';
import { StateManager } from '../state/manager.js';
import { createAIEngine } from '../ai/factory.js';
import { Orchestrator } from '../ai/orchestrator.js';
import { getAnalyzersByTier, getAnalyzerById } from '../analyzers/registry.js';
import { buildAnalysisReport } from '../analyzers/report.js';
import { rawDir, analyzedDir, writeMarkdown, readMarkdown } from '../utils/fs.js';
import type { SubagentTask } from '../ai/types.js';
import type { AnalyzerReport } from '../analyzers/types.js';

export async function runAnalyze(dir: string, options: { only?: string; force?: boolean }): Promise<void> {
  const config = await loadConfig(dir);
  const state = new StateManager(dir);

  if (!options.force) {
    state.requirePhase('ingested');
  }

  const engine = createAIEngine(config.ai);
  const orchestrator = new Orchestrator(engine, {
    max_parallel: config.ai.max_parallel,
    timeout: config.ai.timeout,
  });

  const raw = rawDir(dir);
  const analyzed = analyzedDir(dir);
  const allReports: AnalyzerReport[] = [];

  const tiers = getAnalyzersByTier();
  const sortedTiers = [...tiers.keys()].sort();

  for (const tierNum of sortedTiers) {
    let analyzers = tiers.get(tierNum)!;

    if (options.only) {
      analyzers = analyzers.filter((a) => a.id === options.only);
    }

    if (analyzers.length === 0) continue;

    console.log(`Running Tier ${tierNum} analyzers: ${analyzers.map((a) => a.id).join(', ')}`);

    const tasks: SubagentTask[] = analyzers.map((analyzer) => {
      const contextFiles = analyzer.reads
        .map((r) => {
          const fullPath = path.join(raw, r);
          if (fs.existsSync(fullPath)) return readMarkdown(fullPath);
          return '';
        })
        .filter(Boolean)
        .join('\n\n---\n\n');

      const promptTemplate = fs.readFileSync(
        path.join(dir, 'prompts', analyzer.promptFile),
        'utf-8',
      ).replace('{{CONTEXT}}', contextFiles);

      return {
        id: analyzer.id,
        prompt: promptTemplate,
        outputPath: path.join(analyzed, analyzer.produces[0]),
      };
    });

    const results = await orchestrator.runAll(tasks);

    for (const result of results) {
      const analyzer = analyzers.find((a) => a.id === result.id)!;
      if (result.status === 'success' && result.output) {
        for (const outputFile of analyzer.produces) {
          writeMarkdown(path.join(analyzed, outputFile), result.output);
        }
      }
      allReports.push({
        id: result.id,
        status: result.status,
        durationMs: result.durationMs,
        outputFiles: analyzer.produces,
      });
      console.log(`  ${result.id}: ${result.status} (${(result.durationMs / 1000).toFixed(1)}s)`);
    }
  }

  const report = buildAnalysisReport(allReports);
  writeMarkdown(path.join(analyzed, '_analysis-report.md'), report);

  state.completeAnalyze({
    analyzers_run: allReports.filter((r) => r.status === 'success').map((r) => r.id),
    confidence: { overall: 0 },
  });

  console.log('Analysis complete.');
}
```

- [ ] **Step 4: Implement generate command**

`src/commands/generate.ts`:

```typescript
import { loadConfig } from '../config/loader.js';
import { StateManager } from '../state/manager.js';
import { createAIEngine } from '../ai/factory.js';
import { Orchestrator } from '../ai/orchestrator.js';
import { getGeneratorsByTier } from '../generators/registry.js';
import { createFormatAdapter } from '../formats/factory.js';
import { analyzedDir, specsDir } from '../utils/fs.js';

export async function runGenerate(dir: string, options: { only?: string; force?: boolean }): Promise<void> {
  const config = await loadConfig(dir);
  const state = new StateManager(dir);

  if (!options.force) {
    state.requirePhase('analyzed');
  }

  const engine = createAIEngine(config.ai);
  const orchestrator = new Orchestrator(engine, {
    max_parallel: config.ai.max_parallel,
    timeout: config.ai.timeout,
  });

  const analyzed = analyzedDir(dir);
  const specs = specsDir(dir, config.output.dir);

  console.log(`Generating specs in ${config.output.format} format...`);

  // TODO: Run generators by tier through orchestrator
  // For now, create format-specific output structure
  const formatAdapter = createFormatAdapter(config.output.format);
  await formatAdapter.package(specs, specs, {
    projectName: config.project.name,
    projectDescription: config.project.description,
    sddContent: '# SDD\n\n(Generated by ReSpec)',
    analyzedDir: analyzed,
  });

  state.completeGenerate({
    generators_run: ['format-gen'],
    format: config.output.format,
  });

  console.log('Generation complete.');
}
```

- [ ] **Step 5: Implement export command**

`src/commands/export.ts`:

```typescript
import { loadConfig } from '../config/loader.js';
import { createFormatAdapter } from '../formats/factory.js';
import { specsDir, analyzedDir } from '../utils/fs.js';

export async function runExport(dir: string, options: { format?: string; output?: string }): Promise<void> {
  const config = await loadConfig(dir);
  const format = options.format ?? config.output.format;
  const outDir = options.output ?? config.output.dir;

  console.log(`Exporting specs as ${format} format to ${outDir}...`);

  const formatAdapter = createFormatAdapter(format);
  await formatAdapter.package(specsDir(dir, config.output.dir), outDir, {
    projectName: config.project.name,
    projectDescription: config.project.description,
    sddContent: '# SDD\n\n(Re-exported by ReSpec)',
    analyzedDir: analyzedDir(dir),
  });

  console.log('Export complete.');
}
```

- [ ] **Step 6: Implement status command**

`src/commands/status.ts`:

```typescript
import { StateManager } from '../state/manager.js';

export async function runStatus(dir: string, options: { verbose?: boolean }): Promise<void> {
  const state = new StateManager(dir);
  const pipeline = state.load();

  console.log(`Pipeline phase: ${pipeline.phase}\n`);

  if (pipeline.ingest) {
    console.log('Ingest:');
    console.log(`  Completed: ${pipeline.ingest.completed_at}`);
    console.log(`  Sources: repo=${pipeline.ingest.sources.repo} jira=${pipeline.ingest.sources.jira} docs=${pipeline.ingest.sources.docs}`);
    console.log(`  Stats: ${pipeline.ingest.stats.files} files, ${pipeline.ingest.stats.tickets} tickets, ${pipeline.ingest.stats.pages} pages`);
  }

  if (pipeline.analyze) {
    console.log('\nAnalyze:');
    console.log(`  Completed: ${pipeline.analyze.completed_at}`);
    console.log(`  Analyzers: ${pipeline.analyze.analyzers_run.join(', ')}`);
    if (options.verbose && pipeline.analyze.confidence) {
      console.log(`  Confidence: ${JSON.stringify(pipeline.analyze.confidence)}`);
    }
  }

  if (pipeline.generate) {
    console.log('\nGenerate:');
    console.log(`  Completed: ${pipeline.generate.completed_at}`);
    console.log(`  Format: ${pipeline.generate.format}`);
    console.log(`  Generators: ${pipeline.generate.generators_run.join(', ')}`);
  }

  if (pipeline.phase === 'empty') {
    console.log('No pipeline activity yet. Run `respec init` and `respec ingest` to begin.');
  }
}
```

- [ ] **Step 7: Implement validate command**

`src/commands/validate.ts`:

```typescript
import * as fs from 'node:fs';
import { rawDir, analyzedDir, specsDir } from '../utils/fs.js';
import { loadConfig } from '../config/loader.js';

export async function runValidate(dir: string, options: { phase?: string }): Promise<void> {
  const config = await loadConfig(dir);
  const phase = options.phase ?? 'all';
  let errors = 0;

  if (phase === 'raw' || phase === 'all') {
    console.log('Validating raw/ ...');
    const raw = rawDir(dir);
    if (!fs.existsSync(raw)) {
      console.log('  ERROR: .respec/raw/ does not exist. Run `respec ingest` first.');
      errors++;
    } else {
      const required = ['repo/structure.md', 'repo/dependencies.md', '_manifest.md'];
      for (const file of required) {
        if (!fs.existsSync(`${raw}/${file}`)) {
          console.log(`  WARNING: Missing ${file}`);
          errors++;
        }
      }
      if (errors === 0) console.log('  OK');
    }
  }

  if (phase === 'analyzed' || phase === 'all') {
    console.log('Validating analyzed/ ...');
    const analyzed = analyzedDir(dir);
    if (!fs.existsSync(analyzed)) {
      console.log('  ERROR: .respec/analyzed/ does not exist. Run `respec analyze` first.');
      errors++;
    } else {
      if (!fs.existsSync(`${analyzed}/_analysis-report.md`)) {
        console.log('  WARNING: Missing _analysis-report.md');
        errors++;
      }
      if (errors === 0) console.log('  OK');
    }
  }

  if (phase === 'specs' || phase === 'all') {
    console.log('Validating specs/ ...');
    const specs = specsDir(dir, config.output.dir);
    if (!fs.existsSync(specs)) {
      console.log(`  ERROR: ${config.output.dir} does not exist. Run \`respec generate\` first.`);
      errors++;
    } else {
      console.log('  OK');
    }
  }

  if (errors > 0) {
    console.log(`\n${errors} issue(s) found.`);
    process.exitCode = 1;
  } else {
    console.log('\nAll validations passed.');
  }
}
```

- [ ] **Step 8: Wire up all commands in bin/respec.ts**

Update `bin/respec.ts`:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from '../src/commands/init.js';
import { runIngest } from '../src/commands/ingest.js';
import { runAnalyze } from '../src/commands/analyze.js';
import { runGenerate } from '../src/commands/generate.js';
import { runExport } from '../src/commands/export.js';
import { runStatus } from '../src/commands/status.js';
import { runValidate } from '../src/commands/validate.js';

const program = new Command();

program
  .name('respec')
  .description('Reverse Engineering to Specification')
  .version('0.1.0');

program
  .command('init')
  .description('Creates respec.config.yaml with defaults')
  .option('--template <name>', 'Use a config template')
  .action(async (opts) => {
    await runInit(process.cwd());
  });

program
  .command('ingest')
  .description('Reads all sources and writes to .respec/raw/')
  .option('--source <name>', 'Run only one ingestor: repo|jira|docs')
  .option('--force', 'Bypass prerequisite checks')
  .action(async (opts) => {
    await runIngest(process.cwd(), opts);
  });

program
  .command('analyze')
  .description('AI analysis of raw data to .respec/analyzed/')
  .option('--only <analyzer>', 'Run only one analyzer')
  .option('--model <model>', 'Override AI model')
  .option('--force', 'Bypass prerequisite checks')
  .action(async (opts) => {
    await runAnalyze(process.cwd(), opts);
  });

program
  .command('generate')
  .description('Generates final specs from analyzed data')
  .option('--only <generator>', 'Run only one generator')
  .option('--format <format>', 'Output format: kiro|openspec|antigravity|superpowers')
  .option('--force', 'Bypass prerequisite checks')
  .action(async (opts) => {
    await runGenerate(process.cwd(), opts);
  });

program
  .command('export')
  .description('Repackages specs into a different output format')
  .option('--format <format>', 'Target format: kiro|openspec|antigravity|superpowers')
  .option('--output <dir>', 'Output directory')
  .action(async (opts) => {
    await runExport(process.cwd(), opts);
  });

program
  .command('status')
  .description('Shows pipeline state and coverage')
  .option('--verbose', 'Show detailed information')
  .action(async (opts) => {
    await runStatus(process.cwd(), opts);
  });

program
  .command('validate')
  .description('Validates integrity of current phase outputs')
  .option('--phase <phase>', 'Phase to validate: raw|analyzed|specs')
  .action(async (opts) => {
    await runValidate(process.cwd(), opts);
  });

program.parse();
```

- [ ] **Step 9: Build and test CLI**

```bash
npx tsc
node dist/bin/respec.js --help
node dist/bin/respec.js init
node dist/bin/respec.js status
```

Expected: Help text, config creation, status output

- [ ] **Step 10: Commit**

```bash
git add src/commands/ bin/respec.ts
git commit -m "feat: wire up all CLI commands (init, ingest, analyze, generate, export, status, validate)"
```

---

## Task 13: Integration Test + Final Build

**Files:**
- Test: `tests/commands/init.test.ts`
- Test: `tests/commands/status.test.ts`

- [ ] **Step 1: Write integration test for init + status flow**

`tests/commands/init.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runInit } from '../../src/commands/init.js';
import { runStatus } from '../../src/commands/status.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('init command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-init-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates respec.config.yaml', async () => {
    await runInit(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'respec.config.yaml'))).toBe(true);
  });

  it('config is valid YAML with correct defaults', async () => {
    await runInit(tmpDir);
    const { loadConfig } = await import('../../src/config/loader.js');
    const config = await loadConfig(tmpDir);
    expect(config.output.format).toBe('openspec');
    expect(config.ai.engine).toBe('claude');
    expect(config.ai.max_parallel).toBe(4);
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All PASS

- [ ] **Step 3: Full build**

```bash
npx tsc
```

Expected: No errors

- [ ] **Step 4: Update src/index.ts barrel exports**

```typescript
export { configSchema, type ReSpecConfig, type OutputFormat, type AIEngine } from './config/schema.js';
export { loadConfig, resolveEnvAuth } from './config/loader.js';
export { StateManager } from './state/manager.js';
export { createAIEngine } from './ai/factory.js';
export { Orchestrator } from './ai/orchestrator.js';
export { createFormatAdapter } from './formats/factory.js';
export { getAnalyzerRegistry, getAnalyzersByTier } from './analyzers/registry.js';
export { getGeneratorRegistry, getGeneratorsByTier } from './generators/registry.js';
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: ReSpec MVP — CLI tool with ingestors, AI engine adapters, analyzers, generators, and 4 output formats"
```

---

## Summary

| Task | Description | Key Deliverable |
|------|-------------|-----------------|
| 1 | Project scaffolding | package.json, tsconfig, vitest, CLI entry |
| 2 | Config schema + loader | Zod validation for respec.config.yaml |
| 3 | Pipeline state manager | state.json read/write with phase validation |
| 4 | Utility helpers | fs, markdown, git wrappers |
| 5 | AI engine adapters | Claude/Codex/Gemini/custom + parallel orchestrator |
| 6 | Repo ingestor | structure, deps, endpoints, models, env-vars, modules |
| 7 | Jira ingestor | JQL builder, ticket formatter, paginated fetch |
| 8 | Docs ingestor | Local files + README capture |
| 9 | Analyzer registry | 6 analyzers in 2 tiers + prompt templates |
| 10 | Generator registry | 6 generators in 3 tiers + SDD gen |
| 11 | Output format adapters | Kiro, OpenSpec, Antigravity, Superpowers |
| 12 | CLI commands | All 7 commands wired to Commander |
| 13 | Integration tests | End-to-end init/status flow + full build |
