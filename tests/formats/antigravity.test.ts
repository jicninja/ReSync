import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AntigravityFormat } from '../../src/formats/antigravity.js';
import type { FormatContext } from '../../src/formats/types.js';
import { configSchema } from '../../src/config/schema.js';

let tmpDir: string;
let outputDir: string;
const adapter = new AntigravityFormat();

const minimalConfig = configSchema.parse({
  project: { name: 'TestProject', description: 'A test project description' },
  sources: { repo: { path: '.' } },
  output: { format: 'antigravity' },
});

const context: FormatContext = {
  projectName: 'TestProject',
  projectDescription: 'A test project description',
  sddContent: '# System Design Document\n\nContent here.',
  analyzedDir: '',
  generatedDir: '',
  config: minimalConfig,
  ciMode: false,
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-antigravity-test-'));
  outputDir = join(tmpDir, 'output');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('AntigravityFormat', () => {
  it('has the correct name', () => {
    expect(adapter.name).toBe('antigravity');
  });

  it('creates GEMINI.md with Antigravity-specific rules', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'GEMINI.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('TestProject');
  });

  it('creates AGENTS.md with cross-tool rules', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'AGENTS.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('TestProject');
    expect(content).toContain('A test project description');
  });

  it('creates .agent/rules/domain-model.md', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, '.agent', 'rules', 'domain-model.md');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('creates .agent/rules/business-rules.md', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, '.agent', 'rules', 'business-rules.md');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('creates docs/sdd.md with full SDD content', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'docs', 'sdd.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('System Design Document');
    expect(content).toContain('Content here.');
  });

  it('creates tasks/task.md as a living checklist', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'tasks', 'task.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('TestProject');
  });

  it('creates tasks/implementation_plan.md', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'tasks', 'implementation_plan.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('TestProject');
  });
});
