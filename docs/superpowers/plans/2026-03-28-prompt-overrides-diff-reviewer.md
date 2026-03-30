# Prompt Overrides, Spec Diff & AI Reviewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add prompt overrides from project `prompts/` directory, spec diff with snapshots, and an AI reviewer that validates specs against raw data.

**Architecture:** Three independent features. Prompt overrides modify how analyze/generate load prompts. Spec diff adds snapshot-before-run + a compare command. AI reviewer adds a new pipeline step with its own prompt and command.

**Tech Stack:** Node.js fs, vitest, existing orchestrator/AI engine

---

## Part A: Prompt Overrides

### Task 1: Fix Analyzer Prompt Override + Add Subprocess Directive

**Files:**
- Modify: `src/commands/analyze.ts:99-108`
- Test: `tests/commands/analyze-prompts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/commands/analyze-prompts.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('analyzer prompt loading', () => {
  it('loads prompt override from project prompts/ dir by analyzer id', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-prompt-'));
    const promptsDir = path.join(tmpDir, 'prompts');
    fs.mkdirSync(promptsDir);
    fs.writeFileSync(path.join(promptsDir, 'domain-mapper.md'), 'CUSTOM PROMPT\n\n{{CONTEXT}}');

    // Test the loadPromptTemplate function
    const { loadPromptTemplate } = require('../../src/prompts/loader.js');
    const result = loadPromptTemplate('domain-mapper', tmpDir);
    expect(result).toContain('CUSTOM PROMPT');
    expect(result).toContain('subprocess');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('falls back to built-in prompt when no override exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-prompt-'));

    const { loadPromptTemplate } = require('../../src/prompts/loader.js');
    const result = loadPromptTemplate('domain-mapper', tmpDir);
    expect(result).toContain('{{CONTEXT}}');
    expect(result).toContain('subprocess');

    fs.rmSync(tmpDir, { recursive: true });
  });
});
```

- [ ] **Step 2: Create prompt loader module**

```typescript
// src/prompts/loader.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SUBPROCESS_DIRECTIVE = `IMPORTANT: You are running as a text-generation subprocess. Do NOT attempt to create files, use tools, or interact with any system. Your ONLY output is the raw Markdown text written to stdout. Everything you write goes directly into a single output file.\n\n`;

const BUILTIN_PROMPTS_DIR = join(import.meta.dirname ?? '.', '..', '..', 'prompts');

export function loadPromptTemplate(id: string, projectDir: string): string {
  // Check project override first
  const overridePath = join(projectDir, 'prompts', `${id}.md`);
  if (existsSync(overridePath)) {
    const content = readFileSync(overridePath, 'utf-8');
    return SUBPROCESS_DIRECTIVE + content;
  }

  // Fall back to built-in
  const builtinPath = join(BUILTIN_PROMPTS_DIR, `${id}.md`);
  if (existsSync(builtinPath)) {
    const content = readFileSync(builtinPath, 'utf-8');
    return SUBPROCESS_DIRECTIVE + content;
  }

  // Default generic template
  return SUBPROCESS_DIRECTIVE + `Analyze the following raw data and produce structured analysis output.\n\n{{CONTEXT}}`;
}
```

Note: `import.meta.dirname` is available in Node 21+. For the built-in prompts path, resolve relative to the compiled file at `dist/src/prompts/loader.js` → `../../prompts/`. Alternatively, use `fileURLToPath(import.meta.url)` + `dirname` like wizard/index.ts does.

- [ ] **Step 3: Update analyze.ts to use loader**

In `src/commands/analyze.ts`, replace lines 99-108:

```typescript
// Before:
let promptTemplate = `Analyze the following raw data and produce structured analysis output.\n\n{{CONTEXT}}`;
const promptFilePath = path.join(dir, 'prompts', path.basename(analyzer.promptFile));
if (fs.existsSync(promptFilePath)) {
  try {
    promptTemplate = fs.readFileSync(promptFilePath, 'utf-8');
  } catch {
    // fall back to default template
  }
}

// After:
import { loadPromptTemplate } from '../prompts/loader.js';
// ... (import at top of file)

const promptTemplate = loadPromptTemplate(analyzer.id, dir);
```

- [ ] **Step 4: Add generator prompt override**

In `src/commands/generate.ts`, update the prompt building section (~line 94-100):

