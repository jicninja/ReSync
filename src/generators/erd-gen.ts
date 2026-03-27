import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratorContext } from './types.js';

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

export function buildERDPrompt(ctx: GeneratorContext): string {
  const entitiesContent = readFile(path.join(ctx.analyzedDir, 'domain', 'entities.md'));
  const boundedContextsContent = readFile(path.join(ctx.analyzedDir, 'domain', 'bounded-contexts.md'));
  const aggregatesContent = readFile(path.join(ctx.analyzedDir, 'domain', 'aggregates.md'));

  return `You are a senior software architect generating entity-relationship and context map diagrams for the project "${ctx.projectName}".

Using the analyzed domain artifacts below, produce two Mermaid diagrams:

1. An ERD (Entity Relationship Diagram) showing all entities and their relationships.
2. A context map showing bounded contexts and their integrations.

## Domain Entities

${entitiesContent || '(No entities file found.)'}

## Bounded Contexts

${boundedContextsContent || '(No bounded contexts file found.)'}

## Aggregates

${aggregatesContent || '(No aggregates file found.)'}

---

## Instructions

Produce two outputs:

### 1. ERD (save as \`domain/erd.mermaid\`)

Use Mermaid \`erDiagram\` syntax. Include all entities, their attributes, and relationships (one-to-one, one-to-many, many-to-many).

### 2. Context Map (save as \`domain/context-map.mermaid\`)

Use Mermaid \`graph LR\` syntax. Show each bounded context as a node and draw edges labeled with the integration pattern (e.g., Shared Kernel, Customer/Supplier, Conformist, Anti-Corruption Layer).

Output only the Mermaid diagram code blocks, clearly labeled.`;
}
