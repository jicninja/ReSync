# Push to Jira

## Problem

After `respec generate` produces `specs/tasks/epics.md` with structured epics and stories, users have to manually create these in Jira. This is tedious for large refactoring projects with dozens of stories.

## Command

```bash
respec push jira                              # create epics + stories
respec push jira --epics-only                 # only epics
respec push jira --project NEWPROJ            # specific target project
respec push jira --prefix "[Migration v2]"    # custom prefix (default: [ReSpec])
respec push jira --dry-run                    # preview without creating
```

## Flow

1. Read `specs/tasks/epics.md` (output of task-gen)
2. Parse markdown to typed structure: `Epic[]` with `Story[]` children
3. Read Jira credentials from `respec.config.yaml` (`sources.jira.host`, `sources.jira.auth`)
4. Resolve target project: `--project` flag > first project in `jira.filters.projects`
5. For each epic:
   - Create issue type Epic in Jira with prefixed title, description, acceptance criteria
   - Add label `respec` to the issue
   - For each story (unless `--epics-only`):
     - Create issue type Story linked to the epic parent
     - Add label `respec`
6. Print summary: "Created 5 epics, 23 stories in PROJ"

## Prefix and Label

- Default prefix: `[ReSpec]` — prepended to every issue title
- Custom prefix via `--prefix` flag
- Label `respec` added to all issues — enables JQL filtering: `labels = respec`

Examples:
```
[ReSpec] User Authentication          ← epic title
[ReSpec] Login form                   ← story title
```

## Epic/Story Parser

The `task-gen` produces markdown like:

```markdown
# Epics

## EPIC-001: User Authentication
- Description: Implement auth system
- Acceptance Criteria: Users can log in, reset password
- Complexity: M

### Stories

#### STORY-001: Login form
- As a user, I want to log in so that I can access the dashboard
- Acceptance criteria:
  - Email + password fields
  - Validation errors shown
- Technical notes: Use existing auth API
```

The parser extracts this to:

```typescript
interface Epic {
  id: string;           // "EPIC-001"
  title: string;        // "User Authentication"
  description: string;
  acceptanceCriteria: string;
  complexity: string;   // "S" | "M" | "L" | "XL"
  stories: Story[];
}

interface Story {
  id: string;           // "STORY-001"
  title: string;        // "Login form"
  userStory: string;    // "As a user, I want to..."
  acceptanceCriteria: string;
  technicalNotes: string;
}
```

Parser is tolerant — handles variations in markdown formatting.

## Dry Run

`--dry-run` shows a preview without touching Jira:

```
DRY RUN — would create in PROJ:

  [ReSpec] EPIC-001: User Authentication (M)
    [ReSpec] Login form
    [ReSpec] Password reset
    [ReSpec] Session management

  [ReSpec] EPIC-002: Dashboard (L)
    [ReSpec] Overview widget
    [ReSpec] Activity feed

  Total: 2 epics, 5 stories
  Label: respec
```

## Wizard Integration

In `generated` state, after "Review specs":

```
◇  What's next?
│  ○ Export to format
│  ○ Review specs
│  ● Push to Jira
│  ○ View diff
│  ...
```

When selected, asks for project and prefix interactively:

```
◇  Jira project key?
│  PROJ                    ← from config, editable

◇  Issue prefix?
│  [ReSpec]                ← default, editable

◇  What to create?
│  ● Epics + Stories
│  ○ Epics only
```

## File Structure

```
src/push/
├── epic-parser.ts         # parseEpics(markdown) → Epic[]
├── jira-pusher.ts         # createEpic, createStory — uses jira.js
└── index.ts               # runPushJira() orchestrates parse → create
```

- `src/commands/push.ts` — command handler
- Modify: `bin/respec.ts` — register `push` command
- Modify: `src/wizard/menu.ts` — add "Push to Jira" in generated state
- Modify: `src/wizard/index.ts` — add push case

## Credentials

Reuses `sources.jira` from `respec.config.yaml`:
- `host` — Jira instance URL
- `auth` — `env:JIRA_API_TOKEN` (resolved via `resolveEnvAuth`)

If `sources.jira` is not configured, the command errors with: "Jira not configured in respec.config.yaml. Add sources.jira with host and auth."

## What Does NOT Change

- Jira ingestor (only reads, never writes)
- task-gen (produces markdown as always)
- Pipeline, orchestrator, AI adapters
- Config schema (no new fields)
