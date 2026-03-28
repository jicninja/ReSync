import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratorContext } from './types.js';

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

export function buildADRPrompt(ctx: GeneratorContext): string {
  const architectureContent = readFile(path.join(ctx.analyzedDir, 'infra', 'architecture.md'));
  const externalDepsContent = readFile(path.join(ctx.analyzedDir, 'api', 'external-deps.md'));
  const dataStorageContent = readFile(path.join(ctx.analyzedDir, 'infra', 'data-storage.md'));

  return `You are a senior software architect generating Architecture Decision Records (ADRs) for the project "${ctx.projectName}".

IMPORTANT: You are running as a text-generation subprocess. Do NOT attempt to create files, use tools, or interact with any system. Your ONLY output is the raw Markdown text written to stdout. Everything you write goes directly into a single output file.

Using the analyzed infrastructure and API artifacts below, identify and document the key architectural decisions as ADRs.

## Architecture

${architectureContent || '(No architecture file found.)'}

## External Dependencies

${externalDepsContent || '(No external dependencies file found.)'}

## Data Storage

${dataStorageContent || '(No data storage file found.)'}

---

## Instructions

Identify all significant architectural decisions (technology choices, structural patterns, integration strategies, trade-offs made).

For each decision, produce an ADR section labeled as \`adrs/adr-NNN-{slug}.md\` (NNN is a zero-padded sequence number, slug is kebab-case title).

Each ADR must follow this template:

\`\`\`markdown
# ADR-NNN: {Title}

## Status
Proposed | Accepted | Deprecated | Superseded

## Context
What is the issue that motivated this decision or change?

## Decision
What is the change that we're actually proposing or doing?

## Consequences
What becomes easier or more difficult as a result of this change?

## Alternatives Considered
What other options were evaluated and why were they rejected?
\`\`\`

Output all ADRs as a single continuous Markdown document. Use headings to label each ADR with its intended path (e.g., \`## adrs/adr-001-example.md\`).`;
}
