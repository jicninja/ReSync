<p align="center">
  <img src="logo.svg" alt="ReSpec — Legacy to SDD, Fast" width="420">
</p>

<p align="center">
  <strong>Reverse-engineer legacy codebases into complete specifications.</strong>
</p>

ReSpec is a CLI tool that reads your code, Jira tickets, and documentation, then produces a System Design Document (SDD) with everything needed to rebuild the system from scratch — without carrying over legacy code.

## Why

You have a working system but no spec. Rebuilding means either losing institutional knowledge or porting technical debt. ReSpec automates the reverse-engineering step: it extracts domain models, business rules, API contracts, and user flows, then packages them into structured specs ready for any AI coding agent.

## How it works

```
respec              → interactive wizard (guides you through the pipeline)
respec init         → creates respec.config.yaml
respec ingest       → reads repo, Jira, docs → .respec/raw/
  ↓  (you review the raw data)
respec analyze      → AI extracts domain model, rules, flows → .respec/analyzed/
  ↓  (you validate the analysis)
respec generate     → produces specs → .respec/generated/
respec export       → formats output → project root (kiro, openspec, etc.)
```

Each phase produces Markdown files. You review and edit between phases. Every command is idempotent.

Run `respec` with no arguments for the **interactive wizard** — it detects your pipeline state and guides you step by step, with an **autopilot** mode that runs the full pipeline automatically.

## Quick start

```bash
# Install
npm install -g respec-cli

# Interactive wizard — guides you through everything
respec

# Or run commands individually:
respec init           # auto-detects project from manifests
respec ingest         # read sources
respec analyze        # AI analysis
respec generate       # produce specs
```

## Agent-agnostic

ReSpec works with any AI coding agent. Configure once in `respec.config.yaml`:

```yaml
ai:
  engine: claude    # simple single-engine (default)
  max_parallel: 4
  timeout: 600
```

Or use **multi-engine routing** with fallback chains:

```yaml
ai:
  timeout: 600
  engines:
    claude:
      model: opus
      timeout: 900
    gemini:
      model: pro
  phases:
    analyze: [claude, gemini]   # fallback: if claude fails, try gemini
    generate: gemini
```

Both formats are supported. Analyzers and generators run as parallel subagents. Tier 1 analyzers (domain, infra, API) run first, then Tier 2 (flows, rules, permissions) uses their output.

## Interactive Wizard

Run `respec` with no arguments to launch the interactive wizard:

```
  ╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗
  ╠╦╝║╣ ╚═╗╠═╝║╣ ║
  ╩╚═╚═╝╚═╝╩  ╚═╝╚═╝
  reverse engineering → spec

◇  Pipeline: empty. What's next?
│  ● Ingest sources (recommended)
│  ○ Autopilot — run full pipeline
│  ○ View status
│  ○ Exit
└
```

- **Contextual menus** — shows only valid actions for your current pipeline state
- **Autopilot** — runs the entire remaining pipeline automatically
- **Pause (P)** — press during execution to pause after the current batch, then:
  - View outputs so far
  - Add instructions to refine remaining AI prompts
  - Retry a task with different instructions
  - Resume or abort
- **Start fresh** — wipes `.respec/`, then re-runs the full pipeline from scratch

## Smart Init

`respec init` auto-detects your project from manifest files — no manual editing needed:

- **Manifests**: package.json, go.mod, pyproject.toml, Cargo.toml, composer.json
- **Frameworks**: React, Vue, Angular, Next.js, Express, NestJS, Vite, TypeScript
- **Source patterns**: detects `src/`, `lib/`, `app/` directories for includes
- **Excludes**: reads `.gitignore` and adds common patterns
- **Sibling repos**: scans parent directory for neighboring projects and infers roles (backend → `api_provider`, mobile → `mobile`, shared → `shared_types`)

In the wizard (`respec` → Init), each detected value is pre-filled and editable, with additional prompts for Jira, Confluence, and local docs integration.

## Prompt Overrides

Customize analyzer/generator prompts by placing files in your project's `prompts/` directory:

```
my-project/
└── prompts/
    ├── domain-mapper.md      ← overrides built-in analyzer prompt
    ├── sdd-gen.md            ← overrides built-in generator prompt
    └── spec-reviewer.md      ← overrides reviewer prompt
```

