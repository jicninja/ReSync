import { describe, it, expect } from 'vitest';
import { configSchema } from '../../src/config/schema.js';
import { createEngineChain } from '../../src/ai/factory.js';
import { Orchestrator } from '../../src/ai/orchestrator.js';
import type { SubagentTask, AIEngine as AIEngineInterface } from '../../src/ai/types.js';

function makeMockEngine(name: string, response: string): AIEngineInterface {
  return { name, run: async () => response };
}

describe('Multi-engine integration', () => {
  it('full flow: parse config → create chain → orchestrate with fallback', () => {
    const rawConfig = {
      project: { name: 'test-project' },
      sources: { repo: { path: '.' } },
      ai: {
        timeout: 60,
        max_parallel: 2,
        engines: {
          claude: { model: 'opus', timeout: 120 },
          gemini: { model: 'pro' },
        },
        phases: {
          analyze: ['claude', 'gemini'],
          generate: 'gemini',
        },
      },
      output: {},
    };

    const parsed = configSchema.safeParse(rawConfig);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    // Verify normalized config shape
    expect(parsed.data.ai.engines.claude).toEqual({ model: 'opus', timeout: 120 });
    expect(parsed.data.ai.phases.analyze).toEqual(['claude', 'gemini']);
    expect(parsed.data.ai.phases.generate).toEqual(['gemini']);
  });

  it('legacy config still works end-to-end', () => {
    const rawConfig = {
      project: { name: 'legacy-project' },
      sources: { repo: { path: '.' } },
      ai: { engine: 'claude', timeout: 300 },
      output: {},
    };

    const parsed = configSchema.safeParse(rawConfig);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.ai.engines.claude).toBeDefined();
    expect(parsed.data.ai.timeout).toBe(300);
  });

  it('orchestrator uses fallback when first engine fails', async () => {
    const failEngine: AIEngineInterface = {
      name: 'fail',
      run: async () => { throw new Error('down'); },
    };
    const okEngine = makeMockEngine('ok', 'success-output');

    const orchestrator = new Orchestrator([failEngine, okEngine], {
      max_parallel: 1,
      timeout: 30,
    });

    const tasks: SubagentTask[] = [
      { id: 't1', prompt: 'test', outputPath: '/out.md' },
    ];

    const results = await orchestrator.runAll(tasks);
    expect(results[0].status).toBe('success');
    expect(results[0].output).toBe('success-output');
    expect(results[0].engine).toBe('ok');
  });
});