```typescript
// Before:
const buildPrompt = PROMPT_BUILDERS[generator.id];
if (!buildPrompt) {
  throw new Error(`No prompt builder for generator "${generator.id}"`);
}
const prompt = buildPrompt(generatorCtx);

// After:
import { loadPromptTemplate } from '../prompts/loader.js';

// Check for override first
const overridePath = path.join(dir, 'prompts', `${generator.id}.md`);
let prompt: string;
if (fs.existsSync(overridePath)) {
  const template = loadPromptTemplate(generator.id, dir);
  // For generators, inject the analyzed content as context
  const analyzedContent = fs.readdirSync(analyzedPath)
    .filter(f => f.endsWith('.md'))
    .map(f => fs.readFileSync(path.join(analyzedPath, f), 'utf-8'))
    .join('\n\n---\n\n');
  prompt = template.replace('{{CONTEXT}}', analyzedContent);
} else {
  const buildPrompt = PROMPT_BUILDERS[generator.id];
  if (!buildPrompt) {
    throw new Error(`No prompt builder for generator "${generator.id}"`);
  }
  prompt = buildPrompt(generatorCtx);
}
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/prompts/loader.ts src/commands/analyze.ts src/commands/generate.ts tests/commands/analyze-prompts.test.ts
git commit -m "feat: prompt overrides from project prompts/ directory"
```

---

## Part B: Spec Diff

### Task 2: Snapshot Module

**Files:**
- Create: `src/diff/snapshot.ts`
- Test: `tests/diff/snapshot.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/diff/snapshot.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { takeSnapshot, getLatestSnapshot } from '../../src/diff/snapshot.js';

describe('takeSnapshot', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-snap-'));
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true }); });

  it('copies directory contents to snapshot', () => {
    const srcDir = path.join(tmpDir, 'source');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'file.md'), 'content');

    const snapDir = path.join(tmpDir, 'snapshots');
    takeSnapshot(srcDir, snapDir, 'analyzed');

    const snapshotPath = getLatestSnapshot(snapDir, 'analyzed');
    expect(snapshotPath).toBeTruthy();
    expect(fs.existsSync(path.join(snapshotPath!, 'file.md'))).toBe(true);
    expect(fs.readFileSync(path.join(snapshotPath!, 'file.md'), 'utf-8')).toBe('content');
  });

  it('overwrites previous snapshot for same phase', () => {
    const srcDir = path.join(tmpDir, 'source');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'v1.md'), 'first');

    const snapDir = path.join(tmpDir, 'snapshots');
    takeSnapshot(srcDir, snapDir, 'analyzed');

    fs.writeFileSync(path.join(srcDir, 'v2.md'), 'second');
    takeSnapshot(srcDir, snapDir, 'analyzed');

    const snapshotPath = getLatestSnapshot(snapDir, 'analyzed')!;
    expect(fs.existsSync(path.join(snapshotPath, 'v2.md'))).toBe(true);
  });

  it('returns null when no snapshot exists', () => {
    const snapDir = path.join(tmpDir, 'snapshots');
    const result = getLatestSnapshot(snapDir, 'analyzed');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Implement snapshot**

```typescript
// src/diff/snapshot.ts
import { existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export function takeSnapshot(sourceDir: string, snapshotsDir: string, phase: string): void {
  if (!existsSync(sourceDir)) return;

  const phaseSnapDir = join(snapshotsDir, phase);

  // Overwrite previous snapshot
  if (existsSync(phaseSnapDir)) {
    rmSync(phaseSnapDir, { recursive: true });
  }

  mkdirSync(phaseSnapDir, { recursive: true });
  cpSync(sourceDir, phaseSnapDir, { recursive: true });
}

export function getLatestSnapshot(snapshotsDir: string, phase: string): string | null {
  const phaseSnapDir = join(snapshotsDir, phase);
  if (!existsSync(phaseSnapDir)) return null;
  return phaseSnapDir;
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/diff/snapshot.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/diff/snapshot.ts tests/diff/snapshot.test.ts
git commit -m "feat: snapshot module for spec diff"
```

---

### Task 3: Compare Module

**Files:**
- Create: `src/diff/compare.ts`
- Test: `tests/diff/compare.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/diff/compare.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { compareDirectories } from '../../src/diff/compare.js';

describe('compareDirectories', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-diff-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true }); });

  it('detects modified files', () => {
    const oldDir = path.join(tmpDir, 'old');
    const newDir = path.join(tmpDir, 'new');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.mkdirSync(newDir, { recursive: true });
    fs.writeFileSync(path.join(oldDir, 'file.md'), 'old content');
    fs.writeFileSync(path.join(newDir, 'file.md'), 'new content');

    const result = compareDirectories(oldDir, newDir);
    expect(result.modified).toContain('file.md');
  });

  it('detects added files', () => {
    const oldDir = path.join(tmpDir, 'old');
    const newDir = path.join(tmpDir, 'new');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.mkdirSync(newDir, { recursive: true });
    fs.writeFileSync(path.join(newDir, 'new-file.md'), 'content');

    const result = compareDirectories(oldDir, newDir);
    expect(result.added).toContain('new-file.md');
  });

  it('detects removed files', () => {
    const oldDir = path.join(tmpDir, 'old');
    const newDir = path.join(tmpDir, 'new');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.mkdirSync(newDir, { recursive: true });
    fs.writeFileSync(path.join(oldDir, 'gone.md'), 'content');

    const result = compareDirectories(oldDir, newDir);
    expect(result.removed).toContain('gone.md');
  });

  it('detects unchanged files', () => {
    const oldDir = path.join(tmpDir, 'old');
    const newDir = path.join(tmpDir, 'new');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.mkdirSync(newDir, { recursive: true });
    fs.writeFileSync(path.join(oldDir, 'same.md'), 'same');
    fs.writeFileSync(path.join(newDir, 'same.md'), 'same');

    const result = compareDirectories(oldDir, newDir);
    expect(result.unchanged).toContain('same.md');
  });
});
```

- [ ] **Step 2: Implement compare**

```typescript
// src/diff/compare.ts
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface DiffResult {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
}

