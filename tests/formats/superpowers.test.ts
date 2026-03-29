import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SuperpowersFormat } from '../../src/formats/superpowers.js';
import type { FormatContext } from '../../src/formats/types.js';
import { configSchema } from '../../src/config/schema.js';

let tmpDir: string;
let outputDir: string;
const adapter = new SuperpowersFormat();

const minimalConfig = configSchema.parse({
  project: { name: 'TestProject', description: 'A test project description' },
  sources: { repo: { path: '.' } },
  output: { format: 'superpowers' },
});

const context: FormatContext = {
  projectName: 'TestProject',
  projectDescription: 'A test project description',
  sddContent: '# System Design Document\n\nContent here.',
  analyzedDir: '',
  specsDir: '',
  config: minimalConfig,
  ciMode: false,
};

const SKILL_NAMES = [
  'domain-model',
  'business-rules',
  'api-contracts',
  'user-flows',
  'data-model',
  'security-auth',
  'infrastructure',
  'migration-guide',
];

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-superpowers-test-'));
  outputDir = join(tmpDir, 'output');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('SuperpowersFormat', () => {
  it('has the correct name', () => {
    expect(adapter.name).toBe('superpowers');
  });

  it('creates 8 skill folders under skills/', async () => {
    await adapter.package('', outputDir, context);
    const skillsDir = join(outputDir, 'skills');
    expect(fs.existsSync(skillsDir)).toBe(true);
    const entries = fs.readdirSync(skillsDir);
    expect(entries).toHaveLength(8);
  });

  it.each(SKILL_NAMES)('creates skills/%s/SKILL.md with YAML frontmatter', async (skillName) => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'skills', skillName, 'SKILL.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('---');
    expect(content).toContain(`name: ${skillName}`);
    expect(content).toContain('user-invocable: true');
    expect(content).toContain('description:');
  });

  it('creates CLAUDE.md', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'CLAUDE.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('TestProject');
  });

  it('creates sdd.md with full SDD content', async () => {
    await adapter.package('', outputDir, context);
    const filePath = join(outputDir, 'sdd.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('System Design Document');
    expect(content).toContain('Content here.');
  });
});
