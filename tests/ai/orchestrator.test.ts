import { describe, it, expect, vi } from 'vitest';
import { Orchestrator } from '../../src/ai/orchestrator.js';
import type { AIEngine, SubagentTask } from '../../src/ai/types.js';

function makeMockEngine(runFn: (prompt: string) => Promise<string>): AIEngine {
  return {
    name: 'mock',
    run: vi.fn(runFn),
  };
}

const tasks: SubagentTask[] = [
  { id: 'task-1', prompt: 'Prompt 1', outputPath: '/out/1.md' },
  { id: 'task-2', prompt: 'Prompt 2', outputPath: '/out/2.md' },
  { id: 'task-3', prompt: 'Prompt 3', outputPath: '/out/3.md' },
];

describe('Orchestrator', () => {
  it('runs all tasks and returns results', async () => {
    const engine = makeMockEngine(async (prompt) => `result for: ${prompt}`);
    const orchestrator = new Orchestrator(engine, { max_parallel: 2, timeout: 30 });

    const results = await orchestrator.runAll(tasks);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'success')).toBe(true);
    expect(results.find((r) => r.id === 'task-1')?.output).toBe('result for: Prompt 1');
    expect(results.find((r) => r.id === 'task-3')?.output).toBe('result for: Prompt 3');
  });

  it('runs tasks in batches of max_parallel', async () => {
    const callOrder: number[] = [];
    let concurrentCount = 0;
    let maxConcurrent = 0;

    const engine = makeMockEngine(async (_prompt) => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      callOrder.push(concurrentCount);
      await new Promise((r) => setTimeout(r, 10));
      concurrentCount--;
      return 'done';
    });

    const orchestrator = new Orchestrator(engine, { max_parallel: 2, timeout: 30 });
    await orchestrator.runAll(tasks);

    expect(engine.run).toHaveBeenCalledTimes(3);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('handles task failures gracefully', async () => {
    let callCount = 0;
    const engine = makeMockEngine(async (_prompt) => {
      callCount++;
      if (callCount === 2) {
        throw new Error('AI engine failed');
      }
      return 'success output';
    });

    const orchestrator = new Orchestrator(engine, { max_parallel: 4, timeout: 30 });
    const results = await orchestrator.runAll(tasks);

    // All 3 results should be present (Promise.allSettled captures fulfilled values)
    expect(results).toHaveLength(3);

    const successful = results.filter((r) => r.status === 'success');
    const failed = results.filter((r) => r.status === 'failure');

    expect(successful).toHaveLength(2);
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toBe('AI engine failed');
  });

  it('marks timed-out tasks with status "timeout"', async () => {
    const engine = makeMockEngine(async (_prompt) => {
      throw new Error('ETIMEDOUT: TIMEOUT exceeded');
    });

    const orchestrator = new Orchestrator(engine, { max_parallel: 1, timeout: 1 });
    const results = await orchestrator.runAll([tasks[0]]);

    expect(results[0].status).toBe('timeout');
  });

  it('returns empty array when given no tasks', async () => {
    const engine = makeMockEngine(async () => 'result');
    const orchestrator = new Orchestrator(engine, { max_parallel: 4, timeout: 30 });

    const results = await orchestrator.runAll([]);
    expect(results).toHaveLength(0);
  });

  it('records durationMs for each result', async () => {
    const engine = makeMockEngine(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 'done';
    });

    const orchestrator = new Orchestrator(engine, { max_parallel: 4, timeout: 30 });
    const results = await orchestrator.runAll([tasks[0]]);

    expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('Orchestrator with fallback chain', () => {
  it('uses first engine when it succeeds', async () => {
    const engine1 = makeMockEngine(async () => 'from-engine-1');
    const engine2 = makeMockEngine(async () => 'from-engine-2');
    const orchestrator = new Orchestrator([engine1, engine2], { max_parallel: 4, timeout: 30 });

    const results = await orchestrator.runAll([tasks[0]]);

    expect(results[0].status).toBe('success');
    expect(results[0].output).toBe('from-engine-1');
    expect(results[0].engine).toBe('mock');
    expect(engine2.run).not.toHaveBeenCalled();
  });

  it('falls back to second engine when first fails', async () => {
    const engine1 = makeMockEngine(async () => { throw new Error('rate limited'); });
    const engine2 = makeMockEngine(async () => 'from-engine-2');
    const orchestrator = new Orchestrator([engine1, engine2], { max_parallel: 4, timeout: 30 });

    const results = await orchestrator.runAll([tasks[0]]);

    expect(results[0].status).toBe('success');
    expect(results[0].output).toBe('from-engine-2');
  });

  it('returns failure when all engines fail', async () => {
    const engine1 = makeMockEngine(async () => { throw new Error('fail-1'); });
    const engine2 = makeMockEngine(async () => { throw new Error('fail-2'); });
    const orchestrator = new Orchestrator([engine1, engine2], { max_parallel: 4, timeout: 30 });

    const results = await orchestrator.runAll([tasks[0]]);

    expect(results[0].status).toBe('failure');
    expect(results[0].error).toBe('fail-2');
  });

  it('accepts single engine (no array) for backwards compat', async () => {
    const engine = makeMockEngine(async () => 'result');
    const orchestrator = new Orchestrator(engine, { max_parallel: 4, timeout: 30 });

    const results = await orchestrator.runAll([tasks[0]]);
    expect(results[0].status).toBe('success');
  });
});

describe('Orchestrator per-engine config', () => {
  it('passes per-engine timeout and model to engine.run()', async () => {
    const engine = makeMockEngine(async () => 'result');
    const orchestrator = new Orchestrator(
      [engine],
      { max_parallel: 4, timeout: 600 },
      { mock: { timeout: 900, model: 'opus' } },
    );

    await orchestrator.runAll([tasks[0]]);

    expect(engine.run).toHaveBeenCalledWith(
      'Prompt 1',
      expect.objectContaining({ timeout: 900, model: 'opus' }),
    );
  });

  it('falls back to global timeout when per-engine timeout is not set', async () => {
    const engine = makeMockEngine(async () => 'result');
    const orchestrator = new Orchestrator(
      [engine],
      { max_parallel: 4, timeout: 600 },
      { mock: {} },
    );

    await orchestrator.runAll([tasks[0]]);

    expect(engine.run).toHaveBeenCalledWith(
      'Prompt 1',
      expect.objectContaining({ timeout: 600 }),
    );
  });
});
