import type { GeneratorDef } from './types.js';

const GENERATORS: GeneratorDef[] = [
  // Tier 1 — parallel
  {
    id: 'erd-gen',
    reads: ['domain/entities.md', 'domain/bounded-contexts.md'],
    produces: ['domain/erd.mermaid', 'domain/context-map.mermaid'],
    tier: 1,
  },
  {
    id: 'flow-gen',
    reads: ['flows/user-flows.md', 'flows/data-flows.md'],
    produces: ['flows/*.mermaid'],
    tier: 1,
  },
  {
    id: 'adr-gen',
    reads: ['infra/architecture.md', 'api/external-deps.md'],
    produces: ['adrs/*.md'],
    tier: 1,
  },

  // Tier 2 — sequential (depends on tier 1 outputs being available for context)
  {
    id: 'sdd-gen',
    reads: ['domain/', 'flows/', 'rules/', 'api/', 'infra/'],
    produces: ['sdd.md'],
    tier: 2,
  },

  // Tier 3 — parallel
  {
    id: 'task-gen',
    reads: ['domain/', 'flows/', 'rules/', 'api/', 'infra/'],
    produces: ['tasks/epics.md', 'tasks/stories/', 'tasks/migration-plan.md'],
    tier: 3,
  },
  {
    id: 'format-gen',
    reads: ['api/contracts.md'],
    produces: ['api/contracts/'],
    tier: 3,
  },
  {
    id: 'toolkit-gen',
    reads: ['domain/bounded-contexts.md', 'infra/architecture.md'],
    produces: ['toolkit/recommendations.json'],
    tier: 3,
  },
];

export function getGeneratorRegistry(): GeneratorDef[] {
  return GENERATORS;
}

export function getGeneratorsByTier(tier: number): GeneratorDef[] {
  return GENERATORS.filter((g) => g.tier === tier);
}
