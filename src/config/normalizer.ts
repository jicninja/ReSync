import { DEFAULT_AI_TIMEOUT_SECONDS, DEFAULT_MAX_PARALLEL, AI_ENGINES } from '../constants.js';
import type { ResolvedAIConfig, EngineConfig, PhaseRouting } from '../ai/types.js';

const VALID_ENGINES = new Set<string>(AI_ENGINES);

interface LegacyAIInput {
  engine?: string;
  command?: string;
  model?: string;
  timeout?: number;
  max_parallel?: number;
}

interface NewAIInput {
  timeout?: number;
  max_parallel?: number;
  engines?: Record<string, EngineConfig>;
  phases?: Record<string, string | string[]>;
}

type AIInput = LegacyAIInput & NewAIInput;

export function normalizeAiConfig(raw: unknown): ResolvedAIConfig {
  const input = (raw ?? {}) as AIInput;

  const hasLegacy = 'engine' in input && input.engine !== undefined;
  const hasNew = 'engines' in input && input.engines !== undefined;

  if (hasLegacy && hasNew) {
    throw new Error('Cannot specify both "ai.engine" and "ai.engines". Use one format or the other.');
  }

  const timeout = input.timeout ?? DEFAULT_AI_TIMEOUT_SECONDS;
  const max_parallel = input.max_parallel ?? DEFAULT_MAX_PARALLEL;

  if (hasLegacy) {
    const engineName = input.engine!;
    const engineConfig: EngineConfig = {};
    if (input.model) engineConfig.model = input.model;
    if (input.command) engineConfig.command = input.command;

    return {
      timeout,
      max_parallel,
      engines: { [engineName]: engineConfig },
      phases: {},
    };
  }

  const engines: Record<string, EngineConfig> = input.engines ?? {};

  if (Object.keys(engines).length === 0) {
    throw new Error('At least one engine must be defined in "ai.engines".');
  }

  for (const name of Object.keys(engines)) {
    if (!VALID_ENGINES.has(name)) {
      throw new Error(`Unknown engine name "${name}". Valid engines: ${AI_ENGINES.join(', ')}`);
    }
  }

  const rawPhases = input.phases ?? {};

  const phases: PhaseRouting = {};
  for (const [phase, value] of Object.entries(rawPhases)) {
    const engineList = Array.isArray(value) ? value : [value];

    for (const engineName of engineList) {
      if (!(engineName in engines)) {
        throw new Error(
          `Phase "${phase}" references undefined engine "${engineName}". Define it in "ai.engines".`
        );
      }
    }

    (phases as Record<string, string[]>)[phase] = engineList;
  }

  return { timeout, max_parallel, engines, phases };
}
