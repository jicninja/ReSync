import * as clack from '@clack/prompts';
import type { WizardState } from './menu.js';
import type { ReSpecConfig } from '../config/schema.js';
import { runWithSpinner } from './runner.js';
import { updateConfig } from '../config/loader.js';
import { rawDir, analyzedDir } from '../utils/fs.js';

export interface RunStep {
  id: string;
  phase: WizardState;
  interactive: boolean;
}

const ALL_RUN_STEPS: RunStep[] = [
  { id: 'intent-type', phase: 'empty', interactive: true },
  { id: 'ingest', phase: 'empty', interactive: false },
  { id: 'intent-suggest', phase: 'ingested', interactive: true },
  { id: 'analyze', phase: 'ingested', interactive: false },
  { id: 'intent-refine', phase: 'analyzed', interactive: true },
  { id: 'generate', phase: 'analyzed', interactive: false },
  { id: 'export', phase: 'generated', interactive: false },
];

const PHASE_ORDER: WizardState[] = ['no-config', 'empty', 'ingested', 'analyzed', 'generated'];

const PROJECT_TYPES = [
  'full system specification',
  'port / migration',
  'refactor',
  'version upgrade',
  'audit / review',
] as const;

export function getRunSteps(state: WizardState, intent: string | undefined): RunStep[] {
  const stateIndex = PHASE_ORDER.indexOf(state);

  let steps = ALL_RUN_STEPS.filter((step) => {
    const stepIndex = PHASE_ORDER.indexOf(step.phase);
    return stepIndex >= stateIndex;
  });

  if (intent) {
    steps = steps.filter((s) => s.id !== 'intent-type');
  }

  return steps;
}

async function handleIntentType(dir: string): Promise<void> {
  const projectType = await clack.select({
    message: 'What type of project is this?',
    options: [
      ...PROJECT_TYPES.map((t) => ({ value: t, label: t })),
      { value: 'custom', label: 'Custom (describe your own)' },
    ],
    initialValue: PROJECT_TYPES[0],
  });
  if (clack.isCancel(projectType)) return;

  if (projectType !== 'full system specification') {
    let intent: string;
    if (projectType === 'custom') {
      const custom = await clack.text({ message: 'Describe your goal:' });
      if (clack.isCancel(custom)) return;
      intent = custom as string;
    } else {
      intent = projectType as string;
    }
    await updateConfig(dir, { 'project.intent': intent });
  }
}

async function handleIntentSuggest(dir: string, config: ReSpecConfig): Promise<void> {
  const { buildIntentSuggestPrompt, parseIntentSuggestResponse } = await import('../pipeline/intent-suggest.js');
  const raw = rawDir(dir);
  const prompt = buildIntentSuggestPrompt(raw, config.project.intent ?? 'full system specification');
  if (!prompt) return;

  const { createEngineChain } = await import('../ai/factory.js');
  const { PHASE_ANALYZE } = await import('../constants.js');
  const engines = createEngineChain(PHASE_ANALYZE, config.ai);
  try {
    const engine = engines[0];
    const output = await engine.run(prompt);
    if (!output) return;

    const result = parseIntentSuggestResponse(output);
    if (!result || result.questions.length === 0) return;

    clack.log.step(result.summary);

    const answers: string[] = [];
    for (const q of result.questions) {
      if (q.type === 'text') {
        const answer = await clack.text({ message: q.text });
        if (clack.isCancel(answer)) break;
        answers.push(`${q.text}: ${answer}`);
      } else if (q.type === 'select' && q.options) {
        const answer = await clack.select({
          message: q.text,
          options: q.options.map((o) => ({ value: o, label: o })),
        });
        if (clack.isCancel(answer)) break;
        answers.push(`${q.text}: ${answer}`);
      } else if (q.type === 'multiselect' && q.options) {
        const answer = await clack.multiselect({
          message: q.text,
          options: q.options.map((o) => ({ value: o, label: o })),
        });
        if (clack.isCancel(answer)) break;
        answers.push(`${q.text}: ${(answer as string[]).join(', ')}`);
      }
    }

    if (answers.length > 0) {
      const existing = config.project.context_notes ?? '';
      const notes = existing ? `${existing}\n${answers.join('\n')}` : answers.join('\n');
      await updateConfig(dir, { 'project.context_notes': notes });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    clack.log.warn(`Intent suggestions unavailable: ${message}`);
  }
}

async function handleIntentRefine(dir: string, config: ReSpecConfig): Promise<void> {
  const { buildIntentRefinePrompt, parseIntentRefineResponse } = await import('../pipeline/intent-refine.js');
  const analyzed = analyzedDir(dir);
  const prompt = buildIntentRefinePrompt(analyzed, config.project.intent, config.project.context_notes);

  const { createEngineChain } = await import('../ai/factory.js');
  const { PHASE_ANALYZE } = await import('../constants.js');
  const engines = createEngineChain(PHASE_ANALYZE, config.ai);
  try {
    const engine = engines[0];
    const output = await engine.run(prompt);
    if (!output) return;

    const result = parseIntentRefineResponse(output);
    if (!result || result.recommendations.length === 0) return;

    const recList = result.recommendations.map((r) => `  - ${r}`).join('\n');
    clack.log.step(`Refined recommendations:\n${recList}`);

    const adjustment = await clack.text({
      message: 'Adjust goal or add constraints? (Enter to continue)',
    });
    if (clack.isCancel(adjustment)) return;
    if (adjustment && (adjustment as string).trim()) {
      const existing = config.project.context_notes ?? '';
      const notes = existing ? `${existing}\n${adjustment}` : adjustment as string;
      await updateConfig(dir, { 'project.context_notes': notes });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    clack.log.warn(`Intent refinement unavailable: ${message}`);
  }
}

export async function runPipeline(
  dir: string,
  state: WizardState,
  config: ReSpecConfig,
  executeCommand: (command: string, dir: string) => Promise<void>,
): Promise<void> {
  const steps = getRunSteps(state, config.project.intent);
  const pipelineSteps = steps.filter((s) => !s.interactive);
  const total = pipelineSteps.length;
  let pipelineIndex = 0;

  for (const step of steps) {
    if (step.interactive) {
      if (step.id === 'intent-type') {
        await handleIntentType(dir);
      } else if (step.id === 'intent-suggest') {
        await handleIntentSuggest(dir, config);
      } else if (step.id === 'intent-refine') {
        await handleIntentRefine(dir, config);
      }
      continue;
    }

    pipelineIndex++;
    const label = `[${pipelineIndex}/${total}] ${step.id}`;
    const result = await runWithSpinner(label, () => executeCommand(step.id, dir));
    if (!result.ok) {
      clack.log.error(`${step.id} failed: ${result.error}`);
      break;
    }
  }
}
