import { describe, it, expect } from 'vitest';
import { getGeneratorRegistry, getGeneratorsByTier } from '../../src/generators/registry.js';

describe('getGeneratorRegistry', () => {
  it('returns all 6 generators', () => {
    const generators = getGeneratorRegistry();
    expect(generators).toHaveLength(6);
  });

  it('each generator has required fields', () => {
    const generators = getGeneratorRegistry();
    for (const gen of generators) {
      expect(gen.id).toBeTruthy();
      expect(Array.isArray(gen.reads)).toBe(true);
      expect(Array.isArray(gen.produces)).toBe(true);
      expect(typeof gen.tier).toBe('number');
    }
  });

  it('generator ids are unique', () => {
    const generators = getGeneratorRegistry();
    const ids = generators.map((g) => g.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('getGeneratorsByTier', () => {
  it('tier 1 has erd-gen, flow-gen, adr-gen', () => {
    const tier1 = getGeneratorsByTier(1);
    const ids = tier1.map((g) => g.id);
    expect(ids).toContain('erd-gen');
    expect(ids).toContain('flow-gen');
    expect(ids).toContain('adr-gen');
    expect(tier1).toHaveLength(3);
  });

  it('tier 2 has sdd-gen', () => {
    const tier2 = getGeneratorsByTier(2);
    const ids = tier2.map((g) => g.id);
    expect(ids).toContain('sdd-gen');
    expect(tier2).toHaveLength(1);
  });

  it('tier 3 has task-gen, format-gen', () => {
    const tier3 = getGeneratorsByTier(3);
    const ids = tier3.map((g) => g.id);
    expect(ids).toContain('task-gen');
    expect(ids).toContain('format-gen');
    expect(tier3).toHaveLength(2);
  });

  it('returns empty array for non-existent tier', () => {
    const tier99 = getGeneratorsByTier(99);
    expect(tier99).toHaveLength(0);
  });
});
