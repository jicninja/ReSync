# RESPEC

**Reverse Engineering to Specification — System Design Document**

Version 1.0 | March 2026 | Author: Ignacio — Suquía Bytes

---

CONFIDENTIAL

---

## 1. Overview

ReSpec is a CLI tool that reads legacy codebases, Jira tickets, and documentation, and transforms them into a complete System Design Document (SDD) with associated artifacts. The goal is to produce everything needed to reimplement a system from scratch, without carrying over legacy code.

The tool bridges the gap between "we have a working system but no spec" and "we need a spec to rebuild this properly." It leverages AI coding agents (Claude Code, Codex CLI, Gemini CLI, or any compatible agent) for AI-powered analysis while keeping humans in the loop at every stage. The AI engine is configurable and agent-agnostic — ReSpec dispatches independent analysis tasks as parallel subagents for maximum throughput.

### 1.1 Problem Statement

Organizations frequently face legacy systems that work but are poorly documented, architecturally degraded, and expensive to maintain. When the decision is made to rebuild, teams typically either:

- Start from scratch and lose institutional knowledge embedded in the code
- Port the legacy code directly, carrying over technical debt and outdated patterns
- Spend weeks manually reverse-engineering the system into a specification

ReSpec automates the third approach, producing a structured specification that captures the system's behavior and business rules without inheriting its implementation decisions.

### 1.2 Target Users

- Tech leads planning system rewrites or major refactors
- Consultants onboarding onto legacy client projects
- Teams migrating between tech stacks (e.g., monolith to microservices)
- Engineering managers needing to document undocumented systems

## 2. Goals & Non-Goals

### 2.1 Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Extract domain model from legacy code | Entities, relationships, and bounded contexts identified with >80% accuracy |
| G2 | Mine business rules from code and tickets | Rules documented and traceable to source code or Jira tickets |
| G3 | Generate a complete, implementation-agnostic SDD | SDD covers all 12 standard sections with no TODOs in core sections |
| G4 | Produce actionable task breakdown | Epics and stories with acceptance criteria, ready for sprint planning |
| G5 | Create AI agent skills/instructions for the new project | Skills/instructions that enable AI-assisted development from day one (agent-agnostic) |
| G6 | Maintain full traceability | Every spec artifact traceable to its source (code, ticket, or doc) |

### 2.2 Non-Goals

- Automated code migration or transpilation (ReSpec produces specs, not code)
- Runtime analysis or dynamic behavior detection (static analysis only in v1)
- Continuous sync with the legacy system (one-shot pipeline, not a live mirror)
- Replacing human architectural judgment (humans review and approve every phase)

## 3. Architecture

### 3.1 High-Level Design

ReSpec follows a three-phase pipeline architecture where each phase produces Markdown artifacts that serve as input for the next phase. Humans review and optionally edit the intermediate artifacts between phases.

| Phase | Command | Input | Output | Engine |
|-------|---------|-------|--------|--------|
| 1. Ingest | respec ingest | Repo, Jira API, Docs | /.respec/raw/ | Parsers + API clients |
| 2. Analyze | respec analyze | /.respec/raw/ | /.respec/analyzed/ | AI subagents (parallel) |
| 3. Generate | respec generate | /.respec/analyzed/ | /specs/ | AI subagents + templates |
| (4. Export) | respec export | /specs/ | Skills package | File transforms |

### 3.2 Design Principles

- **Idempotent phases**: every command can be re-run safely, overwriting previous output
- **Human-in-the-loop**: intermediate MDs are editable; the pipeline respects manual changes
- **Source-agnostic analysis**: analyzers work on the normalized raw MDs, not on source code directly
- **Implementation-agnostic output**: specs describe WHAT, never HOW to implement
- **Progressive disclosure**: each phase adds abstraction (raw data → domain model → spec)
- **Agent-agnostic**: the AI engine is a pluggable adapter; any CLI agent that accepts a prompt and returns text can be used
- **Parallel subagents**: analyzers and generators with no data dependencies run as concurrent subagents, reducing wall-clock time proportionally

