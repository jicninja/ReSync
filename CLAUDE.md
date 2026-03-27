# ReSpec — Reverse Engineering to Specification

## What is this?

ReSpec is a CLI tool that reads legacy codebases, Jira tickets, and documentation, and transforms them into a complete System Design Document (SDD) with associated artifacts. The output is everything needed to reimplement a system from scratch — without carrying over legacy code.

## Stack

- **Runtime**: Node.js >= 20, TypeScript
- **CLI framework**: commander
- **LLM engine**: `claude -p` (Claude Code headless mode)
- **Config**: YAML with Zod validation (`respec.config.yaml`)
- **Jira client**: jira.js (Atlassian SDK)
- **Git operations**: simple-git
- **Output format**: Markdown + Mermaid diagrams

## Architecture

Three-phase pipeline. Each phase produces Markdown files. Humans review and edit between phases. Every command is idempotent.

```
respec init     → generates respec.config.yaml
respec ingest   → reads sources → /.respec/raw/
  ↓ (human reviews, removes noise)
respec analyze  → AI analysis → /.respec/analyzed/
  ↓ (human validates domain, flows, rules)
respec generate → produces specs → /specs/
  ↓ (human reviews SDD)
respec export   → packages /specs/ as Claude Code skills
```

## CLI Commands

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `respec init` | Creates respec.config.yaml with guided prompts | `--template <n>` |
| `respec ingest` | Reads all sources, writes to `/.respec/raw/` | `--source repo\|jira\|docs` |
| `respec analyze` | AI analysis of raw data to `/.respec/analyzed/` | `--only <analyzer>` |
| `respec generate` | Generates final specs from analyzed data | `--only <generator>` |
| `respec export` | Packages /specs/ into Claude Code skill set | `--output <dir>` |
| `respec status` | Shows pipeline state and coverage | `--verbose` |
| `respec validate` | Validates integrity of current phase outputs | `--phase raw\|analyzed\|specs` |

## Config Schema (respec.config.yaml)

```yaml
project:
  name: string
  version: string
  description: string

sources:
  # Primary source — what we're porting
  repo:
    path: string             # local path or git URL
    branch: string           # default: main
    role: primary             # primary = what gets ported
    include: string[]        # glob patterns
    exclude: string[]        # glob patterns

  # Context sources — inform analysis but don't get ported
  context:
    - path: string
      role: api_provider | shared_types | design_system
      include: string[]
      exclude: string[]

  jira:
    host: string
    auth: env:JIRA_API_TOKEN
    filters:
      projects: string[]
      labels: string[]
      title_contains: string[]   # search in summary field
      types: string[]            # Epic, Story, Bug
      status: string[]
      sprints: string[]
      jql: string               # raw JQL override (takes precedence)

  docs:
    confluence:
      host: string
      space: string
      auth: env:CONFLUENCE_TOKEN
    local: string[]

output:
  dir: string               # default: ./specs
  diagrams: mermaid | none
  skills: boolean
  tasks: boolean
```

Jira filters combine with AND logic. `title_contains` generates `summary ~ "term"` JQL clauses. If `jql` is provided, it overrides all other filters.

## File Structure by Phase

### Phase 1: `/.respec/raw/` (Ingest — no interpretation, structured dump)

```
raw/
├── repo/
│   ├── structure.md          # directory tree with descriptions
│   ├── dependencies.md       # package.json / requirements
│   ├── endpoints.md          # HTTP routes detected
│   ├── models.md             # DB schemas (Prisma, TypeORM, SQL)
│   ├── env-vars.md           # environment variables used
│   ├── config.md             # detected configs (auth, queues, storage)
│   └── modules/
│       └── {module-name}.md  # per-module summary
├── context/                  # context sources (BE, shared libs)
│   └── {source-name}/
│       ├── endpoints.md
│       ├── models.md
│       └── types.md
├── jira/
│   ├── epics.md
│   ├── stories.md
│   ├── bugs.md
│   └── labels-map.md
├── docs/
│   ├── readme.md
│   ├── wiki-pages/{page}.md
│   └── inline-docs.md
└── _manifest.md              # what was ingested, stats, timestamps
```

### Phase 2: `/.respec/analyzed/` (AI analysis via claude -p)

```
analyzed/
├── domain/
│   ├── bounded-contexts.md
│   ├── entities.md
│   ├── value-objects.md
│   ├── aggregates.md
│   └── glossary.md
├── flows/
│   ├── user-flows.md
│   ├── data-flows.md
│   └── integration-flows.md
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
└── _analysis-report.md       # confidence scores, gaps, open questions
```

### Phase 3: `/specs/` (Final output)

