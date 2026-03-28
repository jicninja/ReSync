# ReSpec v2 Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve ReSpec from a batch CLI into an interactive tool with real-time TUI (3 modes: interactive/auto/ci), richer AI output (confidence parsing, context injection, prompt examples), and complete source coverage (Confluence, Kiro format).

**Architecture:** Two-track approach — Track 1 builds the TUI engine (renderer, controller, keypress, decision log), Track 2 improves content quality (Confluence, Kiro, confidence, prompts). Tracks converge when commands are migrated to use TUI + enhanced content. Final task updates docs and creates PR.

**Tech Stack:** TypeScript, chalk (colors), ora (spinners), readline (keypress), turndown (HTML→MD), Zod, vitest

**Spec:** `docs/superpowers/specs/2026-03-27-respec-v2-improvements-design.md`

---

## Task 1: Create feature branch + install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feat/v2-tui-and-quality
```

- [ ] **Step 2: Install new dependency**

```bash
npm install turndown
npm install -D @types/turndown
```

- [ ] **Step 3: Add TUI constants to src/constants.ts**

Add to `src/constants.ts`:

```typescript
// ── TUI ─────────────────────────────────────────────────────────────
export const DECISIONS_FILENAME = '_decisions.md';
export const TUI_BRAND_COLOR = '#EF9F27';

// ── Confidence ──────────────────────────────────────────────────────
export const CONFIDENCE_HIGH = 'HIGH' as const;
export const CONFIDENCE_MEDIUM = 'MEDIUM' as const;
export const CONFIDENCE_LOW = 'LOW' as const;
export const CONFIDENCE_TO_FLOAT: Record<string, number> = {
  HIGH: 0.9,
  MEDIUM: 0.6,
  LOW: 0.3,
};
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/constants.ts
git commit -m "chore: create v2 branch, add turndown dep, add TUI + confidence constants"
```

---

## Task 2: TUI Renderer — pure formatting functions

**Files:**
- Create: `src/tui/renderer.ts`
- Test: `tests/tui/renderer.test.ts`

Implement the visual layer. All functions are pure — they take data, return formatted strings or write to stdout. No state.

The renderer must support two modes: styled (chalk colors + unicode box chars) and plain (no ANSI, for CI). Pass `ci: boolean` to each function or use a module-level config.

Key functions:
- `phaseHeader(title, subtitle?)` — boxed header: `╭─ INGEST ──────╮`
- `stepProgress(current, total, message)` — `[2/6] ⠋ Detecting endpoints...`
- `stepSuccess(current, total, message)` — `[2/6] ✓ Endpoints — 14 found`
- `warn(message, details?)` — yellow `⚠` prefix
- `error(message)` — red `✗` prefix
- `info(message)` — blue `ℹ` prefix
- `phaseSummary(title, rows)` — boxed summary table
- `contextBox(name, role, stats)` — `┌─ Context: backend-api ─┐`
- `divider()` — horizontal line
- `modeTag(mode)` — `[interactive]` / `[auto]` / `[ci]`

Tests: verify styled output contains expected text (don't assert exact ANSI codes). Verify CI mode produces no ANSI.

- [ ] **Step 1: Write failing tests for renderer**

Test `phaseHeader`, `stepSuccess`, `warn`, `phaseSummary` in both styled and CI modes.

- [ ] **Step 2: Implement renderer**

Use chalk for colors. Brand amber: `chalk.hex('#EF9F27')`. Use unicode box drawing chars for borders. In CI mode, use plain text equivalents.

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/tui/renderer.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/tui/renderer.ts tests/tui/renderer.test.ts
git commit -m "feat(tui): add renderer with styled phase headers, summaries, and CI fallback"
```

---

## Task 3: TUI Decision Log

**Files:**
- Create: `src/tui/decision-log.ts`
- Test: `tests/tui/decision-log.test.ts`

Simple accumulator that collects decisions and writes them as Markdown.

