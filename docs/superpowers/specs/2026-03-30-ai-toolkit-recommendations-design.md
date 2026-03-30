# AI Toolkit Recommendations

## Overview

After ReSpec analyzes a codebase and generates specs, it recommends and optionally installs AI tools (MCP servers, skills, plugins, extensions) tailored to the detected stack and chosen export format. Recommendations are AI-driven with post-validation, not a static registry.

## Architecture

### Pipeline Integration

toolkit-gen runs as a standard generator in tier 3 of `respec generate`, parallel with task-gen and format-gen:

```
respec generate
  Tier 1: erd-gen, flow-gen, adr-gen (parallel)
  Tier 2: sdd-gen (sequential)
  Tier 3: task-gen, format-gen, toolkit-gen (parallel)
            ↓
  Output: .respec/generated/toolkit/recommendations.json
```

Post-export, the install wizard reads recommendations.json and offers to install approved tools.

```
respec export --format <format>
  1. Format adapter generates output (existing behavior)
  2. Export command reads recommendations.json from generatedDir
  3. Export command runs post-export install wizard (format-agnostic)
```

### Format-Agent Mapping

The export format signals which agent ecosystem the user works in:

| Format | Agent ID | Multi-agent? |
|--------|----------|-------------|
| superpowers | `claude` | No |
| antigravity | `gemini` | No |
| kiro | `kiro` | Yes, if cc-sdd installed |
| openspec | `*` (all) | Yes |
| speckit | `copilot` | No |
| bmad | `bmad` | Depends |

Canonical agent identifiers: `claude`, `gemini`, `kiro`, `copilot`, `cursor`, `bmad`. These are the valid values for the `agents` array in recommendations. The export format maps to one or more agent IDs via the table above. toolkit-gen includes the target format in its prompt so the AI engine prioritizes relevant agents, but all recommendations are returned — filtering happens at display time in the wizard.

## toolkit-gen: Generator Definition

### Registry Entry

```typescript
{
  id: 'toolkit-gen',
  reads: [
    'domain/bounded-contexts.md',     // complexity signal
    'infra/architecture.md',           // infra patterns
  ],
  produces: ['toolkit/recommendations.json'],
  tier: 3,
}
```

**rawDir access**: toolkit-gen is the first generator that reads from the raw phase. To support this cleanly, add an optional `rawDir?: string` field to `GeneratorContext` in `src/generators/types.ts`. In `src/commands/generate.ts`, add `rawDir: rawDir(dir)` (from `src/utils/fs.ts`) to the `generatorCtx` object where it is constructed. `buildToolkitPrompt` must guard against `ctx.rawDir` being `undefined` (graceful degradation: skip dependency data, produce recommendations based on analyzed files only). The `reads` array only declares analyzed-phase paths (per convention) — the raw dependency on `raw/repo/dependencies.md` is accessed via `ctx.rawDir` and documented here as a known deviation from the standard generator contract.

A `buildToolkitPrompt` function must be registered in the `PROMPT_BUILDERS` map in `src/commands/generate.ts`.

### Generator Flow

1. **Collect context**: prompt builder reads dependencies from rawDir, architecture and bounded contexts from analyzedDir, plus `config.output.format`
2. **Build prompt**: ask AI engine to recommend MCPs, skills, plugins, extensions as structured JSON given the detected stack and target agent ecosystem
3. **AI engine returns** text response containing JSON (possibly wrapped in code fences)
4. **Parse JSON**: extract JSON from AI response (strip markdown fences if present), validate against expected schema. If parsing fails, log warning and produce empty recommendations file.
5. **Validate packages**: for each recommendation with a `package` field, run `npm view <package>` with `TOOLKIT_VALIDATE_TIMEOUT` (default 5s) per call, up to `TOOLKIT_VALIDATE_CONCURRENCY` (default 10) concurrent. Mark `validated: true|false`. If npm is not available, skip validation and mark all as `validated: null` (unknown). Constants defined in `src/constants.ts` under a `// ── Toolkit ──` section, per project convention.
6. **Write** `.respec/generated/toolkit/recommendations.json` — note: `writeMarkdown()` in `src/utils/fs.ts` is just `ensureDir` + `writeFileSync` with no Markdown-specific transformation, so it works fine for JSON content. No conditional path needed. If `recommendations.json` exists but contains invalid JSON when read later (e.g., truncated write), treat as missing and log a warning.

### Prompt Strategy

The prompt provides:
- Concrete dependency list (not asking the LLM to guess)
- Target format and whether multi-agent
- Output JSON schema (strict, with examples)
- Instruction: "only recommend tools you know with certainty, include exact npm package name or URL"
- Instruction: "return ONLY valid JSON, no markdown wrapping" (with fallback extraction if the AI wraps anyway)

