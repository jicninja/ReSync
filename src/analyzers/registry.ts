import type { AnalyzerDef } from './types.js';

const ANALYZERS: AnalyzerDef[] = [
  // Tier 1 — parallel
  {
    id: 'domain-mapper',
    reads: ['repo/models.md', 'repo/modules/', 'repo/endpoints.md'],
    produces: [
      'domain/bounded-contexts.md',
      'domain/entities.md',
      'domain/glossary.md',
    ],
    promptFile: 'prompts/domain-mapper.md',
    tier: 1,
  },
  {
    id: 'infra-detector',
    reads: ['repo/dependencies.md', 'repo/env-vars.md', 'repo/structure.md'],
    produces: ['infra/architecture.md', 'infra/data-storage.md'],
    promptFile: 'prompts/infra-detector.md',
    tier: 1,
  },
  {
    id: 'api-mapper',
    reads: ['repo/endpoints.md', 'repo/models.md'],
    produces: ['api/contracts.md', 'api/external-deps.md'],
    promptFile: 'prompts/api-mapper.md',
    tier: 1,
  },

  // Tier 2 — parallel (run after tier 1)
  {
    id: 'flow-extractor',
    reads: ['repo/endpoints.md', 'repo/modules/', 'jira/stories.md'],
    produces: ['flows/user-flows.md', 'flows/data-flows.md'],
    promptFile: 'prompts/flow-extractor.md',
    tier: 2,
  },
  {
    id: 'rule-miner',
    reads: ['repo/modules/', 'jira/stories.md', 'jira/bugs.md'],
    produces: ['rules/business-rules.md', 'rules/validation-rules.md'],
    promptFile: 'prompts/rule-miner.md',
    tier: 2,
  },
  {
    id: 'permission-scanner',
    reads: ['repo/modules/', 'repo/endpoints.md'],
    produces: ['rules/permissions.md'],
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
