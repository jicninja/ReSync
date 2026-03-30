import { describe, it, expect } from 'vitest';
import { getRunSteps } from '../../src/wizard/run-flow.js';
import { getLowPriorityIds, appendIntentToPrompt } from '../../src/pipeline/intent.js';

describe('Run flow integration', () => {
  it('full run from empty state skips nothing without intent', () => {
    const steps = getRunSteps('empty', undefined);
    const lowPriority = getLowPriorityIds(undefined);
    expect(steps.length).toBeGreaterThanOrEqual(6);
    expect(lowPriority.analyzers).toHaveLength(0);
    expect(lowPriority.generators).toHaveLength(0);
  });

  it('upgrade intent skips flow analyzers and generators', () => {
    const steps = getRunSteps('empty', 'version upgrade');
    const lowPriority = getLowPriorityIds('version upgrade');
    expect(steps[0].id).toBe('ingest');
    expect(lowPriority.analyzers).toContain('flow-extractor');
    expect(lowPriority.generators).toContain('flow-gen');
  });

  it('intent injection adds sections to prompt', () => {
    const prompt = appendIntentToPrompt('Base prompt.', 'port to Fastify', 'Focus on API layer');
    expect(prompt).toContain('Base prompt.');
    expect(prompt).toContain('## Project Intent');
    expect(prompt).toContain('port to Fastify');
    expect(prompt).toContain('## Additional Context');
    expect(prompt).toContain('Focus on API layer');
  });

  it('continue from analyzed state includes intent-refine', () => {
    const steps = getRunSteps('analyzed', 'refactor');
    expect(steps[0].id).toBe('intent-refine');
    expect(steps[1].id).toBe('generate');
  });
});