```typescript
interface Decision {
  id: string;
  question: string;
  choice: string;
  reason: string; // "user chose" | "auto-default" | "ci-default"
}

class DecisionLog {
  private decisions: Decision[] = [];
  private phase: string = '';

  setPhase(phase: string): void;
  add(decision: Decision): void;
  getRecent(n: number): Decision[];
  write(respecDir: string): void; // appends to .respec/_decisions.md
}
```

Tests: add decisions, verify `getRecent`, verify `write` produces correct Markdown.

- [ ] **Step 1: Write failing tests**
- [ ] **Step 2: Implement decision-log.ts**
- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/tui/decision-log.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/tui/decision-log.ts tests/tui/decision-log.test.ts
git commit -m "feat(tui): add decision log accumulator with Markdown writer"
```

---

## Task 4: TUI Keypress Handler

**Files:**
- Create: `src/tui/keypress.ts`
- Test: `tests/tui/keypress.test.ts`

Handles raw stdin keypress for hotkeys (`a` → auto, `p` → pause). Must coexist with ora spinners.

```typescript
type KeyCallback = (key: 'a' | 'p') => void;

class KeypressHandler {
  constructor(private onKey: KeyCallback);
  start(): void;   // setRawMode(true), listen
  pause(): void;    // setRawMode(false) — for readline questions
  resume(): void;   // setRawMode(true) — after question
  stop(): void;     // cleanup, restore terminal
  isActive(): boolean;
}
```

In CI mode, never instantiated. The controller checks `process.stdin.isTTY` before creating.

Tests: unit test the class methods (start/pause/resume/stop state transitions). Don't test actual stdin in automated tests — mock `process.stdin`.

- [ ] **Step 1: Write failing tests** (state transitions, mock stdin)
- [ ] **Step 2: Implement keypress.ts**
- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/tui/keypress.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/tui/keypress.ts tests/tui/keypress.test.ts
git commit -m "feat(tui): add keypress handler for runtime mode switching"
```

---

## Task 5: TUI Controller + Factory

**Files:**
- Create: `src/tui/controller.ts`
- Create: `src/tui/factory.ts`
- Test: `tests/tui/controller.test.ts`

The controller ties renderer + keypress + decision log together. The factory creates the right controller from CLI options.

Controller API:
- `progress(message)` — renders spinner (interactive/auto) or plain text (ci)
- `success(message)` — renders checkmark
- `warn(message, details?)` — renders warning
- `error(message)` — renders error
- `phaseSummary(phase, stats)` — renders boxed summary
- `ask(question)` — interactive: prompt user. auto/ci: use default, log decision
- `setMode(mode)` / `getMode()` — runtime toggle
- `writeDecisionLog(respecDir)` — delegates to DecisionLog
- `destroy()` — stop keypress, stop spinner, restore terminal

Factory:
```typescript
function createTUI(options: { auto?: boolean; ci?: boolean }): TUIController;
```
- `--ci` → ci mode (no colors, no interaction, no keypress)
- `--auto` → auto mode (colors, no interaction, keypress active)
- default → interactive mode (colors, interaction, keypress active)

Tests: test `ask()` in all 3 modes — interactive returns user input (mock readline), auto returns default and logs decision, ci returns default silently. Test mode switching.

