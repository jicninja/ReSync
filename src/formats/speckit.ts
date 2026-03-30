import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeMarkdown } from '../utils/fs.js';
import { parseBoundedContexts, toKebabCase } from './context-parser.js';
import { offerFrameworkInstall } from './framework-installer.js';
import type { FormatAdapter, FormatContext } from './types.js';

function readIfExists(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

interface Feature {
  name: string;
  slug: string;
  descriptions: string[];
  entities: string[];
}

export class SpecKitFormat implements FormatAdapter {
  name = 'speckit';

  async package(specsDir: string, outputDir: string, context: FormatContext): Promise<void> {
    const { projectName, projectDescription, sddContent, analyzedDir, config, ciMode } = context;

    // Offer framework install
    await offerFrameworkInstall({
      name: 'Spec Kit',
      checkPath: path.join(outputDir, '.specify', 'templates'),
      installCommand: 'specify init',
      cwd: outputDir,
      ciMode,
    });

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

    // Read raw dependencies
    const rawDir = analyzedDir ? path.join(analyzedDir, '..', 'raw') : '';
    const dependencies = rawDir ? readIfExists(path.join(rawDir, 'repo', 'dependencies.md')) : '';

    // Read tasks from specs dir
    const tasksContent = context.specsDir ? readIfExists(path.join(context.specsDir, 'tasks.md')) : '';

    // Generate constitution.md
    const sddIntro = sddContent ? sddContent.split('\n').slice(0, 30).join('\n') : '';
    const constitutionParts: string[] = [
      `# ${projectName} — Constitution\n`,
      `## Project\n`,
      `**Name:** ${projectName}\n`,
    ];
    if (projectDescription) {
      constitutionParts.push(`**Description:** ${projectDescription}\n`);
    }
    if (sddIntro) {
      constitutionParts.push(`## System Overview\n\n${sddIntro}\n`);
    }
    if (businessRules) {
      constitutionParts.push(`## Business Rules\n\n${businessRules}\n`);
    }
    if (validationRules) {
      constitutionParts.push(`## Validation Rules\n\n${validationRules}\n`);
    }

    writeMarkdown(
      path.join(outputDir, '.specify', 'memory', 'constitution.md'),
      constitutionParts.join('\n'),
    );

    // Resolve features
    const features = this.resolveFeatures(analyzedDir, config);

    // Generate per-feature directories
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const num = String(i + 1).padStart(3, '0');
      const featureDir = path.join(outputDir, '.specify', 'specs', `${num}-${feature.slug}`);

      // spec.md
      const specParts: string[] = [
        `# ${feature.name}\n`,
      ];
      if (feature.descriptions.length > 0) {
        specParts.push(`## Overview\n\n${feature.descriptions.join('\n\n')}\n`);
      }
      if (userFlows) {
        specParts.push(`## User Flows\n\n${userFlows}\n`);
      }
      if (dataFlows) {
        specParts.push(`## Data Flows\n\n${dataFlows}\n`);
      }
      writeMarkdown(path.join(featureDir, 'spec.md'), specParts.join('\n'));

      // plan.md
      const planParts: string[] = [
        `# ${feature.name} — Plan\n`,
      ];
      if (architecture) {
        planParts.push(`## Architecture\n\n${architecture}\n`);
      }
      if (dependencies) {
        planParts.push(`## Dependencies\n\n${dependencies}\n`);
      }
      if (dataStorage) {
        planParts.push(`## Data Storage\n\n${dataStorage}\n`);
      }
      writeMarkdown(path.join(featureDir, 'plan.md'), planParts.join('\n'));

      // research.md
      const researchParts: string[] = [
        `# ${feature.name} — Research\n`,
      ];
      if (externalDeps) {
        researchParts.push(`## External Dependencies\n\n${externalDeps}\n`);
      }
      if (dependencies) {
        researchParts.push(`## Project Dependencies\n\n${dependencies}\n`);
      }
      writeMarkdown(path.join(featureDir, 'research.md'), researchParts.join('\n'));

      // data-model.md
      const dataModelParts: string[] = [
        `# ${feature.name} — Data Model\n`,
      ];
      if (feature.entities.length > 0) {
        dataModelParts.push(`## Entities\n\n${feature.entities.join(', ')}\n`);
      }
      if (entities) {
        dataModelParts.push(`## Entity Details\n\n${entities}\n`);
      }
      if (dataStorage) {
        dataModelParts.push(`## Storage\n\n${dataStorage}\n`);
      }
      writeMarkdown(path.join(featureDir, 'data-model.md'), dataModelParts.join('\n'));

      // tasks.md
      const tasksParts: string[] = [
        `# ${feature.name} — Tasks\n`,
      ];
      if (tasksContent) {
        tasksParts.push(tasksContent);
      } else {
        tasksParts.push(`- [ ] Implement ${feature.name}\n- [ ] Write tests\n- [ ] Update documentation\n`);
      }
      writeMarkdown(path.join(featureDir, 'tasks.md'), tasksParts.join('\n'));

      // contracts/api-spec.md (only if contracts exist)
      if (contracts) {
        const contractParts: string[] = [
          `# ${feature.name} — API Contracts\n`,
          contracts,
        ];
        writeMarkdown(path.join(featureDir, 'contracts', 'api-spec.md'), contractParts.join('\n'));
      }
    }
  }

  private resolveFeatures(analyzedDir: string, config: FormatContext['config']): Feature[] {
    // Mode 1: Manual mapping from config
    const mapping = config.output.speckit?.mapping;
    if (mapping && mapping.length > 0) {
      const allContexts = analyzedDir ? parseBoundedContexts(analyzedDir) : [];
      const contextMap = new Map(allContexts.map((c) => [c.name.toLowerCase(), c]));

      return mapping.map((group) => {
        const descriptions: string[] = [];
        const entities: string[] = [];

        for (const ctxName of group.contexts) {
          const ctx = contextMap.get(ctxName.toLowerCase());
          if (ctx) {
            descriptions.push(ctx.description);
            entities.push(...ctx.entities);
          }
        }

        return {
          name: group.name,
          slug: toKebabCase(group.name),
          descriptions,
          entities: [...new Set(entities)],
        };
      });
    }

    // Mode 2: Bounded contexts from analyzed data
    if (analyzedDir) {
      const contexts = parseBoundedContexts(analyzedDir);
      if (contexts.length > 0) {
        return contexts.map((ctx) => ({
          name: ctx.name,
          slug: ctx.slug,
          descriptions: [ctx.description],
          entities: ctx.entities,
        }));
      }
    }

    // Mode 3: Fallback — single feature
    return [
      {
        name: 'Full Reimplementation',
        slug: 'full-reimplementation',
        descriptions: [],
        entities: [],
      },
    ];
  }
}
