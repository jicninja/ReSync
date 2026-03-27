export interface AnalyzerDef {
  id: string;
  reads: string[];
  produces: string[];
  promptFile: string;
  tier: number;
}

export interface AnalyzerReport {
  id: string;
  status: 'success' | 'failure' | 'timeout';
  durationMs: number;
  outputFiles: string[];
  confidence?: string;
}
