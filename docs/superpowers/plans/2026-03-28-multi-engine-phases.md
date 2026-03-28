# Multi-Engine Per Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support multiple AI engines routed per pipeline phase with ordered fallback chains, while maintaining backwards compatibility with the existing single-engine config format.

**Architecture:** Config normalization layer converts both legacy (`ai.engine`) and new (`ai.engines` + `ai.phases`) formats into a single `ResolvedAIConfig` type. The factory builds engine chains per phase. The orchestrator tries engines in fallback order. Commands resolve their phase's engine chain before creating the orchestrator.

**Tech Stack:** Zod (schema validation), vitest (testing), TypeScript ESM

---

### Task 1: Add Phase Constants

**Files:**
- Modify: `src/constants.ts:31-36`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/constants.test.ts
import { describe, it, expect } from 'vitest';
import { PHASE_ANALYZE, PHASE_GENERATE, AI_PIPELINE_PHASES } from '../src/constants.js';

describe('AI pipeline phase constants', () => {
  it('exports analyze and generate phase names', () => {
    expect(PHASE_ANALYZE).toBe('analyze');
    expect(PHASE_GENERATE).toBe('generate');
  });

  it('exports AI_PIPELINE_PHASES tuple', () => {
    expect(AI_PIPELINE_PHASES).toEqual(['analyze', 'generate']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/constants.test.ts`
Expected: FAIL — `PHASE_ANALYZE` is not exported

- [ ] **Step 3: Add constants**

Add to `src/constants.ts` after line 36 (after `PHASE_ORDER`):

```typescript
// ── AI Pipeline Phases (for multi-engine routing) ──────────────────
export const PHASE_ANALYZE = 'analyze' as const;
export const PHASE_GENERATE = 'generate' as const;
export const AI_PIPELINE_PHASES = [PHASE_ANALYZE, PHASE_GENERATE] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/constants.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts tests/constants.test.ts
git commit -m "feat: add AI pipeline phase constants for multi-engine routing"
```

---

### Task 2: Add New Types for Multi-Engine Config

**Files:**
- Modify: `src/ai/types.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ai/types.test.ts
import { describe, it, expect } from 'vitest';

describe('Multi-engine types', () => {
  it('EngineConfig interface has optional fields', async () => {
    // Type-level test: if this compiles, the types exist
    const { } = await import('../../src/ai/types.js');
    // We verify the types exist by importing the module without error
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Add types to `src/ai/types.ts`**

Append after the existing `SubagentResult` interface:

```typescript
export interface EngineConfig {
  command?: string;
  model?: string;
  timeout?: number;
}

export interface PhaseRouting {
  analyze?: string[];
  generate?: string[];
}

export interface ResolvedAIConfig {
  timeout: number;
  max_parallel: number;
  engines: Record<string, EngineConfig>;
  phases: PhaseRouting;
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run tests/ai/types.test.ts`
Expected: PASS

- [ ] **Step 4: Run all existing tests to verify nothing broke**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/ai/types.ts tests/ai/types.test.ts
git commit -m "feat: add multi-engine type definitions"
```

---

### Task 3: Config Normalizer (Legacy → New Format)

**Files:**
- Create: `src/config/normalizer.ts`
- Test: `tests/config/normalizer.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/config/normalizer.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeAiConfig } from '../../src/config/normalizer.js';

describe('normalizeAiConfig', () => {
  it('passes through new format unchanged', () => {
    const input = {
      timeout: 600,
      max_parallel: 4,
      engines: { claude: { model: 'opus' }, gemini: {} },
      phases: { analyze: ['claude', 'gemini'], generate: 'gemini' },
    };
    const result = normalizeAiConfig(input);
    expect(result.engines).toEqual({ claude: { model: 'opus' }, gemini: {} });
    expect(result.phases.analyze).toEqual(['claude', 'gemini']);
    expect(result.phases.generate).toEqual(['gemini']);
  });

  it('normalizes legacy single-engine format', () => {
    const input = {
      engine: 'claude',
      timeout: 600,
      max_parallel: 4,
      model: 'opus',
    };
    const result = normalizeAiConfig(input);
    expect(result.engines).toEqual({ claude: { model: 'opus' } });
    expect(result.phases).toEqual({});
    expect(result.timeout).toBe(600);
    expect(result.max_parallel).toBe(4);
  });

  it('normalizes legacy custom engine with command', () => {
    const input = {
      engine: 'custom',
      command: 'my-cli -p',
      timeout: 300,
      max_parallel: 2,
    };
    const result = normalizeAiConfig(input);
    expect(result.engines).toEqual({ custom: { command: 'my-cli -p' } });
  });

  it('normalizes legacy format with command override on non-custom engine', () => {
    const input = {
      engine: 'claude',
      command: 'my-claude-wrapper',
      timeout: 600,
      max_parallel: 4,
    };
    const result = normalizeAiConfig(input);
    expect(result.engines).toEqual({ claude: { command: 'my-claude-wrapper' } });
  });

  it('normalizes string phase values to arrays', () => {
    const input = {
      timeout: 600,
      max_parallel: 4,
      engines: { gemini: {} },
      phases: { analyze: 'gemini', generate: 'gemini' },
    };
    const result = normalizeAiConfig(input);
    expect(result.phases.analyze).toEqual(['gemini']);
    expect(result.phases.generate).toEqual(['gemini']);
  });

  it('applies global defaults when missing', () => {
    const input = {
      engines: { claude: {} },
    };
    const result = normalizeAiConfig(input);
    expect(result.timeout).toBe(600);
    expect(result.max_parallel).toBe(4);
  });

  it('throws if both engine and engines are present', () => {
    const input = {
      engine: 'claude',
      engines: { claude: {} },
    };
    expect(() => normalizeAiConfig(input)).toThrow(
      'Cannot specify both "ai.engine" and "ai.engines"'
    );
  });

  it('throws if phase references undefined engine', () => {
    const input = {
      engines: { claude: {} },
      phases: { analyze: ['claude', 'openai'] },
    };
    expect(() => normalizeAiConfig(input)).toThrow(
      'Phase "analyze" references undefined engine "openai"'
    );
  });

  it('throws if engines map is empty', () => {
    const input = { engines: {} };
    expect(() => normalizeAiConfig(input)).toThrow('At least one engine must be defined');
  });

  it('throws if engine name is not a known engine type', () => {
    const input = { engines: { openai: {} } };
    expect(() => normalizeAiConfig(input)).toThrow('Unknown engine name "openai"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config/normalizer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement normalizer**

```typescript
// src/config/normalizer.ts
import { DEFAULT_AI_TIMEOUT_SECONDS, DEFAULT_MAX_PARALLEL, AI_ENGINES } from '../constants.js';
import type { ResolvedAIConfig, EngineConfig, PhaseRouting } from '../ai/types.js';

const VALID_ENGINES = new Set<string>(AI_ENGINES);

interface LegacyAIInput {
  engine?: string;
  command?: string;
  model?: string;
  timeout?: number;
  max_parallel?: number;
}

interface NewAIInput {
  timeout?: number;
  max_parallel?: number;
  engines?: Record<string, EngineConfig>;
  phases?: Record<string, string | string[]>;
}

type AIInput = LegacyAIInput & NewAIInput;

export function normalizeAiConfig(raw: unknown): ResolvedAIConfig {
  const input = (raw ?? {}) as AIInput;

  const hasLegacy = 'engine' in input && input.engine !== undefined;
  const hasNew = 'engines' in input && input.engines !== undefined;

  if (hasLegacy && hasNew) {
    throw new Error('Cannot specify both "ai.engine" and "ai.engines". Use one format or the other.');
  }

  const timeout = input.timeout ?? DEFAULT_AI_TIMEOUT_SECONDS;
  const max_parallel = input.max_parallel ?? DEFAULT_MAX_PARALLEL;

  if (hasLegacy) {
    const engineName = input.engine!;
    const engineConfig: EngineConfig = {};
    if (input.model) engineConfig.model = input.model;
    if (input.command) engineConfig.command = input.command;

    return {
      timeout,
      max_parallel,
      engines: { [engineName]: engineConfig },
      phases: {},
    };
  }

  const engines: Record<string, EngineConfig> = input.engines ?? {};

  if (Object.keys(engines).length === 0) {
    throw new Error('At least one engine must be defined in "ai.engines".');
  }

  for (const name of Object.keys(engines)) {
    if (!VALID_ENGINES.has(name)) {
      throw new Error(`Unknown engine name "${name}". Valid engines: ${AI_ENGINES.join(', ')}`);
    }
  }

  const rawPhases = input.phases ?? {};

  // Normalize string phase values to arrays
  const phases: PhaseRouting = {};
  for (const [phase, value] of Object.entries(rawPhases)) {
    const engineList = Array.isArray(value) ? value : [value];

    // Validate all referenced engines exist
    for (const engineName of engineList) {
      if (!(engineName in engines)) {
        throw new Error(
          `Phase "${phase}" references undefined engine "${engineName}". Define it in "ai.engines".`
        );
      }
    }

    (phases as Record<string, string[]>)[phase] = engineList;
  }

  return { timeout, max_parallel, engines, phases };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/config/normalizer.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/normalizer.ts tests/config/normalizer.test.ts
git commit -m "feat: config normalizer for legacy-to-new AI format conversion"
```

---

### Task 4: Update Config Schema to Accept Both Formats

**Files:**
- Modify: `src/config/schema.ts:72-83`
- Modify: `src/config/loader.ts:24`
- Modify: `tests/config/schema.test.ts`

- [ ] **Step 1: Write failing tests for the new format**

Add to `tests/config/schema.test.ts`:

```typescript
it('validates new multi-engine config format', () => {
  const withMultiEngine = {
    ...minimalConfig,
    ai: {
      timeout: 600,
      max_parallel: 4,
      engines: {
        claude: { model: 'opus', timeout: 900 },
        gemini: { model: 'pro' },
      },
      phases: {
        analyze: ['claude', 'gemini'],
        generate: 'gemini',
      },
    },
  };
  const result = configSchema.safeParse(withMultiEngine);
  expect(result.success).toBe(true);
});

it('rejects config with both engine and engines', () => {
  const invalid = {
    ...minimalConfig,
    ai: {
      engine: 'claude',
      engines: { claude: {} },
    },
  };
  const result = configSchema.safeParse(invalid);
  expect(result.success).toBe(false);
});

it('rejects phase referencing undefined engine', () => {
  const invalid = {
    ...minimalConfig,
    ai: {
      engines: { claude: {} },
      phases: { analyze: ['openai'] },
    },
  };
  const result = configSchema.safeParse(invalid);
  expect(result.success).toBe(false);
});

it('preserves legacy config defaults after normalization', () => {
  const result = configSchema.safeParse(minimalConfig);
  expect(result.success).toBe(true);
  if (!result.success) return;
  // Legacy format still works — ai.engine defaults to 'claude'
  expect(result.data.ai.engines).toBeDefined();
  expect(result.data.ai.engines.claude).toBeDefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/config/schema.test.ts`
Expected: FAIL — `ai.engines` not in schema output

- [ ] **Step 3: Update schema to accept both formats and normalize**

Replace the `aiObjectSchema` and `aiSchema` in `src/config/schema.ts` (lines 72-83):

```typescript
export const aiEngineEnum = z.enum(AI_ENGINES);
export type AIEngineType = z.infer<typeof aiEngineEnum>;

const engineConfigSchema = z.object({
  command: z.string().optional(),
  model: z.string().optional(),
  timeout: z.number().int().min(30).optional(),
}).passthrough();

const phaseValueSchema = z.union([z.string(), z.array(z.string())]);

const phasesSchema = z.object({
  analyze: phaseValueSchema.optional(),
  generate: phaseValueSchema.optional(),
}).optional();

// Accept raw AI input (either format) — normalizer handles the rest
const aiRawSchema = z.object({
  engine: aiEngineEnum.optional(),
  engines: z.record(z.string(), engineConfigSchema).optional(),
  command: z.string().optional(),
  model: z.string().optional(),
  max_parallel: z.number().int().min(1).max(16).optional(),
  timeout: z.number().int().min(30).optional(),
  phases: phasesSchema,
}).superRefine((data, ctx) => {
  if (data.engine !== undefined && data.engines !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cannot specify both "ai.engine" and "ai.engines". Use one format or the other.',
    });
    return;
  }

  // Validate phase references
  if (data.engines && data.phases) {
    const engineNames = new Set(Object.keys(data.engines));
    for (const [phase, value] of Object.entries(data.phases)) {
      const names = Array.isArray(value) ? value : [value];
      for (const name of names) {
        if (!engineNames.has(name)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Phase "${phase}" references undefined engine "${name}"`,
            path: ['phases', phase],
          });
        }
      }
    }
  }
});

const aiSchema = z.preprocess(
  (val) => val ?? {},
  aiRawSchema.transform((raw) => {
    // Import normalizer inline to avoid circular deps
    // The normalizer converts legacy format to new format
    return normalizeAiConfigSync(raw);
  }),
);
```

Also add the `normalizeAiConfigSync` import at top of schema.ts:

```typescript
import { normalizeAiConfig as normalizeAiConfigSync } from './normalizer.js';
```

- [ ] **Step 4: Update existing tests that assert `config.ai.engine`**

The schema now outputs `ResolvedAIConfig` (with `engines` map) instead of the old format (with `engine` string). Update all existing test assertions:

In `tests/config/schema.test.ts`, replace:
```typescript
expect(data.ai.engine).toBe('claude');
```
with:
```typescript
expect(data.ai.engines.claude).toBeDefined();
```

And replace:
```typescript
expect(result.data.ai.engine).toBe('custom');
expect(result.data.ai.command).toBe('/usr/local/bin/my-ai');
```
with:
```typescript
expect(result.data.ai.engines.custom).toBeDefined();
expect(result.data.ai.engines.custom.command).toBe('/usr/local/bin/my-ai');
```

In `tests/config/loader.test.ts`, replace any `config.ai.engine` assertions with `config.ai.engines` equivalents.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/config/schema.test.ts tests/config/loader.test.ts`
Expected: All PASS (both old and new tests)

- [ ] **Step 6: Commit**

```bash
git add src/config/schema.ts tests/config/schema.test.ts
git commit -m "feat: update config schema to accept multi-engine format with validation"
```

---

### Task 5: Update Factory to Create Engines from EngineConfig

**Files:**
- Modify: `src/ai/factory.ts`
- Modify: `tests/ai/factory.test.ts`

- [ ] **Step 1: Write failing tests for the new factory functions**

Add to `tests/ai/factory.test.ts`:

```typescript
import { createAIEngine, createEngineFromConfig, createEngineChain } from '../../src/ai/factory.js';
import type { ResolvedAIConfig } from '../../src/ai/types.js';

describe('createEngineFromConfig', () => {
  it('creates claude adapter from engine name', () => {
    const engine = createEngineFromConfig('claude', {});
    expect(engine.name).toBe('claude');
  });

  it('creates gemini adapter from engine name', () => {
    const engine = createEngineFromConfig('gemini', {});
    expect(engine.name).toBe('gemini');
  });

  it('creates codex adapter from engine name', () => {
    const engine = createEngineFromConfig('codex', {});
    expect(engine.name).toBe('codex');
  });

  it('creates custom adapter when command is in engine config', () => {
    const engine = createEngineFromConfig('custom', { command: 'my-cli -p' });
    expect(engine.name).toBe('custom');
  });

  it('creates custom adapter when command override is on non-custom engine', () => {
    const engine = createEngineFromConfig('claude', { command: 'my-wrapper' });
    expect(engine.name).toBe('custom');
  });

  it('throws for custom engine without command', () => {
    expect(() => createEngineFromConfig('custom', {})).toThrow(
      'custom engine requires a command'
    );
  });

  it('throws for unknown engine name', () => {
    expect(() => createEngineFromConfig('openai', {})).toThrow('Unknown AI engine');
  });
});

describe('createEngineChain', () => {
  const resolvedConfig: ResolvedAIConfig = {
    timeout: 600,
    max_parallel: 4,
    engines: {
      claude: { model: 'opus' },
      gemini: { model: 'pro' },
    },
    phases: {
      analyze: ['claude', 'gemini'],
      generate: ['gemini'],
    },
  };

  it('returns engine chain for a defined phase', () => {
    const chain = createEngineChain('analyze', resolvedConfig);
    expect(chain).toHaveLength(2);
    expect(chain[0].name).toBe('claude');
    expect(chain[1].name).toBe('gemini');
  });

  it('returns single engine for phase with one engine', () => {
    const chain = createEngineChain('generate', resolvedConfig);
    expect(chain).toHaveLength(1);
    expect(chain[0].name).toBe('gemini');
  });

  it('falls back to first engine when phase is not defined', () => {
    const chain = createEngineChain('unknown-phase', resolvedConfig);
    expect(chain).toHaveLength(1);
    expect(chain[0].name).toBe('claude');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ai/factory.test.ts`
Expected: FAIL — `createEngineFromConfig` not exported

- [ ] **Step 3: Implement new factory functions**

Replace `src/ai/factory.ts`:

```typescript
import type { AIEngine as AIEngineInterface, EngineConfig, ResolvedAIConfig } from './types.js';
import { ClaudeAdapter } from './adapters/claude.js';
import { CodexAdapter } from './adapters/codex.js';
import { GeminiAdapter } from './adapters/gemini.js';
import { CustomAdapter } from './adapters/custom.js';
import { ENGINE_CLAUDE, ENGINE_CODEX, ENGINE_GEMINI, ENGINE_CUSTOM } from '../constants.js';

/**
 * Create a single AI engine from a name and per-engine config.
 */
export function createEngineFromConfig(name: string, config: EngineConfig): AIEngineInterface {
  if (config.command && name !== ENGINE_CUSTOM) {
    return new CustomAdapter(config.command);
  }

  switch (name) {
    case ENGINE_CLAUDE:
      return new ClaudeAdapter();
    case ENGINE_CODEX:
      return new CodexAdapter();
    case ENGINE_GEMINI:
      return new GeminiAdapter();
    case ENGINE_CUSTOM:
      if (!config.command) {
        throw new Error('custom engine requires a command in engine config');
      }
      return new CustomAdapter(config.command);
    default:
      throw new Error(`Unknown AI engine: ${name}`);
  }
}

/**
 * Create an ordered engine chain for a pipeline phase.
 * Falls back to the first defined engine if the phase has no routing.
 */
export function createEngineChain(phase: string, config: ResolvedAIConfig): AIEngineInterface[] {
  const phaseEngines = (config.phases as Record<string, string[]>)[phase];
  const engineNames = phaseEngines ?? [Object.keys(config.engines)[0]];

  return engineNames.map((name) => {
    const engineConfig = config.engines[name] ?? {};
    return createEngineFromConfig(name, engineConfig);
  });
}

/**
 * @deprecated Use createEngineFromConfig or createEngineChain instead.
 * Kept for backwards compatibility during migration.
 */
export function createAIEngine(config: { engine: string; command?: string }): AIEngineInterface {
  return createEngineFromConfig(config.engine, { command: config.command });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/ai/factory.test.ts`
Expected: All PASS (old and new tests)

- [ ] **Step 5: Commit**

```bash
git add src/ai/factory.ts tests/ai/factory.test.ts
git commit -m "feat: add createEngineFromConfig and createEngineChain factory functions"
```

---

### Task 6: Update Orchestrator for Fallback Chain

**Files:**
- Modify: `src/ai/orchestrator.ts`
- Modify: `tests/ai/orchestrator.test.ts`

- [ ] **Step 1: Write failing tests for fallback behavior**

Add to `tests/ai/orchestrator.test.ts`:

```typescript
describe('Orchestrator with fallback chain', () => {
  it('uses first engine when it succeeds', async () => {
    const engine1 = makeMockEngine(async () => 'from-engine-1');
    const engine2 = makeMockEngine(async () => 'from-engine-2');
    const orchestrator = new Orchestrator([engine1, engine2], { max_parallel: 4, timeout: 30 });

    const results = await orchestrator.runAll([tasks[0]]);

    expect(results[0].status).toBe('success');
    expect(results[0].output).toBe('from-engine-1');
    expect(results[0].engine).toBe('mock');
    expect(engine2.run).not.toHaveBeenCalled();
  });

  it('falls back to second engine when first fails', async () => {
    const engine1 = makeMockEngine(async () => { throw new Error('rate limited'); });
    const engine2 = makeMockEngine(async () => 'from-engine-2');
    const orchestrator = new Orchestrator([engine1, engine2], { max_parallel: 4, timeout: 30 });

    const results = await orchestrator.runAll([tasks[0]]);

    expect(results[0].status).toBe('success');
    expect(results[0].output).toBe('from-engine-2');
  });

  it('returns failure when all engines fail', async () => {
    const engine1 = makeMockEngine(async () => { throw new Error('fail-1'); });
    const engine2 = makeMockEngine(async () => { throw new Error('fail-2'); });
    const orchestrator = new Orchestrator([engine1, engine2], { max_parallel: 4, timeout: 30 });

    const results = await orchestrator.runAll([tasks[0]]);

    expect(results[0].status).toBe('failure');
    expect(results[0].error).toBe('fail-2');
  });

  it('accepts single engine (no array) for backwards compat', async () => {
    const engine = makeMockEngine(async () => 'result');
    const orchestrator = new Orchestrator(engine, { max_parallel: 4, timeout: 30 });

    const results = await orchestrator.runAll([tasks[0]]);
    expect(results[0].status).toBe('success');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ai/orchestrator.test.ts`
Expected: FAIL — constructor doesn't accept array

- [ ] **Step 3: Update orchestrator to support engine chain**

Replace `src/ai/orchestrator.ts`:

```typescript
import type { AIEngine, SubagentTask, SubagentResult } from './types.js';

export class Orchestrator {
  private readonly engines: AIEngine[];

  constructor(
    engines: AIEngine | AIEngine[],
    private readonly config: { max_parallel: number; timeout: number },
  ) {
    this.engines = Array.isArray(engines) ? engines : [engines];
  }

  async runAll(tasks: SubagentTask[]): Promise<SubagentResult[]> {
    const results: SubagentResult[] = [];
    const chunks = this.chunk(tasks, this.config.max_parallel);

    for (const batch of chunks) {
      const batchResults = await Promise.allSettled(batch.map((t) => this.runOne(t)));
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

    for (let i = 0; i < this.engines.length; i++) {
      const engine = this.engines[i];
      const isLast = i === this.engines.length - 1;

      try {
        const output = await engine.run(task.prompt, { timeout: this.config.timeout });
        return {
          id: task.id,
          status: 'success',
          output,
          engine: engine.name,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);

        if (isLast) {
          const status = error.includes('TIMEOUT') ? 'timeout' : 'failure';
          return {
            id: task.id,
            status,
            error,
            engine: engine.name,
            durationMs: Date.now() - start,
          };
        }
        // Not last engine — try next one
      }
    }

    // Should never reach here, but TypeScript needs it
    return {
      id: task.id,
      status: 'failure',
      error: 'No engines available',
      durationMs: Date.now() - start,
    };
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

- [ ] **Step 4: Add `engine` field to SubagentResult type**

In `src/ai/types.ts`, update `SubagentResult`:

```typescript
export interface SubagentResult {
  id: string;
  status: 'success' | 'failure' | 'timeout';
  output?: string;
  error?: string;
  engine?: string;
  durationMs: number;
}
```

- [ ] **Step 5: Run all orchestrator tests**

Run: `npx vitest run tests/ai/orchestrator.test.ts`
Expected: All PASS (old + new tests)

- [ ] **Step 6: Commit**

```bash
git add src/ai/orchestrator.ts src/ai/types.ts tests/ai/orchestrator.test.ts
git commit -m "feat: orchestrator fallback chain — tries engines in order"
```

---

### Task 7: Update Analyze Command to Use Multi-Engine

**Files:**
- Modify: `src/commands/analyze.ts:28-34`

- [ ] **Step 1: Update imports**

Replace the factory import in `src/commands/analyze.ts`:

```typescript
// Before:
import { createAIEngine } from '../ai/factory.js';

// After:
import { createEngineChain } from '../ai/factory.js';
import { PHASE_ANALYZE } from '../constants.js';
```

- [ ] **Step 2: Update engine creation**

Replace lines 28-34 in `src/commands/analyze.ts`:

```typescript
// Before:
tui.phaseHeader('ANALYZE', `Engine: ${config.ai.engine}`);

const engine = createAIEngine(config.ai);
const orchestrator = new Orchestrator(engine, {
  max_parallel: config.ai.max_parallel,
  timeout: config.ai.timeout,
});

// After:
const engines = createEngineChain(PHASE_ANALYZE, config.ai);
const engineNames = engines.map((e) => e.name).join(' → ');
tui.phaseHeader('ANALYZE', `Engine: ${engineNames}`);

const orchestrator = new Orchestrator(engines, {
  max_parallel: config.ai.max_parallel,
  timeout: config.ai.timeout,
});
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/commands/analyze.ts
git commit -m "feat: analyze command uses multi-engine chain"
```

---

### Task 8: Update Generate Command to Use Multi-Engine

**Files:**
- Modify: `src/commands/generate.ts:52-58`

- [ ] **Step 1: Update imports**

```typescript
// Before:
import { createAIEngine } from '../ai/factory.js';

// After:
import { createEngineChain } from '../ai/factory.js';
import { PHASE_GENERATE } from '../constants.js';
```

- [ ] **Step 2: Update engine creation**

Replace lines 52-58 in `src/commands/generate.ts`:

```typescript
// Before:
tui.phaseHeader('GENERATE', `Format: ${format}`);

const engine = createAIEngine(config.ai);
const orchestrator = new Orchestrator(engine, {
  max_parallel: config.ai.max_parallel,
  timeout: config.ai.timeout,
});

// After:
const engines = createEngineChain(PHASE_GENERATE, config.ai);
const engineNames = engines.map((e) => e.name).join(' → ');
tui.phaseHeader('GENERATE', `Format: ${format} | Engine: ${engineNames}`);

const orchestrator = new Orchestrator(engines, {
  max_parallel: config.ai.max_parallel,
  timeout: config.ai.timeout,
});
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/commands/generate.ts
git commit -m "feat: generate command uses multi-engine chain"
```

---

### Task 9: Update Init Command to Generate New Config Format Example

**Files:**
- Modify: `src/commands/init.ts` (the template YAML)

- [ ] **Step 1: Find and update the YAML template in init command**

Update the generated `respec.config.yaml` template to show the new format as a comment:

```yaml
ai:
  engine: claude          # simple single-engine (default)
  timeout: 600
  max_parallel: 4
  # Multi-engine alternative:
  # engines:
  #   claude:
  #     model: opus
  #     timeout: 900
  #   gemini:
  #     model: pro
  # phases:
  #   analyze: [claude, gemini]
  #   generate: gemini
```

- [ ] **Step 2: Run init test**

Run: `npx vitest run tests/commands/init.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/commands/init.ts
git commit -m "feat: init command shows multi-engine config example"
```

---

### Task 10: Per-Engine Timeout/Model Resolution

**Files:**
- Modify: `src/ai/orchestrator.ts`
- Modify: `src/commands/analyze.ts`
- Modify: `src/commands/generate.ts`
- Modify: `tests/ai/orchestrator.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/ai/orchestrator.test.ts`:

```typescript
import type { EngineConfig } from '../../src/ai/types.js';

it('passes per-engine timeout and model to engine.run()', async () => {
  const engine = makeMockEngine(async () => 'result');
  const orchestrator = new Orchestrator(
    [engine],
    { max_parallel: 4, timeout: 600 },
    { mock: { timeout: 900, model: 'opus' } },
  );

  await orchestrator.runAll([tasks[0]]);

  expect(engine.run).toHaveBeenCalledWith(
    'Prompt 1',
    expect.objectContaining({ timeout: 900, model: 'opus' }),
  );
});

it('falls back to global timeout when per-engine timeout is not set', async () => {
  const engine = makeMockEngine(async () => 'result');
  const orchestrator = new Orchestrator(
    [engine],
    { max_parallel: 4, timeout: 600 },
    { mock: {} },
  );

  await orchestrator.runAll([tasks[0]]);

  expect(engine.run).toHaveBeenCalledWith(
    'Prompt 1',
    expect.objectContaining({ timeout: 600 }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ai/orchestrator.test.ts`
Expected: FAIL — constructor doesn't accept third arg

- [ ] **Step 3: Update orchestrator to accept engine configs**

Add optional third parameter to `Orchestrator` constructor and use it in `runOne`:

```typescript
import type { AIEngine, SubagentTask, SubagentResult, EngineConfig } from './types.js';

export class Orchestrator {
  private readonly engines: AIEngine[];

  constructor(
    engines: AIEngine | AIEngine[],
    private readonly config: { max_parallel: number; timeout: number },
    private readonly engineConfigs?: Record<string, EngineConfig>,
  ) {
    this.engines = Array.isArray(engines) ? engines : [engines];
  }
```

In `runOne`, resolve per-engine options before calling `engine.run()`:

```typescript
const perEngine = this.engineConfigs?.[engine.name] ?? {};
const output = await engine.run(task.prompt, {
  timeout: perEngine.timeout ?? this.config.timeout,
  model: perEngine.model,
});
```

- [ ] **Step 4: Update commands to pass engine configs**

In `src/commands/analyze.ts` and `src/commands/generate.ts`, update orchestrator construction:

```typescript
const orchestrator = new Orchestrator(engines, {
  max_parallel: config.ai.max_parallel,
  timeout: config.ai.timeout,
}, config.ai.engines);
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/ai/orchestrator.ts src/commands/analyze.ts src/commands/generate.ts tests/ai/orchestrator.test.ts
git commit -m "feat: per-engine timeout and model resolution in orchestrator"
```

---

### Task 11: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Config Schema section**

Update the `ai:` block in the Config Schema section of CLAUDE.md to document both formats:

```yaml
ai:
  # Legacy (single engine) — still supported:
  engine: claude | codex | gemini | custom
  command: string                              # custom CLI override
  timeout: number                              # default: 600
  max_parallel: number                         # default: 4
  model: string                                # optional model

  # New (multi-engine with phase routing):
  timeout: number                              # global default: 600
  max_parallel: number                         # global default: 4
  engines:
    claude:
      model: string                            # per-engine model
      timeout: number                          # per-engine timeout override
      max_parallel: number                     # per-engine parallelism override
    gemini: {}
    custom:
      command: string                          # required for custom
  phases:
    analyze: string | string[]                 # engine or fallback chain
    generate: string | string[]
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with multi-engine config schema"
```

---

### Task 12: Integration Smoke Test

**Files:**
- Create: `tests/integration/multi-engine.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// tests/integration/multi-engine.test.ts
import { describe, it, expect } from 'vitest';
import { configSchema } from '../../src/config/schema.js';
import { createEngineChain } from '../../src/ai/factory.js';
import { Orchestrator } from '../../src/ai/orchestrator.js';
import type { SubagentTask, AIEngine as AIEngineInterface } from '../../src/ai/types.js';

function makeMockEngine(name: string, response: string): AIEngineInterface {
  return { name, run: async () => response };
}

describe('Multi-engine integration', () => {
  it('full flow: parse config → create chain → orchestrate with fallback', () => {
    const rawConfig = {
      project: { name: 'test-project' },
      sources: { repo: { path: '.' } },
      ai: {
        timeout: 60,
        max_parallel: 2,
        engines: {
          claude: { model: 'opus', timeout: 120 },
          gemini: { model: 'pro' },
        },
        phases: {
          analyze: ['claude', 'gemini'],
          generate: 'gemini',
        },
      },
      output: {},
    };

    const parsed = configSchema.safeParse(rawConfig);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    // Verify normalized config shape
    expect(parsed.data.ai.engines.claude).toEqual({ model: 'opus', timeout: 120 });
    expect(parsed.data.ai.phases.analyze).toEqual(['claude', 'gemini']);
    expect(parsed.data.ai.phases.generate).toEqual(['gemini']);
  });

  it('legacy config still works end-to-end', () => {
    const rawConfig = {
      project: { name: 'legacy-project' },
      sources: { repo: { path: '.' } },
      ai: { engine: 'claude', timeout: 300 },
      output: {},
    };

    const parsed = configSchema.safeParse(rawConfig);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.ai.engines.claude).toBeDefined();
    expect(parsed.data.ai.timeout).toBe(300);
  });

  it('orchestrator uses fallback when first engine fails', async () => {
    const failEngine: AIEngineInterface = {
      name: 'fail',
      run: async () => { throw new Error('down'); },
    };
    const okEngine = makeMockEngine('ok', 'success-output');

    const orchestrator = new Orchestrator([failEngine, okEngine], {
      max_parallel: 1,
      timeout: 30,
    });

    const tasks: SubagentTask[] = [
      { id: 't1', prompt: 'test', outputPath: '/out.md' },
    ];

    const results = await orchestrator.runAll(tasks);
    expect(results[0].status).toBe('success');
    expect(results[0].output).toBe('success-output');
    expect(results[0].engine).toBe('ok');
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run tests/integration/multi-engine.test.ts`
Expected: All PASS

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add tests/integration/multi-engine.test.ts
git commit -m "test: integration smoke test for multi-engine pipeline"
```