```
specs/
├── sdd.md                    # 12-section System Design Document
├── domain/
│   ├── erd.mermaid
│   ├── context-map.mermaid
│   └── domain-model.md
├── flows/
│   └── {flow-name}.mermaid
├── api/
│   ├── endpoints.md
│   └── contracts/{entity}.schema.md
├── tasks/
│   ├── epics.md
│   ├── stories/{epic-slug}/story-NNN.md
│   └── migration-plan.md
├── adrs/
│   └── adr-NNN-{slug}.md
├── skills/
│   ├── SKILL.md
│   └── guides/{domain}.md
└── _respec-meta.md           # traceability: source → raw → analyzed → spec
```

## SDD Template (12 sections)

1. Overview
2. Goals & Non-Goals
3. Domain Model
4. Architecture
5. Data Model
6. API Design
7. User Flows
8. Business Rules
9. Security & Auth
10. Infrastructure & Deployment
11. Migration Strategy
12. Open Questions

## Analyzers

Each analyzer reads specific raw MDs and produces analyzed output using `claude -p`:

| Analyzer | Reads | Produces |
|----------|-------|----------|
| domain-mapper | models, modules, endpoints | bounded-contexts, entities, glossary |
| flow-extractor | endpoints, modules, stories | user-flows, data-flows |
| rule-miner | modules, stories, bugs | business-rules, validation-rules |
| permission-scanner | modules, endpoints | permissions |
| api-mapper | endpoints, models | contracts, external-deps |
| infra-detector | dependencies, env-vars, structure | architecture, data-storage |

Each analyzer self-reports confidence (HIGH/MEDIUM/LOW) in `_analysis-report.md`.

## Generators

| Generator | Reads | Produces |
|-----------|-------|----------|
| sdd-gen | all analyzed/* | sdd.md |
| erd-gen | entities, bounded-contexts | erd.mermaid, context-map.mermaid |
| flow-gen | user-flows, data-flows | flows/*.mermaid |
| task-gen | all analyzed/* + sdd | epics, stories, migration-plan |
| adr-gen | architecture, external-deps | adrs/*.md |
| skill-gen | all specs/* | skills/SKILL.md, guides/*.md |

## Design Principles

- **Idempotent phases**: every command can be re-run, overwriting previous output
- **Human-in-the-loop**: intermediate MDs are editable; pipeline respects manual changes
- **Source-agnostic analysis**: analyzers work on normalized raw MDs, not source code
- **Implementation-agnostic output**: specs describe WHAT, never HOW
- **Primary vs context**: primary source is what gets ported; context sources inform but aren't ported
- **Filesystem is the data model**: no database, no graph store — just files and folders

## Pipeline State

Tracked in `/.respec/state.json`:

```json
{
  "phase": "analyzed",
  "ingest": {
    "completed_at": "2026-03-27T10:00:00Z",
    "sources": { "repo": true, "jira": true, "docs": true },
    "stats": { "files": 342, "tickets": 186, "pages": 23 }
  },
  "analyze": {
    "completed_at": "2026-03-27T10:15:00Z",
    "analyzers_run": ["domain", "flows", "rules", "api"],
    "confidence": { "overall": 0.78, "domain": 0.92, "rules": 0.65 }
  },
  "generate": null
}
```

Commands validate prerequisites before running (e.g., `analyze` fails if `ingest` hasn't completed). Use `--force` to bypass.

## Security

- Credentials use `env:` prefix, never stored in config directly
- Ingestor redacts known sensitive patterns (API keys, tokens, passwords)
- `respec init` adds `/.respec/` to `.gitignore`
- `claude -p` inherits the user's existing Claude Code auth

## Code Rules

### ESM only — no require()
This is a `"type": "module"` project. Never use `require()` or `module.exports`. Always use `import`/`export`. This includes dynamic imports inside functions — use `await import()` if needed, never `require()`.

### Validate external inputs early
Any path, URL, or resource from config or user input must be validated before use. Check `fs.existsSync()` before reading directories, verify URLs are reachable before fetching. Never silently swallow ENOENT or ECONNREFUSED — surface a clear error.

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

- All output files are Markdown or Mermaid
- Diagrams use Mermaid syntax exclusively
- File names use kebab-case
- One concept per file (no mega-documents except sdd.md)
- Every phase has a `_manifest.md` or `_report.md` meta file
- Traceability is maintained in `_respec-meta.md`

## Implementation Roadmap

**Phase 1 — MVP (Weeks 1-3)**: CLI scaffolding, repo ingestor, Jira ingestor with filtering, manual analyze step

**Phase 2 — AI Pipeline (Weeks 4-6)**: Automated analyzers, confidence scoring, SDD generator, Mermaid diagrams

**Phase 3 — Polish (Weeks 7-8)**: Task breakdown, skill generator, ADR generator, docs ingestor, validation/export

**Future**: MCP Server mode, interactive TUI for review, more sources (Notion, Linear, GitHub Issues), multi-language support, diff mode between runs