Templates use the same placeholders as built-ins (`{{CONTEXT}}`, `{{CONTEXT_SOURCES}}`, `{{TIER1_OUTPUT}}`). A subprocess safety directive is always prepended automatically.

## Spec Review

`respec review` runs an AI reviewer that validates your generated specs against the raw data:

```bash
respec review              # review specs for hallucinations
respec review --verbose    # show full report in terminal
```

The reviewer compares the SDD against raw ingestion data and produces `.respec/review-report.md` with: claims without evidence, raw data not covered, inconsistencies, and verified items.

## Spec Diff

After re-running analyze or generate, see what changed:

```bash
respec diff                    # diff both analyzed and specs
respec diff --phase analyzed   # only analyzed phase
respec diff --phase specs      # only specs
```

Snapshots are taken automatically before each analyze/generate run.

## Push to Jira

Export generated tasks directly to Jira as epics and stories:

```bash
respec push jira                              # create epics + stories
respec push jira --epics-only                 # only epics
respec push jira --project NEWPROJ            # specific target project
respec push jira --prefix "[Migration v2]"    # custom prefix (default: [ReSpec])
respec push jira --dry-run                    # preview without creating
```

Issues are created with a `respec` label for easy JQL filtering (`labels = respec`). Uses Jira credentials from `sources.jira` in your config.

## TUI Modes

Individual commands support three modes:

```
respec ingest              # interactive (default) — pauses on questions
respec ingest --auto       # auto-continue — runs through, logs decisions
respec ingest --ci         # CI mode — plain text, no colors, no interaction
```

**Runtime mode switching** — press `a` anytime to switch to auto-continue, or `p` to pause back to interactive.

When running in `--auto` mode, all decisions are logged to `.respec/_decisions.md` so you can review what was auto-decided after the run.

**Smart breakpoints** pause for:
- Internal/debug endpoints detected during ingestion
- Hardcoded secrets found in source code
- LOW confidence items from AI analysis

## Output formats

ReSpec generates specs in six formats. Set `output.format` in your config or use `respec export --format`:

| Format | Target | What it creates |
|--------|--------|-----------------|
| **kiro** | AWS Kiro IDE | `.kiro/steering/` + `.kiro/specs/` with requirements/design/tasks triplets |
| **openspec** | Any agent | `openspec/` with capability specs, RFC 2119 requirements, GIVEN/WHEN/THEN scenarios |
| **antigravity** | Google Antigravity | `GEMINI.md` + `AGENTS.md` + `.agent/rules/` |
| **superpowers** | Claude Code | `CLAUDE.md` + `skills/` with YAML frontmatter for discovery |
| **speckit** | GitHub Spec Kit | `.specify/memory/` + `.specify/specs/` with per-feature spec/plan/tasks |
| **bmad** | BMAD Method | `_bmad-output/` with PRD, architecture, epics, project-context |

```bash
# Generate raw specs (format-independent)
respec generate

# Export to a specific format
respec export --format kiro --output ./kiro-specs
respec export --format superpowers --output ./claude-specs
```

## Configuration

`respec.config.yaml` controls everything:

```yaml
project:
  name: MyApp
  version: "1.0"
  description: Legacy app to reverse-engineer

sources:
  repo:
    path: ../legacy-app        # local path or git URL
    branch: main
    exclude:
      - "**/node_modules/**"
      - "**/*.test.ts"

  context:                     # optional — other repos for reference
    - name: backend-api
      path: ../backend
      role: backend            # backend | frontend | mobile | api_provider
                               # shared_types | design_system | infra | reference
    - name: shared-lib
      path: ../shared
      role: shared_types

  jira:                        # optional
    host: https://company.atlassian.net
    auth: env:JIRA_API_TOKEN   # reads from environment variable
    filters:
      projects: [PROJ]
      types: [Epic, Story, Bug]
      labels: [mvp]

  docs:                        # optional
    confluence:
      host: https://company.atlassian.net/wiki
      space: PROJ
      auth: env:CONFLUENCE_TOKEN
    local:
      - ./docs
      - ./README.md

ai:
  engine: claude               # or use engines: { claude: {}, gemini: {} }
  max_parallel: 4
  timeout: 600

output:
  # dir: ./custom-output       # optional — omit to use .respec/generated/
  format: openspec             # kiro | openspec | antigravity | superpowers | speckit | bmad
  diagrams: mermaid
  tasks: true
```

