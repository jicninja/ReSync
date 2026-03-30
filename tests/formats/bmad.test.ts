import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configSchema } from '../../src/config/schema.js';
import type { FormatContext } from '../../src/formats/types.js';

vi.mock('../../src/formats/framework-installer.js', () => ({
  offerFrameworkInstall: vi.fn().mockResolvedValue(false),
}));

// Import after mock
const { BmadFormat } = await import('../../src/formats/bmad.js');

let tmpDir: string;
let outputDir: string;
let analyzedDir: string;
const adapter = new BmadFormat();

const minimalConfig = configSchema.parse({
  project: { name: 'TestProject', description: 'A test project' },
  sources: { repo: { path: '.' } },
  output: { format: 'bmad' },
});

const baseContext: FormatContext = {
  projectName: 'TestProject',
  projectDescription: 'A test project',
  sddContent: '# System Design Document\n\nContent here.',
  analyzedDir: '',
  generatedDir: '',
  config: minimalConfig,
  ciMode: false,
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-bmad-test-'));
  outputDir = join(tmpDir, 'output');
  analyzedDir = join(tmpDir, '.respec', 'analyzed');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeContext(overrides: Partial<FormatContext> = {}): FormatContext {
  return { ...baseContext, ...overrides };
}

function writeAnalyzedFile(relativePath: string, content: string): void {
  const filePath = join(analyzedDir, relativePath);
  fs.mkdirSync(join(filePath, '..'), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('BmadFormat', () => {
  it('has the correct name', () => {
    expect(adapter.name).toBe('bmad');
  });

  it('creates PRD.md with SDD content and business rules', async () => {
    writeAnalyzedFile('rules/business-rules.md', '## BR-001\n\nUsers must verify email.');
    const ctx = makeContext({ analyzedDir });
    await adapter.package('', outputDir, ctx);

    const prdPath = join(outputDir, '_bmad-output', 'planning-artifacts', 'PRD.md');
    expect(fs.existsSync(prdPath)).toBe(true);
    const content = fs.readFileSync(prdPath, 'utf-8');
    expect(content).toContain('TestProject');
    expect(content).toContain('Users must verify email.');
  });

  it('creates architecture.md with infra content', async () => {
    writeAnalyzedFile('infra/architecture.md', '## Infra\n\nNode.js microservices on AWS.');
    const ctx = makeContext({ analyzedDir });
    await adapter.package('', outputDir, ctx);

    const archPath = join(outputDir, '_bmad-output', 'planning-artifacts', 'architecture.md');
    expect(fs.existsSync(archPath)).toBe(true);
    const content = fs.readFileSync(archPath, 'utf-8');
    expect(content).toContain('Node.js microservices on AWS.');
  });

  it('creates ux-spec.md with flows', async () => {
    writeAnalyzedFile('flows/user-flows.md', '## Login Flow\n\nUser enters credentials.');
    const ctx = makeContext({ analyzedDir });
    await adapter.package('', outputDir, ctx);

    const uxPath = join(outputDir, '_bmad-output', 'planning-artifacts', 'ux-spec.md');
    expect(fs.existsSync(uxPath)).toBe(true);
    const content = fs.readFileSync(uxPath, 'utf-8');
    expect(content).toContain('User enters credentials.');
  });

  it('creates epic files from bounded contexts', async () => {
    writeAnalyzedFile(
      'domain/bounded-contexts.md',
      '## Auth\n\nHandles authentication.\n\n## Billing\n\nHandles payments.\n',
    );
    const ctx = makeContext({ analyzedDir });
    await adapter.package('', outputDir, ctx);

    const epic1Path = join(outputDir, '_bmad-output', 'planning-artifacts', 'epics', 'epic-1-auth.md');
    const epic2Path = join(outputDir, '_bmad-output', 'planning-artifacts', 'epics', 'epic-2-billing.md');
    expect(fs.existsSync(epic1Path)).toBe(true);
    expect(fs.existsSync(epic2Path)).toBe(true);

    const epic1 = fs.readFileSync(epic1Path, 'utf-8');
    expect(epic1).toContain('# Epic 1: Auth');
    expect(epic1).toContain('Handles authentication.');

    const epic2 = fs.readFileSync(epic2Path, 'utf-8');
    expect(epic2).toContain('# Epic 2: Billing');
    expect(epic2).toContain('Handles payments.');
  });

  it('creates project-context.md', async () => {
    writeAnalyzedFile('domain/glossary.md', '## Terms\n\n- **API**: Application Programming Interface');
    const ctx = makeContext({ analyzedDir });
    await adapter.package('', outputDir, ctx);

    const contextPath = join(outputDir, '_bmad-output', 'project-context.md');
    expect(fs.existsSync(contextPath)).toBe(true);
    const content = fs.readFileSync(contextPath, 'utf-8');
    expect(content).toContain('Application Programming Interface');
  });

  it('creates empty sprint-status.yaml', async () => {
    await adapter.package('', outputDir, makeContext());

    const yamlPath = join(outputDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
    expect(fs.existsSync(yamlPath)).toBe(true);
    const content = fs.readFileSync(yamlPath, 'utf-8');
    expect(content).toContain('status: not_started');
  });

  it('creates fallback PRD when no analyzed dir', async () => {
    await adapter.package('', outputDir, makeContext());

    const prdPath = join(outputDir, '_bmad-output', 'planning-artifacts', 'PRD.md');
    expect(fs.existsSync(prdPath)).toBe(true);
    const content = fs.readFileSync(prdPath, 'utf-8');
    expect(content).toContain('TestProject');
  });
});
