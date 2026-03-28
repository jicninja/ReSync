import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DecisionLog } from '../../src/tui/decision-log.js';
import { DECISIONS_FILENAME } from '../../src/constants.js';

let tmpDir: string;
let log: DecisionLog;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-decision-log-test-'));
  log = new DecisionLog();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('DecisionLog', () => {
  it('returns empty array when no decisions added', () => {
    expect(log.getAll()).toEqual([]);
  });

  it('add and getAll returns all decisions', () => {
    log.add({ id: 'd1', question: 'Use TypeScript?', choice: 'yes', reason: 'user chose' });
    log.add({ id: 'd2', question: 'Add linting?', choice: 'no', reason: 'auto-default' });
    const all = log.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe('d1');
    expect(all[1].id).toBe('d2');
  });

  it('getAll returns a copy, not the internal array', () => {
    log.add({ id: 'd1', question: 'Q?', choice: 'A', reason: 'user chose' });
    const all = log.getAll();
    all.push({ id: 'extra', question: 'X?', choice: 'Y', reason: 'ci-default' });
    expect(log.getAll()).toHaveLength(1);
  });

  it('getRecent(2) returns the last 2 decisions', () => {
    log.add({ id: 'd1', question: 'Q1?', choice: 'A1', reason: 'user chose' });
    log.add({ id: 'd2', question: 'Q2?', choice: 'A2', reason: 'auto-default' });
    log.add({ id: 'd3', question: 'Q3?', choice: 'A3', reason: 'ci-default' });
    const recent = log.getRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].id).toBe('d2');
    expect(recent[1].id).toBe('d3');
  });

  it('getRecent(n) when fewer than n decisions returns all', () => {
    log.add({ id: 'd1', question: 'Q1?', choice: 'A1', reason: 'user chose' });
    expect(log.getRecent(5)).toHaveLength(1);
  });

  it('setPhase sets the phase name used in write output', () => {
    log.setPhase('ingest');
    log.add({ id: 'd1', question: 'Q?', choice: 'A', reason: 'user chose' });
    log.write(tmpDir);
    const content = fs.readFileSync(join(tmpDir, DECISIONS_FILENAME), 'utf-8');
    expect(content).toContain('## ingest');
  });

  it('write creates _decisions.md with correct content', () => {
    log.setPhase('init');
    log.add({ id: 'd1', question: 'Use Jira?', choice: 'yes', reason: 'user chose' });
    log.add({ id: 'd2', question: 'Use Confluence?', choice: 'no', reason: 'auto-default' });
    log.write(tmpDir);

    const filePath = join(tmpDir, DECISIONS_FILENAME);
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('# ReSpec Decisions Log');
    expect(content).toContain('## init');
    expect(content).toContain('**Timestamp:**');
    expect(content).toContain('| # | Decision | Choice | Reason |');
    expect(content).toContain('| 1 | Use Jira? | yes | user chose |');
    expect(content).toContain('| 2 | Use Confluence? | no | auto-default |');
  });

  it('write appends to existing file (write twice, verify both sections)', () => {
    log.setPhase('init');
    log.add({ id: 'd1', question: 'Q1?', choice: 'A1', reason: 'user chose' });
    log.write(tmpDir);

    const log2 = new DecisionLog();
    log2.setPhase('ingest');
    log2.add({ id: 'd2', question: 'Q2?', choice: 'A2', reason: 'ci-default' });
    log2.write(tmpDir);

    const content = fs.readFileSync(join(tmpDir, DECISIONS_FILENAME), 'utf-8');

    // Header appears only once
    const headerCount = (content.match(/# ReSpec Decisions Log/g) || []).length;
    expect(headerCount).toBe(1);

    // Both sections present
    expect(content).toContain('## init');
    expect(content).toContain('## ingest');
    expect(content).toContain('| 1 | Q1? | A1 | user chose |');
    expect(content).toContain('| 1 | Q2? | A2 | ci-default |');
  });

  it('write does nothing if no decisions', () => {
    log.setPhase('init');
    log.write(tmpDir);
    expect(fs.existsSync(join(tmpDir, DECISIONS_FILENAME))).toBe(false);
  });
});
