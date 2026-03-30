# Pipeline UX Improvements: Unified Run, Project Intent, and Two-Pass Guidance

## Overview

Simplify the ReSpec user experience from 5 manual steps to a single "Run" that chains the full pipeline, with two natural AI-guided checkpoints where the system suggests project intents and refinements based on actual codebase data. Add an optional `intent` field that shapes what analyzers/generators focus on without changing the pipeline architecture.

## Project Intent

### Config Schema

Two new optional fields on `project`:

```yaml
project:
  name: MyApp
  description: E-commerce platform
  intent: "port from Express to Fastify"  # optional, one-liner
  context_notes: |                         # optional, freeform
    Target stack: Fastify, PostgreSQL, Redis
    Constraints: keep existing DB schema, team of 3
    Focus: backend only, skip UI/frontend analysis
```

Both fields are optional. When omitted, the pipeline runs as it does today with no behavioral change.

### How Intent Enters the System

- **Quick-setup** (wizard, first run): not asked — comes post-ingest (Pass 1) when the system has data
- **`respec init`**: asks "What's the goal? (optional)" after name/description
- **`respec init --detailed`**: brainstorming-style interview (see Detailed Init section)
- **`--intent "..."` CLI flag**: sets intent without prompting, skips Pass 1
- **Individual commands** (`respec analyze`, `respec generate`, etc.): read `project.intent` and `project.context_notes` from config if present. Intent injection works the same regardless of whether the command was triggered from Run or individually.

### Intent Injection Mechanism

Add `intent?: string` and `contextNotes?: string` to `GeneratorContext` in `src/generators/types.ts`. In `src/commands/generate.ts`, populate them from `config.project.intent` and `config.project.context_notes` when constructing `generatorCtx`.

For analyzers: the orchestrator in `src/commands/analyze.ts` appends intent sections to prompts after the prompt builder returns them. If `config.project.intent` exists, append `\n\n## Project Intent\n\n{intent}`. If `config.project.context_notes` exists, append `\n\n## Additional Context\n\n{context_notes}`.

For generators: each prompt builder receives intent via `ctx.intent` and `ctx.contextNotes` and includes them in its prompt template. This follows the same pattern as `ctx.rawDir` — optional fields that prompt builders check and include if present.

### How Intent Is Used

- Injected as `## Project Intent` section in all analyzer and generator prompts
- If `context_notes` exists, injected as `## Additional Context` section alongside intent
- toolkit-gen uses intent to adjust MCP/skill recommendations
- sdd-gen references intent in the SDD introduction

### Low-Priority Heuristic

A small module `src/pipeline/intent.ts` marks analyzers/generators as low-priority based on keyword matching on the intent string:

| Intent contains | Low-priority analyzers | Low-priority generators |
|----------------|----------------------|------------------------|
| "upgrade", "update", "version" | flow-extractor, permission-scanner | flow-gen |
| "refactor" | (none) | (none — refactors need full analysis) |
| "port", "migrate" | (none — ports need full analysis) | (none) |
| "audit", "review" | (none) | task-gen, format-gen |

In autopilot/Run mode, low-priority items are skipped. In manual mode (individual commands), everything runs at normal priority. The mapping is a simple heuristic — if the intent doesn't match any keyword, everything runs.

**Visibility and override:**
- When a low-priority analyzer/generator is skipped, the TUI displays: `⊘ flow-gen — skipped (low priority for "upgrade" intent)`
- `--all` flag forces all analyzers/generators to run regardless of intent heuristic
- **Tier dependency safety**: if a skipped generator produces files that a downstream tier reads, the skip is overridden. For example, if `flow-gen` (tier 1) is low-priority but `sdd-gen` (tier 2) reads `flows/`, `flow-gen` is promoted back to normal priority. The intent module checks `reads` declarations in the registry to detect these dependencies.

## Two-Pass Intent System

Two AI-guided checkpoints during the pipeline where the system knows enough to help the user.

### Pass 1: Post-Ingest Intent Selection

After ingest completes, a lightweight AI call reads `raw/repo/dependencies.md` + `raw/repo/structure.md` and produces suggested intents.

```typescript
// src/pipeline/intent-suggest.ts
// Input: raw dependencies + structure
// Output: { suggestions: string[], reasoning: string }
```

The wizard displays options:

