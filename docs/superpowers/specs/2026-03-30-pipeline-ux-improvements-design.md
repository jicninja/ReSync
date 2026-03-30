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
- **`--intent "..."` CLI flag**: sets intent without prompting, skips pre-ingest cold questions. Post-ingest dynamic questions (Pass 1) still run to gather detail.
- **Individual commands** (`respec analyze`, `respec generate`, etc.): read `project.intent` and `project.context_notes` from config if present. Intent injection works the same regardless of whether the command was triggered from Run or individually.

### Intent Injection Mechanism

Add `intent?: string` and `contextNotes?: string` to `GeneratorContext` in `src/generators/types.ts`. In `src/commands/generate.ts`, populate them from config with explicit mapping: `intent: config.project.intent` and `contextNotes: config.project.context_notes` (YAML uses snake_case, TypeScript uses camelCase).

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

## Three-Pass Intent System

Three guided checkpoints: one pre-ingest (cold, 1-2 questions) and two post-pipeline-phase (dynamic, informed by data).

### Pre-Ingest: Project Type (1-2 cold questions)

Before ingest runs, the wizard asks 1-2 high-level questions that don't require seeing the code:

```
? What type of project is this?
  ❯ Full system specification (default)
    Port / Migration
    Refactor
    Version upgrade
    Audit / Review
    Custom: [describe]

? Brief description of the architecture (optional — press Enter to skip):
> Express monolith with PostgreSQL, serves mobile + web
```

The project type saves to `project.intent` (e.g., "port / migration"). The architecture description saves to `project.context_notes`. These two questions replace the old `--detailed` init interview — no more 5 static questions. In `respec init --detailed`, these same questions are asked during init.

### Pass 1: Post-Ingest Detail Questions (dynamic)

After ingest completes, an AI call reads `raw/repo/dependencies.md` + `raw/repo/structure.md` + the current intent, and generates **follow-up questions specific to the project type and what was found**.

```typescript
// src/pipeline/intent-suggest.ts
// Input: raw dependencies + structure + current intent
// Output: { questions: IntentQuestion[], summary: string }

interface IntentQuestion {
  id: string;
  text: string;
  type: 'select' | 'multiselect' | 'text';
  options?: string[];  // for select/multiselect — generated from ingested data
}
```

Example for a "Port / Migration" intent:

```
Ingested: Express 4.18, PostgreSQL, 12 endpoints, 3 modules (auth, payments, users)

? What's the target stack?
  > Fastify

? Which modules should be ported? (multi-select)
  ☑ auth (47 files, high complexity)
  ☑ users (23 files, medium complexity)
  ☐ payments (31 files, high complexity — external deps: Stripe, PayPal)

? Any constraints?
  > keep DB schema, deadline Q2
```

Example for a "Refactor" intent:

```
Ingested: React 17, Redux, 89 components, no TypeScript

? What aspect of the codebase needs refactoring?
  ❯ State management (Redux → modern alternative)
    Component architecture
    TypeScript migration
    Testing coverage
    Custom: [describe]

? Target state for the refactored code?
  > React 18 with Zustand, TypeScript strict mode
```

The questions are **generated by the LLM** based on what it found in the codebase and the intent type. The prompt instructs the LLM to return 2-4 targeted questions in the `IntentQuestion` schema. User answers are appended to `project.context_notes` in config.

**Error handling**: Best-effort. If the AI call fails, log a warning and continue with the intent from the pre-ingest question. If `raw/repo/dependencies.md` or `raw/repo/structure.md` are missing (e.g., only Jira sources configured), skip the AI call entirely and continue — there is nothing to base dynamic questions on. The pipeline is not blocked.

### Pass 2: Post-Analyze Refinement

After analyze completes, another AI call reads the analysis report (`_analysis-report.md`, bounded contexts, architecture) combined with the current intent and context_notes.

```typescript
// src/pipeline/intent-refine.ts
// Input: analyzed output + current intent + context_notes
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

All three passes can write back to `respec.config.yaml`. This requires a new `updateConfig(dir, updates)` function in `src/config/loader.ts` that:
1. Reads the existing YAML file as a string
2. Parses it with the `yaml` library (which preserves comments when using `parseDocument`)
3. Sets/updates only the specified fields
4. Writes back

This avoids rewriting the entire config from scratch and preserves user comments and formatting. New fields (`intent`, `context_notes`) are appended after existing `project` fields (name, version, description) to maintain logical grouping.

### Behavior by Mode

| Mode | Pre-Ingest (cold) | Pass 1 (post-ingest) | Pass 2 (post-analyze) |
|------|-------------------|---------------------|----------------------|
| Wizard / Run | Asks project type + architecture | Dynamic questions from AI | Recommendations, user adjusts |
| Autopilot | Skipped, uses config | Skipped | Skipped |
| CI | Skipped | Skipped | Skipped |
| `--intent` flag | Skipped (flag value used) | Still runs (detail questions) | Still runs, user can refine |

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
4. Ask project type (pre-ingest cold question — see Three-Pass Intent System)
5. Ask architecture description (optional)
6. Persist `respec.config.yaml`
7. Start Run immediately

### Run / Continue

Run chains: `[pre-ingest questions] → ingest → [Pass 1] → analyze → [Pass 2] → generate → export (includes toolkit wizard)`

Continue picks up from the current state with the same checkpoints.

The Run/Continue flow has its own step-resolution logic (not reusing `getAutopilotSteps`). It defines an ordered list of steps including the three-pass checkpoints:

```typescript
const RUN_STEPS = [
  { id: 'intent-type', phase: 'empty', interactive: true, skipIf: 'hasIntent' }, // skip if intent already in config
  { id: 'ingest', phase: 'empty' },
  { id: 'intent-suggest', phase: 'ingested', interactive: true }, // dynamic detail questions
  { id: 'analyze', phase: 'ingested' },
  { id: 'intent-refine', phase: 'analyzed', interactive: true },  // post-analyze refinement
  { id: 'generate', phase: 'analyzed' },
  { id: 'export', phase: 'generated' },  // toolkit wizard runs inside export (already implemented)
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

`respec init --detailed` triggers the full init flow (Jira, Confluence, context repos, AI engine, format) with the same pre-ingest cold questions (project type + architecture) as quick-setup. The detail questions that were previously static (target stack, constraints, focus areas) are now handled dynamically by Pass 1 post-ingest — where the AI generates targeted follow-up questions based on what it actually found in the codebase.

`respec init` (without `--detailed`) is the quick init: just the standard config questions without Jira/Confluence setup. Both modes include the 1-2 pre-ingest cold questions (project type + architecture).

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
- Pre-ingest cold questions (project type + architecture) in wizard and init
- `intent-suggest.ts`: post-ingest AI call producing dynamic follow-up questions based on intent + ingested data (best-effort)
- `intent-refine.ts`: post-analyze AI call producing recommendations (best-effort)
- `IntentQuestion` schema for AI-generated dynamic questions (select, multiselect, text)
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
