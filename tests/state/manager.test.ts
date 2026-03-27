import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StateManager } from '../../src/state/manager.js';

let tmpDir: string;
let manager: StateManager;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-state-test-'));
  manager = new StateManager(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('StateManager', () => {
  it('returns empty state when no state file exists', () => {
    const state = manager.load();
    expect(state.phase).toBe('empty');
    expect(state.ingest).toBeNull();
    expect(state.analyze).toBeNull();
    expect(state.generate).toBeNull();
  });

  it('saves and loads ingest state', () => {
    const result = manager.completeIngest({
      sources: { repo: true, jira: false, docs: false },
      stats: { files: 42, tickets: 0, pages: 0 },
    });

    expect(result.phase).toBe('ingested');
    expect(result.ingest).not.toBeNull();
    expect(result.ingest!.stats.files).toBe(42);
    expect(result.ingest!.completed_at).toBeTruthy();

    const loaded = manager.load();
    expect(loaded.phase).toBe('ingested');
    expect(loaded.ingest!.stats.files).toBe(42);
    expect(loaded.ingest!.completed_at).toBe(result.ingest!.completed_at);
  });

  it('saves and loads analyze state', () => {
    manager.completeIngest({
      sources: { repo: true, jira: false, docs: false },
      stats: { files: 10, tickets: 0, pages: 0 },
    });

    const result = manager.completeAnalyze({
      analyzers_run: ['domain-mapper', 'flow-extractor'],
      confidence: { overall: 0.85, domain: 0.9 },
    });

    expect(result.phase).toBe('analyzed');
    expect(result.analyze).not.toBeNull();
    expect(result.analyze!.analyzers_run).toEqual(['domain-mapper', 'flow-extractor']);
    expect(result.analyze!.completed_at).toBeTruthy();

    const loaded = manager.load();
    expect(loaded.phase).toBe('analyzed');
    expect(loaded.analyze!.analyzers_run).toEqual(['domain-mapper', 'flow-extractor']);
  });

  it('validates prerequisites — analyze requires ingest (throws)', () => {
    expect(() => manager.requirePhase('ingested')).toThrow();
    expect(() => manager.requirePhase('analyzed')).toThrow();
    expect(() => manager.requirePhase('generated')).toThrow();
  });

  it('passes prerequisites when phase is met', () => {
    manager.completeIngest({
      sources: { repo: true, jira: true, docs: true },
      stats: { files: 100, tickets: 50, pages: 5 },
    });

    expect(() => manager.requirePhase('empty')).not.toThrow();
    expect(() => manager.requirePhase('ingested')).not.toThrow();
    expect(() => manager.requirePhase('analyzed')).toThrow();
    expect(() => manager.requirePhase('generated')).toThrow();
  });
});
