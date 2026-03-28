import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../config/loader.js';
import { StateManager } from '../state/manager.js';
import { createEngineChain } from '../ai/factory.js';
import { Orchestrator } from '../ai/orchestrator.js';
import { getGeneratorsByTier, getGeneratorRegistry } from '../generators/registry.js';
import { createFormatAdapter } from '../formats/factory.js';
import { analyzedDir, specsDir, writeMarkdown } from '../utils/fs.js';
import { PHASE_ANALYZED, PHASE_GENERATE } from '../constants.js';
import { createTUI } from '../tui/factory.js';
import { loadPromptTemplate } from '../prompts/loader.js';
import { buildERDPrompt } from '../generators/erd-gen.js';
import { buildFlowPrompt } from '../generators/flow-gen.js';
import { buildADRPrompt } from '../generators/adr-gen.js';
import { buildSDDPrompt } from '../generators/sdd-gen.js';
import { buildTaskPrompt } from '../generators/task-gen.js';
import { buildFormatPrompt } from '../generators/format-gen.js';
import type { SubagentTask } from '../ai/types.js';
import type { GeneratorContext } from '../generators/types.js';

/** Resolve a produces path to a concrete file path (handles globs and directory patterns). */
function resolveProducePath(producePath: string | undefined, generatorId: string): string {
  if (!producePath) return `${generatorId}.md`;
  if (producePath.endsWith('/')) return path.join(producePath, 'index.md');
  if (producePath.includes('*')) return path.join(path.dirname(producePath), `${generatorId}-output.md`);
  return producePath;
}

const PROMPT_BUILDERS: Record<string, (ctx: GeneratorContext) => string> = {
  'erd-gen': buildERDPrompt,
  'flow-gen': buildFlowPrompt,
  'adr-gen': buildADRPrompt,
  'sdd-gen': buildSDDPrompt,
  'task-gen': buildTaskPrompt,
  'format-gen': buildFormatPrompt,
};

export async function runGenerate(
  dir: string,
  options: { only?: string; force?: boolean; auto?: boolean; ci?: boolean }
): Promise<void> {
  const tui = createTUI(options);
  const config = await loadConfig(dir);
  const state = new StateManager(dir);

  if (!options.force) {
    state.requirePhase(PHASE_ANALYZED);
  }

  const format = config.output.format;

  const engines = createEngineChain(PHASE_GENERATE, config.ai);
  const engineNames = engines.map((e) => e.name).join(' → ');
  tui.phaseHeader('GENERATE', `Format: ${format} | Engine: ${engineNames}`);

  const orchestrator = new Orchestrator(engines, {
    max_parallel: config.ai.max_parallel,
    timeout: config.ai.timeout,
  }, config.ai.engines);

  const analyzedPath = analyzedDir(dir);
  const outputDir = specsDir(dir, config.output.dir);

  const generatorCtx: GeneratorContext = {
    analyzedDir: analyzedPath,
    specsDir: outputDir,
    projectName: config.project.name,
    format,
  };

  const allGenerators = getGeneratorRegistry();

  if (options.only) {
    const found = allGenerators.find((g) => g.id === options.only);
    if (!found) {
      throw new Error(`Unknown generator: "${options.only}". Available: ${allGenerators.map((g) => g.id).join(', ')}`);
    }
  }

  const generatorsRun: string[] = [];
  const maxTier = Math.max(...allGenerators.map((g) => g.tier));

  for (let tier = 1; tier <= maxTier; tier++) {
    let tierGenerators = getGeneratorsByTier(tier);

    if (options.only) {
      tierGenerators = tierGenerators.filter((g) => g.id === options.only);
    }

    if (tierGenerators.length === 0) continue;

    tui.progress(`Tier ${tier}: ${tierGenerators.map((g) => g.id).join(', ')}`);

    const tasks: SubagentTask[] = tierGenerators.map((generator) => {
      const overridePath = path.join(dir, 'prompts', `${generator.id}.md`);
      let prompt: string;
      if (fs.existsSync(overridePath)) {
        prompt = loadPromptTemplate(generator.id, dir);
      } else {
        const buildPrompt = PROMPT_BUILDERS[generator.id];
        if (!buildPrompt) {
          throw new Error(`No prompt builder for generator "${generator.id}"`);
        }
        prompt = buildPrompt(generatorCtx);
      }

      return {
        id: generator.id,
        prompt,
        outputPath: path.join(outputDir, resolveProducePath(generator.produces[0], generator.id)),
      };
    });

    const results = await orchestrator.runAll(tasks);

    for (const result of results) {
      const generator = tierGenerators.find((g) => g.id === result.id);
      if (!generator) continue;

      generatorsRun.push(result.id);

      if (result.status === 'success' && result.output) {
        const outputFile = path.join(outputDir, resolveProducePath(generator.produces[0], generator.id));
        writeMarkdown(outputFile, result.output);
        tui.success(`${result.id} — done (${result.durationMs}ms)`);
      } else {
        tui.warn(`${result.id}: ${result.status}`, result.error ?? 'unknown error');
      }
    }
  }

  // Now run the format adapter to package the generated specs
  tui.progress(`Packaging as ${format}...`);
  const adapter = createFormatAdapter(format);

  const sddPath = path.join(outputDir, 'sdd.md');
  const sddContent = fs.existsSync(sddPath)
    ? fs.readFileSync(sddPath, 'utf-8')
    : '';

  const formatContext = {
    projectName: config.project.name,
    projectDescription: config.project.description ?? '',
    sddContent,
    analyzedDir: analyzedPath,
  };

  await adapter.package(outputDir, outputDir, formatContext);
  tui.success(`Packaged as ${format}`);

  state.completeGenerate({
    generators_run: generatorsRun,
    format,
  });

  tui.phaseSummary('GENERATE COMPLETE', [
    ...generatorsRun.map((id) => ({ label: id, status: '✓', detail: '' })),
    { label: format, status: '✓', detail: outputDir },
  ]);

  tui.setPhase('generate');
  tui.writeDecisionLog(path.join(dir, '.respec'));
  tui.destroy();
}