### 3.3 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| CLI framework | Node.js + TypeScript + commander | Type safety for schemas, familiar ecosystem |
| AI engine | Pluggable adapter: Claude Code (`claude -p`), Codex CLI (`codex`), Gemini CLI (`gemini`), or custom | Agent-agnostic; each adapter wraps the agent's CLI invocation |
| Subagent orchestrator | Built-in parallel dispatcher (Promise.allSettled) | Runs independent analyzers/generators concurrently |
| Jira client | jira.js (Atlassian SDK) | Official SDK, handles auth and pagination |
| Git operations | simple-git | Clone, log, diff operations |
| Doc parsing | Confluence REST API + markdown-it | Parse wiki pages and Markdown docs |
| YAML config | yaml + zod | Schema-validated configuration |
| File output | Markdown + Mermaid | Universal, version-controllable, LLM-friendly |

## 4. Data Model

ReSpec does not use a database. All data is stored as files in the filesystem, organized in a well-defined directory structure. The "data model" is the schema of the Markdown files and the configuration YAML.

### 4.1 Configuration Schema

The `respec.config.yaml` file defines all inputs, filters, and output preferences:

```yaml
# respec.config.yaml
project:
  name: string              # Project name for output
  version: string            # SDD version
  description: string        # One-line project description

sources:
  repo:
    path: string             # Local path or git URL
    branch: string           # Branch to analyze (default: main)
    include: string[]        # Glob patterns to include
    exclude: string[]        # Glob patterns to exclude

  jira:
    host: string             # Atlassian instance URL
    auth: string             # env:JIRA_API_TOKEN
    filters:
      projects: string[]     # Project keys
      labels: string[]       # Filter by labels
      title_contains: string[] # Search in summary
      types: string[]        # Issue types
      status: string[]       # Status filter
      jql: string            # Raw JQL override

  docs:
    confluence:
      host: string           # Confluence URL
      space: string          # Space key
      auth: string           # env:CONFLUENCE_TOKEN
    local: string[]          # Local Markdown/text paths

ai:
  engine: string              # "claude" | "codex" | "gemini" | "custom"
  command: string             # Override: custom CLI command (e.g., "my-agent --prompt")
  max_parallel: number        # Max concurrent subagents (default: 4)
  timeout: number             # Per-subagent timeout in seconds (default: 300)
  model: string               # Optional model override (e.g., "opus", "o3", "gemini-2.5-pro")

output:
  dir: string               # Output directory (default: ./specs)
  format: string            # "kiro" | "openspec" | "antigravity" | "superpowers" (default: "openspec")
  diagrams: mermaid | none   # Diagram format
  tasks: boolean             # Generate task breakdown
```

**AI Engine Resolution**: If `ai.engine` is set, ReSpec uses the corresponding built-in adapter. If `ai.command` is set, it overrides the adapter and uses the raw command. The adapter contract is simple: receive a prompt string via stdin/argument, return Markdown via stdout.

