import type { AIEngine, SubagentTask, SubagentResult, EngineConfig } from './types.js';

export class Orchestrator {
  private readonly engines: AIEngine[];

  constructor(
    engines: AIEngine | AIEngine[],
    private readonly config: { max_parallel: number; timeout: number },
    private readonly engineConfigs?: Record<string, EngineConfig>,
  ) {
    this.engines = Array.isArray(engines) ? engines : [engines];
  }

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

    for (let i = 0; i < this.engines.length; i++) {
      const engine = this.engines[i];
      const isLast = i === this.engines.length - 1;

      try {
        const perEngine = this.engineConfigs?.[engine.name] ?? {};
        const output = await engine.run(task.prompt, {
          timeout: perEngine.timeout ?? this.config.timeout,
          model: perEngine.model,
        });
        return {
          id: task.id,
          status: 'success',
          output,
          engine: engine.name,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);

        if (isLast) {
          const status = error.includes('TIMEOUT') ? 'timeout' : 'failure';
          return {
            id: task.id,
            status,
            error,
            engine: engine.name,
            durationMs: Date.now() - start,
          };
        }
        // Not last engine — try next one
      }
    }

    // Should never reach here, but TypeScript needs it
    return {
      id: task.id,
      status: 'failure',
      error: 'No engines available',
      durationMs: Date.now() - start,
    };
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
