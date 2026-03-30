import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratorContext } from './types.js';
import { FORMAT_OPENSPEC } from '../constants.js';

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

function isMultiAgent(format: string): boolean {
  return format === FORMAT_OPENSPEC;
}

export function buildToolkitPrompt(ctx: GeneratorContext): string {
  let dependenciesContent = '';
  if (ctx.rawDir) {
    dependenciesContent = readFile(path.join(ctx.rawDir, 'repo', 'dependencies.md'));
  }

  const boundedContexts = readFile(path.join(ctx.analyzedDir, 'domain', 'bounded-contexts.md'));
  const architecture = readFile(path.join(ctx.analyzedDir, 'infra', 'architecture.md'));

  const multiAgent = isMultiAgent(ctx.format);

  return `You are an AI toolkit advisor generating tool recommendations for the project "${ctx.projectName}".

IMPORTANT: You are running as a text-generation subprocess. Do NOT attempt to create files, use tools, or interact with any system. Your ONLY output is raw JSON text written to stdout.

## Project Dependencies

${dependenciesContent || '(No dependency data available.)'}

## Architecture

${architecture || '(No architecture data available.)'}

## Domain Complexity

${boundedContexts || '(No bounded context data available.)'}

## Target Configuration

- Export format: ${ctx.format}
- Multi-agent: ${multiAgent}

## Instructions

Based on the project dependencies, architecture, and domain complexity above, recommend MCP servers, skills, plugins, and IDE extensions that would help developers working on this project.

Return ONLY valid JSON matching this exact schema — no markdown wrapping, no explanation text:

\`\`\`
{
  "stack": {
    "detected": ["framework1", "lib2"],
    "format": "${ctx.format}",
    "multiAgent": ${multiAgent}
  },
  "recommendations": [
    {
      "type": "mcp",
      "name": "human-readable-name",
      "package": "@scope/package-name",
      "description": "one-line description",
      "reason": "why this is recommended based on detected stack",
      "install": {
        "method": "mcp-config",
        "config": {
          "command": "npx",
          "args": ["@scope/package-name"]
        }
      },
      "validated": null,
      "agents": ["claude", "gemini"],
      "category": "database"
    }
  ],
  "workflowGuidance": {
    "complexity": "medium",
    "suggestedWorkflow": "description of recommended development workflow",
    "reason": "why this workflow fits the project"
  }
}
\`\`\`

Rules:
- Only recommend tools you know with certainty exist. Include the exact npm package name.
- For MCPs, use the "mcp-config" install method with the exact command and args.
- For skills and plugins, use the "npm" install method with the full install command.
- For IDE extensions, use the "manual" install method with clear instructions.
- The "agents" array should list which AI agents support this tool. Valid IDs: claude, gemini, kiro, copilot, cursor, bmad.
- Group recommendations by category (database, frontend, testing, devops, api, monitoring, etc.).
- Assess project complexity from the bounded contexts and architecture to inform workflowGuidance.
- Return ONLY the JSON object. No markdown, no explanation.`;
}
