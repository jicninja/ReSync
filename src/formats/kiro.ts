import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureDir, writeMarkdown } from '../utils/fs.js';
import { parseSectionHeaders, toKebabCase } from './context-parser.js';
import type { FormatAdapter, FormatContext } from './types.js';

function readIfExists(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export class KiroFormat implements FormatAdapter {
  name = 'kiro';

  async package(specsDir: string, outputDir: string, context: FormatContext): Promise<void> {
    const { projectName, projectDescription, sddContent, analyzedDir } = context;

    // Derive the raw dir: analyzedDir is typically /.respec/analyzed, raw is /.respec/raw
    const rawDir = analyzedDir ? path.join(analyzedDir, '..', 'raw') : '';

    // .kiro/steering/product.md
    writeMarkdown(
      path.join(outputDir, '.kiro', 'steering', 'product.md'),
      `# Product Overview\n\n## Project\n\n**Name:** ${projectName}\n\n**Description:** ${projectDescription}\n`
    );

    // .kiro/steering/tech.md
    const architectureContent = analyzedDir
      ? readIfExists(path.join(analyzedDir, 'infra', 'architecture.md'))
      : '';
    const dependenciesContent = rawDir
      ? readIfExists(path.join(rawDir, 'repo', 'dependencies.md'))
      : '';

    const techBody = architectureContent || '<!-- No architecture analysis found. Run `respec analyze` first. -->';
    const depsBody = dependenciesContent || '<!-- No dependencies file found. Run `respec ingest` first. -->';

    writeMarkdown(
      path.join(outputDir, '.kiro', 'steering', 'tech.md'),
      `# Tech Stack & Conventions\n\n${techBody}\n\n## Dependencies\n\n${depsBody}\n`
    );

    // .kiro/steering/structure.md
    const boundedContextsContent = analyzedDir
      ? readIfExists(path.join(analyzedDir, 'domain', 'bounded-contexts.md'))
      : '';
    const repoStructureContent = rawDir
      ? readIfExists(path.join(rawDir, 'repo', 'structure.md'))
      : '';

    const contextsBody = boundedContextsContent || '<!-- No bounded contexts found. Run `respec analyze` first. -->';
    const structureBody = repoStructureContent || '<!-- No directory layout found. Run `respec ingest` first. -->';

    writeMarkdown(
      path.join(outputDir, '.kiro', 'steering', 'structure.md'),
      `# Project Structure\n\n## Bounded Contexts\n\n${contextsBody}\n\n## Directory Layout\n\n${structureBody}\n`
    );

    // .kiro/specs/ — one folder per bounded context (if available), otherwise default domain-model
    const contextNames = boundedContextsContent
      ? parseSectionHeaders(boundedContextsContent)
      : [];

    if (contextNames.length > 0) {
      const entitiesContent = analyzedDir
        ? readIfExists(path.join(analyzedDir, 'domain', 'entities.md'))
        : '';
      const businessRulesContent = analyzedDir
        ? readIfExists(path.join(analyzedDir, 'rules', 'business-rules.md'))
        : '';

      for (const contextName of contextNames) {
        const slug = toKebabCase(contextName);
        const specBase = path.join(outputDir, '.kiro', 'specs', slug);

        // requirements.md
        const reqParts: string[] = [
          `# ${contextName} Requirements\n`,
          `## Overview\n\nRequirements derived from system design for **${contextName}** context.\n`,
        ];
        if (entitiesContent) {
          reqParts.push(`## Entities\n\n${entitiesContent}\n`);
        } else {
          reqParts.push(`## Entities\n\n<!-- No entities analysis found. Run \`respec analyze\` first. -->\n`);
        }
        if (businessRulesContent) {
          reqParts.push(`## Business Rules\n\n${businessRulesContent}\n`);
        } else {
          reqParts.push(`## Business Rules\n\n<!-- No business rules found. Run \`respec analyze\` first. -->\n`);
        }
        writeMarkdown(path.join(specBase, 'requirements.md'), reqParts.join('\n'));

        // design.md
        writeMarkdown(
          path.join(specBase, 'design.md'),
          `# ${contextName} Design\n\n## Overview\n\nDesign for the **${contextName}** bounded context.\n\n${sddContent}\n`
        );

        // tasks.md
        writeMarkdown(
          path.join(specBase, 'tasks.md'),
          `# ${contextName} Tasks\n\n## Implementation Tasks\n\n- [ ] Implement ${contextName} entities\n- [ ] Add business rules\n- [ ] Set up repositories\n- [ ] Write unit tests\n`
        );
      }
    } else {
      // Fallback: default domain-model skeleton
      writeMarkdown(
        path.join(outputDir, '.kiro', 'specs', 'domain-model', 'requirements.md'),
        `# Domain Model Requirements\n\n## Overview\n\nRequirements derived from system design for ${projectName}.\n\n## Functional Requirements\n\n<!-- Requirements extracted from SDD -->\n`
      );

      writeMarkdown(
        path.join(outputDir, '.kiro', 'specs', 'domain-model', 'design.md'),
        `# Domain Model Design\n\n## Overview\n\nDomain model design for ${projectName}.\n\n${sddContent}\n`
      );

      writeMarkdown(
        path.join(outputDir, '.kiro', 'specs', 'domain-model', 'tasks.md'),
        `# Domain Model Tasks\n\n## Implementation Tasks\n\n<!-- TODO: Break down implementation tasks for the domain model -->\n\n- [ ] Define core entities\n- [ ] Implement value objects\n- [ ] Set up aggregates\n- [ ] Configure repositories\n`
      );
    }
  }
}
