# ReSpec

**Reverse-engineer legacy codebases into complete specifications.**

ReSpec is a CLI tool that reads your code, Jira tickets, and documentation, then produces a System Design Document (SDD) with everything needed to rebuild the system from scratch — without carrying over legacy code.

## Why

You have a working system but no spec. Rebuilding means either losing institutional knowledge or porting technical debt. ReSpec automates the reverse-engineering step: it extracts domain models, business rules, API contracts, and user flows, then packages them into structured specs ready for any AI coding agent.

## How it works

```
respec init       → creates respec.config.yaml
respec ingest     → reads repo, Jira, docs → .respec/raw/
  ↓  (you review the raw data)
respec analyze    → AI extracts domain model, rules, flows → .respec/analyzed/
  ↓  (you validate the analysis)
respec generate   → produces final specs → /specs/
respec export     → repackages specs into a different format
```

Each phase produces Markdown files. You review and edit between phases. Every command is idempotent.

## Quick start

```bash
# Install
npm install -g respec-cli

# Initialize in your project directory
respec init

# Edit respec.config.yaml to point to your legacy repo
# Then ingest
respec ingest

# Check what was captured
respec status
ls .respec/raw/

# Run AI analysis (requires claude, codex, or gemini CLI)
respec analyze

# Generate specs
respec generate
```

## Agent-agnostic

ReSpec works with any AI coding agent. Configure once in `respec.config.yaml`:

```yaml
ai:
  engine: claude    # "claude" | "codex" | "gemini" | "custom"
  max_parallel: 4   # concurrent subagents
  timeout: 300       # seconds per subagent
```

Analyzers and generators run as parallel subagents for speed. Tier 1 analyzers (domain, infra, API) run first, then Tier 2 (flows, rules, permissions) uses their output.

## Output formats

ReSpec generates specs in four formats. Set `output.format` in your config or use `respec export --format`:

| Format | Target | What it creates |
|--------|--------|-----------------|
| **kiro** | AWS Kiro IDE | `.kiro/steering/` + `.kiro/specs/` with requirements/design/tasks triplets |
| **openspec** | Any agent | `openspec/` with capability specs, RFC 2119 requirements, GIVEN/WHEN/THEN scenarios |
| **antigravity** | Google Antigravity | `GEMINI.md` + `AGENTS.md` + `.agent/rules/` |
| **superpowers** | Claude Code | `CLAUDE.md` + `skills/` with YAML frontmatter for discovery |

```bash
# Generate in your default format
respec generate

# Export to a different format
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

  jira:                        # optional
    host: https://company.atlassian.net
    auth: env:JIRA_API_TOKEN   # reads from environment variable
    filters:
      projects: [PROJ]
      types: [Epic, Story, Bug]
      labels: [mvp]

  docs:                        # optional
    local:
      - ./docs
      - ./README.md

ai:
  engine: claude
  max_parallel: 4
  timeout: 300

output:
  dir: ./specs
  format: openspec             # kiro | openspec | antigravity | superpowers
  diagrams: mermaid
  tasks: true
```

Credentials always use the `env:` prefix — never stored in the config file.

## Commands

| Command | What it does |
|---------|-------------|
| `respec init` | Creates `respec.config.yaml` with sensible defaults |
| `respec ingest` | Reads repo, Jira, docs into `.respec/raw/` |
| `respec analyze` | AI analysis of raw data into `.respec/analyzed/` |
| `respec generate` | Produces final specs in the configured format |
| `respec export` | Repackages specs into a different output format |
| `respec status` | Shows pipeline state and phase progress |
| `respec validate` | Checks integrity of phase outputs |

**Flags:**
- `--source repo|jira|docs` — run a single ingestor
- `--only <analyzer|generator>` — run a single analyzer or generator
- `--format kiro|openspec|antigravity|superpowers` — target format for export
- `--force` — bypass prerequisite checks
- `--verbose` — detailed output

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
npm test          # run 136 tests
npm run dev       # watch mode
```

## License

MIT
