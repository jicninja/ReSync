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
    fs.mkdirSync(oldDir); fs.mkdirSync(newDir);
    fs.writeFileSync(path.join(oldDir, 'file.md'), 'old content');
    fs.writeFileSync(path.join(newDir, 'file.md'), 'new content');
    const result = compareDirectories(oldDir, newDir);
    expect(result.modified).toContain('file.md');
  });

  it('detects added files', () => {
    const oldDir = path.join(tmpDir, 'old');
    const newDir = path.join(tmpDir, 'new');
    fs.mkdirSync(oldDir); fs.mkdirSync(newDir);
    fs.writeFileSync(path.join(newDir, 'new-file.md'), 'content');
    const result = compareDirectories(oldDir, newDir);
    expect(result.added).toContain('new-file.md');
  });

  it('detects removed files', () => {
    const oldDir = path.join(tmpDir, 'old');
    const newDir = path.join(tmpDir, 'new');
    fs.mkdirSync(oldDir); fs.mkdirSync(newDir);
    fs.writeFileSync(path.join(oldDir, 'gone.md'), 'content');
    const result = compareDirectories(oldDir, newDir);
    expect(result.removed).toContain('gone.md');
  });

  it('detects unchanged files', () => {
    const oldDir = path.join(tmpDir, 'old');
    const newDir = path.join(tmpDir, 'new');
    fs.mkdirSync(oldDir); fs.mkdirSync(newDir);
    fs.writeFileSync(path.join(oldDir, 'same.md'), 'same');
    fs.writeFileSync(path.join(newDir, 'same.md'), 'same');
    const result = compareDirectories(oldDir, newDir);
    expect(result.unchanged).toContain('same.md');
  });

  it('handles nested directories', () => {
    const oldDir = path.join(tmpDir, 'old');
    const newDir = path.join(tmpDir, 'new');
    fs.mkdirSync(path.join(oldDir, 'sub'), { recursive: true });
    fs.mkdirSync(path.join(newDir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(oldDir, 'sub', 'file.md'), 'old');
    fs.writeFileSync(path.join(newDir, 'sub', 'file.md'), 'new');
    const result = compareDirectories(oldDir, newDir);
    expect(result.modified).toContain('sub/file.md');
  });
});