The `--only toolkit-gen` flag works as expected, allowing re-generation of just the recommendations without re-running the full spec suite.

## recommendations.json Schema

```jsonc
{
  "stack": {
    "detected": ["nextjs", "prisma", "expo", "typescript"],
    "format": "superpowers",
    "multiAgent": false
  },
  "recommendations": [
    {
      "type": "mcp",
      "name": "prisma-mcp",
      "package": "@prisma/mcp-server",
      "description": "Database introspection and query assistance",
      "reason": "Prisma detected in dependencies",
      "install": {
        "method": "mcp-config",
        "config": {
          "command": "npx",
          "args": ["@prisma/mcp-server"]
        }
      },
      "validated": true,
      "agents": ["claude", "gemini", "cursor"],
      "category": "database"
    },
    {
      "type": "skill",
      "name": "db-migrations",
      "package": "superpowers-skills-db",
      "description": "Database migration workflows",
      "reason": "Prisma + relational DB detected",
      "install": {
        "method": "npm",
        "command": "npm install -g superpowers-skills-db"
      },
      "validated": true,
      "agents": ["claude"],
      "category": "database"
    },
    {
      "type": "extension",
      "name": "Prisma VS Code",
      "package": "Prisma.prisma",
      "description": "Prisma schema syntax highlighting and linting",
      "reason": "Prisma detected in dependencies",
      "install": {
        "method": "manual",
        "instructions": "Install 'Prisma' extension from VS Code marketplace (Prisma.prisma)"
      },
      "validated": true,
      "agents": ["cursor"],
      "category": "database"
    }
  ],
  "workflowGuidance": {
    "complexity": "medium",
    "suggestedWorkflow": "spec-driven with domain decomposition",
    "reason": "3 bounded contexts detected, mobile + web targets"
  }
}
```

### Field Semantics

- **type**: `mcp` | `skill` | `plugin` | `extension`
- **name**: human-readable identifier
- **package**: npm package name, marketplace ID, or install target
- **description**: one-line summary
- **reason**: why this was recommended (ties back to detected stack)
- **install**: type-specific install instructions (see Install Object below)
- **validated**: `true` (npm view passed), `false` (npm view failed), `null` (validation skipped, e.g. npm unavailable)
- **agents**: canonical agent IDs this tool supports (`claude`, `gemini`, `kiro`, `copilot`, `cursor`, `bmad`)
- **category**: grouping for wizard display (database, frontend, testing, devops, etc.)

### Install Object

The `install` field varies by recommendation type:

| Method | Used for | Fields |
|--------|----------|--------|
| `mcp-config` | MCPs | `config: { command, args, env? }` — ready to inject into agent's MCP config file |
| `npm` | Skills, plugins | `command: string` — full npm install command to run |
| `copy` | Skills | `source: string, target: string` — file copy instructions |
| `manual` | Extensions, plugins | `instructions: string` — human-readable setup steps |

### workflowGuidance

This top-level field surfaces in two places:
1. **In the wizard**: shown as a summary before the tool recommendations ("Suggested workflow: spec-driven with domain decomposition")
2. **In format adapter output**: injected as a section in CLAUDE.md / AGENTS.md alongside tool recommendations

## TypeScript Types

```typescript
interface ToolkitRecommendations {
  stack: {
    detected: string[];
    format: string;
    multiAgent: boolean;
  };
  recommendations: Recommendation[];
  workflowGuidance: {
    complexity: 'simple' | 'medium' | 'complex';
    suggestedWorkflow: string;
    reason: string;
  };
}

interface Recommendation {
  type: 'mcp' | 'skill' | 'plugin' | 'extension';
  name: string;
  package: string;
  description: string;
  reason: string;
  install: McpInstall | NpmInstall | CopyInstall | ManualInstall;
  validated: boolean | null;
  agents: AgentId[];
  category: string;
}

type AgentId = 'claude' | 'gemini' | 'kiro' | 'copilot' | 'cursor' | 'bmad';

interface McpInstall {
  method: 'mcp-config';
  config: { command: string; args: string[]; env?: Record<string, string> };
}

interface NpmInstall {
  method: 'npm';
  command: string;
}

interface CopyInstall {
  method: 'copy';
  source: string;
  target: string;
}

interface ManualInstall {
  method: 'manual';
  instructions: string;
}
```

## Post-Export Install Wizard

