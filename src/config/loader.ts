import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { configSchema, ReSpecConfig } from './schema.js';
import { CONFIG_FILENAME } from '../constants.js';

export async function loadConfig(dir: string): Promise<ReSpecConfig> {
  const configPath = join(dir, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    throw new Error(`${CONFIG_FILENAME} not found in ${dir}`);
  }

  const raw = readFileSync(configPath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse ${CONFIG_FILENAME}: ${message}`);
  }

  const result = configSchema.safeParse(parsed);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid ${CONFIG_FILENAME}:\n${formatted}`);
  }

  return result.data;
}

export function resolveEnvAuth(value: string): string {
  if (!value.startsWith('env:')) {
    return value;
  }

  const varName = value.slice(4);
  const resolved = process.env[varName];

  if (resolved === undefined) {
    throw new Error(
      `Environment variable ${varName} is not set (referenced as "env:${varName}" in config)`
    );
  }

  return resolved;
}
