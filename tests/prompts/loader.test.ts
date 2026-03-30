import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadPromptTemplate } from '../../src/prompts/loader.js';

describe('loadPromptTemplate', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-prompt-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true }); });

  it('loads override from project prompts/ dir', () => {
    const promptsDir = path.join(tmpDir, 'prompts');
    fs.mkdirSync(promptsDir);
    fs.writeFileSync(path.join(promptsDir, 'domain-mapper.md'), 'CUSTOM PROMPT\n\n{{CONTEXT}}');
    const result = loadPromptTemplate('domain-mapper', tmpDir);
    expect(result).toContain('CUSTOM PROMPT');
    expect(result).toContain('subprocess');
  });

  it('falls back to built-in when no override', () => {
    const result = loadPromptTemplate('domain-mapper', tmpDir);
    expect(result).toContain('{{CONTEXT}}');
    expect(result).toContain('subprocess');
  });

  it('returns generic template for unknown id with no built-in', () => {
    const result = loadPromptTemplate('nonexistent-analyzer', tmpDir);
    expect(result).toContain('subprocess');
    expect(result).toContain('{{CONTEXT}}');
  });

  it('always prepends subprocess directive', () => {
    const promptsDir = path.join(tmpDir, 'prompts');
    fs.mkdirSync(promptsDir);
    fs.writeFileSync(path.join(promptsDir, 'test.md'), 'just content');
    const result = loadPromptTemplate('test', tmpDir);
    expect(result.startsWith('IMPORTANT: You are running as a text-generation subprocess')).toBe(true);
  });
});
