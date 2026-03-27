export interface AIEngine {
  name: string;
  run(prompt: string, options?: AIRunOptions): Promise<string>;
}

export interface AIRunOptions {
  timeout?: number;
  model?: string;
}

export interface AIConfig {
  engine: string;
  command?: string;
  max_parallel: number;
  timeout: number;
  model?: string;
}

export interface SubagentTask {
  id: string;
  prompt: string;
  outputPath: string;
}

export interface SubagentResult {
  id: string;
  status: 'success' | 'failure' | 'timeout';
  output?: string;
  error?: string;
  durationMs: number;
}
