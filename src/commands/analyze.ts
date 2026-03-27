import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../config/loader.js';
import { StateManager } from '../state/manager.js';
import { createAIEngine } from '../ai/factory.js';
import { Orchestrator } from '../ai/orchestrator.js';
import { getAnalyzersByTier, getAnalyzerRegistry } from '../analyzers/registry.js';
import { buildAnalysisReport } from '../analyzers/report.js';
import { rawDir, analyzedDir, writeMarkdown } from '../utils/fs.js';
import type { AnalyzerReport } from '../analyzers/types.js';
import type { SubagentTask } from '../ai/types.js';
import { PHASE_INGESTED } from '../constants.js';

export async function runAnalyze(
  dir: string,
  options: { only?: string; force?: boolean }
): Promise<void> {
  const config = await loadConfig(dir);
  const state = new StateManager(dir);

  if (!options.force) {
    state.requirePhase(PHASE_INGESTED);
  }

  const engine = createAIEngine(config.ai);
  const orchestrator = new Orchestrator(engine, {
    max_parallel: config.ai.max_parallel,
    timeout: config.ai.timeout,
  });

  const rawPath = rawDir(dir);
  const analyzedPath = analyzedDir(dir);

  // Determine tiers to run
  const allAnalyzers = getAnalyzerRegistry();
  const tiersToRun = options.only
    ? [allAnalyzers.find((a) => a.id === options.only)].filter(Boolean)
    : null;

  if (options.only && (!tiersToRun || tiersToRun.length === 0)) {
    throw new Error(`Unknown analyzer: "${options.only}". Run 'respec status' to see available analyzers.`);
  }

  const allReports: AnalyzerReport[] = [];
  const analyzersRun: string[] = [];

  const maxTier = Math.max(...allAnalyzers.map((a) => a.tier));

  for (let tier = 1; tier <= maxTier; tier++) {
    let tierAnalyzers = getAnalyzersByTier(tier);

    if (options.only) {
      tierAnalyzers = tierAnalyzers.filter((a) => a.id === options.only);
    }

    if (tierAnalyzers.length === 0) continue;

    console.log(`Running tier ${tier} analyzers: ${tierAnalyzers.map((a) => a.id).join(', ')}`);

    const tasks: SubagentTask[] = tierAnalyzers.map((analyzer) => {
      // Build context from raw MDs
      const contextParts: string[] = [];

      for (const readPath of analyzer.reads) {
        const fullPath = path.join(rawPath, readPath);
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            // Read all .md files in directory
            const files = fs.readdirSync(fullPath).filter((f) => f.endsWith('.md'));
            for (const file of files) {
              const filePath = path.join(fullPath, file);
              try {
                const content = fs.readFileSync(filePath, 'utf-8');
                contextParts.push(`## ${readPath}${file}\n\n${content}`);
              } catch {
                // skip unreadable files
              }
            }
          } else {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              contextParts.push(`## ${readPath}\n\n${content}`);
            } catch {
              // skip unreadable files
            }
          }
        }
      }

      const context = contextParts.join('\n\n---\n\n') || '(No raw data found for this analyzer)';

      // Load prompt template
      let promptTemplate = `Analyze the following raw data and produce structured analysis output.\n\n{{CONTEXT}}`;
      const promptFilePath = path.join(dir, 'prompts', path.basename(analyzer.promptFile));
      if (fs.existsSync(promptFilePath)) {
        try {
          promptTemplate = fs.readFileSync(promptFilePath, 'utf-8');
        } catch {
          // fall back to default template
        }
      }

      const prompt = promptTemplate.replace('{{CONTEXT}}', context);

      return {
        id: analyzer.id,
        prompt,
        outputPath: path.join(analyzedPath, analyzer.produces[0] ?? `${analyzer.id}.md`),
      };
    });

    const results = await orchestrator.runAll(tasks);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const analyzer = tierAnalyzers.find((a) => a.id === result.id);

      if (!analyzer) continue;

      analyzersRun.push(result.id);

      const report: AnalyzerReport = {
        id: result.id,
        status: result.status,
        durationMs: result.durationMs,
        outputFiles: analyzer.produces,
        confidence: result.status === 'success' ? 'MEDIUM' : undefined,
      };

      allReports.push(report);

      if (result.status === 'success' && result.output) {
        // Write output to first produce file
        const outputFile = path.join(analyzedPath, analyzer.produces[0] ?? `${analyzer.id}.md`);
        writeMarkdown(outputFile, result.output);
        console.log(`  ${result.id}: success (${result.durationMs}ms)`);
      } else {
        console.warn(`  ${result.id}: ${result.status} — ${result.error ?? 'unknown error'}`);
      }
    }
  }

  // Build and write _analysis-report.md
  const reportContent = buildAnalysisReport(allReports);
  const reportPath = path.join(analyzedPath, '_analysis-report.md');
  writeMarkdown(reportPath, reportContent);

  // Compute confidence
  const successCount = allReports.filter((r) => r.status === 'success').length;
  const overall = allReports.length > 0 ? successCount / allReports.length : 0;

  state.completeAnalyze({
    analyzers_run: analyzersRun,
    confidence: { overall },
  });

  console.log(`Analyze complete. ${analyzersRun.length} analyzers run. Overall confidence: ${(overall * 100).toFixed(0)}%`);
}
