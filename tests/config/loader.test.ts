import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, resolveEnvAuth } from '../../src/config/loader.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'respec-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

const validConfigYaml = `
project:
  name: test-project
  version: "1.0.0"
  description: A test project

sources:
  repo:
    path: ./legacy-app
    branch: develop
    include:
      - src/**/*.ts
    exclude:
      - "**/*.test.ts"

output:
  dir: ./my-specs
  format: openspec
  diagrams: mermaid
  tasks: true
`;

describe('loadConfig', () => {
  it('loads and validates a valid config file', async () => {
    writeFileSync(join(tmpDir, 'respec.config.yaml'), validConfigYaml);
    const config = await loadConfig(tmpDir);
    expect(config.project.name).toBe('test-project');
    expect(config.project.version).toBe('1.0.0');
    expect(config.sources.repo.path).toBe('./legacy-app');
    expect(config.sources.repo.branch).toBe('develop');
    expect(config.output.dir).toBe('./my-specs');
  });

  it('applies schema defaults when optional fields are omitted', async () => {
    const minimalYaml = `
project:
  name: minimal-project

sources:
  repo:
    path: ./app

output: {}
`;
    writeFileSync(join(tmpDir, 'respec.config.yaml'), minimalYaml);
    const config = await loadConfig(tmpDir);
    expect(config.sources.repo.branch).toBe('main');
    expect(config.output.format).toBe('openspec');
    expect(config.output.diagrams).toBe('mermaid');
    expect(config.ai.engines).toBeDefined();
    expect(config.ai.engines.claude).toBeDefined();
    expect(config.ai.max_parallel).toBe(4);
  });

  it('throws if respec.config.yaml is missing', async () => {
    await expect(loadConfig(tmpDir)).rejects.toThrow('respec.config.yaml not found');
  });

  it('throws on invalid YAML syntax', async () => {
    writeFileSync(join(tmpDir, 'respec.config.yaml'), 'invalid: yaml: content: [unclosed');
    await expect(loadConfig(tmpDir)).rejects.toThrow();
  });

  it('throws formatted validation errors on invalid config', async () => {
    const invalidYaml = `
project:
  name: bad-config

sources:
  repo:
    path: ./app

output:
  format: not-a-valid-format
`;
    writeFileSync(join(tmpDir, 'respec.config.yaml'), invalidYaml);
    await expect(loadConfig(tmpDir)).rejects.toThrow();
  });
});

describe('resolveEnvAuth', () => {
  it('returns the value directly if it does not start with env:', () => {
    const result = resolveEnvAuth('plain-token-value');
    expect(result).toBe('plain-token-value');
  });

  it('resolves env: prefix from process.env', () => {
    process.env['TEST_RESPEC_TOKEN'] = 'my-secret-token';
    const result = resolveEnvAuth('env:TEST_RESPEC_TOKEN');
    expect(result).toBe('my-secret-token');
    delete process.env['TEST_RESPEC_TOKEN'];
  });

  it('throws if the env variable is not set', () => {
    delete process.env['RESPEC_MISSING_VAR'];
    expect(() => resolveEnvAuth('env:RESPEC_MISSING_VAR')).toThrow('RESPEC_MISSING_VAR');
  });
});
