import type { AIConfig, AIEngine } from './types.js';
import { ClaudeAdapter } from './adapters/claude.js';
import { CodexAdapter } from './adapters/codex.js';
import { GeminiAdapter } from './adapters/gemini.js';
import { CustomAdapter } from './adapters/custom.js';
import { ENGINE_CLAUDE, ENGINE_CODEX, ENGINE_GEMINI, ENGINE_CUSTOM } from '../constants.js';

export function createAIEngine(config: AIConfig): AIEngine {
  if (config.command && config.engine !== ENGINE_CUSTOM) {
    return new CustomAdapter(config.command);
  }

  switch (config.engine) {
    case ENGINE_CLAUDE:
      return new ClaudeAdapter();
    case ENGINE_CODEX:
      return new CodexAdapter();
    case ENGINE_GEMINI:
      return new GeminiAdapter();
    case ENGINE_CUSTOM:
      if (!config.command) {
        throw new Error('custom engine requires a command in ai.command config');
      }
      return new CustomAdapter(config.command);
    default:
      throw new Error(`Unknown AI engine: ${config.engine}`);
  }
}
