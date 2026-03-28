import { timestamp, heading, table } from '../utils/markdown.js';
import type { AnalyzerReport } from './types.js';
import type { ConfidenceLevel, ConfidenceItem } from './confidence-parser.js';

function formatConfidenceLevel(level: ConfidenceLevel): string {
  if (level === 'HIGH') return 'HIGH';
  if (level === 'MEDIUM') return 'MEDIUM ⚠';
  return 'LOW ✗';
}

function renderConfidenceItems(items: ConfidenceItem[]): string {
  if (items.length === 0) return '';
  return items
    .map((item) => {
      const marker = item.confidence === 'LOW' ? '✗' : item.confidence === 'MEDIUM' ? '⚠' : '✓';
      const reason = item.reason ? ` — ${item.reason}` : '';
      return `  - ${marker} **${item.name}** [${item.confidence}]${reason}`;
    })
    .join('\n');
}

export function buildAnalysisReport(results: AnalyzerReport[]): string {
  const success = results.filter((r) => r.status === 'success').length;
  const failure = results.filter((r) => r.status === 'failure').length;
  const timeout = results.filter((r) => r.status === 'timeout').length;

  const rows = results.map((r) => [
    r.id,
    r.status,
    r.confidence ? formatConfidenceLevel(r.confidence.overall) : '—',
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

  // Render per-item confidence details for any analyzer that has items
  const withItems = results.filter((r) => r.confidence && r.confidence.items.length > 0);
  if (withItems.length > 0) {
    lines.push('', heading(2, 'Confidence Details'), '');
    for (const r of withItems) {
      if (!r.confidence) continue;
      lines.push(`**${r.id}** — Overall: ${formatConfidenceLevel(r.confidence.overall)}`);
      lines.push(renderConfidenceItems(r.confidence.items));
      lines.push('');
    }
  }

  return lines.join('\n');
}