**Output Format**: The `output.format` field determines the directory structure, file naming, and conventions of the generated specs. All formats produce equivalent content — the difference is packaging. See [Section 8.3 — Output Formats](#83-output-formats) for details.

### 4.2 File Structure Contract

Each phase writes to a specific directory. Files within each directory follow a strict naming and content convention:

#### Phase 1 Output: `/.respec/raw/`

| File | Content | Source |
|------|---------|--------|
| repo/structure.md | Directory tree with descriptions per folder/file | File system scan |
| repo/dependencies.md | All dependencies with versions and purpose | package.json, go.mod, etc. |
| repo/endpoints.md | HTTP routes with method, path, handler, middleware | Route definitions in code |
| repo/models.md | Database schemas, ORM models, types | Prisma, TypeORM, SQL files |
| repo/env-vars.md | Environment variables used and their context | Code scan for process.env |
| repo/modules/{name}.md | Per-module summary: purpose, exports, dependencies | Code analysis |
| jira/epics.md | Epics with key, summary, description, child stories | Jira API |
| jira/stories.md | Stories with ACs, subtasks, labels, status | Jira API |
| jira/bugs.md | Bugs with reproduction steps and resolution | Jira API |
| docs/wiki-pages/{name}.md | Wiki content converted to Markdown | Confluence API |
| _manifest.md | Ingestion stats, timestamps, coverage report | Pipeline metadata |

#### Phase 2 Output: `/.respec/analyzed/`

| File | Content | LLM Prompt Strategy |
|------|---------|---------------------|
| domain/bounded-contexts.md | Identified contexts with responsibilities and boundaries | Analyze module structure + domain patterns |
| domain/entities.md | Domain entities with attributes and relationships | Extract from models + business logic |
| domain/glossary.md | Ubiquitous language definitions | Cross-reference code terms with Jira/docs |
| flows/user-flows.md | End-to-end user journeys | Trace from endpoints through services |
| flows/data-flows.md | Data movement between components | Analyze imports, calls, data transforms |
| rules/business-rules.md | Explicit and implicit business rules | Extract from validators, guards, conditions |
| rules/permissions.md | Role-based access and authorization model | Analyze auth middleware, guards, CASL |
| api/contracts.md | API request/response shapes and constraints | Parse DTOs, validators, response types |
| api/external-deps.md | Third-party integrations and usage | Scan for SDK clients, HTTP calls |
| _analysis-report.md | Confidence scores, gaps, open questions | Self-assessment of analysis quality |

#### Phase 3 Output: `/specs/` (format-dependent)

The final output structure varies by `output.format`. See [Section 8.3](#83-output-formats) for the full directory layout of each format. The core content is the same across all formats:

| Content | Description |
|---------|-------------|
| System Design Document | Complete 12-section SDD |
| Domain diagrams | ERD, context map (Mermaid) |
| Flow diagrams | Sequence diagrams per user flow (Mermaid) |
| API specification | Endpoints, contracts |
| Task breakdown | Epics, stories with ACs, migration plan |
| Architecture decisions | ADRs |
| Agent instructions | Rules/skills for the target format |
| Traceability | Source → raw → analyzed → spec mapping |

## 5. CLI Design

### 5.1 Commands

| Command | Description | Flags |
|---------|-------------|-------|
| respec init | Creates respec.config.yaml with guided prompts | --template \<name\> |
| respec ingest | Reads all sources and writes to /.respec/raw/ | --source repo\|jira\|docs (run one) |
| respec analyze | AI analysis of raw data to /.respec/analyzed/ | --only \<analyzer\> --model \<model\> |
| respec generate | Generates final specs from analyzed data | --only \<generator\> --format md\|mermaid |
| respec export | Repackages /specs/ into a different output format | --output \<dir\> --format kiro\|openspec\|antigravity\|superpowers |
| respec status | Shows pipeline state and coverage | --verbose |
| respec validate | Validates integrity of current phase outputs | --phase raw\|analyzed\|specs |

### 5.2 Pipeline State Machine

Each phase tracks its state in `/.respec/state.json`:

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

Commands validate that prerequisites are met before running. For example, `respec analyze` will fail if `respec ingest` has not completed. The `--force` flag bypasses this check.

## 6. Ingestors (Phase 1)

Ingestors are responsible for reading data from external sources and normalizing it into Markdown files. They do not interpret or analyze the data — they produce structured dumps.

### 6.1 Repo Ingestor

Reads the source code repository and produces structured summaries.

| Step | Action | Output |
|------|--------|--------|
| 1 | Clone or read local repo (respecting include/exclude globs) | Local copy |
| 2 | Generate directory tree with file counts and sizes | repo/structure.md |
| 3 | Parse package manifests (package.json, go.mod, requirements.txt) | repo/dependencies.md |
| 4 | Scan for route/endpoint definitions (Express, NestJS, FastAPI patterns) | repo/endpoints.md |
| 5 | Extract ORM/DB schemas (Prisma, TypeORM, Sequelize, raw SQL) | repo/models.md |
| 6 | Find environment variable usage | repo/env-vars.md |
| 7 | Per-module analysis: purpose, exports, imports, key functions | repo/modules/*.md |

### 6.2 Jira Ingestor

Connects to the Jira API and fetches filtered tickets. All filters from the config are translated into a single JQL query.

- **Filter composition**: Filters are combined with AND logic. The `title_contains` filter generates `summary ~ "term"` clauses. If a raw `jql` field is provided, it takes precedence over all other filters.
- **Pagination**: Uses Jira's `startAt`/`maxResults` pagination to fetch all matching tickets. Default batch size: 100.
- **Output grouping**: Tickets are grouped by type (Epic, Story, Bug) into separate files. Each ticket includes: key, summary, description, acceptance criteria (from description or custom field), labels, status, linked issues, and comments.

### 6.3 Docs Ingestor

Reads documentation from Confluence and/or local files.

- **Confluence**: Uses the REST API to fetch all pages in the configured space. HTML content is converted to Markdown using turndown or similar.
- **Local docs**: Reads .md, .txt, and .rst files from configured paths. Preserves directory structure in output.
- **README extraction**: Always captures the repo's root README as docs/readme.md.
- **Inline docs**: Scans source code for JSDoc, docstrings, and significant code comments. Outputs to docs/inline-docs.md.

## 7. Analyzers (Phase 2)

Analyzers use the configured AI engine to process the raw Markdown files and produce higher-level abstractions. Each analyzer is a self-contained unit with its own prompt template, dispatched as an independent **subagent** that runs in parallel with other analyzers that share no input dependencies.

### 7.0 Subagent Execution Model

Analyzers are grouped into dependency tiers and dispatched concurrently within each tier:

```
Tier 1 (parallel):  domain-mapper, infra-detector, api-mapper
Tier 2 (parallel):  flow-extractor, rule-miner, permission-scanner
                    (depend on Tier 1 outputs for cross-referencing)
```

Each subagent is a child process running the configured AI engine CLI. The orchestrator:
1. Builds the prompt from the analyzer's template + relevant raw MDs
2. Spawns up to `ai.max_parallel` subagents concurrently
3. Collects stdout (Markdown output) and writes to `/.respec/analyzed/`
4. Reports per-subagent status (success/failure/timeout) in `_analysis-report.md`

Failed subagents can be retried individually with `respec analyze --only <analyzer>`.

### 7.1 Prompt Architecture

Each analyzer follows a consistent prompt structure:

```
SYSTEM: You are a senior software architect performing
reverse engineering analysis. You are reading normalized
documentation from a legacy system. Your job is to
extract [SPECIFIC TARGET] and present it as structured
Markdown.

CONTEXT: [Injected raw MDs relevant to this analyzer]

TASK: [Specific extraction instructions]

OUTPUT FORMAT: [Strict Markdown template to follow]

CONFIDENCE: Rate your confidence (HIGH/MEDIUM/LOW) for
each item and explain gaps or uncertainties.
```

### 7.2 Analyzer Registry

| Analyzer | Reads | Produces | Key Prompt Focus |
|----------|-------|----------|------------------|
| domain-mapper | models.md, modules/*.md, endpoints.md | bounded-contexts.md, entities.md, glossary.md | Identify aggregates, value objects, context boundaries |
| flow-extractor | endpoints.md, modules/*.md, stories.md | user-flows.md, data-flows.md | Trace request lifecycle, map user journeys |
| rule-miner | modules/*.md, stories.md, bugs.md | business-rules.md, validation-rules.md | Find conditionals, guards, validators, edge cases |
| permission-scanner | modules/*.md, endpoints.md | permissions.md | Map roles, guards, CASL rules, auth middleware |
| api-mapper | endpoints.md, models.md | contracts.md, external-deps.md | Document request/response shapes, third-party calls |
| infra-detector | dependencies.md, env-vars.md, structure.md | architecture.md, data-storage.md | Detect DBs, caches, queues, cloud services |

### 7.3 Confidence Scoring

Each analyzer self-reports confidence in its `_analysis-report.md`. This guides human review:

| Level | Meaning | Human Action |
|-------|---------|--------------|
| HIGH | Clear evidence in code/docs, low ambiguity | Skim and approve |
| MEDIUM | Inferred from patterns, some assumptions made | Review carefully, validate assumptions |
| LOW | Guesswork based on naming/structure, significant gaps | Rewrite or flag as open question |

## 8. Generators (Phase 3)

Generators transform analyzed data into final specification artifacts. They combine LLM generation with Markdown/Mermaid templates.

### 8.1 Generator Registry

| Generator | Reads | Produces |
|-----------|-------|----------|
| sdd-gen | All analyzed/* files | sdd.md (12-section System Design Document) |
| erd-gen | entities.md, bounded-contexts.md | domain/erd.mermaid, domain/context-map.mermaid |
| flow-gen | user-flows.md, data-flows.md | flows/*.mermaid (sequence diagrams) |
| task-gen | All analyzed/* + sdd.md | tasks/epics.md, tasks/stories/**/*.md, migration-plan.md |
| adr-gen | architecture.md, external-deps.md | adrs/adr-*.md (Architecture Decision Records) |
| format-gen | All specs/* files | Format-specific output (see 8.3) — adapts to kiro/openspec/antigravity/superpowers |

### 8.1.1 Generator Parallelism

Generators also run as subagents where possible:

```
Tier 1 (parallel):  erd-gen, flow-gen, adr-gen
Tier 2 (sequential): sdd-gen (needs all Tier 1 outputs)
Tier 3 (parallel):  task-gen, format-gen (depend on sdd.md)
```

### 8.2 SDD Template (sdd.md)

The central output document follows a standard 12-section structure:

| Section | Content |
|---------|---------|
| 1. Overview | Project purpose, problem statement, target users |
| 2. Goals & Non-Goals | Measurable goals with success metrics; explicit non-goals |
| 3. Domain Model | Bounded contexts, entities, aggregates, glossary |
| 4. Architecture | High-level design with Mermaid diagram, design principles |
| 5. Data Model | ERD reference, entity details, storage strategy |
| 6. API Design | Endpoints, contracts, versioning strategy |
| 7. User Flows | Key user journeys with sequence diagram references |
| 8. Business Rules | Extracted rules with source traceability |
| 9. Security & Auth | Authentication, authorization, data protection |
| 10. Infrastructure | Deployment, environments, monitoring, scaling |
| 11. Migration Strategy | Implementation order, risks, rollback plan |
| 12. Open Questions | Unresolved items from LOW confidence analysis |

### 8.3 Output Formats

The `output.format` config determines how ReSpec packages the generated specs. All formats contain equivalent content — the difference is structure, naming conventions, and agent-specific files. The `respec export --format <target>` command can repackage an existing output into a different format.

#### 8.3.1 Kiro Format (`format: kiro`)

Produces specs in [AWS Kiro's](https://kiro.dev) spec-driven development structure. Kiro expects a `.kiro/` directory with steering files and per-feature spec folders.

```
specs/
├── .kiro/
│   ├── steering/
│   │   ├── product.md              # ← from SDD §1 Overview + §2 Goals
│   │   ├── tech.md                 # ← from SDD §4 Architecture + §10 Infra
│   │   └── structure.md            # ← from analyzed/domain/bounded-contexts.md
│   └── specs/
│       ├── domain-model/
│       │   ├── requirements.md     # ← entities, aggregates as EARS user stories
│       │   ├── design.md           # ← ERD, context map, domain relationships
│       │   └── tasks.md            # ← domain-related implementation tasks
│       ├── api-layer/
│       │   ├── requirements.md     # ← API contracts as user stories with ACs
│       │   ├── design.md           # ← endpoint specs, auth design
│       │   └── tasks.md            # ← API implementation tasks
│       ├── {flow-name}/
│       │   ├── requirements.md     # ← user flow as Given/When/Then ACs
│       │   ├── design.md           # ← sequence diagrams, data flow
│       │   └── tasks.md            # ← flow implementation tasks
│       └── infrastructure/
│           ├── requirements.md     # ← infra requirements
│           ├── design.md           # ← deployment, monitoring design
│           └── tasks.md            # ← infra setup tasks
├── adrs/
│   └── adr-{NNN}-{slug}.md
├── diagrams/
│   ├── erd.mermaid
│   ├── context-map.mermaid
│   └── flows/{name}.mermaid
└── _respec-meta.md
```

**Key mappings**: SDD sections are decomposed into Kiro's `requirements.md` → `design.md` → `tasks.md` triplets. Requirements use EARS format with Given/When/Then acceptance criteria. Tasks use Markdown checkboxes.

#### 8.3.2 OpenSpec Format (`format: openspec`)

Produces specs in [OpenSpec's](https://openspec.pro) spec-driven framework. OpenSpec organizes by capabilities with delta-aware specs and a proposal/design/tasks pipeline.

```
specs/
├── openspec/
│   ├── AGENTS.md                   # ← AI agent instructions with <openspec-instructions>
│   ├── project.md                  # ← from SDD §1-§4 (stack, domain, patterns)
│   ├── config.yaml                 # ← schema: spec-driven, context, rules
│   ├── specs/                      # ← source of truth per capability
│   │   ├── {bounded-context}/
│   │   │   └── spec.md             # ← entities, rules, contracts for this context
│   │   ├── auth-permissions/
│   │   │   └── spec.md             # ← from rules/permissions + security
│   │   └── {capability-name}/
│   │       └── spec.md             # ← MUST/SHALL requirements + GIVEN/WHEN/THEN scenarios
│   ├── changes/
│   │   └── full-reimplementation/
│   │       ├── proposal.md         # ← Why (from SDD §1), What Changes (all capabilities)
│   │       ├── design.md           # ← from SDD §4 Architecture + §5 Data Model
│   │       ├── tasks.md            # ← numbered task groups with checkboxes
│   │       └── specs/              # ← delta specs per capability
│   │           └── {capability}/
│   │               └── spec.md
│   └── explorations/               # ← open questions, low-confidence analysis
├── diagrams/
│   ├── erd.mermaid
│   ├── context-map.mermaid
│   └── flows/{name}.mermaid
├── adrs/
│   └── adr-{NNN}-{slug}.md
└── _respec-meta.md
```

**Key mappings**: Each bounded context becomes an OpenSpec capability. Business rules use RFC 2119 keywords (MUST, SHALL, SHOULD). Every requirement includes at least one GIVEN/WHEN/THEN scenario. The full reimplementation is modeled as a single OpenSpec "change."

#### 8.3.3 Antigravity Format (`format: antigravity`)

Produces specs compatible with [Google Antigravity's](https://antigravity.google) agent-first IDE. Antigravity uses `GEMINI.md` + `AGENTS.md` for rules, and generates artifacts (`task.md`, `implementation_plan.md`, `walkthrough.md`) during execution.

```
specs/
├── GEMINI.md                       # ← Antigravity-specific rules (tech stack, conventions)
├── AGENTS.md                       # ← Cross-tool rules (shared with Cursor, Claude Code)
├── .agent/
│   └── rules/
│       ├── domain-model.md         # ← bounded contexts, entities, glossary
│       ├── business-rules.md       # ← extracted business rules as agent constraints
│       ├── api-contracts.md        # ← endpoint specs, request/response shapes
│       ├── security.md             # ← auth model, permissions, data protection
│       └── testing.md              # ← validation rules as test requirements
├── docs/
│   ├── sdd.md                      # ← full 12-section SDD
│   ├── domain-model.md             # ← entities, aggregates, context map
│   ├── migration-plan.md           # ← implementation order with dependencies
│   └── diagrams/
│       ├── erd.mermaid
│       ├── context-map.mermaid
│       └── flows/{name}.mermaid
├── tasks/
│   ├── task.md                     # ← living checklist (Antigravity artifact format)
│   └── implementation_plan.md      # ← technical blueprint (Antigravity artifact format)
├── adrs/
│   └── adr-{NNN}-{slug}.md
└── _respec-meta.md
```

**Key mappings**: Business rules and domain knowledge are packaged as `.agent/rules/` files that act as persistent agent instructions. The SDD is preserved as a reference document in `docs/`. Task breakdown uses Antigravity's native `task.md` artifact format. `GEMINI.md` contains project-specific overrides; `AGENTS.md` contains cross-tool compatible rules.

#### 8.3.4 Superpowers Format (`format: superpowers`)

Produces specs as [Claude Code Superpowers](https://github.com/anthropics/claude-code) skills. Each domain area becomes a skill with YAML frontmatter, optimized for Claude's skill discovery system.

```
specs/
├── CLAUDE.md                       # ← project-level instructions (stack, conventions, constraints)
├── skills/
│   ├── domain-model/
│   │   └── SKILL.md                # ← bounded contexts, entities, aggregates, glossary
│   ├── business-rules/
│   │   └── SKILL.md                # ← extracted rules with source traceability
│   ├── api-contracts/
│   │   ├── SKILL.md                # ← endpoint overview, conventions
│   │   └── contracts/{entity}.md   # ← per-entity request/response schemas
│   ├── user-flows/
│   │   ├── SKILL.md                # ← flow overview with diagram references
│   │   └── flows/{name}.md         # ← per-flow detail
│   ├── data-model/
│   │   ├── SKILL.md                # ← ERD reference, storage strategy
│   │   └── erd.mermaid
│   ├── security-auth/
│   │   └── SKILL.md                # ← auth model, permissions, roles
│   ├── infrastructure/
│   │   └── SKILL.md                # ← deployment, monitoring, environments
│   └── migration-guide/
│       ├── SKILL.md                # ← implementation order, priorities
│       └── tasks/
│           ├── epics.md
│           └── stories/{epic}/{story}.md
├── adrs/
│   └── adr-{NNN}-{slug}.md
├── diagrams/
│   ├── context-map.mermaid
│   └── flows/{name}.mermaid
├── sdd.md                          # ← full 12-section SDD as reference
└── _respec-meta.md
```

**Key mappings**: Each SDD section maps to a skill folder with a `SKILL.md` containing YAML frontmatter (`name`, `description`, `user-invocable`). Descriptions use "Use when..." trigger format for Claude's discovery. Heavy reference content (contracts, flows) is split into supporting files. Skills are optimized for token efficiency — under 500 words where possible.

**SKILL.md frontmatter example**:

```yaml
---
name: domain-model
user-invocable: true
description: Use when implementing entities, defining bounded context boundaries, or working with the domain layer
---
```

#### 8.3.5 Format Comparison

| Aspect | Kiro | OpenSpec | Antigravity | Superpowers |
|--------|------|---------|-------------|-------------|
| Agent target | AWS Kiro IDE | Any (agent-agnostic) | Google Antigravity | Claude Code |
| Root directory | `.kiro/` | `openspec/` | `.agent/` + root MDs | `skills/` + root MDs |
| Rules file | `steering/*.md` | `AGENTS.md` + `project.md` | `GEMINI.md` + `AGENTS.md` + `.agent/rules/` | `CLAUDE.md` |
| Spec unit | Feature folder (req/design/tasks) | Capability folder (`spec.md`) | Rule files + artifacts | Skill folder (`SKILL.md`) |
| Task format | Markdown checkboxes | Numbered groups + checkboxes | `task.md` artifact | Epics/stories MDs |
| Requirement style | EARS + Given/When/Then | RFC 2119 + Given/When/Then | Agent constraints | Trigger-based descriptions |
| Cross-tool compatible | No (Kiro only) | Yes | Partial (`AGENTS.md` shared) | No (Claude only) |

## 9. Security & Auth

ReSpec handles credentials for external services (Jira, Confluence, Git). Security is critical even for a local CLI tool.

- Credentials are never stored in `respec.config.yaml` directly. The `env:` prefix references environment variables.
- Git credentials use the system's configured SSH keys or credential helpers.
- Raw ingested data may contain sensitive information (API keys in env-vars.md, passwords in config files). The ingestor should redact known patterns (API keys, tokens, passwords) and flag potential leaks.
- The `.respec/` directory should be added to `.gitignore` by `respec init` to prevent accidental commits of raw data.
- AI engine authentication is the user's responsibility. Each agent CLI (Claude Code, Codex, Gemini) uses its own auth mechanism. ReSpec does not manage AI credentials — it assumes the configured agent CLI is already authenticated.

## 10. Infrastructure & Deployment

ReSpec is a local CLI tool with no server component in v1. Distribution and runtime requirements:

### 10.1 Distribution

- Published to npm as a global CLI: `npm install -g respec`
- Requires Node.js >= 20 and at least one supported AI agent CLI installed and authenticated (Claude Code, Codex CLI, or Gemini CLI)
- Optional: Jira API token and Confluence API token for those ingestors

### 10.2 Runtime Requirements

| Requirement | Purpose | Required? |
|-------------|---------|-----------|
| Node.js >= 20 | CLI runtime | Yes |
| AI agent CLI | LLM analysis (any of: `claude`, `codex`, `gemini`, or custom) | Yes (for analyze/generate) — at least one |
| Git | Repository cloning | Yes (for repo ingestor) |
| Jira API token | Ticket ingestion | Only if using Jira source |
| Confluence API token | Doc ingestion | Only if using Confluence source |

## 11. Implementation Roadmap

ReSpec itself will be built in phases, dogfooding its own output format:

### 11.1 Phase 1: MVP (Weeks 1-3)

- CLI scaffolding: init, ingest, status commands
- Repo ingestor: structure, dependencies, models, endpoints
- Basic Jira ingestor: epics and stories with filtering
- Manual analyze step (user runs AI agent CLI with provided prompts)

### 11.2 Phase 2: AI Pipeline (Weeks 4-6)

- Automated analyzers as parallel subagents: domain-mapper, flow-extractor, rule-miner
- AI engine adapter system (Claude, Codex, Gemini, custom)
- Analysis report with confidence scoring
- SDD generator with the 12-section template
- Mermaid diagram generation (ERD, sequence, context map)

### 11.3 Phase 3: Polish (Weeks 7-8)

- Task breakdown generator (epics → stories → tasks)
- Output format system (Kiro, OpenSpec, Antigravity, Superpowers) with `respec export --format`
- ADR generator
- Docs ingestor (Confluence + local)
- Validation and export commands

### 11.4 Future (Post-MVP)

- MCP Server mode: expose ReSpec as a tool for any MCP-compatible agent
- Interactive TUI for human review steps
- Support for additional source types (Notion, Linear, GitHub Issues)
- Multi-language code analysis (currently focused on TypeScript/JavaScript)
- Diff mode: compare specs between runs to track legacy system evolution

## 12. Open Questions

| # | Question | Impact | Proposed Resolution |
|---|----------|--------|---------------------|
| Q1 | How to handle monorepos with multiple apps? | HIGH | Support workspace-aware config with per-app analysis |
| Q2 | Should AI prompts be customizable by users? | MEDIUM | Provide default prompts with override capability in config |
| Q3 | How to handle private npm packages or internal SDKs in dependency analysis? | MEDIUM | Flag as external dependency, let user annotate purpose manually |
| Q4 | Maximum codebase size before context window limits? | HIGH | Chunk analysis by module; use module-level summaries for cross-cutting analysis |
| Q5 | Should ReSpec support incremental re-ingestion? | LOW (v1) | Defer to post-MVP; v1 is full re-run only |
| Q6 | Integration with Nx monorepo tooling? | MEDIUM | Leverage Nx project graph for automatic module detection |

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| SDD | System Design Document — comprehensive specification for building a system |
| Bounded Context | A defined boundary within which a domain model is consistent and applicable |
| Ingestor | A ReSpec module that reads from an external source and produces raw Markdown |
| Analyzer | A ReSpec module that uses AI to extract abstractions from raw data |
| Generator | A ReSpec module that produces final spec artifacts from analyzed data |
| Confidence Score | AI self-assessment of analysis reliability (HIGH/MEDIUM/LOW) |
| Traceability | The ability to trace any spec artifact back to its source data |
| AI Engine | Pluggable adapter that wraps an AI agent CLI (Claude Code, Codex, Gemini, or custom) |
| Subagent | An independent child process running an analyzer or generator via the AI engine |
| Output Format | The packaging structure for generated specs (Kiro, OpenSpec, Antigravity, or Superpowers) |
| Kiro | AWS's spec-driven IDE; uses `.kiro/specs/` with requirements/design/tasks triplets |
| OpenSpec | Open-source spec framework by Fission AI; uses capability-based specs with RFC 2119 keywords |
| Antigravity | Google's agent-first IDE; uses `GEMINI.md` + `.agent/rules/` for agent instructions |
| Superpowers | Claude Code skill system; uses `SKILL.md` files with YAML frontmatter for discovery |
| ADR | Architecture Decision Record — documents a significant architectural choice |
| Ubiquitous Language | A shared vocabulary between code, docs, and domain experts |

## Appendix B: Example respec.config.yaml

```yaml
project:
  name: DocuPaint
  version: "1.0"
  description: Paint inspection app for iOS/Android

sources:
  repo:
    path: https://github.com/org/docupaint
    branch: main
    include:
      - "apps/**"
      - "libs/**"
    exclude:
      - "**/*.test.ts"
      - "**/*.spec.ts"
      - "**/node_modules/**"

  jira:
    host: https://company.atlassian.net
    auth: env:JIRA_API_TOKEN
    filters:
      projects: [DOC]
      labels: [mvp, core, v2]
      title_contains: ["paint system", "shipping"]
      types: [Epic, Story]
      status: [Done, In Progress, To Do]

  docs:
    confluence:
      host: https://company.atlassian.net/wiki
      space: DOCUPAINT
      auth: env:CONFLUENCE_TOKEN
    local:
      - "./docs"
      - "./README.md"

ai:
  engine: claude               # "claude" | "codex" | "gemini" | "custom"
  max_parallel: 4              # Run up to 4 subagents concurrently
  timeout: 300                 # 5 min per subagent

output:
  dir: ./specs
  format: openspec             # "kiro" | "openspec" | "antigravity" | "superpowers"
  diagrams: mermaid
  tasks: true
```
