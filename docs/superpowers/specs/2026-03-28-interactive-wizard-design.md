# Interactive Wizard (`respec`)

## Problem

Currently ReSpec requires running individual commands (`respec init`, `respec ingest`, etc.) manually. Users need to know the pipeline order and available commands. An interactive wizard that guides users through the pipeline step-by-step with visual feedback makes the tool more accessible. Additionally, there's no way to refine AI prompts mid-execution — if an analyzer produces bad output, you only find out after everything finishes.

## Entry Point

`respec` without arguments launches the wizard. Individual commands continue working as before.

```
bin/respec.ts:
  - No subcommand → runWizard()
  - Subcommand present → commander handles it (unchanged)
```

## Flow

```
1. Splash screen (ASCII art + version)
2. Detect state:
   - No config → offer init
   - Config exists → read pipeline state (state.json)
3. Show contextual menu based on state:
   - empty     → [Init, Exit]
   - ingested  → [Analyze, Re-ingest, Status, Exit]
   - analyzed  → [Generate, Re-analyze, Status, Exit]
   - generated → [Export, Re-generate, Status, Validate, Exit]
4. After each command, return to menu with updated state
5. Spinners during execution, [P] to pause between batches
6. On pause: view outputs, add instructions, retry tasks, or abort
```

## Splash Screen

```
  ╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗
  ╠╦╝║╣ ╚═╗╠═╝║╣ ║
  ╩╚═╚═╝╚═╝╩  ╚═╝╚═╝
  reverse engineering → spec

  v0.1.0
```

ASCII art and tagline rendered in brand color (`#EF9F27`, already defined in `TUI_BRAND_COLOR` constant). Version from package.json.

## Contextual Menu

Uses `@clack/prompts` select. Menu shows only valid actions for current pipeline state. The recommended next action is the default selection:

```
◆  Pipeline: ingested (3 sources)
│
◇  What's next?
│  ● Analyze (recommended)
│  ○ Re-ingest sources
│  ○ View status
│  ○ Exit
└
```

### Menu Options by State

| State | Options | Default |
|-------|---------|---------|
| no config | Init, Autopilot, Exit | Init |
| empty (config exists) | Ingest, Autopilot, Status, Exit | Ingest |
| ingested | Analyze, Autopilot, Re-ingest, Status, Exit | Analyze |
| analyzed | Generate, Autopilot, Re-analyze, Status, Exit | Generate |
| generated | Export, Re-generate, Validate, Status, Exit | Export |

## Autopilot Mode

Runs the entire remaining pipeline automatically from the current state to completion. Available from any state except `generated`.

```
◇  What's next?
│  ○ Ingest sources
│  ● Autopilot — run full pipeline (recommended for new projects)
│  ○ View status
│  ○ Exit
└

◐  Autopilot: running full pipeline...

◐  [1/4] Ingesting sources...
✔  Ingest complete — 26 artifacts, 51 context files

◐  [2/4] Analyzing (Tier 1)...
✔  domain-mapper — done (45s)                    [P to pause]
✔  infra-detector — done (43s)
✔  api-mapper — done (44s)
◐  [2/4] Analyzing (Tier 2)...
✔  Analysis complete — 60% confidence

◐  [3/4] Generating specs...
✔  Generate complete — 6/6 generators

◐  [4/4] Packaging as superpowers...
✔  Autopilot complete! Specs at ./specs/
```

### Autopilot Behavior

- Determines remaining phases from current state (e.g., if `ingested`, runs analyze → generate → export)
- Runs each phase sequentially, showing progress with clack spinners
- On phase failure: stops, shows error, returns to menu (user can retry or fix)
- No confirmations between phases — that's the point of autopilot
- User can press `P` at any time to pause after the current batch completes
- Uses the same underlying command functions as manual mode

## Pause & Prompt Injection

The core interactive refinement feature. Pressing `P` during any phase execution pauses the pipeline **after the current batch completes** (never mid-AI-call). This turns ReSpec from a fire-and-forget pipeline into an interactive AI refinement loop.

### Pause Menu

```
◐  Analyzing... Tier 1: domain-mapper, infra-detector, api-mapper
✔  domain-mapper — done (45s)
✔  infra-detector — done (43s)
✔  api-mapper — done (44s)

[P pressed]

⏸  Paused after Tier 1. Next: Tier 2 (flow-extractor, rule-miner, permission-scanner)

◇  What do you want to do?
│  ● Resume
│  ○ Add instructions for remaining tasks
│  ○ View outputs so far
│  ○ Retry a task with different instructions
│  ○ Abort phase
└
```

### Add Instructions (Prompt Injection)

Appends user-provided context to all remaining task prompts in the current phase:

```
◇  Additional instructions for remaining tasks:
│  Focus on the payment flow and subscription management.
│  The backend uses Stripe for billing — check the webhook handlers.
│  _
└

✔  Instructions added. Resuming...

◐  Tier 2: flow-extractor (with custom instructions)
```

Instructions are injected as a Markdown section appended to each prompt:

```markdown
## Additional Instructions (user-provided)

Focus on the payment flow and subscription management.
The backend uses Stripe for billing — check the webhook handlers.
```

### View Outputs

Shows a summary of completed tasks with the first ~20 lines of each output:

