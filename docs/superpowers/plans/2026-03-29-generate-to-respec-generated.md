# Move Generate Output to .respec/generated/ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move generate output from `specs/` to `.respec/generated/` so all pipeline intermediates live in the hidden `.respec/` directory, and `export` is the only command that produces visible, format-specific output at the project root.

**Architecture:** `generate` writes raw specs (sdd.md, adrs, flows, etc.) to `.respec/generated/`. Format adapters are removed from `generate` — they only run via `export`. All commands that read specs (review, push, diff) now read from `.respec/generated/`. The `output.dir` config field is removed since the generate output location is fixed.

**Tech Stack:** TypeScript (ESM), Vitest, Commander

---

### Task 1: Add GENERATED_DIR_NAME constant and generatedDir helper

**Files:**
- Modify: `src/constants.ts:5` (change DEFAULT_OUTPUT_DIR)
- Modify: `src/constants.ts:13` (add GENERATED_DIR_NAME)
- Modify: `src/utils/fs.ts:3` (import new constant)
- Modify: `src/utils/fs.ts:26-28` (replace specsDir with generatedDir)
- Test: `tests/config/schema.test.ts:29`

- [ ] **Step 1: Write the failing test**

In `tests/utils/fs.test.ts` (create new file):

```typescript
import { describe, it, expect } from 'vitest';
import { generatedDir } from '../../src/utils/fs.js';

describe('generatedDir', () => {
  it('returns .respec/generated path', () => {
    expect(generatedDir('/project')).toBe('/project/.respec/generated');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/utils/fs.test.ts`
Expected: FAIL — `generatedDir` not exported

- [ ] **Step 3: Update constants and fs utility**

In `src/constants.ts`, change:
```typescript
export const DEFAULT_OUTPUT_DIR = './specs';
```
to:
```typescript
export const DEFAULT_OUTPUT_DIR = '.respec/generated';
```

And add after line 13 (`ANALYZED_DIR_NAME`):
```typescript
export const GENERATED_DIR_NAME = 'generated';
```

In `src/utils/fs.ts`, add import for `GENERATED_DIR_NAME`, then replace the `specsDir` function:
```typescript
export function generatedDir(projectDir: string): string {
  return path.join(projectDir, RESPEC_DIR, GENERATED_DIR_NAME);
}

/** @deprecated Use generatedDir() — kept for backwards compat during migration */
export function specsDir(projectDir: string, outputDir: string): string {
  return path.resolve(projectDir, outputDir);
}
```

- [ ] **Step 4: Update schema test**

In `tests/config/schema.test.ts:29`, update the expected default:
```typescript
expect(data.output.dir).toBe('.respec/generated');
```

- [ ] **Step 5: Run tests to verify**

Run: `npx vitest run tests/utils/fs.test.ts tests/config/schema.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/constants.ts src/utils/fs.ts tests/utils/fs.test.ts tests/config/schema.test.ts
git commit -m "refactor: add generatedDir helper, update DEFAULT_OUTPUT_DIR to .respec/generated"
```

---

### Task 2: Update generate command to use generatedDir and remove format adapter call

**Files:**
- Modify: `src/commands/generate.ts:9` (import generatedDir instead of specsDir)
- Modify: `src/commands/generate.ts:64` (use generatedDir)
- Modify: `src/commands/generate.ts:139-158` (remove format adapter block)

- [ ] **Step 1: Update generate.ts imports**

Replace:
```typescript
import { analyzedDir, specsDir, writeMarkdown } from '../utils/fs.js';
```
with:
```typescript
import { analyzedDir, generatedDir, writeMarkdown } from '../utils/fs.js';
```

Remove unused imports that were only needed for the format adapter call:
```typescript
import { createFormatAdapter } from '../formats/factory.js';
```

- [ ] **Step 2: Update outputDir resolution**

Replace line 64:
```typescript
const outputDir = specsDir(dir, config.output.dir);
```
with:
```typescript
const outputDir = generatedDir(dir);
```

- [ ] **Step 3: Remove format adapter block**

Delete lines 139-158 (the entire "Now run the format adapter" block):
```typescript
// Now run the format adapter to package the generated specs
tui.progress(`Packaging as ${format}...`);
const adapter = createFormatAdapter(format);

const sddPath = path.join(outputDir, 'sdd.md');
const sddContent = fs.existsSync(sddPath)
  ? fs.readFileSync(sddPath, 'utf-8')
  : '';

const formatContext = {
  projectName: config.project.name,
  projectDescription: config.project.description ?? '',
  sddContent,
  analyzedDir: analyzedPath,
  specsDir: outputDir,
  config,
  ciMode: !!options.ci,
};

await adapter.package(outputDir, outputDir, formatContext);
tui.success(`Packaged as ${format}`);
```

