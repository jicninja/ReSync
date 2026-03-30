# Design: GitHub Spec Kit & BMAD Method Export Formats

## Summary

Add two new output formats to ReSpec's export system: `speckit` (GitHub Spec Kit) and `bmad` (BMAD Method). Both follow the existing `FormatAdapter` pattern and include a hybrid approach — generate pre-populated artefacts, then optionally run the framework's official installer.

## Decisions

1. **Export only** — no ingest support for these formats
2. **Hybrid install** — generate artefacts first, then offer to run the official CLI installer (`specify init` / `npx bmad-method install`) if the framework isn't already set up
3. **Spec Kit mapping strategy** — 3 modes: bounded contexts (default), single feature (fallback), manual YAML mapping
4. **BMAD artefacts only** — generate `_bmad-output/` with pre-filled planning artefacts (PRD, architecture, epics/stories); user lands at Phase 4 (Implementation) ready to go
5. **No `_bmad/` generation** — framework skills installed by official CLI, not bundled by ReSpec

## Format 1: GitHub Spec Kit (`speckit`)

### Output Structure

```
.specify/
  memory/
    constitution.md              <- project conventions (from SDD + config)
  specs/
    001-{context-name}/          <- one dir per bounded context
      spec.md                    <- user stories + acceptance criteria
      plan.md                    <- tech stack + architecture decisions
      research.md                <- dependencies + external APIs
      data-model.md              <- entities for this context
      tasks.md                   <- implementation tasks
      contracts/
        api-spec.md              <- API contracts relevant to context (Markdown)
```

### Mapping Strategies

**Mode 1 — Bounded contexts (default):**
Each bounded context from `domain/bounded-contexts.md` becomes a numbered feature directory. Entity, flow, and rule data is filtered to the relevant context.

**Mode 2 — Single feature (fallback):**
If no bounded contexts exist (small project or skipped domain analysis), all artefacts go into `001-full-reimplementation/`.

**Mode 3 — Manual YAML mapping:**
User defines custom feature groupings in config:

```yaml
output:
  format: speckit
  speckit:
    mapping:
      - name: user-management
        contexts: [auth, users]
      - name: billing
        contexts: [payments, invoices]
```

Multiple bounded contexts can be merged into a single feature directory.

### Artefact Mapping

| Spec Kit file | ReSpec source |
|---|---|
| `constitution.md` | SDD intro + config project info + business rules summary |
| `spec.md` | SDD scope + user flows + acceptance criteria from business/validation rules |
| `plan.md` | SDD architecture sections + infra/architecture.md + tech stack |
| `research.md` | dependencies.md + api/external-deps.md |
| `data-model.md` | domain/entities.md filtered by context |
| `tasks.md` | task-gen output from `specsDir` (phase 3), filtered by context |
| `contracts/api-spec.md` | api/contracts.md content filtered to relevant context (Markdown, not JSON — avoids lossy MD→JSON conversion) |

### Hybrid Install Flow

After generating artefacts:

1. Check if `.specify/templates/` exists (framework already installed)
2. If not, prompt user: "Install GitHub Spec Kit framework? This runs `specify init`. (Y/n)"
3. If yes: run `specify init` first, then overwrite with our generated artefacts
4. If no: log message suggesting manual install

Order matters — `specify init` runs first so our pre-populated specs aren't overwritten by empty templates.

## Format 2: BMAD Method (`bmad`)

### Output Structure

```
_bmad-output/
  planning-artifacts/
    PRD.md                       <- product requirements from SDD + business rules
    architecture.md              <- architecture + infra analysis + ADRs
    ux-spec.md                   <- user flows + data flows
    epics/
      epic-1-{name}.md           <- one epic per bounded context
      story-{slug}.md            <- stories derived from tasks
  implementation-artifacts/
    sprint-status.yaml           <- initialized empty, ready for Phase 4
  project-context.md             <- tech stack + conventions + implementation rules
```

### Artefact Mapping

| BMAD file | ReSpec source |
|---|---|
| `PRD.md` | SDD sections 1-4 + rules/business-rules.md + rules/validation-rules.md |
| `architecture.md` | SDD sections 5-8 + infra/architecture.md + infra/data-storage.md |
| `ux-spec.md` | flows/user-flows.md + flows/data-flows.md |
| `epic-N-name.md` | domain/bounded-contexts.md (1 epic per context) |
| `story-slug.md` | task-gen output from `specsDir` (phase 3), grouped by epic/context |
| `project-context.md` | config project info + domain/glossary.md + rules/permissions.md |
| `sprint-status.yaml` | Empty scaffold with epic list |

### PRD.md Structure

Follows BMAD's PRD template:
- Project Overview (from SDD intro)
- Goals & Success Metrics (from SDD scope)
- User Personas (inferred from user flows)
- User Stories (from flows + business rules, with acceptance criteria)
- Functional Requirements (from business rules + validation rules)
- Non-Functional Requirements (from infra analysis)
- Data Requirements (from entities + data storage)
- External Integrations (from api/external-deps.md)

### architecture.md Structure

Follows BMAD's architecture template:
- Tech Stack (from SDD + dependencies.md)
- Architecture Overview (from infra/architecture.md)
- Data Model (from domain/entities.md with Mermaid ERD)
- API Design (from api/contracts.md)
- Security (from rules/permissions.md)
- ADRs (from adr-gen output if available)

### Epic/Story Structure

Each epic file follows BMAD format:
```markdown
# Epic N: {Bounded Context Name}

## Description
{Context description from bounded-contexts.md}

## Stories
- story-{slug-1}
- story-{slug-2}

## Acceptance Criteria
{Derived from business rules for this context}
```