Lives in `src/toolkit/wizard.ts` as a standalone module. Called from `src/commands/export.ts` after `adapter.package()` returns. This is format-agnostic — the same wizard runs regardless of which format adapter was used.

### Export Command Integration

```typescript
// In src/commands/export.ts, after adapter.package():
// autoMode comes from options.auto (CLI flag), not from FormatContext
// ciMode comes from options.ci (CLI flag)
const recommendations = readRecommendations(generatedDir);
if (recommendations) {
  await runToolkitWizard(recommendations, {
    format,
    ciMode: !!options.ci,
    autoMode: !!options.auto,
  });
}
```

### Display Format

```
✓ Exported superpowers format to project root

Suggested workflow: spec-driven with domain decomposition
  (3 bounded contexts, mobile + web targets)

AI Toolkit Recommendations for your stack
─────────────────────────────────────────

Database (2 tools)
├── ☐ @prisma/mcp-server — DB introspection and queries
└── ☐ superpowers-skills-db — Migration workflows

Frontend (1 tool)
└── ☐ @vercel/mcp-server — Deployment and preview

⚠ Not verified (1)
└── ☐ expo-dev-tools-mcp — Mobile debugging [unverified]

? Install recommendations
❯ Select individually
  Yes to all
  Yes to all verified only
  Skip
```

### Mode Behavior

| Mode | Behavior |
|------|----------|
| **Wizard (interactive)** | Shows list grouped by category, offers: select individually / yes to all / yes verified only / skip |
| **Autopilot** | Installs all verified, skips unverified, logs decisions to `_decisions.md` |
| **CI** | Generates config files only (mcp.json, etc.), never runs npm install |

### Install Actions by Method

- **mcp-config**: write entry to agent config file (`.claude/settings.json` for claude, `.cursor/mcp.json` for cursor, etc.)
- **npm**: run the install command via child_process
- **copy**: copy files to target directory
- **manual**: print instructions to terminal
- **API keys needed**: leave placeholder in config + warning (`⚠ Set DATABASE_URL in .env`)

### Edge Cases

- **No recommendations returned**: skip wizard, log "No toolkit recommendations generated"
- **All fail validation**: show all as unverified, wizard still offers to install with warning
- **npm not available**: all marked `validated: null`, wizard shows them without verified/unverified distinction
- **recommendations.json missing**: skip wizard silently (generator may not have run, e.g. `--only sdd-gen`)

### Interactive Selection

"Select individually" uses `@clack/prompts` multiselect, consistent with existing ReSpec wizard patterns.

## FormatContext Integration

A new optional field is added to FormatContext:

```typescript
interface FormatContext {
  // existing fields unchanged
  toolkitRecommendations?: ToolkitRecommendations;
}
```

**Population**: the export command in `src/commands/export.ts` reads `recommendations.json` from `generatedDir`, deserializes it into `ToolkitRecommendations`, and passes it as part of the `context` object to `adapter.package()`. If the file doesn't exist, the field is `undefined`.

Each format adapter decides how to use recommendations:

| Format | v1 behavior |
|--------|-------------|
| **superpowers** | "Recommended MCPs" section in CLAUDE.md + install skills to `skills/` |
| **openspec** | Section in AGENTS.md + universal `mcp.json` + per-agent configs |
| **antigravity** | Receives field, no processing (v2) |
| **kiro** | Receives field, no processing (v2) |
| **speckit** | Receives field, no processing (v2) |
| **bmad** | Receives field, no processing (v2) |

## v1 Scope

### Included

- toolkit-gen as tier 3 generator with `buildToolkitPrompt` in PROMPT_BUILDERS
- AI-driven recommendations with npm validation (5s timeout, 10 concurrent)
- JSON output handling in generator runner (conditional path for .json producers)
- recommendations.json schema with typed install objects
- ToolkitRecommendations TypeScript types
- Post-export wizard in `src/toolkit/wizard.ts` (select individually, yes to all, skip)
- Autopilot installs all verified
- CI generates configs only
- Recommendation injection in superpowers and openspec format adapters
- FormatContext.toolkitRecommendations available to all adapters
- `--only toolkit-gen` support (inherited from existing generate command)

### v2 (future)

- `respec toolkit` standalone command (no pipeline required)
- Recommendation injection in antigravity, kiro, speckit, bmad adapters
- Stack recipes (technology combinations trigger extra recommendations)
- npm validation cache
- User overrides in config (`toolkit.ignore` / `toolkit.always`)
- Live marketplace search (npm search, GitHub topics)
- Detect already-installed MCPs/tools to avoid duplicates

### Out of scope

- Programmatic IDE extension installation
- Hardware/infrastructure recommendations
