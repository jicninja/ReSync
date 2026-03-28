import type { AIEngine as AIEngineInterface, EngineConfig, ResolvedAIConfig } from './types.js';
import { ClaudeAdapter } from './adapters/claude.js';
import { CodexAdapter } from './adapters/codex.js';
import { GeminiAdapter } from './adapters/gemini.js';
import { CustomAdapter } from './adapters/custom.js';
import { ENGINE_CLAUDE, ENGINE_CODEX, ENGINE_GEMINI, ENGINE_CUSTOM } from '../constants.js';

/**
 * Create a single AI engine from a name and per-engine config.
 */
export function createEngineFromConfig(name: string, config: EngineConfig): AIEngineInterface {
  if (config.command && name !== ENGINE_CUSTOM) {
    return new CustomAdapter(config.command);
  }

  switch (name) {
    case ENGINE_CLAUDE:
      return new ClaudeAdapter();
    case ENGINE_CODEX:
      return new CodexAdapter();
    case ENGINE_GEMINI:
      return new GeminiAdapter();
    case ENGINE_CUSTOM:
      if (!config.command) {
        throw new Error('custom engine requires a command in engine config');
      }
      return new CustomAdapter(config.command);
    default:
      throw new Error(`Unknown AI engine: ${name}`);
  }
}

/**
 * Create an ordered engine chain for a pipeline phase.
 * Falls back to the first defined engine if the phase has no routing.
 */
export function createEngineChain(phase: string, config: ResolvedAIConfig): AIEngineInterface[] {
  const phaseEngines = (config.phases as Record<string, string[]>)[phase];
  const engineNames = phaseEngines ?? [Object.keys(config.engines)[0]];

  return engineNames.map((name) => {
    const engineConfig = config.engines[name] ?? {};
    return createEngineFromConfig(name, engineConfig);
  });
}

/**
 * @deprecated Use createEngineFromConfig or createEngineChain instead.
 * Kept for backwards compatibility during migration.
 */
export function createAIEngine(config: { engine: string; command?: string }): AIEngineInterface {
  if (config.engine === ENGINE_CUSTOM && !config.command) {
    throw new Error('custom engine requires a command in ai.command config');
  }
  return createEngineFromConfig(config.engine, { command: config.command });
}