- [ ] **Step 1: Write failing tests**
- [ ] **Step 2: Implement controller.ts**
- [ ] **Step 3: Implement factory.ts**
- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/tui/controller.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/tui/controller.ts src/tui/factory.ts tests/tui/controller.test.ts
git commit -m "feat(tui): add controller with 3 modes + factory"
```

---

## Task 6: Wire TUI into CLI + Migrate Commands

**Files:**
- Modify: `bin/respec.ts` — add `--auto`, `--ci` global options
- Modify: `src/commands/ingest.ts` — replace console.log with TUI
- Modify: `src/commands/analyze.ts` — replace console.log with TUI
- Modify: `src/commands/generate.ts` — replace console.log with TUI
- Modify: `src/commands/status.ts` — use TUI renderer for formatted output
- Modify: `src/commands/export.ts` — replace console.log with TUI

Add `--auto` and `--ci` as global program options in `bin/respec.ts`. These propagate to all command handlers via `program.opts()`.

Each command creates a TUI via `createTUI(options)` and replaces all `console.log`/`console.warn` with `tui.progress()`, `tui.success()`, `tui.warn()`, `tui.error()`, `tui.phaseSummary()`.

Add breakpoints in `ingest.ts`:
- After endpoint detection: if any endpoints match internal patterns (`/debug/`, `/internal/`, `/health`), ask whether to include
- After env-var scan: if any look like hardcoded secrets, ask whether to flag

Add breakpoints in `analyze.ts`:
- After each analyzer completes: if confidence is LOW, ask for action

At end of each command: `tui.writeDecisionLog(respecDir)` and `tui.destroy()`.

- [ ] **Step 1: Add global options to bin/respec.ts**

Add `--auto` and `--ci` to the program (not per-command). Pass them through to command handlers.

- [ ] **Step 2: Migrate ingest.ts**

Replace all `console.log`/`console.warn` with TUI calls. Add breakpoints for internal endpoints and secrets.

- [ ] **Step 3: Migrate analyze.ts**

Replace logging with TUI calls. Add confidence breakpoint (placeholder — confidence parsing comes in Task 8).

- [ ] **Step 4: Migrate generate.ts, export.ts, status.ts**

Replace logging. Status command uses renderer for formatted pipeline display.

- [ ] **Step 5: Verify build + tests**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 6: Manual smoke test**

```bash
npx tsc
node dist/bin/respec.js --help          # should show --auto, --ci
node dist/bin/respec.js status          # should show styled output
node dist/bin/respec.js status --ci     # should show plain output
```

- [ ] **Step 7: Commit**

```bash
git add bin/respec.ts src/commands/
git commit -m "feat(tui): migrate all commands to TUI controller with breakpoints"
```

---

## Task 7: Confluence Ingestor

**Files:**
- Create: `src/ingestors/docs/confluence.ts`
- Create: `src/ingestors/docs/html-to-markdown.ts`
- Modify: `src/ingestors/docs/index.ts`
- Test: `tests/ingestors/docs/confluence.test.ts`

**confluence.ts** — `ConfluenceClient` class:
- Constructor takes `{ host, space, auth }`. Resolves auth with `resolveEnvAuth`.
- `fetchPages(): AsyncGenerator<ConfluencePage>` — paginates REST API, yields pages
- Uses native `fetch()` (Node 20+) with Basic auth header
- Each page: `{ id, title, slug, body, ancestors }`

**html-to-markdown.ts** — wraps turndown with Confluence-specific rules:
- Strip Confluence macros (`<ac:structured-macro>`, `<ri:attachment>`)
- Convert Confluence tables to Markdown tables
- Handle code blocks (`<ac:plain-text-body>`)
- `convertHtmlToMarkdown(html: string): string`

**index.ts** — modify the Confluence branch:
- Replace placeholder with: instantiate `ConfluenceClient`, iterate pages, convert HTML, write to `raw/docs/confluence/{slug}.md`
- Write `raw/docs/confluence/_manifest.md` with page count and hierarchy

Tests: test `html-to-markdown` conversion with sample Confluence HTML. Test `ConfluenceClient` with mocked fetch responses.

- [ ] **Step 1: Write tests for html-to-markdown**
- [ ] **Step 2: Implement html-to-markdown.ts**
- [ ] **Step 3: Run tests**
- [ ] **Step 4: Write tests for ConfluenceClient** (mock fetch)
- [ ] **Step 5: Implement confluence.ts**
- [ ] **Step 6: Modify index.ts** — wire Confluence client
- [ ] **Step 7: Run all docs tests**

```bash
npx vitest run tests/ingestors/docs/
```

- [ ] **Step 8: Commit**

```bash
git add src/ingestors/docs/ tests/ingestors/docs/
git commit -m "feat: implement Confluence ingestor with HTML-to-Markdown conversion"
```

---

## Task 8: Confidence Parser

**Files:**
- Create: `src/analyzers/confidence-parser.ts`
- Modify: `src/analyzers/types.ts` — `AnalyzerReport.confidence` → `ConfidenceResult | undefined`
- Modify: `src/analyzers/report.ts` — render parsed confidence in report
- Test: `tests/analyzers/confidence-parser.test.ts`

**confidence-parser.ts:**
- `parseConfidence(aiOutput: string): ConfidenceResult`
- Scans for patterns: `**Confidence:** HIGH`, `[HIGH]`, `Confidence: LOW`, table rows
- Returns `{ overall, items: [{ name, confidence, reason }] }`
- `confidenceToFloat(level): number` — HIGH→0.9, MEDIUM→0.6, LOW→0.3

**types.ts changes:**
- Add `ConfidenceResult` interface
- Change `AnalyzerReport.confidence` from `string | undefined` to `ConfidenceResult | undefined`

**report.ts changes:**
- Render confidence items in the analysis report table
- Show overall confidence with color-coded level

Tests: parse various AI output formats (markdown bold, brackets, tables). Test edge cases (no confidence found → default MEDIUM).

- [ ] **Step 1: Write failing tests for parser**
- [ ] **Step 2: Implement confidence-parser.ts**
- [ ] **Step 3: Update types.ts**
- [ ] **Step 4: Update report.ts**
- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/analyzers/
```

