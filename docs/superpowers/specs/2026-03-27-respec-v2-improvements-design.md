# ReSpec v2 Improvements — Design Spec

**Goal:** Evolve ReSpec from a batch CLI into an interactive, high-quality reverse-engineering tool with real-time TUI, richer AI output, and complete source coverage.

**Two parallel tracks:**
- **Track 1 — TUI Engine**: real-time progress, breakpoints, mode switching (interactive/auto/ci)
- **Track 2 — Content Quality**: Confluence ingestor, Kiro format completion, confidence parsing, prompt enrichment

---

## Track 1: TUI Engine

### Architecture

Three layers, cleanly separated:

```
┌─────────────────────────────────────┐
│  Commands (ingest, analyze, etc.)   │  ← existing, emit events
├─────────────────────────────────────┤
│  TUI Controller                     │  ← manages modes, breakpoints, hotkeys
├─────────────────────────────────────┤
│  Renderer                           │  ← spinners, tables, colors, layout
└─────────────────────────────────────┘
```

### Renderer (`src/tui/renderer.ts`)

Pure output functions. No state, no logic — just formatting.

| Function | Purpose |
|----------|---------|
| `spinner(text)` | Animated spinner via ora |
| `success(text)` | Green checkmark + text |
| `warn(text)` | Yellow warning + text |
| `error(text)` | Red X + text |
| `info(text)` | Blue info + text |
| `table(headers, rows)` | Formatted table with chalk |
| `tree(items)` | File tree rendering |
| `summary(title, stats)` | Boxed phase summary |
| `divider()` | Horizontal separator |
| `modeIndicator(mode)` | Shows current mode in corner |

CI mode: all functions degrade to plain `console.log()` with no ANSI codes.

### Events (`src/tui/events.ts`)

Ingestors, analyzers, and generators emit typed events instead of printing directly.

```typescript
type TUIEvent =
  | { type: 'progress'; message: string }
  | { type: 'result'; message: string; details?: string }
  | { type: 'warning'; message: string; details?: string }
  | { type: 'question'; id: string; message: string; choices: string[]; default: string }
  | { type: 'phase-complete'; phase: string; stats: Record<string, number> }
  | { type: 'subagent-start'; id: string; name: string }
  | { type: 'subagent-done'; id: string; status: string; durationMs: number }
```

### Controller (`src/tui/controller.ts`)

The brain. Manages runtime mode and event processing.

```typescript
type TUIMode = 'interactive' | 'auto' | 'ci';

interface TUIOptions {
  mode: TUIMode;
}

class TUIController {
  private mode: TUIMode;
  private decisions: Decision[];
  private keypressHandler: KeypressHandler;

  constructor(options: TUIOptions);

  // Rendering — fire-and-forget, no return value
  progress(message: string): void;
  success(message: string): void;
  warn(message: string, details?: string): void;
  error(message: string): void;
  phaseSummary(phase: string, stats: Record<string, number>): void;

  // Questions — only method that returns a value
  // Interactive: renders and waits. Auto/CI: returns default.
  ask(question: { id: string; message: string; choices: string[]; default: string }): Promise<string>;

  // Mode control
  setMode(mode: TUIMode): void;
  getMode(): TUIMode;

  // Decision log — writes to .respec/_decisions.md
  writeDecisionLog(respecDir: string): void;

  // Cleanup — restore terminal state, stop spinners
  destroy(): void;
}
```

The public API is split: `progress/success/warn/error/phaseSummary` for fire-and-forget rendering, `ask()` for questions that return answers. No generic `handle()` — each method is explicit.

**Mode behavior for `question` events:**

| Mode | Behavior |
|------|----------|
| interactive | Render question, wait for user input, return answer |
| auto | Use `event.default`, log decision, render briefly, continue |
| ci | Use `event.default`, no render |

**Hotkeys (active during interactive and auto modes):**

| Key | Action |
|-----|--------|
| `a` | Switch to auto-continue mode |
| `p` | Pause — switch to interactive mode |
| `Ctrl+C` | Abort execution |

When pausing from auto mode, the controller shows the last N auto-decisions so the user has context.

### Keypress + Ora Coexistence (`src/tui/keypress.ts`)

`ora` takes control of stdout for spinner rendering. Raw readline for hotkeys conflicts with this. The solution:

1. **Keypress listener runs on stdin in raw mode** but only processes single-char hotkeys (`a`, `p`)
2. **Before rendering a question** (spinner paused), the keypress listener is paused and readline takes over for multi-char input
3. **After question answered**, readline releases and keypress resumes
4. **SIGINT handler** (in Controller): calls `spinner.stop()` → `process.stdin.setRawMode(false)` → `process.exit(0)`. The `destroy()` method on Controller handles this cleanup sequence.

