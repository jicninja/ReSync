import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildToolkitPrompt } from '../../src/generators/toolkit-gen.js';
import type { GeneratorContext } from '../../src/generators/types.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-toolkit-gen-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('buildToolkitPrompt', () => {
  it('includes dependency content when rawDir exists', () => {
    const rawDir = join(tmpDir, 'raw');
    const analyzedDir = join(tmpDir, 'analyzed');
    fs.mkdirSync(join(rawDir, 'repo'), { recursive: true });
    fs.mkdirSync(join(analyzedDir, 'domain'), { recursive: true });
    fs.mkdirSync(join(analyzedDir, 'infra'), { recursive: true });

    fs.writeFileSync(join(rawDir, 'repo', 'dependencies.md'), '# Dependencies\n- next: 14.0\n- prisma: 5.0');
    fs.writeFileSync(join(analyzedDir, 'domain', 'bounded-contexts.md'), '# Bounded Contexts\n## User Management');
    fs.writeFileSync(join(analyzedDir, 'infra', 'architecture.md'), '# Architecture\nNext.js + PostgreSQL');

    const ctx: GeneratorContext = {
      analyzedDir, generatedDir: join(tmpDir, 'generated'),
      projectName: 'TestProject', format: 'superpowers', rawDir,
    };

    const prompt = buildToolkitPrompt(ctx);
    expect(prompt).toContain('next: 14.0');
    expect(prompt).toContain('prisma: 5.0');
    expect(prompt).toContain('User Management');
    expect(prompt).toContain('superpowers');
    expect(prompt).toContain('"recommendations"');
  });

  it('works without rawDir (graceful degradation)', () => {
    const analyzedDir = join(tmpDir, 'analyzed');
    fs.mkdirSync(join(analyzedDir, 'domain'), { recursive: true });
    fs.writeFileSync(join(analyzedDir, 'domain', 'bounded-contexts.md'), '# Bounded Contexts');

    const ctx: GeneratorContext = {
      analyzedDir, generatedDir: join(tmpDir, 'generated'),
      projectName: 'TestProject', format: 'openspec',
    };

    const prompt = buildToolkitPrompt(ctx);
    expect(prompt).toContain('No dependency data available');
    expect(prompt).toContain('openspec');
  });

  it('includes multi-agent flag for openspec format', () => {
    const ctx: GeneratorContext = {
      analyzedDir: join(tmpDir, 'analyzed'), generatedDir: join(tmpDir, 'generated'),
      projectName: 'TestProject', format: 'openspec',
    };
    const prompt = buildToolkitPrompt(ctx);
    expect(prompt).toContain('Multi-agent: true');
  });

  it('includes single-agent flag for superpowers format', () => {
    const ctx: GeneratorContext = {
      analyzedDir: join(tmpDir, 'analyzed'), generatedDir: join(tmpDir, 'generated'),
      projectName: 'TestProject', format: 'superpowers',
    };
    const prompt = buildToolkitPrompt(ctx);
    expect(prompt).toContain('Multi-agent: false');
  });

  it('includes the JSON schema in the prompt', () => {
    const ctx: GeneratorContext = {
      analyzedDir: join(tmpDir, 'analyzed'), generatedDir: join(tmpDir, 'generated'),
      projectName: 'TestProject', format: 'superpowers',
    };
    const prompt = buildToolkitPrompt(ctx);
    expect(prompt).toContain('"stack"');
    expect(prompt).toContain('"recommendations"');
    expect(prompt).toContain('"workflowGuidance"');
  });
});
