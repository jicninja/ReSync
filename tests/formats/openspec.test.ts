import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OpenSpecFormat } from '../../src/formats/openspec.js';
import type { FormatContext } from '../../src/formats/types.js';
import { configSchema } from '../../src/config/schema.js';

let tmpDir: string;
let outputDir: string;
const adapter = new OpenSpecFormat();

const minimalConfig = configSchema.parse({
  project: { name: 'TestProject', description: 'A test project description' },
  sources: { repo: { path: '.' } },
  output: { format: 'openspec' },
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
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-openspec-test-'));
  outputDir = join(tmpDir, 'output');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('OpenSpecFormat', () => {
  it('has the correct name', () => {
    expect(adapter.name).toBe('openspec');
  });

  it('creates openspec/AGENTS.md with openspec-instructions XML block', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'openspec', 'AGENTS.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('<openspec-instructions>');
    expect(content).toContain('</openspec-instructions>');
  });

  it('creates openspec/project.md with project name and description', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'openspec', 'project.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('TestProject');
    expect(content).toContain('A test project description');
  });

  it('creates openspec/config.yaml with spec-driven schema', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'openspec', 'config.yaml');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('spec-driven');
  });

  it('creates openspec/specs/ directory', async () => {
    await adapter.package('', outputDir, context);
    const dirPath = join(outputDir, 'openspec', 'specs');
    expect(fs.existsSync(dirPath)).toBe(true);
    expect(fs.statSync(dirPath).isDirectory()).toBe(true);
  });

  it('creates openspec/changes/full-reimplementation/proposal.md', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'openspec', 'changes', 'full-reimplementation', 'proposal.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('TestProject');
  });

  it('creates openspec/changes/full-reimplementation/tasks.md', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'openspec', 'changes', 'full-reimplementation', 'tasks.md');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('creates openspec/explorations/ directory', async () => {
    await adapter.package('', outputDir, context);
    const dirPath = join(outputDir, 'openspec', 'explorations');
    expect(fs.existsSync(dirPath)).toBe(true);
    expect(fs.statSync(dirPath).isDirectory()).toBe(true);
  });
});
