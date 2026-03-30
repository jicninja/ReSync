import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('../../src/formats/framework-installer.js', () => ({
  offerFrameworkInstall: vi.fn().mockResolvedValue(false),
}));

import { SpecKitFormat } from '../../src/formats/speckit.js';
import type { FormatContext } from '../../src/formats/types.js';
import { configSchema } from '../../src/config/schema.js';

let tmpDir: string;
let outputDir: string;
let analyzedDir: string;
const adapter = new SpecKitFormat();

const minimalConfig = configSchema.parse({
  project: { name: 'TestProject', description: 'A test project' },
  sources: { repo: { path: '.' } },
  output: { format: 'speckit' },
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
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-speckit-test-'));
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

describe('SpecKitFormat', () => {
  it('has the correct name', () => {
    expect(adapter.name).toBe('speckit');
  });

  it('creates constitution.md with project info', async () => {
    await adapter.package('', outputDir, makeContext());
    const filePath = join(outputDir, '.specify', 'memory', 'constitution.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('TestProject');
    expect(content).toContain('A test project');
  });

  describe('fallback mode (no bounded contexts)', () => {
    it('creates 001-full-reimplementation/ with all required files', async () => {
      await adapter.package('', outputDir, makeContext());
      const featureDir = join(outputDir, '.specify', 'specs', '001-full-reimplementation');
      expect(fs.existsSync(join(featureDir, 'spec.md'))).toBe(true);
      expect(fs.existsSync(join(featureDir, 'plan.md'))).toBe(true);
      expect(fs.existsSync(join(featureDir, 'research.md'))).toBe(true);
      expect(fs.existsSync(join(featureDir, 'data-model.md'))).toBe(true);
      expect(fs.existsSync(join(featureDir, 'tasks.md'))).toBe(true);
    });
  });

  describe('bounded context mode', () => {
    it('creates numbered directories per context', async () => {
      writeAnalyzedFile(
        'domain/bounded-contexts.md',
        '## Auth\n\nHandles authentication.\n\n## Billing\n\nHandles billing.\n',
      );
      const ctx = makeContext({ analyzedDir });
      await adapter.package('', outputDir, ctx);

      const authDir = join(outputDir, '.specify', 'specs', '001-auth');
      const billingDir = join(outputDir, '.specify', 'specs', '002-billing');

      expect(fs.existsSync(join(authDir, 'spec.md'))).toBe(true);
      expect(fs.existsSync(join(authDir, 'plan.md'))).toBe(true);
      expect(fs.existsSync(join(authDir, 'tasks.md'))).toBe(true);
      expect(fs.existsSync(join(billingDir, 'spec.md'))).toBe(true);
      expect(fs.existsSync(join(billingDir, 'plan.md'))).toBe(true);
      expect(fs.existsSync(join(billingDir, 'tasks.md'))).toBe(true);
    });
  });

  it('plan.md contains architecture content', async () => {
    writeAnalyzedFile('infra/architecture.md', '## Architecture\n\nUses Node.js microservices.');
    // Need bounded-contexts or fallback — use fallback
    const ctx = makeContext({ analyzedDir });
    await adapter.package('', outputDir, ctx);

    const planPath = join(outputDir, '.specify', 'specs', '001-full-reimplementation', 'plan.md');
    const content = fs.readFileSync(planPath, 'utf-8');
    expect(content).toContain('Uses Node.js microservices.');
  });

  it('data-model.md contains entity content', async () => {
    writeAnalyzedFile('domain/entities.md', '## Order\n\nAn order entity.\n\n## User\n\nA user entity.');
    const ctx = makeContext({ analyzedDir });
    await adapter.package('', outputDir, ctx);

    const dataModelPath = join(outputDir, '.specify', 'specs', '001-full-reimplementation', 'data-model.md');
    const content = fs.readFileSync(dataModelPath, 'utf-8');
    expect(content).toContain('An order entity.');
    expect(content).toContain('A user entity.');
  });

  it('creates contracts/api-spec.md when contracts exist', async () => {
    writeAnalyzedFile('api/contracts.md', '## POST /orders\n\nCreates an order.');
    const ctx = makeContext({ analyzedDir });
    await adapter.package('', outputDir, ctx);

    const contractPath = join(
      outputDir,
      '.specify',
      'specs',
      '001-full-reimplementation',
      'contracts',
      'api-spec.md',
    );
    expect(fs.existsSync(contractPath)).toBe(true);
    const content = fs.readFileSync(contractPath, 'utf-8');
    expect(content).toContain('POST /orders');
    expect(content).toContain('Creates an order.');
  });

  describe('manual mapping mode', () => {
    it('creates feature directories from config mapping', async () => {
      writeAnalyzedFile(
        'domain/bounded-contexts.md',
        '## Auth\n\nHandles authentication.\n\n## Billing\n\nHandles billing.\n\n## Payments\n\nHandles payments.\n',
      );
      writeAnalyzedFile('domain/entities.md', '## User\n\nA user.\n\n## Invoice\n\nAn invoice.');

      const mappedConfig = configSchema.parse({
        project: { name: 'TestProject', description: 'A test project' },
        sources: { repo: { path: '.' } },
        output: {
          format: 'speckit',
          speckit: {
            mapping: [
              { name: 'Identity', contexts: ['Auth'] },
              { name: 'Finance', contexts: ['Billing', 'Payments'] },
            ],
          },
        },
      });

      const ctx = makeContext({ analyzedDir, config: mappedConfig });
      await adapter.package('', outputDir, ctx);

      const identityDir = join(outputDir, '.specify', 'specs', '001-identity');
      const financeDir = join(outputDir, '.specify', 'specs', '002-finance');

      expect(fs.existsSync(join(identityDir, 'spec.md'))).toBe(true);
      expect(fs.existsSync(join(financeDir, 'spec.md'))).toBe(true);

      // Finance should contain descriptions from both Billing and Payments
      const financeSpec = fs.readFileSync(join(financeDir, 'spec.md'), 'utf-8');
      expect(financeSpec).toContain('Handles billing.');
      expect(financeSpec).toContain('Handles payments.');
    });
  });
});
