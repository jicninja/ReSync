import { describe, it, expect } from 'vitest';
import { getLowPriorityIds } from '../../src/pipeline/intent.js';

describe('getLowPriorityIds', () => {
  it('returns empty for no intent', () => {
    expect(getLowPriorityIds(undefined)).toEqual({ analyzers: [], generators: [] });
  });

  it('returns empty for full system specification', () => {
    expect(getLowPriorityIds('full system specification')).toEqual({ analyzers: [], generators: [] });
  });

  it('marks flow-extractor and permission-scanner low for upgrade intent', () => {
    const result = getLowPriorityIds('version upgrade');
    expect(result.analyzers).toContain('flow-extractor');
    expect(result.analyzers).toContain('permission-scanner');
    expect(result.generators).toContain('flow-gen');
  });

  it('returns empty for refactor intent', () => {
    const result = getLowPriorityIds('refactor');
    expect(result.analyzers).toEqual([]);
    expect(result.generators).toEqual([]);
  });

  it('marks task-gen and format-gen low for audit intent', () => {
    const result = getLowPriorityIds('audit the codebase');
    expect(result.generators).toContain('task-gen');
    expect(result.generators).toContain('format-gen');
  });
});
