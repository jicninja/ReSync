# Internal Output Dir Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make internal ReSpec artifacts use an implicit `.respec/generated` default, while allowing optional `output.dir` overrides that only affect internal data; export output remains format-defined.

**Architecture:** Add a `generatedDir(projectDir, outputDir?)` helper with implicit `.respec/generated`, update commands to read/write from it, and make `output.dir` optional (no default) while still honoring it when provided. Remove format packaging from `generate` so only `export` writes visible format output.

**Tech Stack:** TypeScript (ESM), Vitest, Commander

---

## File Structure (targeted)

- `src/utils/fs.ts` — add `generatedDir()` helper; remove `specsDir()` after migration
- `src/constants.ts` — add `GENERATED_DIR_NAME`; remove `DEFAULT_OUTPUT_DIR`
- `src/commands/generate.ts` — write generated artifacts to `generatedDir`, remove format adapter run
- `src/commands/export.ts` — read from `generatedDir`, pass context field `generatedDir`
- `src/commands/review.ts` — read generated specs from `generatedDir`
- `src/commands/push.ts` — read tasks from `generatedDir`
- `src/commands/diff.ts` — compare generated output from `generatedDir`
- `src/generators/types.ts` — rename context field `specsDir` → `generatedDir`
- `src/generators/task-gen.ts` — read SDD from `generatedDir`
- `src/formats/types.ts` — rename context field `specsDir` → `generatedDir`
- `src/formats/speckit.ts` / `src/formats/bmad.ts` — read tasks from `context.generatedDir`
- `src/commands/init.ts` / `src/wizard/init-flow.ts` — stop emitting `output.dir` by default
- `src/config/schema.ts` — make `output.dir` optional (no default)
- Tests: `tests/utils/fs.test.ts`, `tests/config/schema.test.ts`, `tests/config/loader.test.ts`, `tests/formats/*.test.ts`

---

### Task 1: Add `generatedDir` helper (TDD)

**Files:**
- Create: `tests/utils/fs.test.ts`
- Modify: `src/constants.ts`
- Modify: `src/utils/fs.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/utils/fs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generatedDir } from '../../src/utils/fs.js';

describe('generatedDir', () => {
  it('uses implicit .respec/generated when outputDir is omitted', () => {
    expect(generatedDir('/project')).toBe('/project/.respec/generated');
  });

  it('resolves an explicit outputDir relative to project root', () => {
    expect(generatedDir('/project', './custom-specs')).toBe('/project/custom-specs');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/utils/fs.test.ts`
Expected: FAIL — `generatedDir` not exported

- [ ] **Step 3: Implement helper and constant**

Update `src/constants.ts` (add constant near other dir names):

```ts
export const GENERATED_DIR_NAME = 'generated';
```

Update `src/utils/fs.ts` (add helper, keep `specsDir` for now):

```ts
import { RESPEC_DIR, RAW_DIR_NAME, ANALYZED_DIR_NAME, GENERATED_DIR_NAME } from '../constants.js';

export function generatedDir(projectDir: string, outputDir?: string): string {
  if (outputDir) {
    return path.resolve(projectDir, outputDir);
  }
  return path.join(projectDir, RESPEC_DIR, GENERATED_DIR_NAME);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/utils/fs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts src/utils/fs.ts tests/utils/fs.test.ts
git commit -m "feat: add generatedDir helper with implicit .respec/generated"
```

---

### Task 2: Point commands at `generatedDir` and remove format packaging from `generate`

**Files:**
- Modify: `src/commands/generate.ts`
- Modify: `src/commands/export.ts`
- Modify: `src/commands/review.ts`
- Modify: `src/commands/push.ts`
- Modify: `src/commands/diff.ts`

- [ ] **Step 1: Update imports and path resolution**

`src/commands/generate.ts`:

```ts
import { analyzedDir, generatedDir, writeMarkdown } from '../utils/fs.js';
```

Replace:

```ts
const outputDir = specsDir(dir, config.output.dir);
```

With:

```ts
const outputDir = generatedDir(dir, config.output.dir);
```

`src/commands/export.ts`:

```ts
import { analyzedDir, generatedDir } from '../utils/fs.js';
```