In CI mode, the keypress listener is never started.

```typescript
class KeypressHandler {
  private active: boolean;

  start(): void;    // enable raw mode, listen for a/p
  pause(): void;    // disable raw mode (for readline questions)
  resume(): void;   // re-enable raw mode
  stop(): void;     // cleanup, restore terminal
}
```

### Decision Log

Written to `.respec/_decisions.md` (appended per phase, not inside phase output dirs):

```markdown
# Decisions — Ingest

**Mode:** auto-continue
**Timestamp:** 2026-03-27T15:00:00Z

| # | Decision | Choice | Reason |
|---|----------|--------|--------|
| 1 | 3 internal endpoints detected | excluded | Default: exclude debug/internal routes |
| 2 | Hardcoded AWS_SECRET_KEY found | flagged | Default: flag potential secrets |
| 3 | 9 modules detected | included all | Default: include all modules |
```

### CLI Integration

```
respec ingest                # default: interactive mode
respec ingest --auto         # start in auto-continue
respec ingest --ci           # batch mode, no interaction
respec analyze --auto        # auto-continue through analysis
```

**Updated command signatures:**

```typescript
// All commands receive TUI options in addition to their existing options
interface CommandOptions {
  auto?: boolean;
  ci?: boolean;
  force?: boolean;
}

// Example: ingest
async function runIngest(dir: string, options: CommandOptions & { source?: string }): Promise<void>;

// Example: analyze
async function runAnalyze(dir: string, options: CommandOptions & { only?: string }): Promise<void>;
```

`bin/respec.ts` adds `--auto` and `--ci` as global options on the program (not per-command), so they propagate to all commands.

### Command Migration Pattern

Commands switch from `console.log` to TUI controller:

```typescript
// src/commands/ingest.ts — BEFORE
console.log('Ingesting repo...');
const result = await repoIngestor.ingest();
console.log(`  Repo: ${result.files} files`);

// AFTER
const tui = createTUI(options);   // reads --auto, --ci flags
tui.progress('Scanning repository...');
const result = await repoIngestor.ingest();
tui.success(`Repo: ${result.files} files`);

if (suspiciousEndpoints.length) {
  const action = await tui.ask({
    id: 'internal-endpoints',
    message: `${suspiciousEndpoints.length} endpoints look internal`,
    choices: ['include', 'exclude', 'select'],
    default: 'exclude',
  });
  // handle action...
}
```

The `createTUI(options)` factory reads CLI flags and returns the controller. Ingestors/analyzers themselves don't change — breakpoint logic lives in the commands.

### New Dependencies

- `chalk` (already installed) — colors
- `ora` (already installed) — spinners
- `ink` — NOT using. Too heavy. We use raw readline + ANSI for hotkeys.

### Files

```
src/tui/
├── events.ts          # TUIEvent type definitions
├── controller.ts      # TUIController class (mode management, hotkeys, event routing)
├── renderer.ts        # Pure rendering functions (spinner, table, tree, summary)
├── keypress.ts        # Raw keypress listener for hotkeys (a, p, Ctrl+C)
├── decision-log.ts    # Decision accumulator + Markdown writer
└── factory.ts         # createTUI(options) — reads flags, returns controller
```

---

## Track 2: Content Quality

### 2.1 Confluence Ingestor

Replace the placeholder in `src/ingestors/docs/index.ts` with a real implementation.

**API calls:**
- `GET /wiki/rest/api/content?spaceKey={space}&type=page&expand=body.storage,ancestors&limit=25`
- Paginate with `start` parameter until no more results
- Auth: Basic auth with `env:CONFLUENCE_TOKEN` (email:token base64)

**Processing:**
- Convert `body.storage.value` (Confluence storage format / HTML) to Markdown using `turndown`
- Preserve page hierarchy using `ancestors` field
- Sanitize: strip Confluence macros, convert tables, handle code blocks

**Output** (follows existing `raw/docs/` layout from CLAUDE.md):
```
raw/docs/
├── readme.md               # existing
├── local/{file}.md          # existing
├── confluence/              # NEW
│   ├── {page-slug}.md       # one file per page
│   └── _manifest.md         # pages fetched, hierarchy, stats
```

**New dependency:** `turndown` (HTML → Markdown converter)

**Files:**
```
src/ingestors/docs/
├── index.ts               # modify: add Confluence branch
├── confluence.ts           # NEW: ConfluenceClient class
└── html-to-markdown.ts     # NEW: turndown wrapper with Confluence-specific rules
```

### 2.2 Kiro Format Completion

Replace TODOs in `src/formats/kiro.ts` with real content from analyzed files.

