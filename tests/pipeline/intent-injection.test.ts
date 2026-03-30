import { describe, it, expect } from 'vitest';
import { appendIntentToPrompt } from '../../src/pipeline/intent.js';

describe('appendIntentToPrompt', () => {
  it('appends intent section to prompt', () => {
    const result = appendIntentToPrompt('Analyze.', 'port to Fastify', undefined);
    expect(result).toContain('## Project Intent');
    expect(result).toContain('port to Fastify');
  });

  it('appends both intent and context_notes', () => {
    const result = appendIntentToPrompt('Analyze.', 'refactor', 'Focus on auth');
    expect(result).toContain('## Project Intent');
    expect(result).toContain('refactor');
    expect(result).toContain('## Additional Context');
    expect(result).toContain('Focus on auth');
  });

  it('returns original prompt when no intent', () => {
    const result = appendIntentToPrompt('Analyze.', undefined, undefined);
    expect(result).toBe('Analyze.');
  });
});
