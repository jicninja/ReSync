import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseBoundedContexts, toKebabCase } from './context-parser.js';
import { offerFrameworkInstall } from './framework-installer.js';
import { ensureDir, writeMarkdown } from '../utils/fs.js';
import type { FormatAdapter, FormatContext } from './types.js';

function readIfExists(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

export class BmadFormat implements FormatAdapter {
  name = 'bmad';

  async package(specsDir: string, outputDir: string, context: FormatContext): Promise<void> {
    const { projectName, projectDescription, sddContent, analyzedDir, config, ciMode } = context;

    await offerFrameworkInstall({
      name: 'BMAD Method',
      checkPath: path.join(outputDir, '_bmad'),
      installCommand: 'npx bmad-method install',
      cwd: outputDir,
      ciMode,
    });

    const bmadOutput = path.join(outputDir, '_bmad-output');

    // Read analyzed files
    const businessRules = analyzedDir ? readIfExists(path.join(analyzedDir, 'rules', 'business-rules.md')) : '';
    const validationRules = analyzedDir ? readIfExists(path.join(analyzedDir, 'rules', 'validation-rules.md')) : '';
    const userFlows = analyzedDir ? readIfExists(path.join(analyzedDir, 'flows', 'user-flows.md')) : '';
    const dataFlows = analyzedDir ? readIfExists(path.join(analyzedDir, 'flows', 'data-flows.md')) : '';
    const architecture = analyzedDir ? readIfExists(path.join(analyzedDir, 'infra', 'architecture.md')) : '';
    const dataStorage = analyzedDir ? readIfExists(path.join(analyzedDir, 'infra', 'data-storage.md')) : '';
    const entities = analyzedDir ? readIfExists(path.join(analyzedDir, 'domain', 'entities.md')) : '';
    const contracts = analyzedDir ? readIfExists(path.join(analyzedDir, 'api', 'contracts.md')) : '';
    const externalDeps = analyzedDir ? readIfExists(path.join(analyzedDir, 'api', 'external-deps.md')) : '';
    const glossary = analyzedDir ? readIfExists(path.join(analyzedDir, 'domain', 'glossary.md')) : '';
    const permissions = analyzedDir ? readIfExists(path.join(analyzedDir, 'rules', 'permissions.md')) : '';
    const tasks = context.specsDir ? readIfExists(path.join(context.specsDir, 'tasks.md')) : '';

    // planning-artifacts/PRD.md
    const prdParts: string[] = [
      `# ${projectName} — Product Requirements Document\n`,
      `## Project Overview\n\n${projectDescription}\n`,
      `## From SDD\n\n${sddContent}\n`,
    ];
    if (businessRules) {
      prdParts.push(`## Functional Requirements\n\n${businessRules}\n`);
    }
    if (validationRules) {
      prdParts.push(`## Validation Rules\n\n${validationRules}\n`);
    }
    if (externalDeps) {
      prdParts.push(`## External Integrations\n\n${externalDeps}\n`);
    }
    writeMarkdown(path.join(bmadOutput, 'planning-artifacts', 'PRD.md'), prdParts.join('\n'));

    // planning-artifacts/architecture.md
    const archParts: string[] = [
      `# Architecture\n`,
    ];
    if (architecture) {
      archParts.push(`## Architecture Overview\n\n${architecture}\n`);
    }
    if (dataStorage) {
      archParts.push(`## Data Storage\n\n${dataStorage}\n`);
    }
    if (entities) {
      archParts.push(`## Data Model\n\n${entities}\n`);
    }
    if (contracts) {
      archParts.push(`## API Design\n\n${contracts}\n`);
    }
    if (permissions) {
      archParts.push(`## Security\n\n${permissions}\n`);
    }
    writeMarkdown(path.join(bmadOutput, 'planning-artifacts', 'architecture.md'), archParts.join('\n'));

    // planning-artifacts/ux-spec.md
    const uxParts: string[] = [
      `# UX Specification\n`,
    ];
    if (userFlows) {
      uxParts.push(`## User Flows\n\n${userFlows}\n`);
    }
    if (dataFlows) {
      uxParts.push(`## Data Flows\n\n${dataFlows}\n`);
    }
    writeMarkdown(path.join(bmadOutput, 'planning-artifacts', 'ux-spec.md'), uxParts.join('\n'));

    // planning-artifacts/epics/
    const contexts = analyzedDir ? parseBoundedContexts(analyzedDir) : [];
    for (let i = 0; i < contexts.length; i++) {
      const ctx = contexts[i];
      const epicNum = i + 1;
      const epicSlug = toKebabCase(ctx.name);
      const entityList = ctx.entities.length > 0
        ? ctx.entities.map((e) => `- ${e}`).join('\n')
        : '<!-- No entities identified -->';

      const epicContent = [
        `# Epic ${epicNum}: ${ctx.name}\n`,
        `## Description\n\n${ctx.description}\n`,
        `## Entities\n\n${entityList}\n`,
        `## Stories\n\n<!-- No tasks available to derive stories -->\n`,
        `## Acceptance Criteria\n\n<!-- Derived from business rules for this context -->\n`,
      ].join('\n');

      writeMarkdown(
        path.join(bmadOutput, 'planning-artifacts', 'epics', `epic-${epicNum}-${epicSlug}.md`),
        epicContent,
      );
    }

    // project-context.md
    const projectContextParts: string[] = [
      `# Project Context\n`,
      `## Overview\n\n${projectDescription}\n`,
    ];
    if (glossary) {
      projectContextParts.push(`## Glossary\n\n${glossary}\n`);
    }
    if (permissions) {
      projectContextParts.push(`## Permissions\n\n${permissions}\n`);
    }
    if (contexts.length > 0) {
      const epicsList = contexts.map((ctx, i) => `- Epic ${i + 1}: ${ctx.name}`).join('\n');
      projectContextParts.push(`## Epics\n\n${epicsList}\n`);
    }
    writeMarkdown(path.join(bmadOutput, 'project-context.md'), projectContextParts.join('\n'));

    // implementation-artifacts/sprint-status.yaml
    const yamlContent = `# Sprint Status
status: not_started
current_sprint: 1
epics: []
`;
    const yamlPath = path.join(bmadOutput, 'implementation-artifacts', 'sprint-status.yaml');
    ensureDir(path.dirname(yamlPath));
    fs.writeFileSync(yamlPath, yamlContent, 'utf-8');
  }
}
