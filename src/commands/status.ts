import { StateManager } from '../state/manager.js';
import { createTUI } from '../tui/factory.js';

export async function runStatus(
  dir: string,
  options: { verbose?: boolean; auto?: boolean; ci?: boolean }
): Promise<void> {
  const tui = createTUI(options);
  const state = new StateManager(dir);
  const pipeline = state.load();

  tui.phaseHeader('STATUS', `Current phase: ${pipeline.phase}`);

  if (pipeline.ingest) {
    tui.info(`[ingested] Ingest completed at: ${pipeline.ingest.completed_at}`);
    if (options.verbose) {
      tui.info(`  Sources:`);
      tui.info(`    repo: ${pipeline.ingest.sources.repo ? 'yes' : 'no'}`);
      tui.info(`    jira: ${pipeline.ingest.sources.jira ? 'yes' : 'no'}`);
      tui.info(`    docs: ${pipeline.ingest.sources.docs ? 'yes' : 'no'}`);
      tui.info(`  Stats:`);
      tui.info(`    files:   ${pipeline.ingest.stats.files}`);
      tui.info(`    tickets: ${pipeline.ingest.stats.tickets}`);
      tui.info(`    pages:   ${pipeline.ingest.stats.pages}`);
    }
  } else {
    tui.info(`[ingested] Not yet run. Use: respec ingest`);
  }

  if (pipeline.analyze) {
    tui.info(`[analyzed] Analyze completed at: ${pipeline.analyze.completed_at}`);
    if (options.verbose) {
      tui.info(`  Analyzers run: ${pipeline.analyze.analyzers_run.join(', ')}`);
      tui.info(`  Confidence:`);
      for (const [key, value] of Object.entries(pipeline.analyze.confidence)) {
        tui.info(`    ${key}: ${(value * 100).toFixed(0)}%`);
      }
    }
  } else {
    tui.info(`[analyzed] Not yet run. Use: respec analyze`);
  }

  if (pipeline.generate) {
    tui.info(`[generated] Generate completed at: ${pipeline.generate.completed_at}`);
    if (options.verbose) {
      tui.info(`  Format:         ${pipeline.generate.format}`);
      tui.info(`  Generators run: ${pipeline.generate.generators_run.join(', ')}`);
    }
  } else {
    tui.info(`[generated] Not yet run. Use: respec generate`);
  }

  tui.destroy();
}
