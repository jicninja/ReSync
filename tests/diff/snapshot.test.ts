import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { takeSnapshot, getLatestSnapshot } from '../../src/diff/snapshot.js';

describe('takeSnapshot', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-snap-')); });
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

  it('handles nested directories in source', () => {
    const srcDir = path.join(tmpDir, 'source');
    fs.mkdirSync(path.join(srcDir, 'domain'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'domain', 'entities.md'), 'nested');
    const snapDir = path.join(tmpDir, 'snapshots');
    takeSnapshot(srcDir, snapDir, 'analyzed');
    const snapshotPath = getLatestSnapshot(snapDir, 'analyzed')!;
    expect(fs.readFileSync(path.join(snapshotPath, 'domain', 'entities.md'), 'utf-8')).toBe('nested');
  });
});
