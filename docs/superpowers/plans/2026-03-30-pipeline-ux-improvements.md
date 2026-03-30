# Pipeline UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the ReSpec pipeline to a single "Run" flow with three AI-guided intent checkpoints, optional project intent, and unified wizard menus.

**Architecture:** Three subsystems built in sequence: (1) config schema + intent injection into prompts, (2) three-pass intent system with AI-generated questions, (3) unified Run flow with redesigned wizard menus. Each subsystem is independently testable.

**Tech Stack:** TypeScript (ESM), Vitest, @clack/prompts, yaml library (parseDocument for comment-preserving writes)

---

### Task 1: Config Schema — intent and context_notes

Add two optional fields to the project config schema.

**Files:**
- Modify: `src/config/schema.ts:15-19`
- Modify: `tests/config/schema.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// Add to tests/config/schema.test.ts in the existing describe block
it('accepts optional intent field', () => {
  const config = configSchema.parse({
    project: { name: 'Test', intent: 'port to Fastify' },
    sources: { repo: { path: '.' } },
    output: {},
  });
  expect(config.project.intent).toBe('port to Fastify');
});

it('accepts optional context_notes field', () => {
  const config = configSchema.parse({
    project: { name: 'Test', context_notes: 'Focus on backend\nSkip UI' },
    sources: { repo: { path: '.' } },
    output: {},
  });
  expect(config.project.context_notes).toBe('Focus on backend\nSkip UI');
});

it('accepts config without intent or context_notes', () => {
  const config = configSchema.parse({
    project: { name: 'Test' },
    sources: { repo: { path: '.' } },
    output: {},
  });
  expect(config.project.intent).toBeUndefined();
  expect(config.project.context_notes).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config/schema.test.ts`
Expected: FAIL — intent/context_notes not recognized by schema

- [ ] **Step 3: Add fields to projectSchema**

In `src/config/schema.ts`, modify `projectSchema` (lines 15-19):