- [ ] **Step 6: Commit**

```bash
git add src/analyzers/ tests/analyzers/
git commit -m "feat: add confidence parser with HIGH/MEDIUM/LOW extraction and float mapping"
```

---

## Task 9: Prompt Enrichment

**Files:**
- Modify: `prompts/domain-mapper.md`
- Modify: `prompts/flow-extractor.md`
- Modify: `prompts/rule-miner.md`
- Modify: `prompts/permission-scanner.md`
- Modify: `prompts/api-mapper.md`
- Modify: `prompts/infra-detector.md`
- Modify: `src/commands/analyze.ts` — inject context sources + Tier 1 output

Three changes per prompt:
1. Add `{{CONTEXT_SOURCES}}` placeholder for context repo data
2. Add `{{TIER1_OUTPUT}}` placeholder for Tier 2 prompts (flow-extractor, rule-miner, permission-scanner)
3. Add a short example output section at the end

In `analyze.ts`:
- When building prompts, read `raw/context/*/` dirs and inject with role annotation
- For Tier 2 analyzers, read `analyzed/` files from Tier 1 and inject as prior analysis
- Replace `{{CONTEXT_SOURCES}}` and `{{TIER1_OUTPUT}}` placeholders

- [ ] **Step 1: Add example output to all 6 prompts**

Each prompt gets a `## Example Output` section with a short, realistic example of the expected format.

- [ ] **Step 2: Add context source placeholders**

Add `{{CONTEXT_SOURCES}}` to all prompts. Add `{{TIER1_OUTPUT}}` to Tier 2 prompts only.

- [ ] **Step 3: Update analyze.ts — context source injection**

Read `raw/context/*/` directories. For each, read the `_context-role.md` to get the role. Inject content with role annotation.

- [ ] **Step 4: Update analyze.ts — Tier 1→2 cross-injection**

After Tier 1 completes, read its output files. When building Tier 2 prompts, inject as `## Prior Analysis (from Tier 1)`.

- [ ] **Step 5: Verify build**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add prompts/ src/commands/analyze.ts
git commit -m "feat: enrich prompts with context sources, Tier 1→2 injection, and example output"
```

---

## Task 10: Kiro Format Completion

**Files:**
- Modify: `src/formats/kiro.ts`
- Modify: `tests/formats/kiro.test.ts`

Replace TODO placeholders with real content from analyzed files:

- `steering/tech.md` — read `analyzed/infra/architecture.md` + `raw/repo/dependencies.md`, extract tech stack
- `steering/structure.md` — read `analyzed/domain/bounded-contexts.md` + `raw/repo/structure.md`, summarize project structure
- Create one `specs/{context-name}/` folder per bounded context found in analyzed data
- Each folder gets:
  - `requirements.md` — entities and business rules in EARS/Given-When-Then format
  - `design.md` — relevant analyzed content (ERD, architecture)
  - `tasks.md` — task breakdown as Kiro checkboxes

The adapter reads analyzed files using `analyzedDir` from `FormatContext`. If analyzed files don't exist (e.g., `generate --force` without analyze), fall back to placeholder content.

Tests: update kiro tests to verify real content is written when analyzed files exist.

- [ ] **Step 1: Update kiro.ts** — read analyzed files, generate real steering + specs content
- [ ] **Step 2: Update kiro tests** — create fake analyzed files in temp dir, verify output
- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/formats/kiro.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/formats/kiro.ts tests/formats/kiro.test.ts
git commit -m "feat: complete Kiro format with real content from analyzed files"
```

