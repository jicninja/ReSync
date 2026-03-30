# AI Toolkit Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-driven toolkit recommendation generator that suggests MCPs, skills, and plugins based on the detected stack, validates them via npm, and offers interactive installation after export.

**Architecture:** A new `toolkit-gen` generator (tier 3) sends stack context to the AI engine and receives structured JSON recommendations. After `respec export`, a post-export wizard presents recommendations grouped by category and installs approved tools. Format adapters for superpowers and openspec inject recommendations into their output files.

**Tech Stack:** TypeScript (ESM), Vitest, @clack/prompts, child_process (npm view/install)

---

### Task 1: Types and Constants

**Files:**
- Create: `src/toolkit/types.ts`
- Modify: `src/constants.ts:99` (append)

- [ ] **Step 1: Write the failing test for toolkit types**

```typescript
// tests/toolkit/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  ToolkitRecommendations,
  Recommendation,
  AgentId,
  McpInstall,
  NpmInstall,
  CopyInstall,
  ManualInstall,
} from '../../src/toolkit/types.js';

describe('ToolkitRecommendations types', () => {
  it('accepts a valid recommendations object', () => {
    const recs: ToolkitRecommendations = {
      stack: { detected: ['nextjs', 'prisma'], format: 'superpowers', multiAgent: false },
      recommendations: [
        {
          type: 'mcp',
          name: 'test-mcp',
          package: '@test/mcp-server',
          description: 'Test MCP',
          reason: 'Test detected',
          install: { method: 'mcp-config', config: { command: 'npx', args: ['@test/mcp-server'] } },
          validated: true,
          agents: ['claude'],
          category: 'testing',
        },
      ],
      workflowGuidance: {
        complexity: 'medium',
        suggestedWorkflow: 'spec-driven',
        reason: 'test reason',
      },
    };
    expect(recs.recommendations).toHaveLength(1);
    expect(recs.stack.format).toBe('superpowers');
  });

  it('accepts all install method variants', () => {
    const mcp: McpInstall = { method: 'mcp-config', config: { command: 'npx', args: ['pkg'] } };
    const npm: NpmInstall = { method: 'npm', command: 'npm install -g pkg' };
    const copy: CopyInstall = { method: 'copy', source: '/a', target: '/b' };
    const manual: ManualInstall = { method: 'manual', instructions: 'Do this' };
    expect(mcp.method).toBe('mcp-config');
    expect(npm.method).toBe('npm');
    expect(copy.method).toBe('copy');
    expect(manual.method).toBe('manual');
  });

  it('accepts all valid agent IDs', () => {
    const agents: AgentId[] = ['claude', 'gemini', 'kiro', 'copilot', 'cursor', 'bmad'];
    expect(agents).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/toolkit/types.test.ts`
Expected: FAIL — cannot resolve `../../src/toolkit/types.js`

- [ ] **Step 3: Write the types file**

```typescript
// src/toolkit/types.ts
export type AgentId = 'claude' | 'gemini' | 'kiro' | 'copilot' | 'cursor' | 'bmad';

export interface McpInstall {
  method: 'mcp-config';
  config: { command: string; args: string[]; env?: Record<string, string> };
}

export interface NpmInstall {
  method: 'npm';
  command: string;
}

export interface CopyInstall {
  method: 'copy';
  source: string;
  target: string;
}

export interface ManualInstall {
  method: 'manual';
  instructions: string;
}

export type InstallMethod = McpInstall | NpmInstall | CopyInstall | ManualInstall;

export interface Recommendation {
  type: 'mcp' | 'skill' | 'plugin' | 'extension';
  name: string;
  package: string;
  description: string;
  reason: string;
  install: InstallMethod;
  validated: boolean | null;
  agents: AgentId[];
  category: string;
}

export interface ToolkitRecommendations {
  stack: {
    detected: string[];
    format: string;
    multiAgent: boolean;
  };
  recommendations: Recommendation[];
  workflowGuidance: {
    complexity: 'simple' | 'medium' | 'complex';
    suggestedWorkflow: string;
    reason: string;
  };
}
```

- [ ] **Step 4: Add toolkit constants to `src/constants.ts`**

Append at the end of `src/constants.ts` (after line 98):

```typescript
// ── Toolkit ────────────────────────────────────────────────────────
export const TOOLKIT_VALIDATE_TIMEOUT = 5000;
export const TOOLKIT_VALIDATE_CONCURRENCY = 10;
export const TOOLKIT_RECOMMENDATIONS_FILE = 'toolkit/recommendations.json';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/toolkit/types.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite to check nothing broke**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 7: Commit**

```bash
git add src/toolkit/types.ts src/constants.ts tests/toolkit/types.test.ts
git commit -m "feat(toolkit): add recommendation types and constants"
```

---

### Task 2: Package Validator

Validates npm packages exist via `npm view`. Handles timeouts, concurrency, and npm unavailability.

**Files:**
- Create: `src/toolkit/validator.ts`
- Create: `tests/toolkit/validator.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/toolkit/validator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePackages, isNpmAvailable } from '../../src/toolkit/validator.js';
import type { Recommendation } from '../../src/toolkit/types.js';

// Mock child_process — execSync for isNpmAvailable, execFile for validatePackages
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  execFile: vi.fn(),
}));

import { execSync, execFile } from 'node:child_process';
const mockExecSync = vi.mocked(execSync);
const mockExecFile = vi.mocked(execFile);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isNpmAvailable', () => {
  it('returns true when npm --version succeeds', () => {
    mockExecSync.mockReturnValueOnce(Buffer.from('10.0.0'));
    expect(isNpmAvailable()).toBe(true);
  });

  it('returns false when npm --version throws', () => {
    mockExecSync.mockImplementationOnce(() => { throw new Error('not found'); });
    expect(isNpmAvailable()).toBe(false);
  });
});

