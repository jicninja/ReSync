  # ReSpec — Reverse Engineering to Specification

  ## What is this?

  ReSpec is a CLI tool that reads legacy codebases, Jira tickets, and documentation, and transforms them into a complete System Design Document (SDD) with associated artifacts. The output is everything needed to reimplement a system from scratch — without carrying over legacy code.

  ## Stack

  - **Runtime**: Node.js >= 20, TypeScript (ESM, `"type": "module"`)
  - **CLI framework**: commander + @clack/prompts (wizard)
  - **AI engine**: Pluggable — Claude Code, Codex CLI, Gemini CLI, or custom
  - **Config**: YAML with Zod validation (`respec.config.yaml`)
  - **Jira client**: jira.js (Atlassian SDK)
  - **Git operations**: simple-git
  - **Output format**: Markdown + Mermaid, packaged as Kiro / OpenSpec / Antigravity / Superpowers / Spec Kit / BMAD

  ## Architecture

  Three-phase pipeline. Each phase produces Markdown files. Humans review and edit between phases. Every command is idempotent. AI engine is agent-agnostic — analyzers and generators run as parallel subagents via the configured engine.

  ```
  respec init     → generates respec.config.yaml
  respec ingest   → reads sources → /.respec/raw/
    ↓ (human reviews, removes noise)
  respec analyze  → AI subagents → /.respec/analyzed/
    ↓ (human validates domain, flows, rules)
  respec generate → produces specs → /.respec/generated/
  respec export   → formats and writes output → project root (kiro|openspec|antigravity|superpowers|speckit|bmad)
  ```

  ## CLI Commands

  | Command | Description | Key Flags |
  |---------|-------------|-----------|
  | `respec` | Interactive wizard — contextual menus, autopilot, pause/inject | |
  | `respec --autopilot` | Run full remaining pipeline non-interactively | `--reset` `--ci` |
  | `respec init` | Smart init — auto-detects project from manifests | `--repo <path\|url>` |
  | `respec ingest` | Reads all sources to `/.respec/raw/` | `--source repo\|context\|jira\|docs` |
  | `respec analyze` | AI analysis to `/.respec/analyzed/` | `--only <analyzer>` `--force` |
  | `respec generate` | Generates specs to `/.respec/generated/` | `--only <generator>` `--force` |
  | `respec export` | Reads from `.respec/generated/` and writes formatted output | `--format kiro\|openspec\|antigravity\|superpowers\|speckit\|bmad` `--output <dir>` |
  | `respec review` | AI review — detect hallucinations in specs | `--verbose` |
  | `respec diff` | Show changes since last analyze/generate run | `--phase analyzed\|specs` |
  | `respec push jira` | Push tasks to Jira as epics + stories | `--project` `--prefix` `--epics-only` `--dry-run` |
  | `respec status` | Shows pipeline state | `--verbose` |
  | `respec validate` | Validates phase output integrity | `--phase raw\|analyzed\|specs` |

  ## Config Schema (respec.config.yaml)

  ```yaml
  project:
    name: string
    version: string
    description: string

  sources:
    repo:                          # primary — what gets the SDD
      path: string                 # local path or git URL
      branch: string               # default: main
      include: string[]
      exclude: string[]

    context:                       # optional — reference repos, NOT target of SDD
      - name: string               # identifier (defaults to dir basename)
        path: string
        role: backend | frontend | mobile | api_provider | shared_types | design_system | infra | reference
        branch: string             # default: main
        include: string[]
        exclude: string[]

    jira:
      host: string
      auth: env:JIRA_API_TOKEN
      filters:
        projects: string[]
        labels: string[]
        title_contains: string[]
        types: string[]
        status: string[]
        sprints: string[]
        jql: string                # raw JQL override

    docs:
      confluence:
        host: string
        space: string
        auth: env:CONFLUENCE_TOKEN
      local: string[]

  ai:
    # ── Legacy format (single engine) ──────────────────────────
    engine: claude | codex | gemini | custom    # default: claude
    command: string                              # custom CLI override
    max_parallel: number                         # default: 4
    timeout: number                              # default: 600 (seconds)
    model: string                                # optional model override

    # ── New format (multi-engine with phase routing) ───────────
    timeout: number                              # global default: 600
    max_parallel: number                         # global default: 4
    engines:
      claude:
        model: string                            # per-engine model
        timeout: number                          # per-engine timeout override
      gemini: {}
      custom:
        command: string                          # required for custom
    phases:
      analyze: string | string[]                 # engine or fallback chain
      generate: string | string[]

    # Note: Both formats are supported. Legacy format is automatically
    # converted to the new format at runtime.

  output:
    dir: string                    # optional — when omitted, .respec/generated/ is used
    format: kiro | openspec | antigravity | superpowers | speckit | bmad   # default: openspec
    diagrams: mermaid | none
    tasks: boolean
    speckit:                       # optional — only for speckit format
      mapping:                     # manual feature grouping
        - name: string
          contexts: string[]
  ```

  ## Primary vs. Context Sources

  The **primary source** (`sources.repo`) is what gets reverse-engineered into the SDD. **Context sources** (`sources.context`) provide reference — they inform analysis but are not the target.

  Context sources are ingested into `.respec/raw/context/{name}/` with a `_context-role.md` marker. Analyzers use them as reference material.

  ## File Structure by Phase

  ### Phase 1: `/.respec/raw/`

  ```
  raw/
  ├── repo/                        # primary source
  │   ├── structure.md
  │   ├── dependencies.md
  │   ├── endpoints.md
  │   ├── models.md
  │   ├── env-vars.md
  │   └── modules/{name}.md
  ├── context/                     # context sources
  │   └── {source-name}/
  │       ├── _context-role.md     # role marker for analyzers
  │       └── repo/
  │           ├── structure.md
  │           ├── dependencies.md
  │           ├── endpoints.md
  │           └── ...
  ├── jira/
  │   ├── epics.md
  │   ├── stories.md
  │   └── bugs.md
  ├── docs/
  │   ├── readme.md
  │   ├── local/{file}.md
  │   └── confluence/{slug}.md     # Confluence pages (if configured)
  └── _manifest.md
  ```

  ### Phase 2: `/.respec/analyzed/`

  ```
  analyzed/
  ├── domain/
  │   ├── bounded-contexts.md
  │   ├── entities.md
  │   └── glossary.md
  ├── flows/
  │   ├── user-flows.md
  │   └── data-flows.md
  ├── rules/
  │   ├── business-rules.md
  │   ├── validation-rules.md
  │   └── permissions.md
  ├── api/
  │   ├── contracts.md
  │   └── external-deps.md
  ├── infra/
  │   ├── architecture.md
  │   └── data-storage.md
  └── _analysis-report.md
  ```

  ### Phase 3: `/.respec/generated/`

  Raw generated specs (SDD, ERDs, flows, ADRs, tasks) plus `toolkit/recommendations.json` (AI toolkit recommendations). Format-independent. `respec export` reads from here and writes format-specific output to the project root.

  ## Analyzers

  6 analyzers in 2 parallel tiers via the configured AI engine:

  **Tier 1** (parallel): domain-mapper, infra-detector, api-mapper
  **Tier 2** (parallel, uses Tier 1 output): flow-extractor, rule-miner, permission-scanner

  Each self-reports confidence (HIGH/MEDIUM/LOW) in `_analysis-report.md`. Confidence is parsed from AI output by `src/analyzers/confidence-parser.ts` and stored as floats in `state.json` (HIGH=0.9, MEDIUM=0.6, LOW=0.3). Tier 2 analyzers receive Tier 1 output as additional context. All analyzers receive context source data when available.

  ## Generators

  7 generators in 3 tiers:

  **Tier 1** (parallel): erd-gen, flow-gen, adr-gen
  **Tier 2** (sequential): sdd-gen
  **Tier 3** (parallel): task-gen, format-gen, toolkit-gen

  ## Output Formats

  | Format | Target | Structure |
  |--------|--------|-----------|
  | `kiro` | AWS Kiro IDE | `.kiro/steering/` + `.kiro/specs/` (offers optional cc-sdd install) |
  | `openspec` | Any agent | `openspec/specs/` + `openspec/changes/` |
  | `antigravity` | Google Antigravity | `GEMINI.md` + `.agent/rules/` |
  | `superpowers` | Claude Code | `CLAUDE.md` + `skills/` |
  | `speckit` | GitHub Spec Kit | `.specify/memory/` + `.specify/specs/` |
  | `bmad` | BMAD Method | `_bmad-output/planning-artifacts/` + `_bmad-output/project-context.md` |

  ## Interactive Wizard

  Running `respec` with no arguments launches the interactive wizard (`src/wizard/`). It detects the current pipeline state and shows contextual menus with only valid actions. Features:

  - **Autopilot**: runs remaining pipeline phases automatically
  - **Pause (P)**: pauses after current batch, then offers: view outputs, add instructions (prompt injection), retry a task with modifications, resume, or abort
  - **Prompt injection**: user-provided instructions appended to remaining AI prompts as `## Additional Instructions (user-provided)` section
  - **Orchestrator hooks**: `OrchestratorHooks` interface in `src/ai/types.ts` with `onBatchComplete` callback. Wizard registers hooks via `src/wizard/hooks.ts`. CI/auto mode has no hooks (zero overhead).

  Wizard code lives in `src/wizard/`: index.ts (main loop), splash.ts (ASCII art), menu.ts (contextual menus), runner.ts (spinner + autopilot), pause.ts (pause menu helpers), hooks.ts (orchestrator hook → clack UI), init-flow.ts (interactive init).

  Uses `@clack/prompts` for all interactive UI (selects, spinners, text input).

  ## Smart Init

  `respec init` (CLI) and the wizard's Init both auto-detect project metadata. Detection code lives in `src/init/`:

  - `detect.ts` — `detectProject(dir)` reads manifests (package.json, go.mod, pyproject.toml, Cargo.toml, composer.json) for name/description/version. Detects source roots (src/, lib/, app/) for includes. Reads `.gitignore` for excludes. Enriches description with detected frameworks (React, Vue, Express, etc.).
  - `siblings.ts` — `detectSiblings(dir)` scans parent directory for neighboring projects with manifests. Infers role from name patterns (backend → `api_provider`, mobile → `mobile`, shared → `shared_types`, etc.).

  **CLI mode** (`respec init`): generates YAML with detected values, siblings as context sources, and a Jira/docs guide as comments.

  **Wizard mode** (`respec` → Init): interactive step-by-step via `src/wizard/init-flow.ts`. Each field pre-filled with detected values, editable. Prompts for AI engine, Jira host/auth/filters, Confluence host/space/auth, local docs paths, and output format.

  ## Prompt Overrides

  Users can override any analyzer/generator/reviewer prompt by placing a file in `{projectDir}/prompts/{id}.md`. Loading is handled by `src/prompts/loader.ts`:

  1. Check `{projectDir}/prompts/{id}.md` (user override)
  2. Fall back to `prompts/{id}.md` (built-in)
  3. Fall back to generic template

  A subprocess safety directive is always prepended to prevent the AI from attempting file operations. Analyzers load via `loadPromptTemplate(analyzer.id, dir)`. Generators check for override before using inline prompt builders.

  ## Spec Diff

  `respec diff` compares the current state against snapshots taken before each run. Code lives in `src/diff/`:

  - `snapshot.ts` — `takeSnapshot(sourceDir, snapshotsDir, phase)` copies directory before analyze/generate. Only keeps last snapshot per phase.
  - `compare.ts` — `compareDirectories(oldDir, newDir)` returns `DiffResult` with added/removed/modified/unchanged files.
  - Snapshots stored in `.respec/snapshots/{phase}/`.

  ## AI Reviewer

  `respec review` validates generated specs against raw data. Uses the `spec-reviewer` prompt template (`prompts/spec-reviewer.md`). Reads SDD + raw + analyzed, sends to AI, produces `.respec/review-report.md` with findings: claims without evidence, raw data not covered, inconsistencies, and verified items. Command at `src/commands/review.ts`.

  ## Push to External Services

  `respec push jira` creates Jira issues from `.respec/generated/tasks/epics.md`. Code lives in `src/push/`:

  - `epic-parser.ts` — `parseEpics(markdown)` extracts typed `Epic[]` with `Story[]` children from the task-gen markdown output. Tolerant parser handles format variations.
  - `jira-pusher.ts` — `createJiraIssues(client, epics, options)` creates Epic and Story issues in Jira with configurable prefix (default `[ReSpec]`) and `respec` label on all issues.
  - `src/commands/push.ts` — command handler with `--dry-run`, `--project`, `--prefix`, `--epics-only` flags.

  Uses Jira credentials from `sources.jira` in config. Wizard mode prompts interactively for project key, prefix, and creation mode.

  ## AI Toolkit Recommendations

  `toolkit-gen` is a tier 3 generator that recommends MCP servers, skills, plugins, and IDE extensions based on the detected stack. Code lives in `src/generators/toolkit-gen.ts` and `src/toolkit/`:

  - `types.ts` — `ToolkitRecommendations`, `Recommendation`, `AgentId`, install method types
  - `json-parser.ts` — `extractJSON(text)` extracts JSON from AI responses (handles code-fence wrapping)
  - `validator.ts` — `validatePackages(recs)` runs `npm view` per package (5s timeout, 10 concurrent), marks `validated: true|false|null`
  - `wizard.ts` — `runToolkitWizard(recs, options)` post-export interactive installer; `readRecommendations(dir)` loads recommendations.json

  **Pipeline flow**: toolkit-gen runs in tier 3 of `respec generate`. The generate command post-processes its output: extracts JSON from the AI response, validates packages via npm, and writes `.respec/generated/toolkit/recommendations.json`. During `respec export`, recommendations are read and passed to format adapters via `FormatContext.toolkitRecommendations`. After export, a post-export wizard offers interactive installation.

  **Format adapter integration**: superpowers format injects a "Recommended MCPs" / "Recommended Skills" section into `CLAUDE.md`. OpenSpec format injects recommendations into `AGENTS.md`. Other formats receive the field but do not process it (v2).

  **GeneratorContext.rawDir**: toolkit-gen is the only generator that reads from the raw phase. An optional `rawDir` field on `GeneratorContext` provides access to `raw/repo/dependencies.md`. This is a known deviation from the standard generator contract where `reads` only declares analyzed-phase paths.

  ## TUI (Terminal UI)

  Individual commands use an interactive TUI with 3 modes:

  | Mode | Flag | Behavior |
  |------|------|----------|
  | interactive | (default) | Styled output, pauses on breakpoints, waits for input |
  | auto | `--auto` | Styled output, auto-continues, logs decisions to `.respec/_decisions.md` |
  | ci | `--ci` | Plain text, no colors, no interaction |

  Hotkeys at runtime: `a` → switch to auto, `p` → pause to interactive.

  TUI code lives in `src/tui/`: renderer.ts (formatting), controller.ts (mode logic), keypress.ts (hotkeys), decision-log.ts (auto-decision audit trail), factory.ts (createTUI).

  Commands use `tui.progress()`, `tui.success()`, `tui.warn()`, `tui.ask()` — never `console.log` directly.

  ## Design Principles

  - **Idempotent phases**: every command can be re-run safely
  - **Human-in-the-loop**: intermediate MDs are editable; pipeline respects manual changes
  - **Agent-agnostic**: any CLI agent that accepts a prompt and returns text
  - **Parallel subagents**: independent analyzers/generators run concurrently
  - **Primary vs context**: primary source gets the SDD; context sources inform analysis
  - **Source-agnostic analysis**: analyzers work on normalized raw MDs, not source code
  - **Implementation-agnostic output**: specs describe WHAT, never HOW
  - **Filesystem is the data model**: no database — just files and folders

  ## Constants

  All defaults and magic numbers live in `src/constants.ts`. Never hardcode values that are used in more than one file — import from constants.

  ## Code Rules

  ### ESM only — no require()
  This is a `"type": "module"` project. Never use `require()` or `module.exports`. Always use `import`/`export`. This includes dynamic imports inside functions — use `await import()` if needed, never `require()`.

  ### Validate external inputs early
  Any path, URL, or resource from config or user input must be validated before use. Check `fs.existsSync()` before reading directories, verify URLs are reachable before fetching. Never silently swallow ENOENT or ECONNREFUSED — surface a clear error.

  ### Registry is the single source of truth for paths
  `reads` and `produces` in analyzer/generator registries are relative to their phase root (`rawDir` for reads, `analyzedDir` for analyzer produces, `generatedDir` for generator produces). Two rules:
  1. **No phase prefixes in registry paths** — never include `raw/` or `analyzed/` since the consuming code already resolves against the phase root. Duplicating the prefix causes silent path misses (e.g., `.respec/raw/raw/repo/...`).
  2. **No hardcoded paths that duplicate registry data** — if code needs to reference another tier's output files, read them from the registry (`getAnalyzersByTier`, `getGeneratorsByTier`) instead of hardcoding paths. This prevents drift when registry entries change.

  ### No silent catch blocks
  Never write `catch { return []; }` or `catch { /* ignore */ }`. Every catch must either:
  1. Re-throw with context: `catch (err) { throw new Error(\`Failed to X: \${err.message}\`); }`
  2. Log a warning and return a clearly-marked fallback
  3. Handle a specific, expected error (and document which one)

  ### CLI errors go through wrapAction()
  All Commander `.action()` handlers are wrapped with `wrapAction()` in `bin/respec.ts`. This catches errors and prints `Error: <message>` without stack traces. New commands must use this wrapper. Never let unhandled rejections reach the user.

  ### Import extensions
  All internal imports use `.js` extension (ESM requirement): `import { foo } from './bar.js'`

  ## Conventions

  - All output files are Markdown or Mermaid (except `toolkit/recommendations.json`)
  - Diagrams use Mermaid syntax exclusively
  - File names use kebab-case
  - One concept per file (no mega-documents except sdd.md)
  - Every phase has a `_manifest.md` or `_report.md` meta file
  - Traceability is maintained in `_respec-meta.md`