---

## Task 11: TUI + Content Convergence

**Files:**
- Modify: `src/commands/analyze.ts` — confidence breakpoints using TUI
- Modify: `src/state/types.ts` — add context tracking to IngestState

Wire the confidence parser into the analyze command's TUI flow:
- After each analyzer subagent returns, parse confidence
- If any item is LOW, trigger `tui.ask()` breakpoint
- Store parsed confidence in state.json via `state.completeAnalyze()`

Update `IngestState.sources` to include `context: boolean`:
```typescript
sources: { repo: boolean; jira: boolean; docs: boolean; context: boolean };
```

- [ ] **Step 1: Update state/types.ts** — add `context: boolean` to IngestState.sources
- [ ] **Step 2: Update ingest.ts** — set `context: true` when context sources ingested
- [ ] **Step 3: Wire confidence parsing in analyze.ts**

After orchestrator returns results, call `parseConfidence()` on each result's output. If LOW items found and mode is interactive, call `tui.ask()`.

- [ ] **Step 4: Store real confidence in state**

Pass parsed confidence scores (converted to floats) to `state.completeAnalyze()`.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add src/commands/ src/state/ src/analyzers/
git commit -m "feat: wire confidence breakpoints into TUI + track context sources in state"
```

---

## Task 12: Update Docs + Create PR

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to the existing doc:
- TUI section: 3 modes, hotkeys, decision log location
- Confluence in raw/docs/ structure: `confluence/{slug}.md`
- Confidence parsing: mention `confidence-parser.ts`, `CONFIDENCE_TO_FLOAT`
- Updated file structure for raw/docs/

- [ ] **Step 2: Update README.md**

Add:
- TUI modes section: `--auto`, `--ci`, default interactive, runtime toggle with `a`/`p`
- Confluence support in the configuration example
- Mention confidence scoring in the "What gets analyzed" section
- Update the requirements section to mention Confluence API token

- [ ] **Step 3: Run full test suite + build**

```bash
npx vitest run && npx tsc
```

- [ ] **Step 4: Commit docs**

```bash
git add README.md CLAUDE.md
git commit -m "docs: update README and CLAUDE.md with TUI modes, Confluence, and confidence features"
```

- [ ] **Step 5: Push branch and create PR**

```bash
git push -u origin feat/v2-tui-and-quality
gh pr create --title "feat: TUI engine + content quality improvements" --body "$(cat <<'EOF'
## Summary
- Interactive TUI with 3 modes (interactive/auto/ci) and runtime switching
- Confluence ingestor replacing the placeholder stub
- Confidence parser for AI output with LOW-confidence breakpoints
- Enriched prompts with context source injection and example output
- Complete Kiro format adapter with real analyzed content
- Decision logging for auto-mode audit trail

## Test plan
- [ ] Run `respec ingest` — verify styled TUI output with spinners and summaries
- [ ] Run `respec ingest --auto` — verify auto-continue with decision log
- [ ] Run `respec ingest --ci` — verify plain output, no ANSI codes
- [ ] Press `a` during interactive mode — verify switch to auto
- [ ] Press `p` during auto mode — verify pause to interactive
- [ ] Run `respec analyze` on a real repo — verify confidence breakpoints
- [ ] Run `respec export --format kiro` — verify real content in steering and specs
- [ ] Run `npx vitest run` — all tests pass
EOF
)"
```

- [ ] **Step 6: Report PR URL**
