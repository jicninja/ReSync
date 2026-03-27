import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratorContext } from './types.js';

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

export function buildFormatPrompt(ctx: GeneratorContext): string {
  const contractsContent = readFile(path.join(ctx.analyzedDir, 'api', 'contracts.md'));
  const entitiesContent = readFile(path.join(ctx.analyzedDir, 'domain', 'entities.md'));

  return `You are a senior API designer generating formal contract schemas for the project "${ctx.projectName}".

Using the analyzed API contracts and domain entities below, produce per-entity contract schema files.

## API Contracts

${contractsContent || '(No contracts file found.)'}

## Domain Entities

${entitiesContent || '(No entities file found.)'}

---

## Instructions

For each entity and API contract identified in the artifacts above, produce a schema file saved as \`api/contracts/{entity}.schema.md\` (entity name in kebab-case).

Each schema file should contain:

1. **Entity Overview** — What this entity represents in the domain.
2. **Fields** — A table with: field name, type, required/optional, constraints, description.
3. **Request Schema** — JSON-like structure for create/update requests.
4. **Response Schema** — JSON-like structure for API responses.
5. **Validation Rules** — Field-level and entity-level validation constraints.
6. **Example** — A realistic example request and response pair.

Output Markdown only. Label each section with its intended file path (\`api/contracts/{entity}.schema.md\`).`;
}
