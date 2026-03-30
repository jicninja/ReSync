import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../config/loader.js';
import { createEngineChain } from '../ai/factory.js';
import { Orchestrator } from '../ai/orchestrator.js';
import { rawDir, analyzedDir, generatedDir, writeMarkdown } from '../utils/fs.js';
import { RESPEC_DIR } from '../constants.js';
import { loadPromptTemplate } from '../prompts/loader.js';
import { createTUI } from '../tui/factory.js';

function readAllMd(dir: string): string {
  if (!fs.existsSync(dir)) return '';
  const parts: string[] = [];
  function walk(d: string): void {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) {
        const rel = path.relative(dir, full);
        parts.push(`### ${rel}\n\n${fs.readFileSync(full, 'utf-8')}`);
      }
    }
  }
  walk(dir);
  return parts.join('\n\n---\n\n');
}

export async function runReview(
  dir: string,
  options: { verbose?: boolean; auto?: boolean; ci?: boolean },
): Promise<void> {
  const tui = createTUI(options);
  const config = await loadConfig(dir);

  tui.phaseHeader('REVIEW', 'Validating specs against raw data');

  // Read all sources
  const specsPath = generatedDir(dir, config.output.dir);
  const sddPath = path.join(specsPath, 'sdd.md');
  const sddContent = fs.existsSync(sddPath)
    ? fs.readFileSync(sddPath, 'utf-8')
    : readAllMd(specsPath);

  const rawContent = readAllMd(rawDir(dir));
  const analyzedContent = readAllMd(analyzedDir(dir));

  // Build prompt
  const promptTemplate = loadPromptTemplate('spec-reviewer', dir);
  const prompt = promptTemplate
    .replace('{{SDD}}', sddContent || '(No SDD found)')
    .replace('{{RAW}}', rawContent || '(No raw data)')
    .replace('{{ANALYZED}}', analyzedContent || '(No analyzed data)');

  // Run via orchestrator
  const engines = createEngineChain('analyze', config.ai);
  const orchestrator = new Orchestrator(engines, {
    max_parallel: 1,
    timeout: config.ai.timeout,
  }, config.ai.engines);

  tui.progress('Reviewing specs...');

  const results = await orchestrator.runAll([{
    id: 'spec-reviewer',
    prompt,
    outputPath: path.join(dir, RESPEC_DIR, 'review-report.md'),
  }]);

  const result = results[0];
  if (result?.status === 'success' && result.output) {
    const reportPath = path.join(dir, RESPEC_DIR, 'review-report.md');
    writeMarkdown(reportPath, result.output);
    tui.success(`Review complete — report at ${reportPath}`);
  } else {
    tui.warn('Review failed', result?.error ?? 'unknown error');
  }

  tui.destroy();
}
