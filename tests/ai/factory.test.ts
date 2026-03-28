import { describe, it, expect } from 'vitest';
import { createAIEngine, createEngineFromConfig, createEngineChain } from '../../src/ai/factory.js';
import type { AIConfig, ResolvedAIConfig } from '../../src/ai/types.js';

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

describe('createEngineFromConfig', () => {
  it('creates claude adapter from engine name', () => {
    const engine = createEngineFromConfig('claude', {});
    expect(engine.name).toBe('claude');
  });

  it('creates gemini adapter from engine name', () => {
    const engine = createEngineFromConfig('gemini', {});
    expect(engine.name).toBe('gemini');
  });

  it('creates codex adapter from engine name', () => {
    const engine = createEngineFromConfig('codex', {});
    expect(engine.name).toBe('codex');
  });

  it('creates custom adapter when command is in engine config', () => {
    const engine = createEngineFromConfig('custom', { command: 'my-cli -p' });
    expect(engine.name).toBe('custom');
  });

  it('creates custom adapter when command override is on non-custom engine', () => {
    const engine = createEngineFromConfig('claude', { command: 'my-wrapper' });
    expect(engine.name).toBe('custom');
  });

  it('throws for custom engine without command', () => {
    expect(() => createEngineFromConfig('custom', {})).toThrow(
      'custom engine requires a command'
    );
  });

  it('throws for unknown engine name', () => {
    expect(() => createEngineFromConfig('openai', {})).toThrow('Unknown AI engine');
  });
});

describe('createEngineChain', () => {
  const resolvedConfig: ResolvedAIConfig = {
    timeout: 600,
    max_parallel: 4,
    engines: {
      claude: { model: 'opus' },
      gemini: { model: 'pro' },
    },
    phases: {
      analyze: ['claude', 'gemini'],
      generate: ['gemini'],
    },
  };

  it('returns engine chain for a defined phase', () => {
    const chain = createEngineChain('analyze', resolvedConfig);
    expect(chain).toHaveLength(2);
    expect(chain[0].name).toBe('claude');
    expect(chain[1].name).toBe('gemini');
  });

  it('returns single engine for phase with one engine', () => {
    const chain = createEngineChain('generate', resolvedConfig);
    expect(chain).toHaveLength(1);
    expect(chain[0].name).toBe('gemini');
  });

  it('falls back to first engine when phase is not defined', () => {
    const chain = createEngineChain('unknown-phase', resolvedConfig);
    expect(chain).toHaveLength(1);
    expect(chain[0].name).toBe('claude');
  });
});
