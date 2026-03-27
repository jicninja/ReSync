import type { AnalyzerDef } from './types.js';

const ANALYZERS: AnalyzerDef[] = [
  // Tier 1 — parallel
  {
    id: 'domain-mapper',
    reads: ['raw/repo/models.md', 'raw/repo/modules/', 'raw/repo/endpoints.md'],
    produces: [
      'analyzed/domain/bounded-contexts.md',
      'analyzed/domain/entities.md',
      'analyzed/domain/glossary.md',
    ],
    promptFile: 'prompts/domain-mapper.md',
    tier: 1,
  },
  {
    id: 'infra-detector',
    reads: ['raw/repo/dependencies.md', 'raw/repo/env-vars.md', 'raw/repo/structure.md'],
    produces: ['analyzed/infra/architecture.md', 'analyzed/infra/data-storage.md'],
    promptFile: 'prompts/infra-detector.md',
    tier: 1,
  },
  {
    id: 'api-mapper',
    reads: ['raw/repo/endpoints.md', 'raw/repo/models.md'],
    produces: ['analyzed/api/contracts.md', 'analyzed/api/external-deps.md'],
    promptFile: 'prompts/api-mapper.md',
    tier: 1,
  },

  // Tier 2 — parallel (run after tier 1)
  {
    id: 'flow-extractor',
    reads: ['raw/repo/endpoints.md', 'raw/repo/modules/', 'raw/jira/stories.md'],
    produces: ['analyzed/flows/user-flows.md', 'analyzed/flows/data-flows.md'],
    promptFile: 'prompts/flow-extractor.md',
    tier: 2,
  },
  {
    id: 'rule-miner',
    reads: ['raw/repo/modules/', 'raw/jira/stories.md', 'raw/jira/bugs.md'],
    produces: ['analyzed/rules/business-rules.md', 'analyzed/rules/validation-rules.md'],
    promptFile: 'prompts/rule-miner.md',
    tier: 2,
  },
  {
    id: 'permission-scanner',
    reads: ['raw/repo/modules/', 'raw/repo/endpoints.md'],
    produces: ['analyzed/rules/permissions.md'],
    promptFile: 'prompts/permission-scanner.md',
    tier: 2,
  },
];

export function getAnalyzerRegistry(): AnalyzerDef[] {
  return ANALYZERS;
}

export function getAnalyzersByTier(tier: number): AnalyzerDef[] {
  return ANALYZERS.filter((a) => a.tier === tier);
}

export function getAnalyzerById(id: string): AnalyzerDef | undefined {
  return ANALYZERS.find((a) => a.id === id);
}
