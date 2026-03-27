export interface IngestState {
  completed_at: string;
  sources: { repo: boolean; jira: boolean; docs: boolean };
  stats: { files: number; tickets: number; pages: number };
}

export interface AnalyzeState {
  completed_at: string;
  analyzers_run: string[];
  confidence: Record<string, number>;
}

export interface GenerateState {
  completed_at: string;
  generators_run: string[];
  format: string;
}

export type PipelinePhase = 'empty' | 'ingested' | 'analyzed' | 'generated';

export interface PipelineState {
  phase: PipelinePhase;
  ingest: IngestState | null;
  analyze: AnalyzeState | null;
  generate: GenerateState | null;
}
