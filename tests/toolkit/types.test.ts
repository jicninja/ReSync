import { describe, it, expect } from 'vitest';
import type {
  ToolkitRecommendations,
  Recommendation,
  AgentId,
  McpInstall,
  NpmInstall,
  CopyInstall,
  ManualInstall,
} from '../../src/toolkit/types.js';

describe('ToolkitRecommendations types', () => {
  it('accepts a valid recommendations object', () => {
    const recs: ToolkitRecommendations = {
      stack: { detected: ['nextjs', 'prisma'], format: 'superpowers', multiAgent: false },
      recommendations: [
        {
          type: 'mcp',
          name: 'test-mcp',
          package: '@test/mcp-server',
          description: 'Test MCP',
          reason: 'Test detected',
          install: { method: 'mcp-config', config: { command: 'npx', args: ['@test/mcp-server'] } },
          validated: true,
          agents: ['claude'],
          category: 'testing',
        },
      ],
      workflowGuidance: {
        complexity: 'medium',
        suggestedWorkflow: 'spec-driven',
        reason: 'test reason',
      },
    };
    expect(recs.recommendations).toHaveLength(1);
    expect(recs.stack.format).toBe('superpowers');
  });

  it('accepts all install method variants', () => {
    const mcp: McpInstall = { method: 'mcp-config', config: { command: 'npx', args: ['pkg'] } };
    const npm: NpmInstall = { method: 'npm', command: 'npm install -g pkg' };
    const copy: CopyInstall = { method: 'copy', source: '/a', target: '/b' };
    const manual: ManualInstall = { method: 'manual', instructions: 'Do this' };
    expect(mcp.method).toBe('mcp-config');
    expect(npm.method).toBe('npm');
    expect(copy.method).toBe('copy');
    expect(manual.method).toBe('manual');
  });

  it('accepts all valid agent IDs', () => {
    const agents: AgentId[] = ['claude', 'gemini', 'kiro', 'copilot', 'cursor', 'bmad'];
    expect(agents).toHaveLength(6);
  });
});
