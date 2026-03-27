import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratorContext } from './types.js';

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

export function buildTaskPrompt(ctx: GeneratorContext): string {
  const sddContent = readFile(path.join(ctx.specsDir, 'sdd.md'));
  const businessRulesContent = readFile(path.join(ctx.analyzedDir, 'rules', 'business-rules.md'));
  const userFlowsContent = readFile(path.join(ctx.analyzedDir, 'flows', 'user-flows.md'));
  const entitiesContent = readFile(path.join(ctx.analyzedDir, 'domain', 'entities.md'));

  return `You are a senior product manager and technical lead generating an implementation task breakdown for the project "${ctx.projectName}".

Using the SDD and analyzed artifacts below, produce a structured set of epics, stories, and a migration plan.

## System Design Document

${sddContent || '(No SDD found — use analyzed artifacts to infer scope.)'}

## Business Rules

${businessRulesContent || '(No business rules file found.)'}

## User Flows

${userFlowsContent || '(No user flows file found.)'}

## Domain Entities

${entitiesContent || '(No entities file found.)'}

---

## Instructions

Produce the following outputs:

### 1. Epics (save as \`tasks/epics.md\`)

List all epics required to implement the system from scratch. Each epic should have:
- A unique identifier (EPIC-NNN)
- Title
- Description
- Acceptance criteria
- Estimated complexity (S/M/L/XL)

### 2. Stories (save as \`tasks/stories/{epic-slug}/story-NNN.md\`, one file per story)

For each epic, break it down into user stories. Each story should have:
- Story identifier
- User story format: "As a [role], I want [capability] so that [benefit]"
- Acceptance criteria (checklist)
- Technical notes

### 3. Migration Plan (save as \`tasks/migration-plan.md\`)

A phased migration plan covering:
- Pre-migration steps (data preparation, infrastructure)
- Migration phases with rollback strategies
- Validation checkpoints
- Post-migration cleanup

Output Markdown only, clearly labeled with intended file paths.`;
}
