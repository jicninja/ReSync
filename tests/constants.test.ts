import { describe, it, expect } from 'vitest';
import { PHASE_ANALYZE, PHASE_GENERATE, AI_PIPELINE_PHASES } from '../src/constants.js';

describe('AI pipeline phase constants', () => {
  it('exports analyze and generate phase names', () => {
    expect(PHASE_ANALYZE).toBe('analyze');
    expect(PHASE_GENERATE).toBe('generate');
  });

  it('exports AI_PIPELINE_PHASES tuple', () => {
    expect(AI_PIPELINE_PHASES).toEqual(['analyze', 'generate']);
  });
});
