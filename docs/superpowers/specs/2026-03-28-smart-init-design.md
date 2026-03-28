# Smart Init

## Problem

`respec init` generates a generic config with placeholder values ("my-project", "Describe your project here"). Users always have to manually edit it. The project directory already contains enough information to generate a useful config automatically.

## Detection: Current Project

Read manifest files to extract project metadata:

| File | Extracts |
|------|----------|
| `package.json` | name, description, version, scripts (detect framework) |
| `go.mod` | module name |
| `pyproject.toml` | name, description, version |
| `Cargo.toml` | name, description, version |
| `composer.json` | name, description |
| Directory basename | Fallback name if no manifest found |

Additionally:
- Scan for source root (`src/`, `lib/`, `app/`, `packages/`) → set `include` patterns
- Read `.gitignore` patterns → merge into `exclude` (node_modules, dist, build, etc.)
- Detect common framework files (next.config, vite.config, angular.json) for description enrichment

## Detection: Sibling Repos

Scan parent directory (`../`) for directories that contain a manifest file (package.json, go.mod, etc.). For each sibling:

- Extract name from manifest (fallback to dirname)
- Infer role from name patterns:

| Name pattern | Role |
|-------------|------|
| Contains `backend`, `api`, `server` | `api_provider` |
| Contains `frontend`, `web`, `client`, `admin` | `frontend` |
| Contains `mobile`, `app`, `ios`, `android` | `mobile` |
| Contains `shared`, `common`, `lib`, `types` | `shared_types` |
| Contains `infra`, `deploy`, `ops` | `infra` |
| Contains `design`, `ui-kit`, `storybook` | `design_system` |
| Default | `reference` |

Skip the current directory and any directory without a manifest.

## CLI Mode (`respec init`)

Detects everything, generates the YAML with real values. Context sources included directly (not as comments). No prompts — just generates.

```yaml
project:
  name: docupaint-web-admin
  description: "React + TypeScript admin panel (Vite)"

sources:
  repo:
    path: ./
    include: ["src/**"]
    exclude: ["node_modules/**", "dist/**"]

  context:
    - name: docupaint-backend
      path: ../docupaint-backend
      role: api_provider
    - name: docupaint-app
      path: ../docupaint-app
      role: mobile

ai:
  engines:
    claude: {}
  max_parallel: 4
  timeout: 600

output:
  dir: ./specs
  format: openspec
  diagrams: mermaid
  tasks: true
```

## Wizard Mode (`respec` → Init)

Interactive step-by-step with clack. Each field pre-filled with detected values, editable by the user:

```
◇  Project name?
│  docupaint-web-admin              ← detected, editable

◇  Description?
│  React + TypeScript admin panel (Vite)  ← detected, editable

◇  Source include patterns?
│  src/**                           ← detected, editable

◇  Found 2 sibling repos. Add as context?
│  ☑ docupaint-backend (api_provider)
│  ☐ docupaint-app (mobile)

◇  Output format?
│  ● openspec
│  ○ kiro
│  ○ superpowers
│  ○ antigravity

✔  Created respec.config.yaml
```

## File Structure

```
src/init/
├── detect.ts       # detectProject(dir) → ProjectInfo
└── siblings.ts     # detectSiblings(dir) → SiblingRepo[]
```

### detect.ts

```typescript
interface ProjectInfo {
  name: string;
  description: string;
  version?: string;
  includes: string[];
  excludes: string[];
}

function detectProject(dir: string): ProjectInfo
```

Reads manifests in priority order: package.json → go.mod → pyproject.toml → Cargo.toml → composer.json → dirname fallback. Scans for source roots and gitignore patterns.

### siblings.ts

```typescript
interface SiblingRepo {
  name: string;
  path: string;            // relative path (e.g., ../docupaint-backend)
  role: string;            // inferred from name
  manifest: string;        // which manifest was found
}

function detectSiblings(dir: string): SiblingRepo[]
```

Reads parent directory, filters for directories with manifests, infers role from name patterns.

## Changes to Existing Code

- `src/commands/init.ts` — replace hardcoded config with `detectProject()` + `detectSiblings()` results
- `src/wizard/index.ts` — the `init` action in wizard mode calls interactive init flow instead of `runInit`

## What Does NOT Change

- Config schema (output is the same YAML shape)
- All other commands
- Behavior when `respec.config.yaml` already exists (still skips)