Each story file:
```markdown
# Story: {Title}

## Description
{Task description}

## Acceptance Criteria
- [ ] {criterion 1}
- [ ] {criterion 2}

## Technical Notes
{Relevant architecture/entity details}
```

### Hybrid Install Flow

After generating artefacts:

1. Check if `_bmad/` directory exists (framework already installed)
2. If not, prompt user: "Install BMAD Method framework? This runs `npx bmad-method install`. (Y/n)"
3. If yes: run `npx bmad-method install`, then generate artefacts in `_bmad-output/`
4. If no: log message suggesting manual install

Order doesn't matter here — `_bmad/` (framework) and `_bmad-output/` (artefacts) are separate directories.

## Changes to Existing Code

### New Files

| File | Purpose |
|---|---|
| `src/formats/speckit.ts` | `SpecKitFormat` implements `FormatAdapter` |
| `src/formats/bmad.ts` | `BmadFormat` implements `FormatAdapter` |

### Modified Files

| File | Change |
|---|---|
| `src/constants.ts` | Add `FORMAT_SPECKIT = 'speckit'`, `FORMAT_BMAD = 'bmad'` to `OUTPUT_FORMATS` |
| `src/formats/factory.ts` | Add cases for both formats, update error message |

| `src/formats/types.ts` | Extend `FormatContext` with `config` and `ciMode` fields (see below) |
| `src/config/schema.ts` | Add `speckit` mapping schema to `outputSchema` |
| `src/commands/export.ts` | Pass full config and CI flag into `FormatContext` |
| `bin/respec.ts` | Update `--format` help text to include `speckit, bmad` |

### No Changes Needed

| File | Reason |
|---|---|
| `src/wizard/init-flow.ts` | Already reads from `OUTPUT_FORMATS` constant |

### Config Schema Addition

Add optional `speckit` field to output schema for manual mapping:

```typescript
const speckitMappingSchema = z.object({
  mapping: z.array(z.object({
    name: z.string(),
    contexts: z.array(z.string()),
  })).optional(),
}).optional();

const outputSchema = z.object({
  dir: z.string().default(DEFAULT_OUTPUT_DIR),
  format: outputFormatEnum.default(DEFAULT_OUTPUT_FORMAT),
  diagrams: z.enum(['mermaid', 'none']).default(DEFAULT_DIAGRAM_TYPE),
  tasks: z.boolean().default(true),
  speckit: speckitMappingSchema,
});
```

## FormatContext Extension

The `FormatContext` interface must be extended to support config access and CI detection:

```typescript
export interface FormatContext {
  projectName: string;
  projectDescription: string;
  sddContent: string;
  analyzedDir: string;
  specsDir: string;       // NEW: path to specs/ (phase 3 output, for task-gen files)
  config: ReSpecConfig;   // NEW: full config (for speckit.mapping)
  ciMode: boolean;        // NEW: true in --ci mode (suppresses interactive prompts)
}
```

`specsDir` is needed because task-gen output lives in phase 3 output (`specs/`), not phase 2 (`analyzed/`). Both Spec Kit and BMAD read tasks from `specsDir`. The `export.ts` command already has access to all three values — it just needs to pass them through.

The hybrid install prompt happens inside `package()`. In CI mode, the prompt is skipped and a log message is emitted instead.

## Bounded Context Parsing

Both formats need to parse bounded contexts from `domain/bounded-contexts.md`. The existing `kiro.ts` has a local `parseSectionHeaders()` that extracts `##` headers — this logic should be extracted into a shared utility that replaces kiro's local function.

```typescript
// src/formats/context-parser.ts
export interface BoundedContext {
  name: string;       // original header text
  slug: string;       // kebab-case for directory/file names
  description: string; // content between this ## header and the next
  entities: string[]; // entity names mentioned in the description (best-effort grep)
}

export function parseBoundedContexts(analyzedDir: string): BoundedContext[];
```

**Parsing contract**: `bounded-contexts.md` uses `##` headers for each context. Everything between two `##` headers is that context's description. Entity names are extracted by matching references to entries in `domain/entities.md` (cross-reference by name). Returns empty array if file doesn't exist or has no `##` headers.

Used by `SpecKitFormat` for feature directories, `BmadFormat` for epic generation, and `KiroFormat` (replacing its local parser).

## Hybrid Install Implementation

Both formats share the pattern of checking for framework presence and offering install. Extract into a utility:

```typescript
// src/formats/framework-installer.ts
export async function offerFrameworkInstall(options: {
  name: string;
  checkPath: string;
  installCommand: string;
  cwd: string;
  ciMode: boolean;
}): Promise<boolean>;
```

**Behavior:**
- If `checkPath` exists, returns `false` (already installed, skip)
- If `ciMode` is `true`, logs "Skipping {name} install (CI mode). Run `{installCommand}` manually." and returns `false`
- Otherwise, prompts via `@clack/prompts` confirm
- If user accepts, spawns child process with `execSync(installCommand, { cwd, stdio: 'inherit' })`
- On failure (command not found, non-zero exit): catches error, logs warning with the install command for manual execution, returns `false`. The export continues — framework install is optional, artefact generation is not.
- Returns `true` only if install succeeded

## Testing Strategy

- Unit tests for bounded context parser
- Unit tests for each format adapter (mock filesystem, verify output structure)
- Unit tests for manual mapping config parsing
- Integration test verifying end-to-end export with sample analyzed data