```typescript
const projectSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  intent: z.string().optional(),
  context_notes: z.string().optional(),
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/config/schema.test.ts`
Expected: PASS

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/config/schema.ts tests/config/schema.test.ts
git commit -m "feat(intent): add optional intent and context_notes to config schema"
```

---

### Task 2: updateConfig — Comment-Preserving YAML Writer

**Files:**
- Modify: `src/config/loader.ts`
- Create: `tests/config/update-config.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/config/update-config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateConfig } from '../../src/config/loader.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-update-config-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('updateConfig', () => {
  it('adds intent to existing config', async () => {
    const configPath = join(tmpDir, 'respec.config.yaml');
    fs.writeFileSync(configPath, 'project:\n  name: TestProject\nsources:\n  repo:\n    path: .\n');

    await updateConfig(tmpDir, { 'project.intent': 'port to Fastify' });

    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('intent: port to Fastify');
    expect(content).toContain('name: TestProject');
  });

  it('updates existing intent value', async () => {
    const configPath = join(tmpDir, 'respec.config.yaml');
    fs.writeFileSync(configPath, 'project:\n  name: Test\n  intent: old goal\nsources:\n  repo:\n    path: .\n');

    await updateConfig(tmpDir, { 'project.intent': 'new goal' });

    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('intent: new goal');
    expect(content).not.toContain('old goal');
  });

  it('preserves comments', async () => {
    const configPath = join(tmpDir, 'respec.config.yaml');
    fs.writeFileSync(configPath, '# My project config\nproject:\n  name: Test # inline comment\nsources:\n  repo:\n    path: .\n');

    await updateConfig(tmpDir, { 'project.intent': 'refactor' });

    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('# My project config');
    expect(content).toContain('# inline comment');
  });

  it('adds context_notes as multiline', async () => {
    const configPath = join(tmpDir, 'respec.config.yaml');
    fs.writeFileSync(configPath, 'project:\n  name: Test\nsources:\n  repo:\n    path: .\n');

    await updateConfig(tmpDir, { 'project.context_notes': 'Focus on backend\nSkip UI' });

    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('context_notes');
    expect(content).toContain('Focus on backend');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config/update-config.test.ts`
Expected: FAIL — updateConfig not found

- [ ] **Step 3: Implement updateConfig**

Add to `src/config/loader.ts` after the existing `resolveEnvAuth` function:

```typescript
import { Document as YamlDocument, parseDocument } from 'yaml';

export async function updateConfig(dir: string, updates: Record<string, string>): Promise<void> {
  const configPath = join(dir, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    throw new Error(`${CONFIG_FILENAME} not found in ${dir}`);
  }

  const raw = readFileSync(configPath, 'utf-8');
  const doc = parseDocument(raw);

  for (const [dotPath, value] of Object.entries(updates)) {
    const keys = dotPath.split('.');
    doc.setIn(keys, value);
  }

  const { writeFileSync } = await import('node:fs');
  writeFileSync(configPath, doc.toString(), 'utf-8');
}
```

Note: update the import at top of file — change `import { parse as parseYaml } from 'yaml'` to `import { parse as parseYaml, parseDocument } from 'yaml'`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/config/update-config.test.ts`
Expected: PASS

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/config/loader.ts tests/config/update-config.test.ts
git commit -m "feat(intent): add comment-preserving updateConfig to config loader"
```

---

### Task 3: GeneratorContext — intent and contextNotes fields

**Files:**
- Modify: `src/generators/types.ts:8-15`
- Modify: `src/commands/generate.ts:69-75`

- [ ] **Step 1: Add fields to GeneratorContext**

In `src/generators/types.ts`, add after `rawDir?: string;`:

```typescript
  intent?: string;
  contextNotes?: string;
```

- [ ] **Step 2: Populate in generate command**

In `src/commands/generate.ts`, modify `generatorCtx` (lines 69-75):

```typescript
  const generatorCtx: GeneratorContext = {
    analyzedDir: analyzedPath,
    generatedDir: outputDir,
    projectName: config.project.name,
    format,
    rawDir: rawDir(dir),
    intent: config.project.intent,
    contextNotes: config.project.context_notes,
  };
```

- [ ] **Step 3: Run full suite**

Run: `npx vitest run`
Expected: All pass (new fields are optional, no consumers yet)

- [ ] **Step 4: Commit**

```bash
git add src/generators/types.ts src/commands/generate.ts
git commit -m "feat(intent): add intent and contextNotes to GeneratorContext"
```

---

### Task 4: Intent Injection into Analyzer Prompts

**Files:**
- Modify: `src/commands/analyze.ts:213-216`
- Create: `tests/pipeline/intent-injection.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/pipeline/intent-injection.test.ts
import { describe, it, expect } from 'vitest';
import { appendIntentToPrompt } from '../../src/pipeline/intent.js';

describe('appendIntentToPrompt', () => {
  it('appends intent section to prompt', () => {
    const prompt = 'Analyze the codebase.';
    const result = appendIntentToPrompt(prompt, 'port to Fastify', undefined);
    expect(result).toContain('## Project Intent');
    expect(result).toContain('port to Fastify');
  });

  it('appends both intent and context_notes', () => {
    const prompt = 'Analyze the codebase.';
    const result = appendIntentToPrompt(prompt, 'refactor', 'Focus on auth module');
    expect(result).toContain('## Project Intent');
    expect(result).toContain('refactor');
    expect(result).toContain('## Additional Context');
    expect(result).toContain('Focus on auth module');
  });

  it('returns original prompt when no intent', () => {
    const prompt = 'Analyze the codebase.';
    const result = appendIntentToPrompt(prompt, undefined, undefined);
    expect(result).toBe(prompt);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/intent-injection.test.ts`
Expected: FAIL

- [ ] **Step 3: Create intent module**

```typescript
// src/pipeline/intent.ts
export function appendIntentToPrompt(
  prompt: string,
  intent: string | undefined,
  contextNotes: string | undefined,
): string {
  if (!intent && !contextNotes) return prompt;

  let sections = '';
  if (intent) {
    sections += `\n\n## Project Intent\n\n${intent}`;
  }
  if (contextNotes) {
    sections += `\n\n## Additional Context\n\n${contextNotes}`;
  }

  return prompt + sections;
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/pipeline/intent-injection.test.ts`
Expected: PASS

- [ ] **Step 5: Wire into analyze command**

In `src/commands/analyze.ts`, add import at top:
```typescript
import { appendIntentToPrompt } from '../pipeline/intent.js';
```

After line 216 (the template replacements), add:
```typescript
      const finalPrompt = appendIntentToPrompt(prompt, config.project.intent, config.project.context_notes);
```

Then change the return object (line 218-222) to use `finalPrompt` instead of `prompt`:
```typescript
      return {
        id: analyzer.id,
        prompt: finalPrompt,
        outputPath: path.join(analyzedPath, analyzer.produces[0] ?? `${analyzer.id}.md`),
      };
```

- [ ] **Step 6: Wire into generator prompt builders**

In each prompt builder that uses `ctx` (e.g., `src/generators/sdd-gen.ts`, `toolkit-gen.ts`, etc.), the intent is available via `ctx.intent` and `ctx.contextNotes`. The prompt builders can include them naturally. For v1, add a shared helper call at the end of each builder's return:

Actually, simpler approach — modify `src/commands/generate.ts` to append intent after the prompt builder returns (same pattern as analyze). In the task construction block (around line 110), after `prompt = buildPrompt(generatorCtx)`:

```typescript
        prompt = appendIntentToPrompt(prompt, config.project.intent, config.project.context_notes);
```

Add the import at top of generate.ts:
```typescript
import { appendIntentToPrompt } from '../pipeline/intent.js';
```

- [ ] **Step 7: Run full suite**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add src/pipeline/intent.ts src/commands/analyze.ts src/commands/generate.ts tests/pipeline/intent-injection.test.ts
git commit -m "feat(intent): inject intent and context_notes into analyzer and generator prompts"
```

---

### Task 5: Low-Priority Heuristic

**Files:**
- Modify: `src/pipeline/intent.ts`
- Create: `tests/pipeline/intent-priority.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/pipeline/intent-priority.test.ts
import { describe, it, expect } from 'vitest';
import { getLowPriorityIds } from '../../src/pipeline/intent.js';

describe('getLowPriorityIds', () => {
  it('returns empty for no intent', () => {
    expect(getLowPriorityIds(undefined)).toEqual({ analyzers: [], generators: [] });
  });

  it('returns empty for full system specification', () => {
    expect(getLowPriorityIds('full system specification')).toEqual({ analyzers: [], generators: [] });
  });

  it('marks flow-extractor and permission-scanner low for upgrade intent', () => {
    const result = getLowPriorityIds('version upgrade');
    expect(result.analyzers).toContain('flow-extractor');
    expect(result.analyzers).toContain('permission-scanner');
    expect(result.generators).toContain('flow-gen');
  });

  it('returns empty for refactor intent', () => {
    const result = getLowPriorityIds('refactor');
    expect(result.analyzers).toEqual([]);
    expect(result.generators).toEqual([]);
  });

  it('marks task-gen and format-gen low for audit intent', () => {
    const result = getLowPriorityIds('audit the codebase');
    expect(result.generators).toContain('task-gen');
    expect(result.generators).toContain('format-gen');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/intent-priority.test.ts`
Expected: FAIL

- [ ] **Step 3: Add to intent module**

Append to `src/pipeline/intent.ts`:

```typescript
interface LowPriorityResult {
  analyzers: string[];
  generators: string[];
}

const INTENT_PRIORITY_RULES: Array<{
  keywords: string[];
  analyzers: string[];
  generators: string[];
}> = [
  {
    keywords: ['upgrade', 'update', 'version'],
    analyzers: ['flow-extractor', 'permission-scanner'],
    generators: ['flow-gen'],
  },
  {
    keywords: ['audit', 'review'],
    analyzers: [],
    generators: ['task-gen', 'format-gen'],
  },
];

export function getLowPriorityIds(intent: string | undefined): LowPriorityResult {
  if (!intent) return { analyzers: [], generators: [] };

  const lower = intent.toLowerCase();
  const analyzers: string[] = [];
  const generators: string[] = [];

  for (const rule of INTENT_PRIORITY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      analyzers.push(...rule.analyzers);
      generators.push(...rule.generators);
    }
  }

  return {
    analyzers: [...new Set(analyzers)],
    generators: [...new Set(generators)],
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/pipeline/intent-priority.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/intent.ts tests/pipeline/intent-priority.test.ts
git commit -m "feat(intent): add low-priority heuristic for intent-based analyzer/generator skipping"
```

---

### Task 6: Shared Pipeline Utility + Intent Suggest — Post-Ingest AI Questions

**Files:**
- Create: `src/pipeline/utils.ts`
- Create: `src/pipeline/intent-suggest.ts`
- Create: `tests/pipeline/intent-suggest.test.ts`

Before creating intent-suggest, create the shared utility:

```typescript
// src/pipeline/utils.ts
import * as fs from 'node:fs';

export function readFileOrEmpty(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}
```

- [ ] **Step 1: Write failing tests**

```typescript
// tests/pipeline/intent-suggest.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIntentSuggestPrompt, parseIntentSuggestResponse } from '../../src/pipeline/intent-suggest.js';
import type { IntentQuestion } from '../../src/pipeline/intent-suggest.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-intent-suggest-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('buildIntentSuggestPrompt', () => {
  it('includes dependency and structure content', () => {
    const rawDir = join(tmpDir, 'raw');
    fs.mkdirSync(join(rawDir, 'repo'), { recursive: true });
    fs.writeFileSync(join(rawDir, 'repo', 'dependencies.md'), '# Deps\n- express: 4.18');
    fs.writeFileSync(join(rawDir, 'repo', 'structure.md'), '# Structure\nsrc/\n  routes/');

    const prompt = buildIntentSuggestPrompt(rawDir, 'port / migration');
    expect(prompt).toContain('express: 4.18');
    expect(prompt).toContain('routes/');
    expect(prompt).toContain('port / migration');
  });

  it('returns null when raw files missing', () => {
    const prompt = buildIntentSuggestPrompt(join(tmpDir, 'nonexistent'), 'refactor');
    expect(prompt).toBeNull();
  });
});

describe('parseIntentSuggestResponse', () => {
  it('parses valid JSON response with questions', () => {
    const response = JSON.stringify({
      questions: [
        { id: 'target', text: 'Target framework?', type: 'text' },
        { id: 'modules', text: 'Which modules?', type: 'multiselect', options: ['auth', 'users'] },
      ],
      summary: 'Express 4.18 monolith',
    });
    const result = parseIntentSuggestResponse(response);
    expect(result).not.toBeNull();
    expect(result!.questions).toHaveLength(2);
    expect(result!.summary).toBe('Express 4.18 monolith');
  });

  it('handles markdown-wrapped JSON', () => {
    const response = '```json\n{"questions":[],"summary":"test"}\n```';
    const result = parseIntentSuggestResponse(response);
    expect(result).not.toBeNull();
  });

  it('returns null for invalid response', () => {
    const result = parseIntentSuggestResponse('not json');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/intent-suggest.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement intent-suggest**

```typescript
// src/pipeline/intent-suggest.ts
import * as path from 'node:path';
import { readFileOrEmpty } from './utils.js';

export interface IntentQuestion {
  id: string;
  text: string;
  type: 'select' | 'multiselect' | 'text';
  options?: string[];
}

export interface IntentSuggestResult {
  questions: IntentQuestion[];
  summary: string;
}

export function buildIntentSuggestPrompt(rawDir: string, intent: string): string | null {
  const deps = readFileOrEmpty(path.join(rawDir, 'repo', 'dependencies.md'));
  const structure = readFileOrEmpty(path.join(rawDir, 'repo', 'structure.md'));

  if (!deps && !structure) return null;

  return `You are an AI project advisor. Based on the codebase analysis below, generate 2-4 targeted follow-up questions to help refine the project goal.

IMPORTANT: Return ONLY valid JSON, no markdown wrapping.

## Project Dependencies

${deps || '(No dependency data)'}

## Project Structure

${structure || '(No structure data)'}

## User's Selected Goal

${intent}

## Instructions

Generate follow-up questions specific to this codebase and the user's goal. Each question should help clarify scope, constraints, or focus areas.

Return JSON matching this schema:
{
  "questions": [
    {
      "id": "unique-id",
      "text": "Question text to display",
      "type": "select" | "multiselect" | "text",
      "options": ["option1", "option2"]  // only for select/multiselect, generated from codebase data
    }
  ],
  "summary": "One-line summary of what was found in the codebase"
}

Rules:
- Generate options from ACTUAL data found in the codebase (module names, frameworks, etc.)
- For "port / migration" goals: ask about target stack and which modules to port
- For "refactor" goals: ask about target architecture and focus areas
- For "version upgrade" goals: ask about target versions and breaking changes to address
- Keep questions concrete and actionable
- Return ONLY the JSON object`;
}

export function parseIntentSuggestResponse(response: string): IntentSuggestResult | null {
  if (!response) return null;

  // Try raw parse
  try {
    return JSON.parse(response.trim());
  } catch {
    // Try fence extraction
  }

  const fenceMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
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

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/pipeline/intent-suggest.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/intent-suggest.ts tests/pipeline/intent-suggest.test.ts
git commit -m "feat(intent): add post-ingest intent suggestion with dynamic AI questions"
```

---

### Task 7: Intent Refine — Post-Analyze Recommendations

**Files:**
- Create: `src/pipeline/intent-refine.ts`
- Create: `tests/pipeline/intent-refine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/pipeline/intent-refine.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIntentRefinePrompt, parseIntentRefineResponse } from '../../src/pipeline/intent-refine.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-intent-refine-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('buildIntentRefinePrompt', () => {
  it('includes analysis report and intent', () => {
    const analyzedDir = join(tmpDir, 'analyzed');
    fs.mkdirSync(analyzedDir, { recursive: true });
    fs.writeFileSync(join(analyzedDir, '_analysis-report.md'), '# Report\n3 bounded contexts');

    const prompt = buildIntentRefinePrompt(analyzedDir, 'port to Fastify', 'Target: Fastify');
    expect(prompt).toContain('3 bounded contexts');
    expect(prompt).toContain('port to Fastify');
    expect(prompt).toContain('Target: Fastify');
  });
});

describe('parseIntentRefineResponse', () => {
  it('parses valid response', () => {
    const response = JSON.stringify({
      recommendations: ['Start with User module', 'Extract auth first'],
      suggested_focus: ['user-management', 'auth'],
    });
    const result = parseIntentRefineResponse(response);
    expect(result).not.toBeNull();
    expect(result!.recommendations).toHaveLength(2);
  });

  it('returns null for invalid response', () => {
    expect(parseIntentRefineResponse('invalid')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/intent-refine.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement intent-refine**

```typescript
// src/pipeline/intent-refine.ts
import * as path from 'node:path';
import { readFileOrEmpty } from './utils.js';

export interface IntentRefineResult {
  recommendations: string[];
  suggested_focus: string[];
}

export function buildIntentRefinePrompt(
  analyzedDir: string,
  intent: string | undefined,
  contextNotes: string | undefined,
): string {
  const report = readFileOrEmpty(path.join(analyzedDir, '_analysis-report.md'));
  const boundedContexts = readFileOrEmpty(path.join(analyzedDir, 'domain', 'bounded-contexts.md'));
  const architecture = readFileOrEmpty(path.join(analyzedDir, 'infra', 'architecture.md'));

  return `You are an AI project advisor. Based on the analysis below, provide recommendations to refine the project goal.

IMPORTANT: Return ONLY valid JSON, no markdown wrapping.

## Analysis Report

${report || '(No analysis report)'}

## Bounded Contexts

${boundedContexts || '(No bounded context data)'}

## Architecture

${architecture || '(No architecture data)'}

## Current Goal

${intent || '(No specific goal set)'}

## Additional Context

${contextNotes || '(None)'}

## Instructions

Provide actionable recommendations based on the analysis. Suggest which areas to focus on first, flag risks or coupling issues, and recommend a starting point.

Return JSON:
{
  "recommendations": ["recommendation 1", "recommendation 2"],
  "suggested_focus": ["bounded-context-1", "module-name"]
}`;
}

export function parseIntentRefineResponse(response: string): IntentRefineResult | null {
  if (!response) return null;

  try {
    return JSON.parse(response.trim());
  } catch {
    // Try fence extraction
  }

  const fenceMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
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

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/pipeline/intent-refine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/intent-refine.ts tests/pipeline/intent-refine.test.ts
git commit -m "feat(intent): add post-analyze intent refinement with recommendations"
```

---

### Task 8: Wizard Menu Redesign

**Files:**
- Modify: `src/wizard/menu.ts`
- Modify: `tests/wizard/menu.test.ts`

- [ ] **Step 1: Update menu test**

Update `tests/wizard/menu.test.ts` to reflect new menu structure. Key changes:
- `no-config` state should have `quick-setup`, `init`, `init-detailed`
- `empty` state should have `run` instead of `autopilot`
- `ingested` and `analyzed` should have `continue` instead of `autopilot`
- `generated` stays the same

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wizard/menu.test.ts`
Expected: FAIL

- [ ] **Step 3: Update WizardAction type and MENUS**

In `src/wizard/menu.ts`:

```typescript
export type WizardAction =
  | 'init' | 'init-detailed' | 'quick-setup'
  | 'run' | 'continue'
  | 'ingest' | 'analyze' | 'generate' | 'export'
  | 'autopilot' | 'reset' | 'status' | 'validate' | 'review' | 'diff' | 'push-jira' | 'exit';
```

Update `MENUS`:

```typescript
const MENUS: Record<WizardState, { options: Omit<MenuOption, 'hint'>[]; recommended: WizardAction }> = {
  'no-config': {
    recommended: 'quick-setup',
    options: [
      { value: 'quick-setup', label: 'Quick setup & run pipeline' },
      { value: 'init', label: 'Initialize project (quick)' },
      { value: 'init-detailed', label: 'Initialize project (detailed — Jira, Confluence, etc.)' },
      { value: 'exit', label: 'Exit' },
    ],
  },
  'empty': {
    recommended: 'run',
    options: [
      { value: 'run', label: 'Run full pipeline' },
      { value: 'ingest', label: 'Ingest sources only' },
      { value: 'status', label: 'View status' },
      { value: 'exit', label: 'Exit' },
    ],
  },
  'ingested': {
    recommended: 'continue',
    options: [
      { value: 'continue', label: 'Continue pipeline (analyze → generate → export)' },
      { value: 'analyze', label: 'Analyze only' },
      { value: 'status', label: 'View status' },
      { value: 'exit', label: 'Exit' },
    ],
  },
  'analyzed': {
    recommended: 'continue',
    options: [
      { value: 'continue', label: 'Continue pipeline (generate → export)' },
      { value: 'generate', label: 'Generate only' },
      { value: 'diff', label: 'View diff from last run' },
      { value: 'status', label: 'View status' },
      { value: 'exit', label: 'Exit' },
    ],
  },
  'generated': {
    recommended: 'export',
    options: [
      { value: 'export', label: 'Export to format' },
      { value: 'review', label: 'Review specs (detect hallucinations)' },
      { value: 'generate', label: 'Re-generate specs' },
      { value: 'push-jira', label: 'Push tasks to Jira' },
      { value: 'diff', label: 'View diff from last run' },
      { value: 'validate', label: 'Validate output' },
      { value: 'reset', label: 'Start fresh — wipe all and re-run' },
      { value: 'status', label: 'View status' },
      { value: 'exit', label: 'Exit' },
    ],
  },
};
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/wizard/menu.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/wizard/menu.ts tests/wizard/menu.test.ts
git commit -m "feat(wizard): redesign menus with Run, Continue, and quick-setup actions"
```

---

### Task 9: Quick-Setup Flow

**Files:**
- Create: `src/wizard/quick-setup.ts`
- Create: `tests/wizard/quick-setup.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/wizard/quick-setup.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  text: vi.fn(),
  log: { info: vi.fn(), success: vi.fn(), step: vi.fn() },
  isCancel: vi.fn(() => false),
}));

import * as clack from '@clack/prompts';
import { runQuickSetup } from '../../src/wizard/quick-setup.js';

const mockSelect = vi.mocked(clack.select);

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-quick-setup-'));
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runQuickSetup', () => {
  it('creates config file with detected project name', async () => {
    // Create a package.json for detection
    fs.writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'my-app', description: 'Test app' }));
    mockSelect.mockResolvedValueOnce('openspec'); // format
    mockSelect.mockResolvedValueOnce('full system specification'); // project type

    await runQuickSetup(tmpDir);

    const configPath = join(tmpDir, 'respec.config.yaml');
    expect(fs.existsSync(configPath)).toBe(true);
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('my-app');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wizard/quick-setup.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement quick-setup**

```typescript
// src/wizard/quick-setup.ts
import * as clack from '@clack/prompts';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import { detectProject } from '../init/detect.js';
import { OUTPUT_FORMATS, DEFAULT_OUTPUT_FORMAT, CONFIG_FILENAME, RESPEC_DIR } from '../constants.js';

const PROJECT_TYPES = [
  'full system specification',
  'port / migration',
  'refactor',
  'version upgrade',
  'audit / review',
] as const;

export async function runQuickSetup(dir: string): Promise<void> {
  const detected = detectProject(dir);

  clack.log.step(`Detected: ${detected.name}${detected.description ? ` (${detected.description})` : ''}`);

  // Ask format
  const format = await clack.select({
    message: 'Output format?',
    options: OUTPUT_FORMATS.map((f) => ({ value: f, label: f })),
    initialValue: DEFAULT_OUTPUT_FORMAT,
  });
  if (clack.isCancel(format)) return;

  // Ask project type (pre-ingest cold question)
  const projectType = await clack.select({
    message: 'What type of project is this?',
    options: [
      ...PROJECT_TYPES.map((t) => ({ value: t, label: t })),
      { value: 'custom', label: 'Custom (describe your own)' },
    ],
    initialValue: PROJECT_TYPES[0],
  });
  if (clack.isCancel(projectType)) return;

  let intent: string | undefined;
  if (projectType !== 'full system specification') {
    if (projectType === 'custom') {
      const custom = await clack.text({ message: 'Describe your goal:' });
      if (clack.isCancel(custom)) return;
      intent = custom as string;
    } else {
      intent = projectType as string;
    }
  }

  // Build config
  const config: Record<string, unknown> = {
    project: {
      name: detected.name,
      ...(detected.description && { description: detected.description }),
      ...(intent && { intent }),
    },
    sources: {
      repo: {
        path: '.',
        ...(detected.includes.length > 0 && { include: detected.includes }),
        ...(detected.excludes.length > 0 && { exclude: detected.excludes }),
      },
    },
    output: { format },
  };

  // Write config
  const configPath = join(dir, CONFIG_FILENAME);
  fs.writeFileSync(configPath, yamlStringify(config), 'utf-8');

  // Update .gitignore
  const gitignorePath = join(dir, '.gitignore');
  const respecEntry = RESPEC_DIR + '/';
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes(respecEntry)) {
      fs.appendFileSync(gitignorePath, `\n${respecEntry}\n`);
    }
  }

  clack.log.success(`Config saved to ${CONFIG_FILENAME}`);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/wizard/quick-setup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/wizard/quick-setup.ts tests/wizard/quick-setup.test.ts
git commit -m "feat(wizard): add quick-setup flow with auto-detect and project type selection"
```

---

### Task 10: Run/Continue Flow

**Files:**
- Create: `src/wizard/run-flow.ts`
- Create: `tests/wizard/run-flow.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/wizard/run-flow.test.ts
import { describe, it, expect } from 'vitest';
import { getRunSteps } from '../../src/wizard/run-flow.js';

describe('getRunSteps', () => {
  it('returns all steps from empty state without intent', () => {
    const steps = getRunSteps('empty', undefined);
    expect(steps[0].id).toBe('intent-type');
    expect(steps[1].id).toBe('ingest');
    expect(steps.map((s) => s.id)).toContain('analyze');
    expect(steps.map((s) => s.id)).toContain('generate');
    expect(steps.map((s) => s.id)).toContain('export');
  });

  it('skips intent-type when intent already set', () => {
    const steps = getRunSteps('empty', 'port to Fastify');
    expect(steps[0].id).toBe('ingest');
  });

  it('starts from analyze when state is ingested', () => {
    const steps = getRunSteps('ingested', undefined);
    expect(steps[0].id).toBe('intent-suggest');
  });

  it('starts from generate when state is analyzed', () => {
    const steps = getRunSteps('analyzed', undefined);
    expect(steps[0].id).toBe('intent-refine');
  });

  it('returns only export when state is generated', () => {
    const steps = getRunSteps('generated', undefined);
    expect(steps).toHaveLength(1);
    expect(steps[0].id).toBe('export');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wizard/run-flow.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement run-flow**

```typescript
// src/wizard/run-flow.ts
import * as clack from '@clack/prompts';
import type { WizardState } from './menu.js';
import type { ReSpecConfig } from '../config/schema.js';
import { runWithSpinner } from './runner.js';
import { updateConfig } from '../config/loader.js';
import { rawDir, analyzedDir } from '../utils/fs.js';

export interface RunStep {
  id: string;
  phase: WizardState;
  interactive: boolean;
}

const ALL_RUN_STEPS: RunStep[] = [
  { id: 'intent-type', phase: 'empty', interactive: true },
  { id: 'ingest', phase: 'empty', interactive: false },
  { id: 'intent-suggest', phase: 'ingested', interactive: true },
  { id: 'analyze', phase: 'ingested', interactive: false },
  { id: 'intent-refine', phase: 'analyzed', interactive: true },
  { id: 'generate', phase: 'analyzed', interactive: false },
  { id: 'export', phase: 'generated', interactive: false },
];

const PHASE_ORDER: WizardState[] = ['no-config', 'empty', 'ingested', 'analyzed', 'generated'];

const PROJECT_TYPES = [
  'full system specification',
  'port / migration',
  'refactor',
  'version upgrade',
  'audit / review',
] as const;

export function getRunSteps(state: WizardState, intent: string | undefined): RunStep[] {
  const stateIndex = PHASE_ORDER.indexOf(state);

  let steps = ALL_RUN_STEPS.filter((step) => {
    const stepIndex = PHASE_ORDER.indexOf(step.phase);
    return stepIndex >= stateIndex;
  });

  // Skip intent-type if intent already set
  if (intent) {
    steps = steps.filter((s) => s.id !== 'intent-type');
  }

  return steps;
}

async function handleIntentType(dir: string): Promise<void> {
  const projectType = await clack.select({
    message: 'What type of project is this?',
    options: [
      ...PROJECT_TYPES.map((t) => ({ value: t, label: t })),
      { value: 'custom', label: 'Custom (describe your own)' },
    ],
    initialValue: PROJECT_TYPES[0],
  });
  if (clack.isCancel(projectType)) return;

  if (projectType !== 'full system specification') {
    let intent: string;
    if (projectType === 'custom') {
      const custom = await clack.text({ message: 'Describe your goal:' });
      if (clack.isCancel(custom)) return;
      intent = custom as string;
    } else {
      intent = projectType as string;
    }
    await updateConfig(dir, { 'project.intent': intent });
  }
}

async function handleIntentSuggest(
  dir: string,
  config: ReSpecConfig,
  executeCommand: (command: string, dir: string) => Promise<void>,
): Promise<void> {
  const { buildIntentSuggestPrompt, parseIntentSuggestResponse } = await import('../pipeline/intent-suggest.js');
  const raw = rawDir(dir);
  const prompt = buildIntentSuggestPrompt(raw, config.project.intent ?? 'full system specification');
  if (!prompt) return;

  // Run lightweight AI call
  const { createEngineChain } = await import('../ai/factory.js');
  const { PHASE_ANALYZE } = await import('../constants.js');
  const engines = createEngineChain(PHASE_ANALYZE, config.ai);
  try {
    const engine = engines[0];
    const response = await engine.run({ id: 'intent-suggest', prompt, outputPath: '' });
    if (response.status !== 'success' || !response.output) return;

    const result = parseIntentSuggestResponse(response.output);
    if (!result || result.questions.length === 0) return;

    clack.log.step(result.summary);

    // Render dynamic questions
    const answers: string[] = [];
    for (const q of result.questions) {
      if (q.type === 'text') {
        const answer = await clack.text({ message: q.text });
        if (clack.isCancel(answer)) break;
        answers.push(`${q.text}: ${answer}`);
      } else if (q.type === 'select' && q.options) {
        const answer = await clack.select({
          message: q.text,
          options: q.options.map((o) => ({ value: o, label: o })),
        });
        if (clack.isCancel(answer)) break;
        answers.push(`${q.text}: ${answer}`);
      } else if (q.type === 'multiselect' && q.options) {
        const answer = await clack.multiselect({
          message: q.text,
          options: q.options.map((o) => ({ value: o, label: o })),
        });
        if (clack.isCancel(answer)) break;
        answers.push(`${q.text}: ${(answer as string[]).join(', ')}`);
      }
    }

    if (answers.length > 0) {
      const existing = config.project.context_notes ?? '';
      const notes = existing ? `${existing}\n${answers.join('\n')}` : answers.join('\n');
      await updateConfig(dir, { 'project.context_notes': notes });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    clack.log.warn(`Intent suggestions unavailable: ${message}`);
  }
}

async function handleIntentRefine(dir: string, config: ReSpecConfig): Promise<void> {
  const { buildIntentRefinePrompt, parseIntentRefineResponse } = await import('../pipeline/intent-refine.js');
  const analyzed = analyzedDir(dir);
  const prompt = buildIntentRefinePrompt(analyzed, config.project.intent, config.project.context_notes);

  const { createEngineChain } = await import('../ai/factory.js');
  const { PHASE_ANALYZE } = await import('../constants.js');
  const engines = createEngineChain(PHASE_ANALYZE, config.ai);
  try {
    const engine = engines[0];
    const response = await engine.run({ id: 'intent-refine', prompt, outputPath: '' });
    if (response.status !== 'success' || !response.output) return;

    const result = parseIntentRefineResponse(response.output);
    if (!result || result.recommendations.length === 0) return;

    const recList = result.recommendations.map((r) => `  - ${r}`).join('\n');
    clack.log.step(`Refined recommendations:\n${recList}`);

    const adjustment = await clack.text({
      message: 'Adjust goal or add constraints? (Enter to continue)',
    });
    if (clack.isCancel(adjustment)) return;
    if (adjustment && (adjustment as string).trim()) {
      const existing = config.project.context_notes ?? '';
      const notes = existing ? `${existing}\n${adjustment}` : adjustment as string;
      await updateConfig(dir, { 'project.context_notes': notes });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    clack.log.warn(`Intent refinement unavailable: ${message}`);
  }
}

export async function runPipeline(
  dir: string,
  state: WizardState,
  config: ReSpecConfig,
  executeCommand: (command: string, dir: string) => Promise<void>,
): Promise<void> {
  const steps = getRunSteps(state, config.project.intent);
  const pipelineSteps = steps.filter((s) => !s.interactive);
  const total = pipelineSteps.length;
  let pipelineIndex = 0;

  for (const step of steps) {
    // Interactive checkpoints
    if (step.interactive) {
      if (step.id === 'intent-type') {
        await handleIntentType(dir);
      } else if (step.id === 'intent-suggest') {
        await handleIntentSuggest(dir, config, executeCommand);
      } else if (step.id === 'intent-refine') {
        await handleIntentRefine(dir, config);
      }
      continue;
    }

    // Pipeline steps
    pipelineIndex++;
    const label = `[${pipelineIndex}/${total}] ${step.id}`;
    const result = await runWithSpinner(label, () => executeCommand(step.id, dir));
    if (!result.ok) {
      clack.log.error(`${step.id} failed: ${result.error}`);
      break;
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/wizard/run-flow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/wizard/run-flow.ts tests/wizard/run-flow.test.ts
git commit -m "feat(wizard): add Run/Continue step resolution with intent checkpoints"
```

---

### Task 11: Wire New Actions into Wizard

**Files:**
- Modify: `src/wizard/index.ts`
- Modify: `bin/respec.ts`

- [ ] **Step 1: Add new cases to executeCommand**

In `src/wizard/index.ts`, add new cases in the switch (after `case 'init':`):

```typescript
    case 'init-detailed': {
      const { runInteractiveInit } = await import('./init-flow.js');
      await runInteractiveInit(dir);
      break;
    }
```

- [ ] **Step 2: Add quick-setup, run, continue handlers in runWizard**

In `src/wizard/index.ts`, modify the `runWizard` function. After the `if (action === 'autopilot')` block (line 171-174), add:

```typescript
    if (action === 'quick-setup') {
      const { runQuickSetup } = await import('./quick-setup.js');
      await runQuickSetup(dir);
      // After quick-setup, fall through to run
      const { runPipeline } = await import('./run-flow.js');
      const { loadConfig } = await import('../config/loader.js');
      const config = await loadConfig(dir);
      await runPipeline(dir, detectState(dir), config, executeCommand);
      continue;
    }

    if (action === 'run' || action === 'continue') {
      const { runPipeline } = await import('./run-flow.js');
      const { loadConfig } = await import('../config/loader.js');
      const config = await loadConfig(dir);
      await runPipeline(dir, detectState(dir), config, executeCommand);
      continue;
    }
```

Note: `runPipeline` is now fully implemented in Task 10's `run-flow.ts` code above. It handles interactive checkpoints (intent-type, intent-suggest, intent-refine) and pipeline steps with spinner.

- [ ] **Step 3: Add `--intent` and `--detailed` flags to CLI**

In `bin/respec.ts`, add after the existing global options (line 35):

```typescript
  .option('--intent <text>', 'set project intent for this run')
  .option('--all', 'run all analyzers/generators regardless of intent priority')
```

Add `--detailed` flag to the init command (around line 38):

```typescript
program
  .command('init')
  .option('--detailed', 'detailed init with Jira, Confluence, and advanced options')
  .option('--repo <path>', 'repository path or URL')
```

In the init command action handler, check for `--detailed` and call `runInteractiveInit` (existing) vs quick init.

In the default action handler (line 139), add `--intent` handling before the wizard:

```typescript
  // --intent: auto-init if no config, set intent, then run
  if (opts.intent) {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { CONFIG_FILENAME } = await import('../src/constants.js');
    const { updateConfig } = await import('../src/config/loader.js');

    if (!existsSync(join(dir, CONFIG_FILENAME))) {
      // Auto-init with defaults
      await runInit(dir);
    }
    await updateConfig(dir, { 'project.intent': opts.intent });

    // Run pipeline
    const { loadConfig } = await import('../src/config/loader.js');
    const config = await loadConfig(dir);
    const { runPipeline } = await import('../src/wizard/run-flow.js');
    const { StateManager } = await import('../src/state/manager.js');
    const state = new StateManager(dir).load();
    const stateMap = { empty: 'empty', ingested: 'ingested', analyzed: 'analyzed', generated: 'generated' } as const;

    const executeCmd = async (cmd: string, d: string) => {
      switch (cmd) {
        case 'ingest': return runIngest(d, { ci: true, force: true });
        case 'analyze': return runAnalyze(d, { ci: true, force: true });
        case 'generate': return runGenerate(d, { ci: true, force: true });
        case 'export': return runExport(d, {});
      }
    };

    await runPipeline(dir, stateMap[state.phase] ?? 'empty', config, executeCmd);
    return;
  }
```

- [ ] **Step 4: Run full suite**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/wizard/index.ts src/wizard/run-flow.ts bin/respec.ts
git commit -m "feat(wizard): wire quick-setup, run, continue, and --intent flag into wizard and CLI"
```

---

### Task 12: Integration Test — Full Run Flow

**Files:**
- Create: `tests/wizard/run-flow-integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// tests/wizard/run-flow-integration.test.ts
import { describe, it, expect } from 'vitest';
import { getRunSteps } from '../../src/wizard/run-flow.js';
import { getLowPriorityIds, appendIntentToPrompt } from '../../src/pipeline/intent.js';

describe('Run flow integration', () => {
  it('full run from empty state skips nothing without intent', () => {
    const steps = getRunSteps('empty', undefined);
    const lowPriority = getLowPriorityIds(undefined);
    expect(steps.length).toBeGreaterThanOrEqual(6);
    expect(lowPriority.analyzers).toHaveLength(0);
    expect(lowPriority.generators).toHaveLength(0);
  });

  it('upgrade intent skips flow analyzers and generators', () => {
    const steps = getRunSteps('empty', 'version upgrade');
    const lowPriority = getLowPriorityIds('version upgrade');
    expect(steps[0].id).toBe('ingest'); // intent-type skipped
    expect(lowPriority.analyzers).toContain('flow-extractor');
    expect(lowPriority.generators).toContain('flow-gen');
  });

  it('intent injection adds sections to prompt', () => {
    const prompt = appendIntentToPrompt('Base prompt.', 'port to Fastify', 'Focus on API layer');
    expect(prompt).toContain('Base prompt.');
    expect(prompt).toContain('## Project Intent');
    expect(prompt).toContain('port to Fastify');
    expect(prompt).toContain('## Additional Context');
    expect(prompt).toContain('Focus on API layer');
  });

  it('continue from analyzed state includes intent-refine', () => {
    const steps = getRunSteps('analyzed', 'refactor');
    expect(steps[0].id).toBe('intent-refine');
    expect(steps[1].id).toBe('generate');
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run tests/wizard/run-flow-integration.test.ts`
Expected: PASS

- [ ] **Step 3: Run full suite**

Run: `npx vitest run`
Expected: ALL pass

- [ ] **Step 4: Run TypeScript type checking**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add tests/wizard/run-flow-integration.test.ts
git commit -m "test(wizard): add integration tests for Run flow with intent system"
```

---

### Task 13: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL tests pass

- [ ] **Step 2: Run TypeScript type checking**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Verify build**

Run: `npm run build` or `npx tsc`
Expected: Clean build
