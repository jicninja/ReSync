import type { AIEngine, SubagentTask, SubagentResult } from './types.js';

export class Orchestrator {
  constructor(
    private readonly engine: AIEngine,
    private readonly config: { max_parallel: number; timeout: number },
  ) {}

  async runAll(tasks: SubagentTask[]): Promise<SubagentResult[]> {
    const results: SubagentResult[] = [];
    const chunks = this.chunk(tasks, this.config.max_parallel);

    for (const batch of chunks) {
      const batchResults = await Promise.allSettled(batch.map((t) => this.runOne(t)));
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    }

    return results;
  }

  private async runOne(task: SubagentTask): Promise<SubagentResult> {
    const start = Date.now();
    try {
      const output = await this.engine.run(task.prompt, { timeout: this.config.timeout });
      return {
        id: task.id,
        status: 'success',
        output,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const status = error.includes('TIMEOUT') ? 'timeout' : 'failure';
      return {
        id: task.id,
        status,
        error,
        durationMs: Date.now() - start,
      };
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