**Mappings:**

| Kiro file | Source |
|-----------|--------|
| `steering/tech.md` | `analyzed/infra/architecture.md` + `raw/repo/dependencies.md` |
| `steering/structure.md` | `analyzed/domain/bounded-contexts.md` + `raw/repo/structure.md` |
| `specs/{ctx}/requirements.md` | Entities + business rules → EARS format (Given/When/Then) |
| `specs/{ctx}/design.md` | ERD + context map + API contracts |
| `specs/{ctx}/tasks.md` | task-gen output → Kiro checkbox format |

**Key change:** The Kiro adapter needs to receive analyzed content, not just `FormatContext`. Extend `FormatContext` or pass the analyzed dir:

```typescript
interface FormatContext {
  projectName: string;
  projectDescription: string;
  sddContent: string;
  analyzedDir: string;  // ← already exists, but Kiro needs to read it deeply
}
```

The adapter reads analyzed files directly and transforms them into Kiro's format. One `specs/` folder per bounded context.

### 2.3 Confidence Parsing

**Parser** (`src/analyzers/confidence-parser.ts`):

```typescript
interface ConfidenceResult {
  overall: 'HIGH' | 'MEDIUM' | 'LOW';
  items: Array<{
    name: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    reason?: string;
  }>;
}

function parseConfidence(aiOutput: string): ConfidenceResult;

// Mapping for state.json storage (floats 0-1)
function confidenceToFloat(level: 'HIGH' | 'MEDIUM' | 'LOW'): number;
// HIGH → 0.9, MEDIUM → 0.6, LOW → 0.3
```

Scans AI output for patterns:
- `**Confidence:** HIGH` / `Confidence: LOW`
- `[HIGH]`, `[MEDIUM]`, `[LOW]` markers
- Table rows with confidence columns

**Integration points:**

1. **analyze command**: after each subagent returns, parse confidence from output. Store in `_analysis-report.md` as structured data.

2. **State manager**: `state.json` gets real confidence scores:
   ```json
   "confidence": { "overall": 0.78, "domain": 0.92, "rules": 0.65 }
   ```

3. **TUI breakpoint**: LOW confidence triggers a question:
   ```
   ⚠ PAUSE — domain-mapper confidence LOW:
     "PaymentContext" — insufficient evidence (2 files)

   [c] provide context  [s] skip  [a] accept anyway
   ```

   **CI mode default for LOW confidence:** `accept anyway` — CI never blocks. Decisions are logged in `_decisions.md` for post-run review.

**Files:**
```
src/analyzers/
├── confidence-parser.ts    # NEW: parse confidence from AI output
└── report.ts               # modify: include parsed confidence data
```

### 2.4 Prompt Enrichment

Three improvements to analyzer prompts:

**A. Context source injection**

The analyze command currently reads only `raw/repo/`. Modify to also read `raw/context/*/` and inject with role annotation:

```
## Primary Source (target of SDD)
{raw/repo/ content}

## Context Source: backend-api (role: backend)
This is NOT the target. Use for understanding API contracts consumed by the primary source.
{raw/context/backend-api/ content}
```

**B. Cross-analyzer context (Tier 2)**

Tier 2 analyzers receive Tier 1 output as additional context:

```
## Prior Analysis (from Tier 1)
### Bounded Contexts (domain-mapper)
{analyzed/domain/bounded-contexts.md}

### Architecture (infra-detector)
{analyzed/infra/architecture.md}

## Raw Data
{raw files relevant to this analyzer}
```

This is already architecturally possible — Tier 2 runs after Tier 1 completes. Just need to load and inject the files.

**C. Example output in prompts**

Add a short example to each prompt template showing the expected format. For `domain-mapper.md`:

```markdown
## Example Output

### bounded-contexts.md (example)

## OrderContext

**Responsibility:** Manages order lifecycle from creation to fulfillment.

**Key Entities:** Order, OrderLine, OrderStatus

**Confidence:** HIGH — clear module boundary at `src/orders/`, dedicated DB tables.

**Relationships:**
- Consumes from: ProductContext (product catalog)
- Publishes to: NotificationContext (order events)
```

**Files modified:**
```
prompts/domain-mapper.md      # add context injection markers + example
prompts/flow-extractor.md     # add Tier 1 context + example
prompts/rule-miner.md         # add Tier 1 context + example
prompts/permission-scanner.md # add Tier 1 context + example
prompts/api-mapper.md         # add context source injection + example
prompts/infra-detector.md     # add example
src/commands/analyze.ts        # modify: inject context sources + Tier 1 output
```

---

## Convergence: TUI + Content Quality

When both tracks are complete, they integrate naturally:

