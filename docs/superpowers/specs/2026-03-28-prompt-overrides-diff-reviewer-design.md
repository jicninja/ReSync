# Prompt Overrides, Spec Diff, and AI Reviewer

Three independent features that improve output quality and user control.

---

## Feature 1: Prompt Overrides

### Problem

Users can't customize analyzer/generator prompts without forking ReSpec. If an analyzer produces bad output, the only fix is to modify source code.

### Design

Users place a `prompts/` directory in their project root. Files matching an analyzer/generator ID override the built-in prompt.

```
my-project/
└── prompts/
    ├── domain-mapper.md      ← overrides built-in analyzer prompt
    ├── sdd-gen.md            ← overrides built-in generator prompt
    └── anything-else.md      ← ignored (no matching ID)
```

### Behavior

- Before executing an analyzer/generator, check if `{projectDir}/prompts/{id}.md` exists
- If exists, use it as the prompt template instead of the built-in
- Templates use the same placeholders: `{{CONTEXT}}`, `{{CONTEXT_SOURCES}}`, `{{TIER1_OUTPUT}}`
- If not found, fall back to built-in prompt (current behavior)
- The "subprocess" directive is always prepended regardless of override (prevents the Claude-as-tool bug)

### Changes

- `src/commands/analyze.ts` — already has prompt file loading logic at line ~100, fix it to actually work with the project's prompts/ dir
- `src/commands/generate.ts` — generators have prompts inline in builder functions; add override check before using the builder
- Both commands: prepend the subprocess directive to all prompts (built-in or override)

### Subprocess Directive

Always prepended to every prompt, regardless of source:

```
IMPORTANT: You are running as a text-generation subprocess. Do NOT attempt to create files, use tools, or interact with any system. Your ONLY output is the raw Markdown text written to stdout. Everything you write goes directly into a single output file.
```

---

## Feature 2: Spec Diff

### Problem

After re-running analyze or generate, there's no way to see what changed. Users have to manually diff files.

### Design

#### Snapshots

Before each analyze/generate run, snapshot the current state:
- `respec analyze` → snapshots `.respec/analyzed/` to `.respec/snapshots/{timestamp}/analyzed/`
- `respec generate` → snapshots `specs/` to `.respec/snapshots/{timestamp}/specs/`

Only keep the last snapshot per phase (overwrite previous).

#### Diff Command

```bash
respec diff                    # diff both analyzed and specs
respec diff --phase analyzed   # only .respec/analyzed/
respec diff --phase specs      # only specs/
```

Output format:

```
=== Spec Diff ===

  Modified: domain/bounded-contexts.md
    + Added "Payment" bounded context
    - Removed "Legacy Auth" context
    ~ 12 lines changed

  Added: api/webhooks-contract.md

  Unchanged: 8 files

  Summary: 1 modified, 1 added, 0 removed, 8 unchanged
```

#### Wizard Integration

After re-analyze or re-generate, menu shows "View diff" option.

### Files

- Create: `src/commands/diff.ts` — new command
- Create: `src/diff/snapshot.ts` — `takeSnapshot(sourceDir, snapshotDir)` and `getLatestSnapshot(phase)`
- Create: `src/diff/compare.ts` — `compareDirectories(oldDir, newDir)` returns file-level diff summary
- Modify: `src/commands/analyze.ts` — call `takeSnapshot` before running analyzers
- Modify: `src/commands/generate.ts` — call `takeSnapshot` before running generators
- Modify: `bin/respec.ts` — register `diff` command
- Modify: `src/wizard/menu.ts` — add "View diff" option after re-runs

---

## Feature 3: AI Reviewer

### Problem

Generated specs may contain hallucinations — claims not supported by the raw data. There's no automated validation step.

### Design

#### Command

```bash
respec review              # review specs against raw + analyzed data
respec review --verbose    # show detailed findings per section
```

#### Pipeline Position

Optional step after generate, before export:

```
ingest → analyze → generate → review (optional) → export
```

Not a required phase — doesn't block export. Produces a report file.

#### How It Works

1. Read `specs/sdd.md` (or all files in `specs/`)
2. Read all `.respec/raw/` files (ground truth)
3. Read all `.respec/analyzed/` files (intermediate analysis)
4. Send to AI with a reviewer prompt:
   - "Compare this SDD against the raw data. Identify: claims without evidence, raw data not covered, inconsistencies between analysis and spec"
5. Parse output into structured findings
6. Write `.respec/review-report.md`

#### Output

```
# Review Report

## Findings

### ⚠ Claims Without Evidence (3)
- Section 4 (Architecture): "The system uses event-driven messaging" — no evidence of message queues in raw data
- Section 6 (API): "Rate limiting is enforced at 1000 req/s" — no rate limit config found
- Section 9 (Security): "OAuth2 with PKCE flow" — only basic JWT auth detected

### ⚠ Raw Data Not Covered (2)
- POST /api/webhooks — endpoint found in raw but not in SDD
- CRON job `cleanup-expired-sessions` — found in raw but not documented

### ✓ Verified (12/14 entities match raw data)
### ✓ All 6 user flows traceable to raw endpoints
```

#### Wizard Integration

In `generated` state menu, add "Review specs" option (before export).

### Files

- Create: `src/commands/review.ts` — new command
- Create: `src/reviewers/spec-reviewer.ts` — prompt builder reads SDD + raw + analyzed
- Create: `prompts/spec-reviewer.md` — reviewer prompt template
- Modify: `bin/respec.ts` — register `review` command
- Modify: `src/wizard/menu.ts` — add "Review specs" to generated state

---

## What Does NOT Change

- Existing analyzer/generator logic (except adding override check and snapshot call)
- Config schema
- TUI system
- Multi-engine routing
- State manager (review doesn't change pipeline state)
