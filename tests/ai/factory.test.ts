import { describe, it, expect } from 'vitest';
import { createAIEngine } from '../../src/ai/factory.js';
import type { AIConfig } from '../../src/ai/types.js';

const baseConfig: AIConfig = {
  engine: 'claude',
  max_parallel: 4,
  timeout: 300,
};

describe('createAIEngine', () => {
  it('creates a claude adapter with name "claude"', () => {
    const engine = createAIEngine({ ...baseConfig, engine: 'claude' });
    expect(engine.name).toBe('claude');
  });

  it('creates a codex adapter with name "codex"', () => {
    const engine = createAIEngine({ ...baseConfig, engine: 'codex' });
    expect(engine.name).toBe('codex');
  });

  it('creates a gemini adapter with name "gemini"', () => {
    const engine = createAIEngine({ ...baseConfig, engine: 'gemini' });
    expect(engine.name).toBe('gemini');
  });

  it('creates a custom adapter when command is provided', () => {
    const engine = createAIEngine({
      ...baseConfig,
      engine: 'custom',
      command: '/usr/local/bin/my-ai',
    });
    expect(engine.name).toBe('custom');
  });

  it('throws if custom engine has no command', () => {
    expect(() =>
      createAIEngine({ ...baseConfig, engine: 'custom' }),
    ).toThrow('custom engine requires a command in ai.command config');
  });

  it('throws for unknown engine', () => {
    expect(() =>
      createAIEngine({ ...baseConfig, engine: 'unknown-engine' }),
    ).toThrow('Unknown AI engine: unknown-engine');
  });

  it('creates a custom adapter when command is provided even with non-custom engine', () => {
    const engine = createAIEngine({
      ...baseConfig,
      engine: 'claude',
      command: '/usr/local/bin/my-ai',
    });
    expect(engine.name).toBe('custom');
  });
});