Also remove `format` from the `const format = config.output.format;` line and the TUI header that references it — actually keep `format` in state since `state.completeGenerate` uses it. Just remove the adapter call and its TUI messages.

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS (all 343 tests)

- [ ] **Step 5: Commit**

```bash
git add src/commands/generate.ts
git commit -m "refactor: generate writes to .respec/generated, no longer runs format adapter"
```

---

### Task 3: Update export command to read from generatedDir

**Files:**
- Modify: `src/commands/export.ts:5` (import generatedDir)
- Modify: `src/commands/export.ts:19-22` (use generatedDir for input, project root for output)

- [ ] **Step 1: Update export.ts**

Replace:
```typescript
import { analyzedDir, specsDir } from '../utils/fs.js';
```
with:
```typescript
import { analyzedDir, generatedDir } from '../utils/fs.js';
```

Replace the inputDir/outputDir block:
```typescript
const inputDir = specsDir(dir, config.output.dir);
const outputDir = options.output
  ? path.resolve(dir, options.output)
  : dir;
```
with:
```typescript
const inputDir = generatedDir(dir);
const outputDir = options.output
  ? path.resolve(dir, options.output)
  : dir;
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/commands/export.ts
git commit -m "refactor: export reads from .respec/generated, outputs to project root"
```

---

### Task 4: Update review, push, and diff commands

**Files:**
- Modify: `src/commands/review.ts:6` (import generatedDir)
- Modify: `src/commands/review.ts:39` (use generatedDir)
- Modify: `src/commands/push.ts:5` (import generatedDir)
- Modify: `src/commands/push.ts:25` (use generatedDir)
- Modify: `src/commands/diff.ts:5` (import generatedDir)
- Modify: `src/commands/diff.ts:27` (use generatedDir)

- [ ] **Step 1: Update review.ts**

Replace:
```typescript
import { rawDir, analyzedDir, specsDir, writeMarkdown } from '../utils/fs.js';
```
with:
```typescript
import { rawDir, analyzedDir, generatedDir, writeMarkdown } from '../utils/fs.js';
```

Replace:
```typescript
const specsPath = specsDir(dir, config.output.dir);
```
with:
```typescript
const specsPath = generatedDir(dir);
```

- [ ] **Step 2: Update push.ts**

Replace:
```typescript
import { specsDir } from '../utils/fs.js';
```
with:
```typescript
import { generatedDir } from '../utils/fs.js';
```

Replace:
```typescript
const outputDir = specsDir(dir, config.output.dir);
```
with:
```typescript
const outputDir = generatedDir(dir);
```

- [ ] **Step 3: Update diff.ts**

Replace:
```typescript
import { analyzedDir, specsDir } from '../utils/fs.js';
```
with:
```typescript
import { analyzedDir, generatedDir } from '../utils/fs.js';
```

Replace:
```typescript
const config = await loadConfig(dir);
currentDir = specsDir(dir, config.output.dir);
```
with:
```typescript
currentDir = generatedDir(dir);
```

Also remove the now-unused `loadConfig` import and call in the specs branch (it was only needed to get `config.output.dir`).

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/review.ts src/commands/push.ts src/commands/diff.ts
git commit -m "refactor: review, push, diff read from .respec/generated"
```

---

### Task 5: Update generator types and task-gen

**Files:**
- Modify: `src/generators/types.ts:10` (rename specsDir to generatedDir in type)
- Modify: `src/generators/task-gen.ts:11` (update property access)
- Modify: `src/commands/generate.ts:68` (update property name in context object)

- [ ] **Step 1: Update GeneratorContext type**

In `src/generators/types.ts`, rename:
```typescript
specsDir: string;
```
to:
```typescript
generatedDir: string;
```

- [ ] **Step 2: Update task-gen.ts**

Replace:
```typescript
const sddContent = readFile(path.join(ctx.specsDir, 'sdd.md'));
```
with:
```typescript
const sddContent = readFile(path.join(ctx.generatedDir, 'sdd.md'));
```

- [ ] **Step 3: Update generate.ts context object**

In `src/commands/generate.ts`, update the generatorCtx object:
```typescript
const generatorCtx: GeneratorContext = {
  analyzedDir: analyzedPath,
  generatedDir: outputDir,
  projectName: config.project.name,
  format,
};
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/generators/types.ts src/generators/task-gen.ts src/commands/generate.ts
git commit -m "refactor: rename specsDir to generatedDir in GeneratorContext"
```

---

### Task 6: Update format adapter interface and all format tests

**Files:**
- Modify: `src/formats/types.ts:5` (rename specsDir to generatedDir in FormatContext)
- Modify: `src/commands/export.ts:37` (update property name)
- Modify: `tests/formats/openspec.test.ts:24`
- Modify: `tests/formats/superpowers.test.ts:24`
- Modify: `tests/formats/antigravity.test.ts:24`
- Modify: `tests/formats/kiro.test.ts:25`
- Modify: `tests/formats/speckit.test.ts:30`
- Modify: `tests/formats/bmad.test.ts:31`

- [ ] **Step 1: Update FormatContext type**

In `src/formats/types.ts`, rename:
```typescript
specsDir: string;
```
to:
```typescript
generatedDir: string;
```

- [ ] **Step 2: Update export.ts context creation**

In `src/commands/export.ts`, update the context object:
```typescript
const context = {
  projectName: config.project.name,
  projectDescription: config.project.description ?? '',
  sddContent,
  analyzedDir: analyzedPath,
  generatedDir: inputDir,
  config,
  ciMode: !!options.ci,
};
```

- [ ] **Step 3: Update all format tests**

In each test file, replace `specsDir: ''` with `generatedDir: ''`:
- `tests/formats/openspec.test.ts:24`
- `tests/formats/superpowers.test.ts:24`
- `tests/formats/antigravity.test.ts:24`
- `tests/formats/kiro.test.ts:25`
- `tests/formats/speckit.test.ts:30`
- `tests/formats/bmad.test.ts:31`

- [ ] **Step 4: Check if any format adapter reads specsDir**

Grep for `context.specsDir` or `specsDir` in format adapter files. Update any references to use `context.generatedDir`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/formats/types.ts src/commands/export.ts tests/formats/
git commit -m "refactor: rename specsDir to generatedDir in FormatContext and tests"
```