function collectFiles(dir: string, base = ''): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...collectFiles(join(dir, entry.name), rel));
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mermaid')) {
      files.push(rel);
    }
  }
  return files;
}

export function compareDirectories(oldDir: string, newDir: string): DiffResult {
  const oldFiles = new Set(collectFiles(oldDir));
  const newFiles = new Set(collectFiles(newDir));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  const unchanged: string[] = [];

  for (const file of newFiles) {
    if (!oldFiles.has(file)) {
      added.push(file);
    } else {
      const oldContent = readFileSync(join(oldDir, file), 'utf-8');
      const newContent = readFileSync(join(newDir, file), 'utf-8');
      if (oldContent === newContent) {
        unchanged.push(file);
      } else {
        modified.push(file);
      }
    }
  }

  for (const file of oldFiles) {
    if (!newFiles.has(file)) {
      removed.push(file);
    }
  }

  return { added, removed, modified, unchanged };
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/diff/compare.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/diff/compare.ts tests/diff/compare.test.ts
git commit -m "feat: directory comparison module for spec diff"
```

---

### Task 4: Diff Command + Wire Snapshots

**Files:**
- Create: `src/commands/diff.ts`
- Modify: `src/commands/analyze.ts` — add snapshot call before running
- Modify: `src/commands/generate.ts` — add snapshot call before running
- Modify: `bin/respec.ts` — register diff command
- Modify: `src/wizard/menu.ts` — add diff action + "View diff" option

- [ ] **Step 1: Create diff command**

```typescript
// src/commands/diff.ts
import { join } from 'node:path';
import { RESPEC_DIR } from '../constants.js';
import { getLatestSnapshot } from '../diff/snapshot.js';
import { compareDirectories } from '../diff/compare.js';
import { analyzedDir, specsDir } from '../utils/fs.js';

export async function runDiff(
  dir: string,
  options: { phase?: string; ci?: boolean },
): Promise<void> {
  const snapshotsDir = join(dir, RESPEC_DIR, 'snapshots');
  const phases = options.phase ? [options.phase] : ['analyzed', 'specs'];

  for (const phase of phases) {
    const snapshot = getLatestSnapshot(snapshotsDir, phase);
    if (!snapshot) {
      console.log(`No snapshot found for ${phase}. Run analyze/generate first, then re-run to see diff.`);
      continue;
    }

    const currentDir = phase === 'analyzed'
      ? analyzedDir(dir)
      : specsDir(dir);

    const result = compareDirectories(snapshot, currentDir);

    console.log(`\n=== ${phase.toUpperCase()} DIFF ===\n`);

    if (result.modified.length === 0 && result.added.length === 0 && result.removed.length === 0) {
      console.log('  No changes detected.');
      continue;
    }

    for (const f of result.modified) console.log(`  ~ Modified: ${f}`);
    for (const f of result.added) console.log(`  + Added: ${f}`);
    for (const f of result.removed) console.log(`  - Removed: ${f}`);
    console.log(`\n  Summary: ${result.modified.length} modified, ${result.added.length} added, ${result.removed.length} removed, ${result.unchanged.length} unchanged`);
  }
}
```

Note: `specsDir` may need a second arg. Check the actual signature of `specsDir` in `src/utils/fs.ts` — it might be `specsDir(dir, outputDir?)`. If it requires the output dir from config, load the config first.

- [ ] **Step 2: Wire snapshots into analyze and generate**

In `src/commands/analyze.ts`, add before the tier loop (after `const analyzedPath = ...`):

```typescript
import { takeSnapshot } from '../diff/snapshot.js';

// Snapshot before running
const snapshotsDir = path.join(dir, RESPEC_DIR, 'snapshots');
takeSnapshot(analyzedPath, snapshotsDir, 'analyzed');
```

In `src/commands/generate.ts`, add before the tier loop (after `const outputDir = ...`):

```typescript
import { takeSnapshot } from '../diff/snapshot.js';

const snapshotsDir = path.join(dir, RESPEC_DIR, 'snapshots');
takeSnapshot(outputDir, snapshotsDir, 'specs');
```

Add `RESPEC_DIR` to imports in both files if not already present.

- [ ] **Step 3: Register diff command in bin/respec.ts**

```typescript
import { runDiff } from '../src/commands/diff.js';

program
  .command('diff')
  .description('Show changes since last analyze/generate run')
  .option('--phase <phase>', 'Only diff a specific phase (analyzed, specs)')
  .action(wrapAction(async (cmdOpts: { phase?: string }) => {
    const globalOpts = program.opts();
    await runDiff(process.cwd(), { ...globalOpts, ...cmdOpts });
  }));
```

- [ ] **Step 4: Add diff to wizard menu**

In `src/wizard/menu.ts`, add `'diff'` to the WizardAction type and add "View diff" option to `analyzed` and `generated` states.

In `src/wizard/index.ts`, add `case 'diff':` to executeCommand.

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add src/commands/diff.ts src/commands/analyze.ts src/commands/generate.ts bin/respec.ts src/wizard/menu.ts src/wizard/index.ts
git commit -m "feat: spec diff command with snapshots before each run"
```

---

## Part C: AI Reviewer

### Task 5: Reviewer Prompt Template

**Files:**
- Create: `prompts/spec-reviewer.md`

- [ ] **Step 1: Create the prompt**

```markdown
You are a senior software architect reviewing a System Design Document (SDD) for accuracy and completeness.

IMPORTANT: You are running as a text-generation subprocess. Do NOT attempt to create files, use tools, or interact with any system. Your ONLY output is the raw Markdown text written to stdout.

## Your Task

Compare the SDD against the raw ingestion data and analyzed artifacts. Identify:

1. **Claims Without Evidence** — statements in the SDD that have no supporting data in the raw or analyzed artifacts
2. **Raw Data Not Covered** — significant data points in raw/ that are not represented in the SDD
3. **Inconsistencies** — contradictions between the SDD, the analysis, and the raw data
4. **Verified Items** — claims that ARE supported by evidence (briefly list)

## SDD Content

{{SDD}}

## Raw Data

{{RAW}}

## Analyzed Artifacts

{{ANALYZED}}

## Output Format

Produce a review report in this exact format:

# Review Report

## Claims Without Evidence
- [List each claim with the SDD section and what evidence is missing]

## Raw Data Not Covered
- [List each significant raw data point not in the SDD]

## Inconsistencies
- [List each contradiction with both sources]

## Verified
- [Summary: X/Y entities verified, X/Y flows traceable, etc.]

## Overall Assessment
[1-2 sentences: is this SDD trustworthy for reimplementation?]
```

- [ ] **Step 2: Commit**

```bash
git add prompts/spec-reviewer.md
git commit -m "feat: spec reviewer prompt template"
```

---

### Task 6: Review Command

**Files:**
- Create: `src/commands/review.ts`
- Modify: `bin/respec.ts` — register review command
- Modify: `src/wizard/menu.ts` — add review option to generated state
- Modify: `src/wizard/index.ts` — add review case to executeCommand

- [ ] **Step 1: Implement review command**

```typescript
// src/commands/review.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../config/loader.js';
import { createEngineChain } from '../ai/factory.js';
import { Orchestrator } from '../ai/orchestrator.js';
import { rawDir, analyzedDir, specsDir, writeMarkdown } from '../utils/fs.js';
import { RESPEC_DIR, PHASE_GENERATED } from '../constants.js';
import { StateManager } from '../state/manager.js';
import { loadPromptTemplate } from '../prompts/loader.js';
import { createTUI } from '../tui/factory.js';

function readAllMd(dir: string): string {
  if (!fs.existsSync(dir)) return '';
  const parts: string[] = [];
  function walk(d: string): void {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) {
        const rel = path.relative(dir, full);
        parts.push(`### ${rel}\n\n${fs.readFileSync(full, 'utf-8')}`);
      }
    }
  }
  walk(dir);
  return parts.join('\n\n---\n\n');
}

