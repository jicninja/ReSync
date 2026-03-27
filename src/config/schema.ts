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
} from '../constants.js';

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
  path: z.string(),
  role: z.enum(['api_provider', 'shared_types', 'design_system']),
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
export type AIEngine = z.infer<typeof aiEngineEnum>;

const aiObjectSchema = z.object({
  engine: aiEngineEnum.default(DEFAULT_AI_ENGINE),
  command: z.string().optional(),
  max_parallel: z.number().int().min(1).max(16).default(DEFAULT_MAX_PARALLEL),
  timeout: z.number().int().min(30).default(DEFAULT_AI_TIMEOUT_SECONDS),
  model: z.string().optional(),
});

const aiSchema = z.preprocess((val) => val ?? {}, aiObjectSchema);

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
