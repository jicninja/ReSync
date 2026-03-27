import type { AIConfig, AIEngine } from './types.js';
import { ClaudeAdapter } from './adapters/claude.js';
import { CodexAdapter } from './adapters/codex.js';
import { GeminiAdapter } from './adapters/gemini.js';
import { CustomAdapter } from './adapters/custom.js';

export function createAIEngine(config: AIConfig): AIEngine {
  if (config.command && config.engine !== 'custom') {
    return new CustomAdapter(config.command);
  }

  switch (config.engine) {
    case 'claude':
      return new ClaudeAdapter();
    case 'codex':
      return new CodexAdapter();
    case 'gemini':
      return new GeminiAdapter();
    case 'custom':
      if (!config.command) {
        throw new Error('custom engine requires a command in ai.command config');
      }
      return new CustomAdapter(config.command);
    default:
      throw new Error(`Unknown AI engine: ${config.engine}`);
  }
}