```
Based on your codebase: Express 4.x, PostgreSQL, 12 endpoints, monolith

Suggested goals:
  1. Full system specification (default)
  2. Port to modern framework
  3. Refactor for microservices
  4. Custom: [write your own]

? Select goal (Enter for full spec):
```

User selection saves to `project.intent` in config. The analyze phase receives this as context.

**Error handling**: Pass 1 is best-effort. If the AI call fails (network error, timeout, unparseable response), log a warning and continue without an intent. The pipeline is not blocked — intent is optional.

### Pass 2: Post-Analyze Refinement

After analyze completes, another AI call reads the analysis report (`_analysis-report.md`, bounded contexts, architecture) combined with the current intent.

```typescript
// src/pipeline/intent-refine.ts
// Input: analyzed output + current intent
// Output: { recommendations: string[], suggested_focus: string[] }
```

The wizard displays recommendations:

```
Analysis complete: 3 bounded contexts, 47 business rules, high coupling in auth module

Refined recommendations:
  - Auth module is tightly coupled — consider extracting first
  - Payment flow has external deps that need 1:1 mapping
  - Suggested focus: start with User Management context (least coupled)

? Adjust goal or add constraints? (Enter to continue)
```

User adjustments append to `project.context_notes` in config. The generate phase receives both `intent` + `context_notes`.

**Error handling**: Same as Pass 1 — best-effort. On failure, log warning and continue with existing intent/context_notes.

### Config Writing

Pass 1 and Pass 2 write back to `respec.config.yaml`. This requires a new `updateConfig(dir, updates)` function in `src/config/loader.ts` that:
1. Reads the existing YAML file as a string
2. Parses it with the `yaml` library (which preserves comments when using `parseDocument`)
3. Sets/updates only the specified fields
4. Writes back

This avoids rewriting the entire config from scratch and preserves user comments and formatting.

### Behavior by Mode

| Mode | Pass 1 (post-ingest) | Pass 2 (post-analyze) |
|------|---------------------|----------------------|
| Wizard / Run | Shows suggestions, user picks | Shows recommendations, user adjusts |
| Autopilot | Skipped, uses config or default | Skipped |
| CI | Skipped | Skipped |
| `--intent` flag | Skipped (flag value used) | Still runs, user can refine |

## Unified Run Flow

### Wizard Action Types

Extend `WizardAction` type in `src/wizard/menu.ts`:

```typescript
export type WizardAction =
  | 'init' | 'init-detailed' | 'quick-setup'
  | 'run' | 'continue'
  | 'ingest' | 'analyze' | 'generate' | 'export'
  | 'autopilot' | 'reset' | 'status' | 'validate' | 'review' | 'diff' | 'push-jira' | 'exit';
```

Add corresponding cases in `executeCommand` switch in `src/wizard/index.ts`:
- `'quick-setup'`: runs auto-detect → format prompt → persist config → falls through to `'run'`
- `'run'`: runs `ingest → [Pass 1] → analyze → [Pass 2] → generate → export → [toolkit wizard]`
- `'continue'`: same as `run` but starts from current pipeline state
- `'init-detailed'`: runs `respec init` with `--detailed` flag

### Wizard Menu Changes

| State | Primary action | Menu |
|-------|---------------|------|
| no-config | Quick-setup then Run | [quick-setup, init, init-detailed, exit] |
| empty | Run | [run, ingest, status, exit] |
| ingested | Continue | [continue, analyze, status, exit] |
| analyzed | Continue | [continue, generate, diff, status, exit] |
| generated | Export | [export, review, push-jira, diff, validate, reset, status, exit] |

Note: `autopilot` is removed from wizard menus. `run` replaces it — semantically, `run` is autopilot plus the two-pass intent checkpoints. The `--autopilot` CLI flag remains unchanged and runs the pipeline with zero interaction (no checkpoints, no prompts).

### Quick-Setup (no-config state, wizard mode)

1. Auto-detect project from manifests (name, description, stack)
2. Show: `Detected: MyApp (Next.js, Prisma, TypeScript)`
3. Ask format (dropdown, default openspec)
4. Persist `respec.config.yaml`
5. Start Run immediately

No intent question here — it comes post-ingest (Pass 1) when the system has actual data.

### Run / Continue

Run chains: `ingest → [Pass 1] → analyze → [Pass 2] → generate → export → [toolkit wizard]`

Continue picks up from the current state with the same checkpoints.

