import * as path from 'node:path';
import * as fs from 'node:fs';
import { loadConfig } from '../config/loader.js';
import { StateManager } from '../state/manager.js';
import { createFormatAdapter } from '../formats/factory.js';
import { analyzedDir, specsDir } from '../utils/fs.js';
import { PHASE_ANALYZED } from '../constants.js';

export async function runGenerate(
  dir: string,
  options: { only?: string; force?: boolean }
): Promise<void> {
  const config = await loadConfig(dir);
  const state = new StateManager(dir);

  if (!options.force) {
    state.requirePhase(PHASE_ANALYZED);
  }

  const format = config.output.format;
  const adapter = createFormatAdapter(format);

  const analyzedPath = analyzedDir(dir);
  const outputDir = specsDir(dir, config.output.dir);

  // Read SDD content if it exists (from previous generate run)
  const sddPath = path.join(outputDir, 'sdd.md');
  const sddContent = fs.existsSync(sddPath)
    ? fs.readFileSync(sddPath, 'utf-8')
    : '';

  const context = {
    projectName: config.project.name,
    projectDescription: config.project.description ?? '',
    sddContent,
    analyzedDir: analyzedPath,
  };

  console.log(`Generating specs using format: ${format}`);
  await adapter.package(outputDir, outputDir, context);

  state.completeGenerate({
    generators_run: [format],
    format,
  });

  console.log(`Generate complete. Specs written to ${outputDir}`);
}
