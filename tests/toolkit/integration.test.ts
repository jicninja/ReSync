import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRecommendations, filterByAgent } from '../../src/toolkit/wizard.js';
import { extractJSON } from '../../src/toolkit/json-parser.js';
import type { ToolkitRecommendations } from '../../src/toolkit/types.js';
import { TOOLKIT_RECOMMENDATIONS_FILE } from '../../src/constants.js';

let tmpDir: string;

const validRecommendations: ToolkitRecommendations = {
  stack: { detected: ['nextjs', 'prisma'], format: 'superpowers', multiAgent: false },
  recommendations: [
    {
      type: 'mcp', name: 'prisma-mcp', package: '@prisma/mcp-server',
      description: 'DB introspection', reason: 'Prisma detected',
      install: { method: 'mcp-config', config: { command: 'npx', args: ['@prisma/mcp-server'] } },
      validated: true, agents: ['claude', 'gemini', 'cursor'], category: 'database',
    },
    {
      type: 'skill', name: 'db-migrations', package: 'superpowers-skills-db',
      description: 'Migration workflows', reason: 'Prisma detected',
      install: { method: 'npm', command: 'npm install -g superpowers-skills-db' },
      validated: true, agents: ['claude'], category: 'database',
    },
    {
      type: 'extension', name: 'Prisma VS Code', package: 'Prisma.prisma',
      description: 'Prisma syntax highlighting', reason: 'Prisma detected',
      install: { method: 'manual', instructions: 'Install Prisma extension' },
      validated: true, agents: ['cursor'], category: 'database',
    },
  ],
  workflowGuidance: {
    complexity: 'medium',
    suggestedWorkflow: 'spec-driven with domain decomposition',
    reason: '2 bounded contexts detected',
  },
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-toolkit-integration-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Toolkit integration', () => {
  it('writes and reads recommendations.json round-trip', () => {
    const filePath = join(tmpDir, TOOLKIT_RECOMMENDATIONS_FILE);
    fs.mkdirSync(join(tmpDir, 'toolkit'), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(validRecommendations, null, 2));

    const result = readRecommendations(tmpDir);
    expect(result).toBeDefined();
    expect(result!.recommendations).toHaveLength(3);
    expect(result!.stack.detected).toContain('nextjs');
  });

  it('filters recommendations by superpowers format (claude only)', () => {
    const filtered = filterByAgent(validRecommendations.recommendations, 'superpowers');
    expect(filtered.every((r) => r.agents.includes('claude'))).toBe(true);
  });

  it('returns all recommendations for openspec format', () => {
    const filtered = filterByAgent(validRecommendations.recommendations, 'openspec');
    expect(filtered).toHaveLength(3);
  });

  it('extractJSON parses a simulated AI response', () => {
    const aiResponse = '```json\n' + JSON.stringify(validRecommendations) + '\n```';
    const parsed = extractJSON(aiResponse);
    expect(parsed).toBeDefined();
    expect(parsed!.recommendations).toHaveLength(3);
  });

  it('handles malformed recommendations.json gracefully', () => {
    const filePath = join(tmpDir, TOOLKIT_RECOMMENDATIONS_FILE);
    fs.mkdirSync(join(tmpDir, 'toolkit'), { recursive: true });
    fs.writeFileSync(filePath, '{ broken json');

    const result = readRecommendations(tmpDir);
    expect(result).toBeUndefined();
  });
});