export async function runReview(
  dir: string,
  options: { verbose?: boolean; auto?: boolean; ci?: boolean },
): Promise<void> {
  const tui = createTUI(options);
  const config = await loadConfig(dir);

  tui.phaseHeader('REVIEW', 'Validating specs against raw data');

  const sddPath = path.join(specsDir(dir, config.output.dir), 'sdd.md');
  const sddContent = fs.existsSync(sddPath)
    ? fs.readFileSync(sddPath, 'utf-8')
    : readAllMd(specsDir(dir, config.output.dir));

  const rawContent = readAllMd(rawDir(dir));
  const analyzedContent = readAllMd(analyzedDir(dir));

  const promptTemplate = loadPromptTemplate('spec-reviewer', dir);
  const prompt = promptTemplate
    .replace('{{SDD}}', sddContent || '(No SDD found)')
    .replace('{{RAW}}', rawContent || '(No raw data)')
    .replace('{{ANALYZED}}', analyzedContent || '(No analyzed data)');

  const engines = createEngineChain('analyze', config.ai);
  const orchestrator = new Orchestrator(engines, {
    max_parallel: 1,
    timeout: config.ai.timeout,
  }, config.ai.engines);

  const results = await orchestrator.runAll([{
    id: 'spec-reviewer',
    prompt,
    outputPath: path.join(dir, RESPEC_DIR, 'review-report.md'),
  }]);

  const result = results[0];
  if (result?.status === 'success' && result.output) {
    const reportPath = path.join(dir, RESPEC_DIR, 'review-report.md');
    writeMarkdown(reportPath, result.output);
    tui.success(`Review complete — report at ${reportPath}`);

    if (options.verbose || !options.ci) {
      console.log('\n' + result.output);
    }
  } else {
    tui.warn('Review failed', result?.error ?? 'unknown error');
  }

  tui.destroy();
}
```

- [ ] **Step 2: Register in bin/respec.ts**

```typescript
import { runReview } from '../src/commands/review.js';

