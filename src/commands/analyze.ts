import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../config/loader.js';
import { StateManager } from '../state/manager.js';
import { createEngineChain } from '../ai/factory.js';
import { Orchestrator } from '../ai/orchestrator.js';
import { getAnalyzersByTier, getAnalyzerRegistry } from '../analyzers/registry.js';
import { buildAnalysisReport } from '../analyzers/report.js';
import { rawDir, analyzedDir, writeMarkdown } from '../utils/fs.js';
import type { AnalyzerReport } from '../analyzers/types.js';
import type { SubagentTask } from '../ai/types.js';
import { PHASE_INGESTED, PHASE_ANALYZE } from '../constants.js';
import { parseConfidence, confidenceToFloat } from '../analyzers/confidence-parser.js';
import { createTUI } from '../tui/factory.js';
import { loadPromptTemplate } from '../prompts/loader.js';

export async function runAnalyze(
  dir: string,
  options: { only?: string; force?: boolean; auto?: boolean; ci?: boolean }
): Promise<void> {
  const tui = createTUI(options);
  const config = await loadConfig(dir);
  const state = new StateManager(dir);

  if (!options.force) {
    state.requirePhase(PHASE_INGESTED);
  }

  const engines = createEngineChain(PHASE_ANALYZE, config.ai);
  const engineNames = engines.map((e) => e.name).join(' → ');
  tui.phaseHeader('ANALYZE', `Engine: ${engineNames}`);

  const orchestrator = new Orchestrator(engines, {
    max_parallel: config.ai.max_parallel,
    timeout: config.ai.timeout,
  }, config.ai.engines);

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

    tui.progress(`Tier ${tier}: ${tierAnalyzers.map((a) => a.id).join(', ')}`);

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
      const promptTemplate = loadPromptTemplate(analyzer.id, dir);

      // Build context sources section
      let contextSourcesSection = '';
      const contextRawPath = path.join(rawPath, 'context');
      if (fs.existsSync(contextRawPath) && fs.statSync(contextRawPath).isDirectory()) {
        const sourceDirs = fs.readdirSync(contextRawPath).filter((entry) => {
          const entryPath = path.join(contextRawPath, entry);
          return fs.statSync(entryPath).isDirectory();
        });

        const sourceSections: string[] = [];
        for (const sourceDir of sourceDirs) {
          const sourcePath = path.join(contextRawPath, sourceDir);
          const sectionParts: string[] = [];

          // Read _context-role.md for role metadata
          let role = 'unknown';
          const contextRoleFile = path.join(sourcePath, '_context-role.md');
          if (fs.existsSync(contextRoleFile)) {
            try {
              const roleContent = fs.readFileSync(contextRoleFile, 'utf-8');
              sectionParts.push(roleContent);
              const roleMatch = roleContent.match(/role:\s*(\S+)/i);
              if (roleMatch) role = roleMatch[1];
            } catch {
              // skip
            }
          }

          // Read key files: structure.md, endpoints.md, models.md
          const keyFiles: Array<{ label: string; candidates: string[] }> = [
            {
              label: 'Structure',
              candidates: [
                path.join(sourcePath, 'repo', 'structure.md'),
                path.join(sourcePath, 'structure.md'),
              ],
            },
            {
              label: 'Endpoints',
              candidates: [
                path.join(sourcePath, 'repo', 'endpoints.md'),
                path.join(sourcePath, 'endpoints.md'),
              ],
            },
            {
              label: 'Models',
              candidates: [
                path.join(sourcePath, 'repo', 'models.md'),
                path.join(sourcePath, 'models.md'),
              ],
            },
          ];

          for (const { label, candidates } of keyFiles) {
            for (const candidate of candidates) {
              if (fs.existsSync(candidate)) {
                try {
                  const content = fs.readFileSync(candidate, 'utf-8');
                  sectionParts.push(`### ${label}\n\n${content}`);
                } catch {
                  // skip
                }
                break;
              }
            }
          }

          if (sectionParts.length > 0) {
            sourceSections.push(
              `## Context Source: ${sourceDir} (role: ${role})\n> This is NOT the target of the SDD. Use as reference only.\n\n${sectionParts.join('\n\n')}`
            );
          }
        }

        if (sourceSections.length > 0) {
          contextSourcesSection = sourceSections.join('\n\n---\n\n');
        }
      }

      // Build Tier 1 output section (for Tier 2 analyzers only)
      let tier1OutputSection = '';
      if (analyzer.tier === 2) {
        const tier1Parts: string[] = [];
        const tier1Analyzers = getAnalyzersByTier(1);

        for (const t1 of tier1Analyzers) {
          for (const producePath of t1.produces) {
            const filePath = path.join(analyzedPath, producePath);
            if (fs.existsSync(filePath)) {
              try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const label = path.basename(producePath, '.md').replace(/-/g, ' ');
                tier1Parts.push(`### ${label}\n\n${content}`);
              } catch {
                // skip
              }
            }
          }
        }

        if (tier1Parts.length > 0) {
          tier1OutputSection = `## Prior Analysis (from Tier 1)\n\n${tier1Parts.join('\n\n')}`;
        }
      }

      const prompt = promptTemplate
        .replace('{{CONTEXT}}', context)
        .replace('{{CONTEXT_SOURCES}}', contextSourcesSection)
        .replace('{{TIER1_OUTPUT}}', tier1OutputSection);

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

      const parsed = result.output ? parseConfidence(result.output) : undefined;

      const report: AnalyzerReport = {
        id: result.id,
        status: result.status,
        durationMs: result.durationMs,
        outputFiles: analyzer.produces,
        confidence: result.status === 'success'
          ? (parsed ?? { overall: 'MEDIUM', items: [] })
          : undefined,
      };

      allReports.push(report);

      if (result.status === 'success' && result.output) {
        // Write output to first produce file
        const outputFile = path.join(analyzedPath, analyzer.produces[0] ?? `${analyzer.id}.md`);
        writeMarkdown(outputFile, result.output);
        tui.success(`${result.id} — done (${result.durationMs}ms)`);

        if (parsed && parsed.items.some(i => i.confidence === 'LOW') && tui.getMode() === 'interactive') {
          const lowItems = parsed.items.filter(i => i.confidence === 'LOW');
          const itemList = lowItems.map(i => `  • "${i.name}" — ${i.reason ?? 'insufficient evidence'}`).join('\n');

          await tui.ask({
            id: `confidence-${result.id}`,
            message: `${result.id} has LOW confidence items:\n${itemList}`,
            choices: ['accept', 'skip', 'retry'],
            default: 'accept',
          });
        }
      } else {
        tui.warn(`${result.id}: ${result.status}`, result.error ?? 'unknown error');
      }
    }
  }

  // Build and write _analysis-report.md
  const reportContent = buildAnalysisReport(allReports);
  const reportPath = path.join(analyzedPath, '_analysis-report.md');
  writeMarkdown(reportPath, reportContent);

  // Compute confidence from real parsed data
  const confidenceScores: Record<string, number> = {};
  for (const report of allReports) {
    if (report.confidence) {
      confidenceScores[report.id] = confidenceToFloat(report.confidence.overall);
    }
  }
  const overallValues = Object.values(confidenceScores);
  const overallAvg = overallValues.length > 0
    ? overallValues.reduce((a, b) => a + b, 0) / overallValues.length
    : 0;
  confidenceScores.overall = Math.round(overallAvg * 100) / 100;

  state.completeAnalyze({
    analyzers_run: analyzersRun,
    confidence: confidenceScores,
  });

  tui.phaseSummary('ANALYZE COMPLETE', [
    ...allReports.map((r) => ({
      label: r.id,
      status: r.status === 'success' ? '✓' : '✗',
      detail: r.status === 'success' ? `${r.durationMs}ms` : r.status,
    })),
    { label: 'confidence', status: '·', detail: `${(confidenceScores.overall * 100).toFixed(0)}%` },
  ]);

  tui.setPhase('analyze');
  tui.writeDecisionLog(path.join(dir, '.respec'));
  tui.destroy();
}