```
◇  Which output to view?
│  ● domain-mapper
│  ○ infra-detector
│  ○ api-mapper
└

── domain-mapper output (first 20 lines) ──────────────

# Domain Model

## Bounded Contexts

### Organization Management
Handles tenant lifecycle, user management...

### Project Management
Manages coating inspection projects...

(showing 20 of 145 lines — full output at .respec/analyzed/domain/bounded-contexts.md)
────────────────────────────────────────────────────────
```

### Retry with Modifications

Re-runs a completed task with additional instructions. The original prompt is kept, the user's instructions are appended:

```
◇  Which task to retry?
│  ● domain-mapper
│  ○ infra-detector
│  ○ api-mapper
└

◇  Additional instructions for domain-mapper:
│  The main bounded contexts are: Organizations, Projects,
│  Instruments, and Reports. Focus on their relationships.
│  _
└

◐  Retrying domain-mapper with custom instructions...
✔  domain-mapper — done (38s, retry)
```

The retried output replaces the original in the output file.

### Orchestrator Hooks

The orchestrator gets an optional hooks interface to support pause between batches:

```typescript
interface OrchestratorHooks {
  onBatchComplete?(results: SubagentResult[]): Promise<BatchAction>;
}

interface BatchAction {
  action: 'continue' | 'abort';
  extraPrompt?: string;                              // inject into remaining tasks
  retryTasks?: { id: string; extraPrompt: string }[]; // retry specific tasks
}
```

- In wizard/interactive mode: the hook checks if `P` was pressed, shows pause menu, returns action
- In CI/auto mode: no hook registered (current behavior, zero overhead)
- The keypress handler (`src/tui/keypress.ts`) already supports `P` — it sets a flag that the hook checks

### Prompt Injection Scope

| Scope | Triggered by | Applies to |
|-------|-------------|------------|
| Remaining tasks | "Add instructions" | All tasks in remaining batches of current phase |
| Single retry | "Retry a task" | Only the retried task |

Instructions do NOT persist across phases. Each phase starts fresh. This prevents instruction accumulation from degrading prompts.

## Execution Feedback

Spinner from clack during long-running operations:

```
◐  Analyzing... Tier 1: domain-mapper, infra-detector, api-mapper   [P to pause]
✔  domain-mapper — done (45s)
✔  infra-detector — done (43s)
✔  api-mapper — done (44s)
◐  Analyzing... Tier 2: flow-extractor, rule-miner, permission-scanner
```

On completion, show summary and return to menu:

```
✔  Analysis complete — 6/6 analyzers passed, 60% confidence

◇  What's next?
│  ● Generate specs (recommended)
│  ○ Re-analyze
│  ○ View status
│  ○ Exit
└
```

On error:

```
✖  sdd-gen failed: timeout after 600s

◇  What's next?
│  ● Retry generate
│  ○ View status
│  ○ Exit
└
```

## File Structure

```
src/wizard/
├── index.ts          # runWizard() — main loop, state detection, menu cycle
├── splash.ts         # ASCII art rendering with brand color
├── menu.ts           # buildMenu(state) → clack select options
├── runner.ts         # Wraps command execution with clack spinner + pause support
└── pause.ts          # Pause menu, prompt injection, output viewer, retry logic
```

### index.ts

Main loop:
1. Show splash
2. Loop:
   a. Detect current state (config exists? state.json phase?)
   b. Build menu for state
   c. Show menu, get user choice
   d. Execute choice via runner (with pause hooks if interactive)
   e. Show result
   f. Continue loop (unless Exit)

### splash.ts

Exports `showSplash()` that prints the ASCII art with chalk/color using `TUI_BRAND_COLOR`. Reads version from package.json.

### menu.ts

Exports `buildMenu(state: PipelineState)` that returns clack select options. Each option has a `value` (command name), `label`, and optional `hint` ("recommended"). The recommended option is determined by the current state.

### runner.ts

Exports `runCommand(command, dir)` that:
1. Starts a clack spinner
2. Registers pause hook with the orchestrator
3. Calls the underlying command function (`runIngest`, `runAnalyze`, etc.)
4. Updates spinner text based on progress
5. Stops spinner on completion with success/error message

### pause.ts

Exports `createPauseHook()` that returns an `OrchestratorHooks` implementation:
- Listens for `P` keypress via the existing keypress handler
- When triggered, stops the spinner and shows the pause menu (clack select)
- Handles "Add instructions", "View outputs", "Retry task", "Resume", "Abort"
- Returns the appropriate `BatchAction` to the orchestrator

## Integration with bin/respec.ts

```typescript
// In bin/respec.ts, after commander setup:
program.action(async () => {
  // No subcommand → wizard
  const { runWizard } = await import('../src/wizard/index.js');
  await runWizard(process.cwd());
});
```

## Dependency

- `@clack/prompts` — lightweight prompts library (selects, spinners, confirmations)

## What Does NOT Change

- Individual commands (`respec ingest`, `respec analyze`, etc.) — unchanged
- Existing TUI system (renderer, controller, decision-log) — unchanged, used by individual commands
- Pipeline logic, config, AI adapters — unchanged
- `--auto` and `--ci` flags on individual commands — unchanged

## What Changes in Existing Code

- `src/ai/orchestrator.ts` — optional `hooks` parameter in constructor, `onBatchComplete` callback between batches
- `bin/respec.ts` — default action when no subcommand (launches wizard)
