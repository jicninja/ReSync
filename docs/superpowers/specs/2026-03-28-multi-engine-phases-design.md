# Multi-Engine Per Phase with Fallback

## Problem

ReSpec currently supports a single AI engine for the entire pipeline. Real-world usage needs different engines for different phases — heavy reasoning (analyze) benefits from Claude Opus, while template-following (generate) works fine with cheaper/faster models. Additionally, parallel subagent calls can hit rate limits, requiring automatic fallback to an alternative engine.

## Config Schema

### New Format

```yaml
ai:
  # Global defaults — apply to all engines unless overridden
  timeout: 600
  max_parallel: 4

  # Engine definitions (at least one required)
  engines:
    claude:
      model: opus           # optional per-engine model
      timeout: 900          # optional per-engine timeout override
      max_parallel: 2       # optional per-engine parallelism override
    gemini:
      model: pro
    codex: {}               # uses all global defaults
    custom:
      command: "my-cli -p"  # required for custom engine

  # Phase-to-engine routing (optional)
  phases:
    analyze: [claude, gemini]   # array = ordered fallback chain
    generate: gemini            # string = single engine, no fallback
```

### Backwards-Compatible Format

The existing single-engine config continues to work:

```yaml
ai:
  engine: claude
  timeout: 600
  max_parallel: 4
  model: opus
  command: string  # optional
```

When this format is detected, it is normalized internally to:

```yaml
ai:
  timeout: 600
  max_parallel: 4
  engines:
    claude:
      model: opus
  phases: {}  # all phases use claude (the only defined engine)
```

### Resolution Rules

1. If `ai.engine` (string) is present → legacy format, normalize to new format
2. If `ai.engines` (object) is present → new format
3. Both present → validation error
4. `phases` is optional — if omitted, all phases use the first engine in `engines`
5. Every engine referenced in `phases` must exist in `engines` — validation error otherwise
6. Per-engine fields (`timeout`, `max_parallel`, `model`) override global defaults
7. `custom` engine requires `command` field — validation error if missing

## Architecture Changes

### Config Schema (`src/config/schema.ts`)

New Zod schemas:

```typescript
const engineConfigSchema = z.object({
  command: z.string().optional(),
  model: z.string().optional(),
  timeout: z.number().int().min(30).optional(),
  max_parallel: z.number().int().min(1).max(16).optional(),
});

const enginesMapSchema = z.record(
  z.enum(AI_ENGINES),
  engineConfigSchema,
).refine(obj => Object.keys(obj).length >= 1, {
  message: 'At least one engine must be defined',
});

const phaseRoutingSchema = z.object({
  analyze: z.union([z.string(), z.array(z.string())]).optional(),
  generate: z.union([z.string(), z.array(z.string())]).optional(),
});

// Top-level ai schema accepts EITHER legacy or new format
const aiSchema = z.union([legacyAiSchema, newAiSchema]);
```

### Config Normalizer (`src/config/loader.ts`)

New function `normalizeAiConfig(raw)` that:

1. Detects legacy format (has `engine` key, no `engines` key)
2. Converts to new format
3. Returns normalized config for Zod validation

This runs before Zod parsing so the rest of the codebase only sees the new format.

### Resolved Config Type

After normalization, the internal type is always:

```typescript
interface ResolvedAIConfig {
  timeout: number;
  max_parallel: number;
  engines: Record<string, EngineConfig>;
  phases: {
    analyze?: string[];   // always normalized to array
    generate?: string[];
  };
}
```

### Factory (`src/ai/factory.ts`)

Current signature:
```typescript
createAIEngine(config: AIConfig): AIEngine
```

New signature:
```typescript
createAIEngine(engineName: string, engineConfig: EngineConfig): AIEngine
```

New helper:
```typescript
createEngineChain(phase: string, config: ResolvedAIConfig): AIEngine[]
// Returns ordered list of engines for a phase
// If phase not in config.phases, returns [first engine]
```

### Orchestrator (`src/ai/orchestrator.ts`)

Change constructor to accept engine chain:

```typescript
class Orchestrator {
  constructor(
    private readonly engines: AIEngine[],  // was: single engine
    private readonly config: { max_parallel: number; timeout: number },
  ) {}
}
```

Change `runOne()` to try engines in order:

```
runOne(task):
  for (i, engine) of engines:
    try:
      result = engine.run(prompt, options)
      return { status: 'success', output: result, engine: engine.name }
    catch (err):
      if i === engines.length - 1:
        return { status: 'failure', error: err.message }
      log warning: "${engine.name} failed, trying ${engines[i+1].name}"
```

Add `engine` field to `SubagentResult` so callers know which engine actually ran.

### Commands

**`src/commands/analyze.ts`:**
```typescript
// Before:
const engine = createAIEngine(config.ai);
const orchestrator = new Orchestrator(engine, config.ai);

// After:
const engines = createEngineChain('analyze', config.ai);
const orchestrator = new Orchestrator(engines, config.ai);
```

**`src/commands/generate.ts`:** Same pattern with `'generate'` phase.

### Constants (`src/constants.ts`)

New constants:

```typescript
export const PHASE_ANALYZE = 'analyze' as const;
export const PHASE_GENERATE = 'generate' as const;
export const PIPELINE_PHASES = [PHASE_ANALYZE, PHASE_GENERATE] as const;
```

## What Does NOT Change

- `AIEngine` interface — stays as `{ name: string; run(prompt, options): Promise<string> }`
- Individual adapters (claude.ts, codex.ts, gemini.ts, custom.ts) — untouched
- TUI system — untouched
- Analyzer/generator registries — untouched
- Confidence parser — untouched
- Decision log — untouched
- Ingest command — does not use AI

## Edge Cases

1. **Single engine, no phases defined** → all phases use that engine, no fallback
2. **All engines in fallback chain fail** → task marked as failure, error from last engine
3. **Rate limit mid-batch** → fallback kicks in for remaining retries, already-succeeded tasks kept
4. **Custom engine in fallback** → works, just needs `command` defined in its config
5. **Legacy config with `command` override** → normalized to custom engine entry

## Testing Strategy

- Unit tests for config normalizer (legacy → new format conversion)
- Unit tests for schema validation (both formats, error cases)
- Unit tests for `createEngineChain()` resolution logic
- Unit tests for orchestrator fallback behavior (mock engines)
- Integration test: load a multi-engine YAML and run analyze with mock adapters
