import { describe, it, expect } from 'vitest';
import { normalizeAiConfig } from '../../src/config/normalizer.js';

describe('normalizeAiConfig', () => {
  it('passes through new format unchanged', () => {
    const input = {
      timeout: 600,
      max_parallel: 4,
      engines: { claude: { model: 'opus' }, gemini: {} },
      phases: { analyze: ['claude', 'gemini'], generate: 'gemini' },
    };
    const result = normalizeAiConfig(input);
    expect(result.engines).toEqual({ claude: { model: 'opus' }, gemini: {} });
    expect(result.phases.analyze).toEqual(['claude', 'gemini']);
    expect(result.phases.generate).toEqual(['gemini']);
  });

  it('normalizes legacy single-engine format', () => {
    const input = {
      engine: 'claude',
      timeout: 600,
      max_parallel: 4,
      model: 'opus',
    };
    const result = normalizeAiConfig(input);
    expect(result.engines).toEqual({ claude: { model: 'opus' } });
    expect(result.phases).toEqual({});
    expect(result.timeout).toBe(600);
    expect(result.max_parallel).toBe(4);
  });

  it('normalizes legacy custom engine with command', () => {
    const input = {
      engine: 'custom',
      command: 'my-cli -p',
      timeout: 300,
      max_parallel: 2,
    };
    const result = normalizeAiConfig(input);
    expect(result.engines).toEqual({ custom: { command: 'my-cli -p' } });
  });

  it('normalizes legacy format with command override on non-custom engine', () => {
    const input = {
      engine: 'claude',
      command: 'my-claude-wrapper',
      timeout: 600,
      max_parallel: 4,
    };
    const result = normalizeAiConfig(input);
    expect(result.engines).toEqual({ claude: { command: 'my-claude-wrapper' } });
  });

  it('normalizes string phase values to arrays', () => {
    const input = {
      timeout: 600,
      max_parallel: 4,
      engines: { gemini: {} },
      phases: { analyze: 'gemini', generate: 'gemini' },
    };
    const result = normalizeAiConfig(input);
    expect(result.phases.analyze).toEqual(['gemini']);
    expect(result.phases.generate).toEqual(['gemini']);
  });

  it('applies global defaults when missing', () => {
    const input = {
      engines: { claude: {} },
    };
    const result = normalizeAiConfig(input);
    expect(result.timeout).toBe(600);
    expect(result.max_parallel).toBe(4);
  });

  it('throws if both engine and engines are present', () => {
    const input = {
      engine: 'claude',
      engines: { claude: {} },
    };
    expect(() => normalizeAiConfig(input)).toThrow(
      'Cannot specify both "ai.engine" and "ai.engines"'
    );
  });

  it('throws if phase references undefined engine', () => {
    const input = {
      engines: { claude: {} },
      phases: { analyze: ['claude', 'openai'] },
    };
    expect(() => normalizeAiConfig(input)).toThrow(
      'Phase "analyze" references undefined engine "openai"'
    );
  });

  it('throws if engines map is empty', () => {
    const input = { engines: {} };
    expect(() => normalizeAiConfig(input)).toThrow('At least one engine must be defined');
  });

  it('throws if engine name is not a known engine type', () => {
    const input = { engines: { openai: {} } };
    expect(() => normalizeAiConfig(input)).toThrow('Unknown engine name "openai"');
  });
});