---

### Task 7: Remove output.dir from config schema

**Files:**
- Modify: `src/config/schema.ts:152-153` (remove dir field from outputSchema)
- Modify: `src/constants.ts:5` (remove DEFAULT_OUTPUT_DIR)
- Modify: `src/wizard/init-flow.ts:12,201` (remove DEFAULT_OUTPUT_DIR usage)
- Modify: `tests/config/schema.test.ts` (remove dir assertion)
- Modify: `tests/config/loader.test.ts:47` (remove dir assertion)

- [ ] **Step 1: Remove dir from outputSchema**

In `src/config/schema.ts`, remove the `dir` field from `outputSchema`:
```typescript
const outputSchema = z.object({
  format: outputFormatEnum.default(DEFAULT_OUTPUT_FORMAT),
  diagrams: z.enum(['mermaid', 'none']).default(DEFAULT_DIAGRAM_TYPE),
  tasks: z.boolean().default(true),
  speckit: speckitMappingSchema,
});
```

Remove `DEFAULT_OUTPUT_DIR` from the import.

- [ ] **Step 2: Remove DEFAULT_OUTPUT_DIR from constants**

In `src/constants.ts`, delete:
```typescript
export const DEFAULT_OUTPUT_DIR = '.respec/generated';
```

- [ ] **Step 3: Update init-flow.ts**

In `src/wizard/init-flow.ts`, remove `DEFAULT_OUTPUT_DIR` from import and replace usage at line 201. The output config should only set `format`:
```typescript
output: {
  format: outputFormat as OutputFormat,
  diagrams: 'mermaid' as const,
  tasks: true,
},
```

- [ ] **Step 4: Update tests**

In `tests/config/schema.test.ts`, remove the assertion:
```typescript
expect(data.output.dir).toBe('./specs');
```

In `tests/config/loader.test.ts`, remove or update the assertion at line 47 about `output.dir`.

- [ ] **Step 5: Clean up remaining specsDir references**

Remove the deprecated `specsDir` function from `src/utils/fs.ts` if no longer used anywhere. Search for any remaining imports of `specsDir` and remove them.

- [ ] **Step 6: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/config/schema.ts src/constants.ts src/wizard/init-flow.ts src/utils/fs.ts tests/
git commit -m "refactor: remove output.dir config field, generate path is now fixed at .respec/generated"
```

---

### Task 8: Update CLAUDE.md and README.md documentation

**Files:**
- Modify: `CLAUDE.md` (update architecture diagram, file structure, config schema, output dirs)
- Modify: `README.md` (update any references to specs/ output dir)

- [ ] **Step 1: Update CLAUDE.md**

Key sections to update:
- Architecture diagram: `respec generate → produces specs → /.respec/generated/`
- Config Schema: remove `output.dir` field
- File Structure Phase 3: change `/specs/` to `/.respec/generated/`
- Add note that `respec export` produces format-specific output at project root
- Pipeline description: clarify generate vs export responsibilities

- [ ] **Step 2: Update README.md**

Update any references to `specs/` as the generate output directory.

- [ ] **Step 3: Run tests one final time**

Run: `npx vitest run`
Expected: PASS (all tests)

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update documentation for .respec/generated output directory"
```