program
  .command('review')
  .description('AI review of specs against raw data — detect hallucinations')
  .option('--verbose', 'Show full review report in terminal')
  .action(wrapAction(async (cmdOpts: { verbose?: boolean }) => {
    const globalOpts = program.opts();
    await runReview(process.cwd(), { ...globalOpts, ...cmdOpts });
  }));
```

- [ ] **Step 3: Add to wizard menu**

In `src/wizard/menu.ts`:
- Add `'review'` and `'diff'` to `WizardAction` type
- Add `{ value: 'review', label: 'Review specs (detect hallucinations)' }` to `generated` state, before export

In `src/wizard/index.ts`:
- Add `case 'review':` and `case 'diff':` to executeCommand

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`

- [ ] **Step 5: Build**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/commands/review.ts prompts/spec-reviewer.md bin/respec.ts src/wizard/menu.ts src/wizard/index.ts
git commit -m "feat: AI reviewer validates specs against raw data"
```

---

### Task 7: Build + Smoke Test

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`

- [ ] **Step 2: Build**

Run: `npm run build`

- [ ] **Step 3: Verify help**

```bash
respec --help
respec diff --help
respec review --help
```

- [ ] **Step 4: Run /docs-sync**

Run the docs-sync command to update CLAUDE.md and README.md with the new commands.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "docs: sync docs with prompt overrides, diff, and review features"
git push origin feat/v2-tui-and-quality
```
