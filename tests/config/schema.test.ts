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
    expect(data.ai.engine).toBe('claude');
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
    expect(result.data.ai.engine).toBe('custom');
    expect(result.data.ai.command).toBe('/usr/local/bin/my-ai');
    expect(result.data.ai.max_parallel).toBe(8);
    expect(result.data.ai.model).toBe('my-model-v2');
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
});
