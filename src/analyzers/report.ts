import { timestamp, heading, table } from '../utils/markdown.js';
import type { AnalyzerReport } from './types.js';

export function buildAnalysisReport(results: AnalyzerReport[]): string {
  const success = results.filter((r) => r.status === 'success').length;
  const failure = results.filter((r) => r.status === 'failure').length;
  const timeout = results.filter((r) => r.status === 'timeout').length;

  const rows = results.map((r) => [
    r.id,
    r.status,
    r.confidence ?? '—',
    `${r.durationMs}ms`,
    r.outputFiles.join(', '),
  ]);

  const lines: string[] = [
    heading(1, 'Analysis Report'),
    '',
    `**Generated:** ${timestamp()}`,
    '',
    heading(2, 'Summary'),
    '',
    `- Total analyzers run: ${results.length}`,
    `- Success: ${success}`,
    `- Failure: ${failure}`,
    `- Timeout: ${timeout}`,
    '',
    heading(2, 'Results'),
    '',
    table(['Analyzer', 'Status', 'Confidence', 'Duration', 'Output Files'], rows),
  ];

  return lines.join('\n');
}
