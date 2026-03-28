import { z } from 'zod';
import {
  DEFAULT_AI_ENGINE,
  DEFAULT_AI_TIMEOUT_SECONDS,
  DEFAULT_MAX_PARALLEL,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_DIAGRAM_TYPE,
  DEFAULT_REPO_BRANCH,
  OUTPUT_FORMATS,
  AI_ENGINES,
  CONTEXT_ROLES,
} from '../constants.js';
import { normalizeAiConfig } from './normalizer.js';

const projectSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
});

const repoSourceSchema = z.object({
  path: z.string(),
  branch: z.string().default(DEFAULT_REPO_BRANCH),
  role: z.literal('primary').optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
});

const contextSourceSchema = z.object({
  name: z.string().optional(),
  path: z.string(),
  role: z.enum(CONTEXT_ROLES),
  branch: z.string().default(DEFAULT_REPO_BRANCH),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
});

const jiraFiltersSchema = z.object({
  projects: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  title_contains: z.array(z.string()).optional(),
  types: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  sprints: z.array(z.string()).optional(),
  jql: z.string().optional(),
}).optional();

const jiraSourceSchema = z.object({
  host: z.string().url(),
  auth: z.string(),
  filters: jiraFiltersSchema,
}).optional();

const confluenceSchema = z.object({
  host: z.string(),
  space: z.string(),
  auth: z.string(),
});

const docsSourceSchema = z.object({
  confluence: confluenceSchema.optional(),
  local: z.array(z.string()).optional(),
}).optional();

const sourcesSchema = z.object({
  repo: repoSourceSchema,
  context: z.array(contextSourceSchema).optional(),
  jira: jiraSourceSchema,
  docs: docsSourceSchema,
});

export const aiEngineEnum = z.enum(AI_ENGINES);
export type AIEngineType = z.infer<typeof aiEngineEnum>;
// Backwards-compat alias (non-conflicting with AIEngine interface in src/ai/types.ts)
export type AIEngine = AIEngineType;

const engineConfigSchema = z.object({
  command: z.string().optional(),
  model: z.string().optional(),
  timeout: z.number().int().min(30).optional(),
}).passthrough();

const phaseValueSchema = z.union([z.string(), z.array(z.string())]);

const phasesSchema = z.object({
  analyze: phaseValueSchema.optional(),
  generate: phaseValueSchema.optional(),
}).optional();

const aiRawSchema = z.object({
  engine: aiEngineEnum.optional(),
  engines: z.record(z.string(), engineConfigSchema).optional(),
  command: z.string().optional(),
  model: z.string().optional(),
  max_parallel: z.number().int().min(1).max(16).optional(),
  timeout: z.number().int().min(30).optional(),
  phases: phasesSchema,
}).superRefine((data, ctx) => {
  if (data.engine !== undefined && data.engines !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cannot specify both "ai.engine" and "ai.engines". Use one format or the other.',
    });
    return;
  }

  if (data.engines && data.phases) {
    const engineNames = new Set(Object.keys(data.engines));
    for (const [phase, value] of Object.entries(data.phases)) {
      if (value === undefined) continue;
      const names = Array.isArray(value) ? value : [value];
      for (const name of names) {
        if (!engineNames.has(name)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Phase "${phase}" references undefined engine "${name}"`,
            path: ['phases', phase],
          });
        }
      }
    }
  }
});

const aiSchema = z.preprocess(
  (val) => val ?? {},
  aiRawSchema.transform((raw) => {
    // Apply defaults before normalizing: if neither engine nor engines specified, use default engine
    const withDefaults = {
      max_parallel: DEFAULT_MAX_PARALLEL,
      timeout: DEFAULT_AI_TIMEOUT_SECONDS,
      ...raw,
      ...(raw.engine === undefined && raw.engines === undefined
        ? { engine: DEFAULT_AI_ENGINE }
        : {}),
    };
    return normalizeAiConfig(withDefaults);
  }),
);

export const outputFormatEnum = z.enum(OUTPUT_FORMATS);
export type OutputFormat = z.infer<typeof outputFormatEnum>;

const outputSchema = z.object({
  dir: z.string().default(DEFAULT_OUTPUT_DIR),
  format: outputFormatEnum.default(DEFAULT_OUTPUT_FORMAT),
  diagrams: z.enum(['mermaid', 'none']).default(DEFAULT_DIAGRAM_TYPE),
  tasks: z.boolean().default(true),
});

export const configSchema = z.object({
  project: projectSchema,
  sources: sourcesSchema,
  ai: aiSchema,
  output: outputSchema,
});

export type ReSpecConfig = z.infer<typeof configSchema>;