The Run/Continue flow has its own step-resolution logic (not reusing `getAutopilotSteps`). It defines an ordered list of steps including the two-pass checkpoints:

```typescript
const RUN_STEPS = [
  { id: 'ingest', phase: 'empty' },
  { id: 'intent-suggest', phase: 'ingested', interactive: true },
  { id: 'analyze', phase: 'ingested' },
  { id: 'intent-refine', phase: 'analyzed', interactive: true },
  { id: 'generate', phase: 'analyzed' },
  { id: 'export', phase: 'generated' },
  { id: 'toolkit', phase: 'generated', interactive: true },
];
```

Steps marked `interactive: true` are skipped in autopilot/CI mode. The flow starts from the first step whose `phase` matches the current state.

Both support:
- Pause with `P` at any batch boundary
- Low-priority skipping based on intent heuristic
- On failure: stops, returns to wizard at partial state

### CLI Mapping

```
respec                    # wizard → quick-setup if needed → Run
respec --autopilot        # zero questions, zero pauses, defaults for everything
respec --format kiro      # auto-init with format → Run
respec --intent "..."     # auto-init with intent (skip Pass 1) → Run
respec --all              # force all analyzers/generators (ignore low-priority)
respec init               # interactive quick init
respec init --detailed    # brainstorming-style init
respec ingest/analyze/... # individual steps (power user, unchanged)
```

## Detailed Init

`respec init --detailed` triggers an expanded brainstorming-style interview. Each question is skippable with Enter.

### Question Flow

```
1. What's the goal?
   > port from Express to Fastify

2. What's the target stack? (only if goal suggests port/migration)
   > Fastify, PostgreSQL, Redis

3. What constraints should we know about?
   (e.g., timeline, team size, must-keep components)
   > keep existing DB schema, team of 3, Q2 deadline

4. What should we focus on?
   ❯ Full system analysis (default)
     API contracts and endpoints
     Domain model and business rules
     Infrastructure and deployment
     Data model and storage

5. Any areas to skip or deprioritize?
   > UI/frontend — we're only porting the backend
```

Question 1 saves to `project.intent`. Questions 2-5 are combined into `project.context_notes`. The focus/skip answers also feed the low-priority heuristic.

After the interview, the standard init questions follow (Jira, Confluence, context repos, AI engine, format).

## Config Evolution Through Pipeline

```yaml
# After quick-setup (minimal)
project:
  name: MyApp
  description: E-commerce platform (Next.js, Prisma, TypeScript)
output:
  format: openspec

# After Pass 1 (intent selected)
project:
  name: MyApp
  description: E-commerce platform (Next.js, Prisma, TypeScript)
  intent: "port to modern framework"
output:
  format: openspec

# After Pass 2 (refined)
project:
  name: MyApp
  description: E-commerce platform (Next.js, Prisma, TypeScript)
  intent: "port to modern framework"
  context_notes: |
    Focus on User Management context first.
    Auth module tightly coupled — extract second.
output:
  format: openspec
```

## v1 Scope

### Included

- `project.intent` and `project.context_notes` optional fields in config schema (Zod validation)
- `intent` and `contextNotes` fields on `GeneratorContext` for prompt injection
- Intent section appended to analyzer prompts via orchestrator
- `intent-suggest.ts`: post-ingest AI call producing suggested intents (best-effort)
- `intent-refine.ts`: post-analyze AI call producing recommendations (best-effort)
- `intent.ts`: low-priority heuristic with tier dependency safety and `--all` override
- `updateConfig()` function for writing back intent/context_notes to YAML (comment-preserving)
- New `WizardAction` values: `run`, `continue`, `quick-setup`, `init-detailed`
- Quick-setup flow in wizard (auto-detect → format → persist → Run)
- Run / Continue with own step-resolution logic including interactive checkpoints
- Two-pass intent checkpoints (skipped in autopilot/CI)
- `--intent` and `--all` CLI flags
- `respec init --detailed` brainstorming-style init
- Skip visibility in TUI (`⊘ skipped` messages)

### v2 (future)

- Intent history tracking across runs
- Profile presets based on common intents
- Intent-aware diff
- Smart re-run: only re-run analyzers affected by intent change
- Intent-driven Jira push (filter tasks by relevance)

### Out of scope

- Breaking changes to config (new fields are optional)
- Modifying analyzer/generator registry structure
- Changing the TUI mode system