Replace:

```ts
const inputDir = specsDir(dir, config.output.dir);
```

With:

```ts
const inputDir = generatedDir(dir, config.output.dir);
```

`src/commands/review.ts`:

```ts
import { rawDir, analyzedDir, generatedDir, writeMarkdown } from '../utils/fs.js';
```

Replace:

```ts
const specsPath = specsDir(dir, config.output.dir);
```

With:

```ts
const specsPath = generatedDir(dir, config.output.dir);
```

`src/commands/push.ts`:

```ts
import { generatedDir } from '../utils/fs.js';
```

Replace:

```ts
const outputDir = specsDir(dir, config.output.dir);
```

With:

```ts
const outputDir = generatedDir(dir, config.output.dir);
```

`src/commands/diff.ts`:

```ts
import { analyzedDir, generatedDir } from '../utils/fs.js';
```

Replace:

```ts
const config = await loadConfig(dir);
currentDir = specsDir(dir, config.output.dir);
```

With:

```ts
const config = await loadConfig(dir);
currentDir = generatedDir(dir, config.output.dir);
```

- [ ] **Step 2: Remove format adapter execution from generate**

In `src/commands/generate.ts`, delete the entire block that packages format output:

```ts
// Now run the format adapter to package the generated specs
// ... adapter.package(...) ...
```

Also remove the now-unused import:

```ts
import { createFormatAdapter } from '../formats/factory.js';
```

- [ ] **Step 3: Run targeted tests**

Run: `npx vitest run tests/utils/fs.test.ts tests/config/schema.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/commands/generate.ts src/commands/export.ts src/commands/review.ts src/commands/push.ts src/commands/diff.ts
git commit -m "refactor: commands use generatedDir; generate no longer packages formats"
```

---

### Task 3: Rename `GeneratorContext.specsDir` → `generatedDir`

**Files:**
- Modify: `src/generators/types.ts`
- Modify: `src/generators/task-gen.ts`
- Modify: `src/commands/generate.ts`

- [ ] **Step 1: Update GeneratorContext type**

`src/generators/types.ts`:

```ts
generatedDir: string;
```

- [ ] **Step 2: Update task-gen to use new field**

`src/generators/task-gen.ts`:

```ts
const sddContent = readFile(path.join(ctx.generatedDir, 'sdd.md'));
```

- [ ] **Step 3: Update generator context creation**

`src/commands/generate.ts`:

```ts
const generatorCtx: GeneratorContext = {
  analyzedDir: analyzedPath,
  generatedDir: outputDir,
  projectName: config.project.name,
  format,
};
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/utils/fs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/generators/types.ts src/generators/task-gen.ts src/commands/generate.ts
git commit -m "refactor: rename GeneratorContext.specsDir to generatedDir"
```

---

### Task 4: Rename `FormatContext.specsDir` → `generatedDir` and update adapters/tests

**Files:**
- Modify: `src/formats/types.ts`
- Modify: `src/commands/export.ts`
- Modify: `src/formats/speckit.ts`
- Modify: `src/formats/bmad.ts`
- Modify: `tests/formats/openspec.test.ts`
- Modify: `tests/formats/superpowers.test.ts`
- Modify: `tests/formats/antigravity.test.ts`
- Modify: `tests/formats/kiro.test.ts`
- Modify: `tests/formats/speckit.test.ts`
- Modify: `tests/formats/bmad.test.ts`

- [ ] **Step 1: Update FormatContext type**

`src/formats/types.ts`:

```ts
export interface FormatContext {
  projectName: string;
  projectDescription: string;
  sddContent: string;
  analyzedDir: string;
  generatedDir: string;
  config: ReSpecConfig;
  ciMode: boolean;
}
```

- [ ] **Step 2: Update export context object**

`src/commands/export.ts`:

```ts
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

- [ ] **Step 3: Update adapters to read tasks from generatedDir**

`src/formats/speckit.ts`:

```ts
const tasksContent = context.generatedDir
  ? readIfExists(path.join(context.generatedDir, 'tasks.md'))
  : '';
```

`src/formats/bmad.ts`:

```ts
const tasks = context.generatedDir
  ? readIfExists(path.join(context.generatedDir, 'tasks.md'))
  : '';