Credentials always use the `env:` prefix — never stored in the config file.

## Commands

| Command | What it does |
|---------|-------------|
| `respec` | Interactive wizard — guides you through the pipeline |
| `respec --autopilot` | Run full pipeline non-interactively (for CI/cloud) |
| `respec --reset --autopilot` | Wipe and re-run full pipeline |
| `respec init` | Smart init — auto-detects project from manifests |
| `respec ingest` | Reads repo, Jira, docs into `.respec/raw/` |
| `respec analyze` | AI analysis of raw data into `.respec/analyzed/` |
| `respec generate` | Produces specs to `.respec/generated/` |
| `respec export` | Reads generated specs and writes formatted output to project root |
| `respec review` | AI review of specs — detect hallucinations |
| `respec diff` | Show changes since last analyze/generate run |
| `respec push jira` | Push tasks to Jira as epics + stories |
| `respec status` | Shows pipeline state and phase progress |
| `respec validate` | Checks integrity of phase outputs |

**Global flags:**
- `--autopilot` — run full remaining pipeline without interaction
- `--reset` — wipe `.respec/` before running
- `--ci` — CI mode (no colors, no interaction)
- `--auto` — auto-continue mode

**Command flags:**
- `--repo <path|url>` — repository path or git URL (init)
- `--source repo|context|jira|docs` — run a single ingestor
- `--only <analyzer|generator>` — run a single analyzer or generator
- `--format kiro|openspec|antigravity|superpowers|speckit|bmad` — target format for export
- `--force` — bypass prerequisite checks
- `--verbose` — detailed output

**CI/Cloud usage:**

```bash
# Full pipeline from a remote repo
respec init --repo https://github.com/user/repo.git
respec --autopilot --ci

# Reset and re-run
respec --reset --autopilot --ci
```

## Primary vs. context sources

The **primary source** (`sources.repo`) is what gets reverse-engineered into the SDD. **Context sources** (`sources.context`) provide reference information — they inform the analysis but are not the target of the specification.

Example: you're rebuilding a web frontend. The primary source is the frontend repo. You add the backend API as a context source so ReSpec understands the endpoints your frontend consumes, without trying to spec the backend itself.

```yaml
sources:
  repo:
    path: ../frontend          # this gets the SDD
  context:
    - name: backend-api
      path: ../backend
      role: backend            # informs API contract analysis
```

Available roles: `backend`, `frontend`, `mobile`, `api_provider`, `shared_types`, `design_system`, `infra`, `reference`.

Context sources are ingested into `.respec/raw/context/{name}/` with a `_context-role.md` marker that tells analyzers how to use them.

## What gets ingested

The repo ingestor scans your codebase and produces:

| File | Content |
|------|---------|
| `repo/structure.md` | Directory tree with file sizes |
| `repo/dependencies.md` | Package manifests (package.json, go.mod, etc.) |
| `repo/endpoints.md` | HTTP routes (Express, NestJS, FastAPI, Flask) |
| `repo/models.md` | DB schemas (Prisma, TypeORM, SQL, GraphQL) |
| `repo/env-vars.md` | Environment variable usage |
| `repo/modules/*.md` | Per-module summary (exports, imports, file count) |

The Jira ingestor fetches tickets grouped by type (epics, stories, bugs) with acceptance criteria, comments, and links.

## What gets analyzed

Six analyzers run in two parallel tiers:

| Analyzer | Extracts |
|----------|----------|
| domain-mapper | Bounded contexts, entities, glossary |
| infra-detector | Architecture, data storage |
| api-mapper | API contracts, external dependencies |
| flow-extractor | User flows, data flows |
| rule-miner | Business rules, validation rules |
| permission-scanner | Roles, permissions, auth model |

Each reports confidence (HIGH/MEDIUM/LOW) so you know what to review carefully.

## Requirements

- Node.js >= 20
- At least one AI agent CLI for `analyze`/`generate`:
  - [Claude Code](https://claude.ai/code) (`claude`)
  - [Codex CLI](https://github.com/openai/codex) (`codex`)
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli) (`gemini`)
- Optional: Jira API token, Confluence API token

## Development

```bash
git clone <repo-url>
cd ReSpec
npm install
npm run build     # compile TypeScript
npm test          # run tests
npm run dev       # watch mode
```

## License

MIT
