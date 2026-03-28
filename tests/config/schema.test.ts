import { describe, it, expect } from 'vitest';
import { configSchema } from '../../src/config/schema.js';

const minimalConfig = {
  project: {
    name: 'my-project',
  },
  sources: {
    repo: {
      path: './legacy-app',
    },
  },
  output: {},
};

describe('configSchema', () => {
  it('validates a minimal valid config', () => {
    const result = configSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const result = configSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const data = result.data;
    expect(data.sources.repo.branch).toBe('main');
    expect(data.output.dir).toBe('./specs');
    expect(data.output.format).toBe('openspec');
    expect(data.output.diagrams).toBe('mermaid');
    expect(data.output.tasks).toBe(true);
    expect(data.ai.engines).toBeDefined();
    expect(data.ai.engines.claude).toBeDefined();
    expect(data.ai.max_parallel).toBe(4);
    expect(data.ai.timeout).toBe(600);
  });

  it('rejects an invalid output format', () => {
    const invalid = {
      ...minimalConfig,
      output: { format: 'invalid-format' },
    };
    const result = configSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates jira filters config', () => {
    const withJira = {
      ...minimalConfig,
      sources: {
        ...minimalConfig.sources,
        jira: {
          host: 'https://mycompany.atlassian.net',
          auth: 'env:JIRA_API_TOKEN',
          filters: {
            projects: ['PROJ'],
            labels: ['frontend'],
            title_contains: ['payment'],
            types: ['Story', 'Bug'],
            status: ['In Progress'],
            sprints: ['Sprint 42'],
          },
        },
      },
    };
    const result = configSchema.safeParse(withJira);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sources.jira?.filters?.projects).toEqual(['PROJ']);
  });

  it('validates jira config with raw jql override', () => {
    const withJiraJql = {
      ...minimalConfig,
      sources: {
        ...minimalConfig.sources,
        jira: {
          host: 'https://mycompany.atlassian.net',
          auth: 'env:JIRA_API_TOKEN',
          filters: {
            jql: 'project = PROJ AND sprint = "Sprint 42"',
          },
        },
      },
    };
    const result = configSchema.safeParse(withJiraJql);
    expect(result.success).toBe(true);
  });

  it('validates ai config with custom engine', () => {
    const withCustomAi = {
      ...minimalConfig,
      ai: {
        engine: 'custom',
        command: '/usr/local/bin/my-ai',
        max_parallel: 8,
        timeout: 600,
        model: 'my-model-v2',
      },
    };
    const result = configSchema.safeParse(withCustomAi);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ai.engines.custom).toBeDefined();
    expect(result.data.ai.engines.custom.command).toBe('/usr/local/bin/my-ai');
    expect(result.data.ai.max_parallel).toBe(8);
    expect(result.data.ai.engines.custom.model).toBe('my-model-v2');
  });

  it('rejects ai.max_parallel outside 1-16 range', () => {
    const invalid = {
      ...minimalConfig,
      ai: { max_parallel: 20 },
    };
    const result = configSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates context sources array', () => {
    const withContext = {
      ...minimalConfig,
      sources: {
        ...minimalConfig.sources,
        context: [
          {
            path: './backend-api',
            role: 'api_provider',
            include: ['src/**/*.ts'],
          },
          {
            path: './shared-types',
            role: 'shared_types',
          },
        ],
      },
    };
    const result = configSchema.safeParse(withContext);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sources.context).toHaveLength(2);
  });

  it('rejects invalid context source role', () => {
    const invalid = {
      ...minimalConfig,
      sources: {
        ...minimalConfig.sources,
        context: [{ path: './something', role: 'unknown_role' }],
      },
    };
    const result = configSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates docs config with confluence and local', () => {
    const withDocs = {
      ...minimalConfig,
      sources: {
        ...minimalConfig.sources,
        docs: {
          confluence: {
            host: 'https://mycompany.atlassian.net/wiki',
            space: 'ENG',
            auth: 'env:CONFLUENCE_TOKEN',
          },
          local: ['./docs/**/*.md', './README.md'],
        },
      },
    };
    const result = configSchema.safeParse(withDocs);
    expect(result.success).toBe(true);
  });

  it('validates new multi-engine config format', () => {
    const withMultiEngine = {
      ...minimalConfig,
      ai: {
        timeout: 600,
        max_parallel: 4,
        engines: {
          claude: { model: 'opus', timeout: 900 },
          gemini: { model: 'pro' },
        },
        phases: {
          analyze: ['claude', 'gemini'],
          generate: 'gemini',
        },
      },
    };
    const result = configSchema.safeParse(withMultiEngine);
    expect(result.success).toBe(true);
  });

  it('rejects config with both engine and engines', () => {
    const invalid = {
      ...minimalConfig,
      ai: {
        engine: 'claude',
        engines: { claude: {} },
      },
    };
    const result = configSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects phase referencing undefined engine', () => {
    const invalid = {
      ...minimalConfig,
      ai: {
        engines: { claude: {} },
        phases: { analyze: ['openai'] },
      },
    };
    const result = configSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('preserves legacy config defaults after normalization', () => {
    const result = configSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ai.engines).toBeDefined();
    expect(result.data.ai.engines.claude).toBeDefined();
  });
});