```

- [ ] **Step 4: Update format tests to use generatedDir**

Example change in each `tests/formats/*.test.ts`:

```ts
const context: FormatContext = {
  projectName: 'TestProject',
  projectDescription: 'A test project description',
  sddContent: '# System Design Document\n\nContent here.',
  analyzedDir: '',
  generatedDir: '',
  config: minimalConfig,
  ciMode: false,
};
```

- [ ] **Step 5: Run format tests**

Run: `npx vitest run tests/formats/openspec.test.ts tests/formats/speckit.test.ts tests/formats/bmad.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/formats/types.ts src/commands/export.ts src/formats/speckit.ts src/formats/bmad.ts tests/formats

git commit -m "refactor: rename FormatContext.specsDir to generatedDir"
```

---

### Task 5: Make `output.dir` optional (no default) and stop emitting it in init

**Files:**
- Modify: `src/config/schema.ts`
- Modify: `src/constants.ts`
- Modify: `src/commands/init.ts`
- Modify: `src/wizard/init-flow.ts`
- Modify: `tests/config/schema.test.ts`
- Modify: `tests/config/loader.test.ts`

- [ ] **Step 1: Update schema to remove default**

`src/config/schema.ts`:

```ts
const outputSchema = z.object({
  dir: z.string().optional(),
  format: outputFormatEnum.default(DEFAULT_OUTPUT_FORMAT),
  diagrams: z.enum(['mermaid', 'none']).default(DEFAULT_DIAGRAM_TYPE),
  tasks: z.boolean().default(true),
  speckit: speckitMappingSchema,
});
```

Also remove the `DEFAULT_OUTPUT_DIR` import.

- [ ] **Step 2: Remove `DEFAULT_OUTPUT_DIR` constant usage**

`src/constants.ts`: delete `DEFAULT_OUTPUT_DIR` export entirely.

`src/commands/init.ts` and `src/wizard/init-flow.ts`: remove `dir: DEFAULT_OUTPUT_DIR` from the `output` object so the generated YAML omits it.

- [ ] **Step 3: Update schema tests**

`tests/config/schema.test.ts`:

Replace:

```ts
expect(data.output.dir).toBe('./specs');
```

With:

```ts
expect(data.output.dir).toBeUndefined();
```

- [ ] **Step 4: Update loader tests**

`tests/config/loader.test.ts`:

In the “valid config” test, keep:

```ts
expect(config.output.dir).toBe('./my-specs');
```

In the “minimal config” test, add:

```ts
expect(config.output.dir).toBeUndefined();
```

- [ ] **Step 5: Run config tests**

Run: `npx vitest run tests/config/schema.test.ts tests/config/loader.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/config/schema.ts src/constants.ts src/commands/init.ts src/wizard/init-flow.ts tests/config

git commit -m "refactor: make output.dir optional and omit from init"
```

---

### Task 6: Remove `specsDir` helper and remaining references

**Files:**
- Modify: `src/utils/fs.ts`
- Modify: any file still referencing `specsDir`

- [ ] **Step 1: Verify remaining references**

Run: `rg -n "specsDir" src tests -S`
Expected: Only legacy docs or none in `src/` / `tests/`.

- [ ] **Step 2: Remove `specsDir` from fs utils (if unused)**

`src/utils/fs.ts`:

```ts
// Remove the specsDir() export entirely once no longer referenced.
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/fs.ts

git commit -m "refactor: remove specsDir helper"
```

---

## Self-Review Checklist

1. **Spec coverage:**
- `generatedDir` helper with implicit default and explicit override → Task 1
- Commands read/write from generated dir → Task 2
- Export uses format-defined output → Task 2
- Context field rename to `generatedDir` → Tasks 3–4
- `output.dir` optional and omitted from init → Task 5

2. **Placeholder scan:** No TBD/TODO placeholders.

3. **Type consistency:** `generatedDir` used consistently across GeneratorContext and FormatContext.

---

Plan complete and saved to `docs/superpowers/plans/2026-03-29-internal-output-dir.md`.

Two execution options:

1. Subagent-Driven (recommended)
2. Inline Execution

Which approach?