describe('validatePackages', () => {
  it('marks packages as validated when npm view succeeds', async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
      if (typeof _opts === 'function') { cb = _opts; }
      cb(null, { stdout: '{}', stderr: '' });
      return {} as any;
    });
    const recs: Recommendation[] = [
      {
        type: 'mcp', name: 'test', package: '@test/pkg',
        description: 'test', reason: 'test',
        install: { method: 'mcp-config', config: { command: 'npx', args: ['@test/pkg'] } },
        validated: null, agents: ['claude'], category: 'test',
      },
    ];
    const result = await validatePackages(recs);
    expect(result[0].validated).toBe(true);
  });

  it('marks packages as false when npm view fails', async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
      if (typeof _opts === 'function') { cb = _opts; }
      cb(new Error('404'));
      return {} as any;
    });
    const recs: Recommendation[] = [
      {
        type: 'mcp', name: 'test', package: '@bad/pkg',
        description: 'test', reason: 'test',
        install: { method: 'mcp-config', config: { command: 'npx', args: ['@bad/pkg'] } },
        validated: null, agents: ['claude'], category: 'test',
      },
    ];
    const result = await validatePackages(recs);
    expect(result[0].validated).toBe(false);
  });

  it('skips validation for empty package field', async () => {
    const recs: Recommendation[] = [
      {
        type: 'extension', name: 'test', package: '',
        description: 'test', reason: 'test',
        install: { method: 'manual', instructions: 'do it' },
        validated: null, agents: ['claude'], category: 'test',
      },
    ];
    const result = await validatePackages(recs);
    expect(result[0].validated).toBeNull();
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/toolkit/validator.test.ts`
Expected: FAIL — cannot resolve `../../src/toolkit/validator.js`

- [ ] **Step 3: Write the validator**

```typescript
// src/toolkit/validator.ts
import { execSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TOOLKIT_VALIDATE_TIMEOUT, TOOLKIT_VALIDATE_CONCURRENCY } from '../constants.js';
import type { Recommendation } from './types.js';

const execFileAsync = promisify(execFile);

export function isNpmAvailable(): boolean {
  try {
    execSync('npm --version', { timeout: TOOLKIT_VALIDATE_TIMEOUT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function validateSinglePackage(pkg: string): Promise<boolean> {
  try {
    await execFileAsync('npm', ['view', pkg, 'name'], { timeout: TOOLKIT_VALIDATE_TIMEOUT });
    return true;
  } catch {
    return false;
  }
}

export async function validatePackages(recommendations: Recommendation[]): Promise<Recommendation[]> {
  const toValidate = recommendations.filter((r) => r.package && r.package.length > 0);
  const skipValidation = recommendations.filter((r) => !r.package || r.package.length === 0);

  // Process in batches of TOOLKIT_VALIDATE_CONCURRENCY (truly concurrent via async execFile)
  const results: Recommendation[] = [...skipValidation];

  for (let i = 0; i < toValidate.length; i += TOOLKIT_VALIDATE_CONCURRENCY) {
    const batch = toValidate.slice(i, i + TOOLKIT_VALIDATE_CONCURRENCY);
    const validated = await Promise.all(
      batch.map(async (rec) => ({
        ...rec,
        validated: await validateSinglePackage(rec.package),
      }))
    );
    results.push(...validated);
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/toolkit/validator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/toolkit/validator.ts tests/toolkit/validator.test.ts
git commit -m "feat(toolkit): add npm package validator"
```

---

### Task 3: JSON Parser (extract JSON from AI response)

Extracts valid JSON from AI responses that may be wrapped in markdown code fences.

**Files:**
- Create: `src/toolkit/json-parser.ts`
- Create: `tests/toolkit/json-parser.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/toolkit/json-parser.test.ts
import { describe, it, expect } from 'vitest';
import { extractJSON } from '../../src/toolkit/json-parser.js';

describe('extractJSON', () => {
  it('parses raw JSON', () => {
    const input = '{"stack":{"detected":["nextjs"],"format":"openspec","multiAgent":true},"recommendations":[],"workflowGuidance":{"complexity":"simple","suggestedWorkflow":"basic","reason":"small project"}}';
    const result = extractJSON(input);
    expect(result.stack.detected).toEqual(['nextjs']);
  });

  it('extracts JSON from markdown code fences', () => {
    const input = 'Here are the recommendations:\n```json\n{"stack":{"detected":[],"format":"openspec","multiAgent":false},"recommendations":[],"workflowGuidance":{"complexity":"simple","suggestedWorkflow":"basic","reason":"r"}}\n```';
    const result = extractJSON(input);
    expect(result).toBeDefined();
    expect(result.recommendations).toEqual([]);
  });

  it('extracts JSON from bare code fences', () => {
    const input = '```\n{"stack":{"detected":[],"format":"openspec","multiAgent":false},"recommendations":[],"workflowGuidance":{"complexity":"simple","suggestedWorkflow":"basic","reason":"r"}}\n```';
    const result = extractJSON(input);
    expect(result).toBeDefined();
  });

  it('returns null for invalid JSON', () => {
    const result = extractJSON('this is not json at all');
    expect(result).toBeNull();
  });

  it('returns null for empty input', () => {
    const result = extractJSON('');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/toolkit/json-parser.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the parser**

```typescript
// src/toolkit/json-parser.ts
import type { ToolkitRecommendations } from './types.js';

export function extractJSON(text: string): ToolkitRecommendations | null {
  if (!text || text.trim().length === 0) return null;

  // Try raw parse first
  try {
    return JSON.parse(text.trim());
  } catch {
    // Continue to fence extraction
  }

  // Extract from markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      return null;
    }
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/toolkit/json-parser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/toolkit/json-parser.ts tests/toolkit/json-parser.test.ts
git commit -m "feat(toolkit): add JSON parser for AI response extraction"
```

---

### Task 4: GeneratorContext Extension and Registry Entry

Add `rawDir` to `GeneratorContext`, register `toolkit-gen` in the generators registry, and update the generate command.

**Files:**
- Modify: `src/generators/types.ts:8-13` (add rawDir field)
- Modify: `src/generators/registry.ts:3-45` (add toolkit-gen entry)
- Modify: `src/commands/generate.ts:1-70` (import rawDir, add to ctx, import builder, add to PROMPT_BUILDERS)
- Modify: `tests/generators/registry.test.ts` (update counts)

- [ ] **Step 1: Update the registry test**

In `tests/generators/registry.test.ts`:

Change line 6: `expect(generators).toHaveLength(6)` → `expect(generators).toHaveLength(7)`

Change lines 45-50: tier 3 test to include toolkit-gen:
```typescript
it('tier 3 has task-gen, format-gen, toolkit-gen', () => {
  const tier3 = getGeneratorsByTier(3);
  const ids = tier3.map((g) => g.id);
  expect(ids).toContain('task-gen');
  expect(ids).toContain('format-gen');
  expect(ids).toContain('toolkit-gen');
  expect(tier3).toHaveLength(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generators/registry.test.ts`
Expected: FAIL — length 6 !== 7, and toolkit-gen not in tier 3

- [ ] **Step 3: Add rawDir to GeneratorContext**

In `src/generators/types.ts`, add after line 12 (`format: string;`):
```typescript
  rawDir?: string;
```

- [ ] **Step 4: Add toolkit-gen to registry**

In `src/generators/registry.ts`, add inside the `GENERATORS` array after the `format-gen` entry (before the closing `];` on line 45):

```typescript
  {
    id: 'toolkit-gen',
    reads: ['domain/bounded-contexts.md', 'infra/architecture.md'],
    produces: ['toolkit/recommendations.json'],
    tier: 3,
  },
```

- [ ] **Step 5: Run the registry test to verify it passes**

Run: `npx vitest run tests/generators/registry.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/generators/types.ts src/generators/registry.ts tests/generators/registry.test.ts
git commit -m "feat(toolkit): add toolkit-gen to generator registry and rawDir to GeneratorContext"
```

---

### Task 5: Toolkit Prompt Builder

The prompt builder that constructs the AI prompt for toolkit-gen.

**Files:**
- Create: `src/generators/toolkit-gen.ts`
- Create: `tests/generators/toolkit-gen.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/generators/toolkit-gen.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildToolkitPrompt } from '../../src/generators/toolkit-gen.js';
import type { GeneratorContext } from '../../src/generators/types.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-toolkit-gen-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('buildToolkitPrompt', () => {
  it('includes dependency content when rawDir exists', () => {
    const rawDir = join(tmpDir, 'raw');
    const analyzedDir = join(tmpDir, 'analyzed');
    fs.mkdirSync(join(rawDir, 'repo'), { recursive: true });
    fs.mkdirSync(join(analyzedDir, 'domain'), { recursive: true });
    fs.mkdirSync(join(analyzedDir, 'infra'), { recursive: true });

    fs.writeFileSync(join(rawDir, 'repo', 'dependencies.md'), '# Dependencies\n- next: 14.0\n- prisma: 5.0');
    fs.writeFileSync(join(analyzedDir, 'domain', 'bounded-contexts.md'), '# Bounded Contexts\n## User Management');
    fs.writeFileSync(join(analyzedDir, 'infra', 'architecture.md'), '# Architecture\nNext.js + PostgreSQL');

    const ctx: GeneratorContext = {
      analyzedDir,
      generatedDir: join(tmpDir, 'generated'),
      projectName: 'TestProject',
      format: 'superpowers',
      rawDir,
    };

    const prompt = buildToolkitPrompt(ctx);
    expect(prompt).toContain('next: 14.0');
    expect(prompt).toContain('prisma: 5.0');
    expect(prompt).toContain('User Management');
    expect(prompt).toContain('superpowers');
    expect(prompt).toContain('"recommendations"');
  });

  it('works without rawDir (graceful degradation)', () => {
    const analyzedDir = join(tmpDir, 'analyzed');
    fs.mkdirSync(join(analyzedDir, 'domain'), { recursive: true });
    fs.writeFileSync(join(analyzedDir, 'domain', 'bounded-contexts.md'), '# Bounded Contexts');

    const ctx: GeneratorContext = {
      analyzedDir,
      generatedDir: join(tmpDir, 'generated'),
      projectName: 'TestProject',
      format: 'openspec',
    };

    const prompt = buildToolkitPrompt(ctx);
    expect(prompt).toContain('No dependency data available');
    expect(prompt).toContain('openspec');
  });

  it('includes multi-agent flag for openspec format', () => {
    const ctx: GeneratorContext = {
      analyzedDir: join(tmpDir, 'analyzed'),
      generatedDir: join(tmpDir, 'generated'),
      projectName: 'TestProject',
      format: 'openspec',
    };

    const prompt = buildToolkitPrompt(ctx);
    expect(prompt).toContain('Multi-agent: true');
  });

  it('includes single-agent flag for superpowers format', () => {
    const ctx: GeneratorContext = {
      analyzedDir: join(tmpDir, 'analyzed'),
      generatedDir: join(tmpDir, 'generated'),
      projectName: 'TestProject',
      format: 'superpowers',
    };

    const prompt = buildToolkitPrompt(ctx);
    expect(prompt).toContain('Multi-agent: false');
  });

  it('includes the JSON schema in the prompt', () => {
    const ctx: GeneratorContext = {
      analyzedDir: join(tmpDir, 'analyzed'),
      generatedDir: join(tmpDir, 'generated'),
      projectName: 'TestProject',
      format: 'superpowers',
    };

    const prompt = buildToolkitPrompt(ctx);
    expect(prompt).toContain('"stack"');
    expect(prompt).toContain('"recommendations"');
    expect(prompt).toContain('"workflowGuidance"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generators/toolkit-gen.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the prompt builder**

```typescript
// src/generators/toolkit-gen.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratorContext } from './types.js';
import { FORMAT_OPENSPEC } from '../constants.js';

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

function isMultiAgent(format: string): boolean {
  return format === FORMAT_OPENSPEC;
}

export function buildToolkitPrompt(ctx: GeneratorContext): string {
  // Read raw dependencies (may not be available)
  let dependenciesContent = '';
  if (ctx.rawDir) {
    dependenciesContent = readFile(path.join(ctx.rawDir, 'repo', 'dependencies.md'));
  }

  // Read analyzed files
  const boundedContexts = readFile(path.join(ctx.analyzedDir, 'domain', 'bounded-contexts.md'));
  const architecture = readFile(path.join(ctx.analyzedDir, 'infra', 'architecture.md'));

  const multiAgent = isMultiAgent(ctx.format);

  return `You are an AI toolkit advisor generating tool recommendations for the project "${ctx.projectName}".

IMPORTANT: You are running as a text-generation subprocess. Do NOT attempt to create files, use tools, or interact with any system. Your ONLY output is raw JSON text written to stdout.

## Project Dependencies

${dependenciesContent || '(No dependency data available.)'}

## Architecture

${architecture || '(No architecture data available.)'}

## Domain Complexity

${boundedContexts || '(No bounded context data available.)'}

## Target Configuration

- Export format: ${ctx.format}
- Multi-agent: ${multiAgent}

## Instructions

Based on the project dependencies, architecture, and domain complexity above, recommend MCP servers, skills, plugins, and IDE extensions that would help developers working on this project.

Return ONLY valid JSON matching this exact schema — no markdown wrapping, no explanation text:

\`\`\`
{
  "stack": {
    "detected": ["framework1", "lib2"],    // technologies detected from dependencies
    "format": "${ctx.format}",
    "multiAgent": ${multiAgent}
  },
  "recommendations": [
    {
      "type": "mcp",                        // mcp | skill | plugin | extension
      "name": "human-readable-name",
      "package": "@scope/package-name",     // exact npm package name
      "description": "one-line description",
      "reason": "why this is recommended based on detected stack",
      "install": {
        "method": "mcp-config",             // mcp-config | npm | copy | manual
        "config": {                         // for mcp-config method
          "command": "npx",
          "args": ["@scope/package-name"]
        }
      },
      "validated": null,                    // will be filled by validator
      "agents": ["claude", "gemini"],       // which agents support this tool
      "category": "database"                // grouping: database, frontend, testing, devops, etc.
    }
  ],
  "workflowGuidance": {
    "complexity": "medium",                 // simple | medium | complex
    "suggestedWorkflow": "description of recommended development workflow",
    "reason": "why this workflow fits the project"
  }
}
\`\`\`

Rules:
- Only recommend tools you know with certainty exist. Include the exact npm package name.
- For MCPs, use the "mcp-config" install method with the exact command and args.
- For skills and plugins, use the "npm" install method with the full install command.
- For IDE extensions, use the "manual" install method with clear instructions.
- The "agents" array should list which AI agents support this tool. Valid IDs: claude, gemini, kiro, copilot, cursor, bmad.
- Group recommendations by category (database, frontend, testing, devops, api, monitoring, etc.).
- Assess project complexity from the bounded contexts and architecture to inform workflowGuidance.
- Return ONLY the JSON object. No markdown, no explanation.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/generators/toolkit-gen.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/generators/toolkit-gen.ts tests/generators/toolkit-gen.test.ts
git commit -m "feat(toolkit): add toolkit-gen prompt builder"
```

---

### Task 6: Wire toolkit-gen into Generate Command

Register the prompt builder, pass rawDir to the generator context, and add post-processing for toolkit-gen output (JSON parsing + npm validation).

**Files:**
- Modify: `src/commands/generate.ts:1-20` (add imports)
- Modify: `src/commands/generate.ts:30-37` (add to PROMPT_BUILDERS)
- Modify: `src/commands/generate.ts:62-70` (add rawDir to ctx)
- Modify: `src/commands/generate.ts:122-135` (add toolkit-gen post-processing in result loop)

- [ ] **Step 1: Add imports**

In `src/commands/generate.ts`, add after line 18 (`import { buildFormatPrompt } from '../generators/format-gen.js';`):

```typescript
import { buildToolkitPrompt } from '../generators/toolkit-gen.js';
import { extractJSON } from '../toolkit/json-parser.js';
import { validatePackages, isNpmAvailable } from '../toolkit/validator.js';
```

Also update the import on line 8 to include `rawDir`:
```typescript
import { analyzedDir, generatedDir, rawDir, writeMarkdown } from '../utils/fs.js';
```

- [ ] **Step 2: Register in PROMPT_BUILDERS**

In `src/commands/generate.ts`, add to the `PROMPT_BUILDERS` object (after line 36 `'format-gen': buildFormatPrompt,`):

```typescript
  'toolkit-gen': buildToolkitPrompt,
```

- [ ] **Step 3: Add rawDir to generatorCtx**

In `src/commands/generate.ts`, modify the `generatorCtx` construction (lines 65-70) to include rawDir:

```typescript
  const generatorCtx: GeneratorContext = {
    analyzedDir: analyzedPath,
    generatedDir: outputDir,
    projectName: config.project.name,
    format,
    rawDir: rawDir(dir),
  };
```

- [ ] **Step 4: Add toolkit-gen post-processing in the result loop**

In `src/commands/generate.ts`, modify the result writing block (lines 128-134). Replace:

```typescript
      if (result.status === 'success' && result.output) {
        const outputFile = path.join(outputDir, resolveProducePath(generator.produces[0], generator.id));
        writeMarkdown(outputFile, result.output);
        tui.success(`${result.id} — done (${result.durationMs}ms)`);
      }
```

With:

```typescript
      if (result.status === 'success' && result.output) {
        const outputFile = path.join(outputDir, resolveProducePath(generator.produces[0], generator.id));

        // toolkit-gen needs JSON parsing and npm validation
        if (result.id === 'toolkit-gen') {
          const parsed = extractJSON(result.output);
          if (parsed) {
            if (isNpmAvailable()) {
              parsed.recommendations = await validatePackages(parsed.recommendations);
            } else {
              for (const rec of parsed.recommendations) rec.validated = null;
            }
            writeMarkdown(outputFile, JSON.stringify(parsed, null, 2));
            tui.success(`${result.id} — done (${result.durationMs}ms, ${parsed.recommendations.length} recommendations)`);
          } else {
            tui.warn(`${result.id}: failed to parse AI response as JSON`);
            writeMarkdown(outputFile, JSON.stringify({ stack: { detected: [], format, multiAgent: false }, recommendations: [], workflowGuidance: { complexity: 'simple', suggestedWorkflow: 'unknown', reason: 'AI response could not be parsed' } }, null, 2));
          }
        } else {
          writeMarkdown(outputFile, result.output);
          tui.success(`${result.id} — done (${result.durationMs}ms)`);
        }
      }
```

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass (including updated registry test from Task 4)

- [ ] **Step 6: Commit**

```bash
git add src/commands/generate.ts
git commit -m "feat(toolkit): wire toolkit-gen into generate command with JSON parsing and validation"
```

---

### Task 7: Toolkit Wizard

Interactive post-export wizard that presents recommendations and handles installation.

**Files:**
- Create: `src/toolkit/wizard.ts`
- Create: `tests/toolkit/wizard.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/toolkit/wizard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolkitRecommendations } from '../../src/toolkit/types.js';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  multiselect: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), success: vi.fn(), step: vi.fn(), message: vi.fn() },
  isCancel: vi.fn(() => false),
}));

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import * as clack from '@clack/prompts';
import { runToolkitWizard, readRecommendations, filterByAgent } from '../../src/toolkit/wizard.js';

const mockSelect = vi.mocked(clack.select);
const mockMultiselect = vi.mocked(clack.multiselect);

const sampleRecs: ToolkitRecommendations = {
  stack: { detected: ['nextjs'], format: 'superpowers', multiAgent: false },
  recommendations: [
    {
      type: 'mcp', name: 'test-mcp', package: '@test/mcp',
      description: 'Test MCP', reason: 'test',
      install: { method: 'mcp-config', config: { command: 'npx', args: ['@test/mcp'] } },
      validated: true, agents: ['claude'], category: 'testing',
    },
    {
      type: 'mcp', name: 'gemini-only', package: '@gemini/mcp',
      description: 'Gemini MCP', reason: 'test',
      install: { method: 'mcp-config', config: { command: 'npx', args: ['@gemini/mcp'] } },
      validated: true, agents: ['gemini'], category: 'testing',
    },
  ],
  workflowGuidance: {
    complexity: 'medium',
    suggestedWorkflow: 'spec-driven',
    reason: 'test',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('filterByAgent', () => {
  it('filters recommendations by format agent mapping', () => {
    const filtered = filterByAgent(sampleRecs.recommendations, 'superpowers');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('test-mcp');
  });

  it('returns all for openspec format', () => {
    const filtered = filterByAgent(sampleRecs.recommendations, 'openspec');
    expect(filtered).toHaveLength(2);
  });
});

describe('runToolkitWizard', () => {
  it('skips wizard when no recommendations', async () => {
    const empty: ToolkitRecommendations = {
      ...sampleRecs,
      recommendations: [],
    };
    await runToolkitWizard(empty, { format: 'superpowers', ciMode: false, autoMode: false });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('skips interactive prompt in CI mode', async () => {
    await runToolkitWizard(sampleRecs, { format: 'superpowers', ciMode: true, autoMode: false });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('shows select prompt in interactive mode', async () => {
    mockSelect.mockResolvedValueOnce('skip');
    await runToolkitWizard(sampleRecs, { format: 'superpowers', ciMode: false, autoMode: false });
    expect(mockSelect).toHaveBeenCalled();
  });
});

describe('readRecommendations', () => {
  it('returns null for non-existent file', () => {
    const result = readRecommendations('/nonexistent/path');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/toolkit/wizard.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the wizard**

```typescript
// src/toolkit/wizard.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import * as clack from '@clack/prompts';
import { TOOLKIT_RECOMMENDATIONS_FILE } from '../constants.js';
import type { ToolkitRecommendations, Recommendation, AgentId } from './types.js';

const FORMAT_TO_AGENTS: Record<string, AgentId[]> = {
  superpowers: ['claude'],
  antigravity: ['gemini'],
  kiro: ['kiro'],
  openspec: ['claude', 'gemini', 'kiro', 'copilot', 'cursor', 'bmad'],
  speckit: ['copilot'],
  bmad: ['bmad'],
};

export function filterByAgent(recommendations: Recommendation[], format: string): Recommendation[] {
  const agents = FORMAT_TO_AGENTS[format];
  if (!agents) return recommendations;
  // openspec gets all recommendations
  if (format === 'openspec') return recommendations;
  return recommendations.filter((r) =>
    r.agents.some((a) => agents.includes(a))
  );
}

export function readRecommendations(generatedDir: string): ToolkitRecommendations | null {
  const filePath = path.join(generatedDir, TOOLKIT_RECOMMENDATIONS_FILE);
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    clack.log.warn(`Failed to read toolkit recommendations: ${message}`);
    return null;
  }
}

interface WizardOptions {
  format: string;
  ciMode: boolean;
  autoMode: boolean;
}

function groupByCategory(recs: Recommendation[]): Record<string, Recommendation[]> {
  const groups: Record<string, Recommendation[]> = {};
  for (const rec of recs) {
    const cat = rec.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(rec);
  }
  return groups;
}

function displayRecommendations(recs: Recommendation[], guidance: ToolkitRecommendations['workflowGuidance']): void {
  clack.log.step(`Suggested workflow: ${guidance.suggestedWorkflow}\n  (${guidance.reason})`);
  clack.log.message('');

  const groups = groupByCategory(recs);
  const verified = recs.filter((r) => r.validated === true);
  const unverified = recs.filter((r) => r.validated === false);

  for (const [category, items] of Object.entries(groups)) {
    const verifiedItems = items.filter((r) => r.validated !== false);
    if (verifiedItems.length === 0) continue;
    const label = category.charAt(0).toUpperCase() + category.slice(1);
    const lines = verifiedItems.map((r) => `  ${r.package || r.name} — ${r.description}`);
    clack.log.info(`${label} (${verifiedItems.length} tools)\n${lines.join('\n')}`);
  }

  if (unverified.length > 0) {
    const lines = unverified.map((r) => `  ${r.package || r.name} — ${r.description} [unverified]`);
    clack.log.warn(`Not verified (${unverified.length})\n${lines.join('\n')}`);
  }
}

function installRecommendation(rec: Recommendation): void {
  switch (rec.install.method) {
    case 'mcp-config':
      clack.log.success(`MCP config ready: ${rec.name} (add to your agent's MCP config)`);
      break;
    case 'npm':
      try {
        execSync(rec.install.command, { stdio: 'inherit' });
        clack.log.success(`Installed: ${rec.name}`);
      } catch {
        clack.log.warn(`Failed to install ${rec.name}. Run manually: ${rec.install.command}`);
      }
      break;
    case 'copy':
      clack.log.info(`Copy: ${rec.install.source} → ${rec.install.target}`);
      break;
    case 'manual':
      clack.log.info(`${rec.name}: ${rec.install.instructions}`);
      break;
  }
}

export async function runToolkitWizard(
  recs: ToolkitRecommendations,
  options: WizardOptions,
): Promise<void> {
  const filtered = filterByAgent(recs.recommendations, options.format);

  if (filtered.length === 0) {
    clack.log.info('No toolkit recommendations generated.');
    return;
  }

  displayRecommendations(filtered, recs.workflowGuidance);

  // CI mode: only display, no install
  if (options.ciMode) {
    clack.log.info('CI mode — skipping installation. Recommendations logged above.');
    return;
  }

  // Autopilot: install all verified
  if (options.autoMode) {
    const verified = filtered.filter((r) => r.validated === true);
    for (const rec of verified) {
      installRecommendation(rec);
    }
    clack.log.info(`Auto-installed ${verified.length} verified tools. ${filtered.length - verified.length} skipped (unverified).`);
    return;
  }

  // Interactive mode
  const choice = await clack.select({
    message: 'Install recommendations?',
    options: [
      { value: 'select', label: 'Select individually' },
      { value: 'all', label: 'Yes to all' },
      { value: 'verified', label: 'Yes to all verified only' },
      { value: 'skip', label: 'Skip' },
    ],
  });

  if (clack.isCancel(choice) || choice === 'skip') return;

  let toInstall: Recommendation[] = [];

  if (choice === 'all') {
    toInstall = filtered;
  } else if (choice === 'verified') {
    toInstall = filtered.filter((r) => r.validated === true);
  } else if (choice === 'select') {
    const selected = await clack.multiselect({
      message: 'Select tools to install:',
      options: filtered.map((r) => ({
        value: r.name,
        label: `${r.package || r.name} — ${r.description}${r.validated === false ? ' [unverified]' : ''}`,
      })),
    });

    if (clack.isCancel(selected)) return;
    toInstall = filtered.filter((r) => (selected as string[]).includes(r.name));
  }

  for (const rec of toInstall) {
    installRecommendation(rec);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/toolkit/wizard.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/toolkit/wizard.ts tests/toolkit/wizard.test.ts
git commit -m "feat(toolkit): add post-export install wizard"
```

---

### Task 8: Wire Wizard into Export Command

Add FormatContext.toolkitRecommendations and call the wizard after export.

**Files:**
- Modify: `src/formats/types.ts:8-16` (add toolkitRecommendations field)
- Modify: `src/commands/export.ts` (read recommendations, pass to context, call wizard)

- [ ] **Step 1: Update FormatContext type**

In `src/formats/types.ts`, add the import and new field:

Add at line 1:
```typescript
import type { ToolkitRecommendations } from '../toolkit/types.js';
```

Add after line 15 (`ciMode: boolean;`):
```typescript
  toolkitRecommendations?: ToolkitRecommendations;
```

- [ ] **Step 2: Update export command**

In `src/commands/export.ts`, add imports at top:
```typescript
import { readRecommendations, runToolkitWizard } from '../toolkit/wizard.js';
```

After the context construction (after line 38), add:
```typescript
  // Read toolkit recommendations if available
  const toolkitRecs = readRecommendations(inputDir);
  if (toolkitRecs) {
    context.toolkitRecommendations = toolkitRecs;
  }
```

After `adapter.package()` call (after line 43 `tui.success(...)`), add:
```typescript
  // Post-export toolkit wizard
  if (toolkitRecs) {
    await runToolkitWizard(toolkitRecs, {
      format,
      ciMode: !!options.ci,
      autoMode: !!options.auto,
    });
  }
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass. Existing format adapter tests should still pass since `toolkitRecommendations` is optional.

- [ ] **Step 4: Commit**

```bash
git add src/formats/types.ts src/commands/export.ts
git commit -m "feat(toolkit): wire wizard into export command and extend FormatContext"
```

---

### Task 9: Superpowers Format Adapter Integration

Inject toolkit recommendations into CLAUDE.md when available.

**Files:**
- Modify: `src/formats/superpowers.ts:94-98` (add recommendations section to CLAUDE.md)
- Modify: `tests/formats/superpowers.test.ts` (add test for recommendations in CLAUDE.md)

- [ ] **Step 1: Write the failing test**

Add to `tests/formats/superpowers.test.ts`, inside the `describe('SuperpowersFormat', ...)` block:

```typescript
  it('includes toolkit recommendations in CLAUDE.md when provided', async () => {
    const ctxWithRecs = {
      ...context,
      toolkitRecommendations: {
        stack: { detected: ['nextjs'], format: 'superpowers', multiAgent: false },
        recommendations: [
          {
            type: 'mcp' as const,
            name: 'test-mcp',
            package: '@test/mcp-server',
            description: 'Test MCP server',
            reason: 'Next.js detected',
            install: { method: 'mcp-config' as const, config: { command: 'npx', args: ['@test/mcp-server'] } },
            validated: true,
            agents: ['claude' as const],
            category: 'testing',
          },
        ],
        workflowGuidance: {
          complexity: 'medium' as const,
          suggestedWorkflow: 'spec-driven',
          reason: 'test',
        },
      },
    };
    await adapter.package('', outputDir, ctxWithRecs);
    const content = fs.readFileSync(join(outputDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('Recommended MCPs');
    expect(content).toContain('@test/mcp-server');
  });

  it('omits toolkit section in CLAUDE.md when no recommendations', async () => {
    await adapter.package('', outputDir, context);
    const content = fs.readFileSync(join(outputDir, 'CLAUDE.md'), 'utf-8');
    expect(content).not.toContain('Recommended MCPs');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/formats/superpowers.test.ts`
Expected: FAIL — "Recommended MCPs" not found in CLAUDE.md

- [ ] **Step 3: Update SuperpowersFormat**

In `src/formats/superpowers.ts`, read the file first to understand the exact CLAUDE.md generation section. Then add a helper function and modify the CLAUDE.md content generation to append a recommendations section when `context.toolkitRecommendations` is present.

Add a helper function before the class:
```typescript
function buildToolkitSection(recs: FormatContext['toolkitRecommendations']): string {
  if (!recs || recs.recommendations.length === 0) return '';

  const mcps = recs.recommendations.filter((r) => r.type === 'mcp');
  const skills = recs.recommendations.filter((r) => r.type === 'skill');
  const other = recs.recommendations.filter((r) => r.type !== 'mcp' && r.type !== 'skill');

  let section = '\n\n## Recommended MCPs\n\n';
  if (mcps.length > 0) {
    section += mcps.map((r) => `- **${r.package}** — ${r.description}`).join('\n');
  }
  if (skills.length > 0) {
    section += '\n\n## Recommended Skills\n\n';
    section += skills.map((r) => `- **${r.package || r.name}** — ${r.description}`).join('\n');
  }
  if (other.length > 0) {
    section += '\n\n## Other Recommended Tools\n\n';
    section += other.map((r) => `- **${r.name}** — ${r.description}`).join('\n');
  }

  return section;
}
```

Then in the CLAUDE.md generation, append the toolkit section to the content string before writing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/formats/superpowers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/formats/superpowers.ts tests/formats/superpowers.test.ts
git commit -m "feat(toolkit): inject recommendations into superpowers CLAUDE.md"
```

---

### Task 10: OpenSpec Format Adapter Integration

Inject toolkit recommendations into AGENTS.md when available.

**Files:**
- Modify: `src/formats/openspec.ts:12-15` (add recommendations section to AGENTS.md)
- Modify: `tests/formats/openspec.test.ts` (add test for recommendations in AGENTS.md)

- [ ] **Step 1: Write the failing test**

Add to `tests/formats/openspec.test.ts`, inside the `describe('OpenSpecFormat', ...)` block:

```typescript
  it('includes toolkit recommendations in AGENTS.md when provided', async () => {
    const ctxWithRecs = {
      ...context,
      toolkitRecommendations: {
        stack: { detected: ['nextjs'], format: 'openspec', multiAgent: true },
        recommendations: [
          {
            type: 'mcp' as const,
            name: 'test-mcp',
            package: '@test/mcp-server',
            description: 'Test MCP server',
            reason: 'Next.js detected',
            install: { method: 'mcp-config' as const, config: { command: 'npx', args: ['@test/mcp-server'] } },
            validated: true,
            agents: ['claude' as const, 'gemini' as const],
            category: 'testing',
          },
        ],
        workflowGuidance: {
          complexity: 'medium' as const,
          suggestedWorkflow: 'spec-driven',
          reason: 'test',
        },
      },
    };
    await adapter.package('', outputDir, ctxWithRecs);
    const content = fs.readFileSync(join(outputDir, 'openspec', 'AGENTS.md'), 'utf-8');
    expect(content).toContain('@test/mcp-server');
  });

  it('omits toolkit section in AGENTS.md when no recommendations', async () => {
    await adapter.package('', outputDir, context);
    const content = fs.readFileSync(join(outputDir, 'openspec', 'AGENTS.md'), 'utf-8');
    expect(content).not.toContain('Recommended MCP Servers');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/formats/openspec.test.ts`
Expected: FAIL

- [ ] **Step 3: Update OpenSpecFormat**

In `src/formats/openspec.ts`, add a helper function before the class:

```typescript
function buildToolkitSection(recs: FormatContext['toolkitRecommendations']): string {
  if (!recs || recs.recommendations.length === 0) return '';

  const mcps = recs.recommendations.filter((r) => r.type === 'mcp');
  const other = recs.recommendations.filter((r) => r.type !== 'mcp');

  let section = '\n\n## Recommended MCP Servers\n\n';
  if (mcps.length > 0) {
    section += mcps.map((r) => `- **${r.package}** — ${r.description} (agents: ${r.agents.join(', ')})`).join('\n');
  }
  if (other.length > 0) {
    section += '\n\n## Other Recommended Tools\n\n';
    section += other.map((r) => `- **${r.name}** — ${r.description}`).join('\n');
  }

  return section;
}
```

Then modify the AGENTS.md generation to append the toolkit section inside the `<openspec-instructions>` content string, before the closing tag. Find the `writeMarkdown` call for AGENTS.md and concatenate `buildToolkitSection(context.toolkitRecommendations)` into the content.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/formats/openspec.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/formats/openspec.ts tests/formats/openspec.test.ts
git commit -m "feat(toolkit): inject recommendations into openspec AGENTS.md"
```

---

### Task 11: Full Integration Test

End-to-end test that validates toolkit-gen output is consumed by the wizard.

**Files:**
- Create: `tests/toolkit/integration.test.ts`

- [ ] **Step 1: Write the integration test**

```typescript
// tests/toolkit/integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRecommendations, filterByAgent } from '../../src/toolkit/wizard.js';
import { extractJSON } from '../../src/toolkit/json-parser.js';
import type { ToolkitRecommendations } from '../../src/toolkit/types.js';
import { TOOLKIT_RECOMMENDATIONS_FILE } from '../../src/constants.js';

let tmpDir: string;

const validRecommendations: ToolkitRecommendations = {
  stack: { detected: ['nextjs', 'prisma'], format: 'superpowers', multiAgent: false },
  recommendations: [
    {
      type: 'mcp', name: 'prisma-mcp', package: '@prisma/mcp-server',
      description: 'DB introspection', reason: 'Prisma detected',
      install: { method: 'mcp-config', config: { command: 'npx', args: ['@prisma/mcp-server'] } },
      validated: true, agents: ['claude', 'gemini', 'cursor'], category: 'database',
    },
    {
      type: 'skill', name: 'db-migrations', package: 'superpowers-skills-db',
      description: 'Migration workflows', reason: 'Prisma detected',
      install: { method: 'npm', command: 'npm install -g superpowers-skills-db' },
      validated: true, agents: ['claude'], category: 'database',
    },
    {
      type: 'extension', name: 'Prisma VS Code', package: 'Prisma.prisma',
      description: 'Prisma syntax highlighting', reason: 'Prisma detected',
      install: { method: 'manual', instructions: 'Install Prisma extension' },
      validated: true, agents: ['cursor'], category: 'database',
    },
  ],
  workflowGuidance: {
    complexity: 'medium',
    suggestedWorkflow: 'spec-driven with domain decomposition',
    reason: '2 bounded contexts detected',
  },
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-toolkit-integration-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Toolkit integration', () => {
  it('writes and reads recommendations.json round-trip', () => {
    const filePath = join(tmpDir, TOOLKIT_RECOMMENDATIONS_FILE);
    fs.mkdirSync(join(tmpDir, 'toolkit'), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(validRecommendations, null, 2));

    const result = readRecommendations(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.recommendations).toHaveLength(3);
    expect(result!.stack.detected).toContain('nextjs');
  });

  it('filters recommendations by superpowers format (claude only)', () => {
    const filtered = filterByAgent(validRecommendations.recommendations, 'superpowers');
    // claude agent: prisma-mcp (has claude) and db-migrations (has claude)
    expect(filtered.every((r) => r.agents.includes('claude'))).toBe(true);
  });

  it('returns all recommendations for openspec format', () => {
    const filtered = filterByAgent(validRecommendations.recommendations, 'openspec');
    expect(filtered).toHaveLength(3);
  });

  it('extractJSON parses a simulated AI response', () => {
    const aiResponse = '```json\n' + JSON.stringify(validRecommendations) + '\n```';
    const parsed = extractJSON(aiResponse);
    expect(parsed).not.toBeNull();
    expect(parsed!.recommendations).toHaveLength(3);
  });

  it('handles malformed recommendations.json gracefully', () => {
    const filePath = join(tmpDir, TOOLKIT_RECOMMENDATIONS_FILE);
    fs.mkdirSync(join(tmpDir, 'toolkit'), { recursive: true });
    fs.writeFileSync(filePath, '{ broken json');

    const result = readRecommendations(tmpDir);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npx vitest run tests/toolkit/integration.test.ts`
Expected: PASS

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: ALL tests pass

- [ ] **Step 4: Commit**

```bash
git add tests/toolkit/integration.test.ts
git commit -m "test(toolkit): add integration tests for recommendation round-trip"
```

---

### Task 12: Final Verification

Run all tests and verify the full feature works end-to-end.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL tests pass

- [ ] **Step 2: Run TypeScript type checking**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Verify build**

Run: `npm run build` (if build script exists) or `npx tsc`
Expected: Clean build

- [ ] **Step 4: Commit any remaining changes**

If any fixes were needed during verification, commit them.
