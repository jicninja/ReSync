import * as path from 'node:path';
import * as fs from 'node:fs';
import { loadConfig } from '../config/loader.js';
import { createFormatAdapter } from '../formats/factory.js';
import { analyzedDir, specsDir } from '../utils/fs.js';
import { createTUI } from '../tui/factory.js';

export async function runExport(
  dir: string,
  options: { format?: string; output?: string; auto?: boolean; ci?: boolean }
): Promise<void> {
  const tui = createTUI(options);
  const config = await loadConfig(dir);

  const format = options.format ?? config.output.format;
  const adapter = createFormatAdapter(format);

  const analyzedPath = analyzedDir(dir);
  const inputDir = specsDir(dir, config.output.dir);
  const outputDir = options.output
    ? path.resolve(dir, options.output)
    : dir;

  // Read SDD content if it exists
  const sddPath = path.join(inputDir, 'sdd.md');
  const sddContent = fs.existsSync(sddPath)
    ? fs.readFileSync(sddPath, 'utf-8')
    : '';

  const context = {
    projectName: config.project.name,
    projectDescription: config.project.description ?? '',
    sddContent,
    analyzedDir: analyzedPath,
    specsDir: inputDir,
    config,
    ciMode: !!options.ci,
  };

  tui.phaseHeader('EXPORT', `Format: ${format}`);
  tui.progress(`Exporting specs with format: ${format}...`);
  await adapter.package(inputDir, outputDir, context);
  tui.success(`Output: ${outputDir}`);

  tui.phaseSummary('EXPORT COMPLETE', [
    { label: format, status: '✓', detail: outputDir },
  ]);

  tui.setPhase('export');
  tui.writeDecisionLog(path.join(dir, '.respec'));
  tui.destroy();
}
