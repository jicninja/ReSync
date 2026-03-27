import { describe, it, expect } from 'vitest';
import {
  getAnalyzerRegistry,
  getAnalyzersByTier,
  getAnalyzerById,
} from '../../src/analyzers/registry.js';

describe('getAnalyzerRegistry', () => {
  it('returns all 6 analyzers', () => {
    const analyzers = getAnalyzerRegistry();
    expect(analyzers).toHaveLength(6);
  });

  it('groups by tier correctly — tier 1 has 3 analyzers', () => {
    const tier1 = getAnalyzersByTier(1);
    expect(tier1).toHaveLength(3);
  });

  it('groups by tier correctly — tier 2 has 3 analyzers', () => {
    const tier2 = getAnalyzersByTier(2);
    expect(tier2).toHaveLength(3);
  });

  it('tier 1 contains domain-mapper, infra-detector, api-mapper', () => {
    const tier1Ids = getAnalyzersByTier(1).map((a) => a.id);
    expect(tier1Ids).toContain('domain-mapper');
    expect(tier1Ids).toContain('infra-detector');
    expect(tier1Ids).toContain('api-mapper');
  });

  it('tier 2 contains flow-extractor, rule-miner, permission-scanner', () => {
    const tier2Ids = getAnalyzersByTier(2).map((a) => a.id);
    expect(tier2Ids).toContain('flow-extractor');
    expect(tier2Ids).toContain('rule-miner');
    expect(tier2Ids).toContain('permission-scanner');
  });

  it('getAnalyzerById returns the correct analyzer', () => {
    const analyzer = getAnalyzerById('domain-mapper');
    expect(analyzer).toBeDefined();
    expect(analyzer?.id).toBe('domain-mapper');
    expect(analyzer?.tier).toBe(1);
  });

  it('getAnalyzerById returns undefined for unknown id', () => {
    const analyzer = getAnalyzerById('nonexistent');
    expect(analyzer).toBeUndefined();
  });

  it('every analyzer has required fields', () => {
    const analyzers = getAnalyzerRegistry();
    for (const a of analyzers) {
      expect(a.id).toBeTruthy();
      expect(Array.isArray(a.reads)).toBe(true);
      expect(a.reads.length).toBeGreaterThan(0);
      expect(Array.isArray(a.produces)).toBe(true);
      expect(a.produces.length).toBeGreaterThan(0);
      expect(a.promptFile).toBeTruthy();
      expect(typeof a.tier).toBe('number');
    }
  });
});