| Content Event | TUI Behavior |
|---------------|-------------|
| Confidence LOW on an item | Interactive: pause + ask. Auto: log + continue |
| Secret/credential detected | Interactive: pause + ask. Auto: flag + continue |
| Context source ingested | Show role + file count in summary |
| Confluence pages fetched | Show page tree in summary |
| Cross-analyzer context injected | Show "Tier 2 using Tier 1 output" in progress |
| Kiro format generated | Show spec count per bounded context |

The `_decisions.md` log captures all auto-mode choices across both tracks.

---

## File Summary

### New files

```
src/tui/
├── events.ts
├── controller.ts
├── renderer.ts
├── keypress.ts
├── decision-log.ts
└── factory.ts

src/ingestors/docs/
├── confluence.ts
└── html-to-markdown.ts

src/analyzers/
└── confidence-parser.ts
```

### Modified files

```
src/commands/ingest.ts        # emit TUI events, add breakpoints
src/commands/analyze.ts       # emit TUI events, inject context, parse confidence
src/commands/generate.ts      # emit TUI events
src/commands/status.ts        # use TUI renderer for formatted output
src/ingestors/docs/index.ts   # integrate Confluence client
src/formats/kiro.ts           # read analyzed files, fill real content
src/analyzers/types.ts        # AnalyzerReport.confidence → ConfidenceResult
src/analyzers/report.ts       # include parsed confidence
src/state/types.ts            # IngestState.sources add context tracking, confidence types
src/constants.ts              # add CONFIDENCE_TO_FLOAT map, DECISIONS_FILENAME
bin/respec.ts                 # add --auto and --ci as global options
CLAUDE.md                     # update raw/docs/ structure to include confluence/

prompts/domain-mapper.md      # add example + context markers
prompts/flow-extractor.md     # add Tier 1 context + example
prompts/rule-miner.md         # add Tier 1 context + example
prompts/permission-scanner.md # add Tier 1 context + example
prompts/api-mapper.md         # add context source injection + example
prompts/infra-detector.md     # add example
```

### New dependencies

- `turndown` — HTML to Markdown (for Confluence)

---

## Visual Design & Aesthetics

The TUI must feel polished, not like raw log output. Design language:

**Color palette** (via chalk):
- **Amber/orange** (`#EF9F27`) — ReSpec brand, used for headers, phase titles, the logo
- **Green** — success states, checkmarks
- **Yellow** — warnings, breakpoints, questions
- **Red** — errors, failures
- **Dim gray** — secondary info, timestamps, file paths
- **White/bold** — primary text, emphasis

**Visual elements:**
- Phase headers with boxed titles: `╭─ INGEST ─────────────╮`
- Indented sub-steps with tree connectors: `├─ structure.md ✓`
- Spinners use ora with `dots` style (consistent, minimal)
- Summaries in bordered boxes at the end of each phase
- Breakpoint questions highlighted with amber background or bold yellow
- Mode indicator in top-right: `[interactive]` / `[auto]` / `[ci]`
- Progress counters: `[3/6] Scanning env vars...`

**Example styled output:**
```
╭─ INGEST ──────────────────────────────────────╮
│  Project: MyFrontend                          │
│  Sources: repo + 2 context + jira             │
╰───────────────────────────────────────────────╯

[1/6] ⠋ Scanning repo structure...
[1/6] ✓ Structure — 83 files, 33 dirs

[2/6] ⠋ Detecting endpoints...
[2/6] ✓ Endpoints — 14 found

  ⚠ 3 endpoints look internal:                    [interactive]
    POST /debug/reset-cache
    GET  /internal/health
    GET  /internal/metrics

    Include in SDD? (y)es (n)o (s)elect │ [a]uto [p]ause
    > _

[3/6] ✓ Dependencies — 12 production, 8 dev
[4/6] ✓ Models — 3 schemas (Prisma)
[5/6] ✓ Env vars — 8 found
[6/6] ✓ Modules — 9 analyzed

  ┌─ Context: backend-api (backend) ──────────┐
  │  ✓ 7 files scanned                        │
  │  ✓ 4 endpoints, 2 models                  │
  └────────────────────────────────────────────┘

╭─ INGEST COMPLETE ─────────────────────────────╮
│  repo/     ✓  15 artifacts                    │
│  context/  ✓  2 sources, 13 files             │
│  jira/     ✓  186 tickets                     │
│  docs/     ─  not configured                  │
│                                               │
│  Total: 214 artifacts in 4.2s                 │
╰───────────────────────────────────────────────╯

Continue to analyze? [y/n]
```

The renderer functions handle all formatting. Commands never construct ANSI strings directly — they call `tui.success()`, `tui.phaseSummary()`, etc.
