import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratorContext } from './types.js';

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

export function buildFlowPrompt(ctx: GeneratorContext): string {
  const userFlowsContent = readFile(path.join(ctx.analyzedDir, 'flows', 'user-flows.md'));
  const dataFlowsContent = readFile(path.join(ctx.analyzedDir, 'flows', 'data-flows.md'));
  const integrationFlowsContent = readFile(path.join(ctx.analyzedDir, 'flows', 'integration-flows.md'));

  return `You are a senior software architect generating flow diagrams for the project "${ctx.projectName}".

Using the analyzed flow artifacts below, produce Mermaid diagrams for each significant user flow, data flow, and integration flow.

## User Flows

${userFlowsContent || '(No user flows file found.)'}

## Data Flows

${dataFlowsContent || '(No data flows file found.)'}

## Integration Flows

${integrationFlowsContent || '(No integration flows file found.)'}

---

## Instructions

For each distinct flow identified in the artifacts above:

1. Create a Mermaid \`sequenceDiagram\` or \`flowchart TD\` diagram (choose the most appropriate type).
2. Label each diagram clearly with the flow name.
3. Save each diagram as \`flows/{flow-name}.mermaid\` (use kebab-case for file names).

Diagrams should show actors, system components, decision points, and data transformations.
Output only the Mermaid diagram code blocks, clearly labeled with their intended file names.`;
}
