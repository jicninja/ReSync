import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KiroFormat } from '../../src/formats/kiro.js';
import type { FormatContext } from '../../src/formats/types.js';
import { configSchema } from '../../src/config/schema.js';

let tmpDir: string;
let outputDir: string;
let analyzedDir: string;
const adapter = new KiroFormat();

const minimalConfig = configSchema.parse({
  project: { name: 'TestProject', description: 'A test project description' },
  sources: { repo: { path: '.' } },
  output: { format: 'kiro' },
});

const baseContext: FormatContext = {
  projectName: 'TestProject',
  projectDescription: 'A test project description',
  sddContent: '# System Design Document\n\nContent here.',
  analyzedDir: '',
  specsDir: '',
  config: minimalConfig,
  ciMode: false,
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-kiro-test-'));
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

function writeRawFile(relativePath: string, content: string): void {
  const rawDir = join(tmpDir, '.respec', 'raw');
  const filePath = join(rawDir, relativePath);
  fs.mkdirSync(join(filePath, '..'), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('KiroFormat', () => {
  it('has the correct name', () => {
    expect(adapter.name).toBe('kiro');
  });

  it('creates .kiro/steering/product.md with project info', async () => {
    await adapter.package('', outputDir, makeContext());
    const filePath = join(outputDir, '.kiro', 'steering', 'product.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('TestProject');
    expect(content).toContain('A test project description');
  });

  it('creates .kiro/steering/tech.md', async () => {
    await adapter.package('', outputDir, makeContext());
    const filePath = join(outputDir, '.kiro', 'steering', 'tech.md');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('creates .kiro/steering/structure.md', async () => {
    await adapter.package('', outputDir, makeContext());
    const filePath = join(outputDir, '.kiro', 'steering', 'structure.md');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('creates .kiro/specs/domain-model/requirements.md when no analyzed dir', async () => {
    await adapter.package('', outputDir, makeContext());
    const filePath = join(outputDir, '.kiro', 'specs', 'domain-model', 'requirements.md');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('creates .kiro/specs/domain-model/design.md with SDD content', async () => {
    await adapter.package('', outputDir, makeContext());
    const filePath = join(outputDir, '.kiro', 'specs', 'domain-model', 'design.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('System Design Document');
  });

  it('creates .kiro/specs/domain-model/tasks.md', async () => {
    await adapter.package('', outputDir, makeContext());
    const filePath = join(outputDir, '.kiro', 'specs', 'domain-model', 'tasks.md');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  describe('with analyzed files present', () => {
    it('steering/tech.md contains architecture content', async () => {
      writeAnalyzedFile('infra/architecture.md', '## Architecture\n\nUses Node.js microservices on AWS.');
      const ctx = makeContext({ analyzedDir });
      await adapter.package('', outputDir, ctx);

      const content = fs.readFileSync(join(outputDir, '.kiro', 'steering', 'tech.md'), 'utf-8');
      expect(content).toContain('# Tech Stack & Conventions');
      expect(content).toContain('Uses Node.js microservices on AWS.');
    });

    it('steering/tech.md contains dependencies content', async () => {
      writeRawFile('repo/dependencies.md', '## Dependencies\n\n- express 4.x\n- vitest 1.x');
      const ctx = makeContext({ analyzedDir });
      await adapter.package('', outputDir, ctx);

      const content = fs.readFileSync(join(outputDir, '.kiro', 'steering', 'tech.md'), 'utf-8');
      expect(content).toContain('express 4.x');
      expect(content).toContain('## Dependencies');
    });

    it('steering/structure.md contains bounded contexts content', async () => {
      writeAnalyzedFile(
        'domain/bounded-contexts.md',
        '## OrderManagement\n\nHandles orders.\n\n## UserAuth\n\nHandles auth.\n'
      );
      const ctx = makeContext({ analyzedDir });
      await adapter.package('', outputDir, ctx);

      const content = fs.readFileSync(join(outputDir, '.kiro', 'steering', 'structure.md'), 'utf-8');
      expect(content).toContain('# Project Structure');
      expect(content).toContain('## Bounded Contexts');
      expect(content).toContain('OrderManagement');
      expect(content).toContain('UserAuth');
    });

    it('steering/structure.md contains directory layout content', async () => {
      writeRawFile('repo/structure.md', '## Structure\n\nsrc/\n  api/\n  domain/\n');
      const ctx = makeContext({ analyzedDir });
      await adapter.package('', outputDir, ctx);

      const content = fs.readFileSync(join(outputDir, '.kiro', 'steering', 'structure.md'), 'utf-8');
      expect(content).toContain('## Directory Layout');
      expect(content).toContain('src/');
    });

    it('creates per-context spec folders when bounded-contexts.md has sections', async () => {
      writeAnalyzedFile(
        'domain/bounded-contexts.md',
        '## OrderManagement\n\nHandles orders.\n\n## UserAuth\n\nHandles auth.\n'
      );
      const ctx = makeContext({ analyzedDir });
      await adapter.package('', outputDir, ctx);

      // Per-context folders should exist
      expect(fs.existsSync(join(outputDir, '.kiro', 'specs', 'order-management', 'requirements.md'))).toBe(true);
      expect(fs.existsSync(join(outputDir, '.kiro', 'specs', 'order-management', 'design.md'))).toBe(true);
      expect(fs.existsSync(join(outputDir, '.kiro', 'specs', 'order-management', 'tasks.md'))).toBe(true);
      expect(fs.existsSync(join(outputDir, '.kiro', 'specs', 'user-auth', 'requirements.md'))).toBe(true);
      expect(fs.existsSync(join(outputDir, '.kiro', 'specs', 'user-auth', 'design.md'))).toBe(true);
      expect(fs.existsSync(join(outputDir, '.kiro', 'specs', 'user-auth', 'tasks.md'))).toBe(true);
    });

    it('per-context tasks.md includes context name', async () => {
      writeAnalyzedFile(
        'domain/bounded-contexts.md',
        '## OrderManagement\n\nHandles orders.\n'
      );
      const ctx = makeContext({ analyzedDir });
      await adapter.package('', outputDir, ctx);

      const tasks = fs.readFileSync(
        join(outputDir, '.kiro', 'specs', 'order-management', 'tasks.md'),
        'utf-8'
      );
      expect(tasks).toContain('OrderManagement');
      expect(tasks).toContain('- [ ] Implement OrderManagement entities');
      expect(tasks).toContain('- [ ] Add business rules');
    });

    it('per-context requirements.md includes entities and business rules', async () => {
      writeAnalyzedFile('domain/bounded-contexts.md', '## Billing\n\nHandles billing.\n');
      writeAnalyzedFile('domain/entities.md', '## Order\n\nAn order entity.\n');
      writeAnalyzedFile('rules/business-rules.md', '## BR-001\n\nOrders must have a total > 0.\n');
      const ctx = makeContext({ analyzedDir });
      await adapter.package('', outputDir, ctx);

      const reqs = fs.readFileSync(
        join(outputDir, '.kiro', 'specs', 'billing', 'requirements.md'),
        'utf-8'
      );
      expect(reqs).toContain('An order entity.');
      expect(reqs).toContain('Orders must have a total > 0.');
    });

    it('does not crash and uses fallback when no domain-model specs folder when boundedContexts empty', async () => {
      // analyzedDir exists but no bounded-contexts.md
      fs.mkdirSync(analyzedDir, { recursive: true });
      const ctx = makeContext({ analyzedDir });
      await adapter.package('', outputDir, ctx);

      // Falls back to domain-model skeleton
      expect(fs.existsSync(join(outputDir, '.kiro', 'specs', 'domain-model', 'requirements.md'))).toBe(true);
    });
  });

  describe('without analyzed files (fallback behavior)', () => {
    it('steering/tech.md contains placeholder when architecture.md missing', async () => {
      fs.mkdirSync(analyzedDir, { recursive: true }); // dir exists but no files
      const ctx = makeContext({ analyzedDir });
      await adapter.package('', outputDir, ctx);

      const content = fs.readFileSync(join(outputDir, '.kiro', 'steering', 'tech.md'), 'utf-8');
      expect(content).toContain('# Tech Stack & Conventions');
      expect(content).toContain('No architecture analysis found');
    });

    it('steering/structure.md contains placeholder when bounded-contexts.md missing', async () => {
      fs.mkdirSync(analyzedDir, { recursive: true });
      const ctx = makeContext({ analyzedDir });
      await adapter.package('', outputDir, ctx);

      const content = fs.readFileSync(join(outputDir, '.kiro', 'steering', 'structure.md'), 'utf-8');
      expect(content).toContain('No bounded contexts found');
    });

    it('does not crash when analyzedDir is empty string', async () => {
      const ctx = makeContext({ analyzedDir: '' });
      await expect(adapter.package('', outputDir, ctx)).resolves.not.toThrow();
    });
  });
});
