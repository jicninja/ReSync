import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolkitRecommendations } from '../../src/toolkit/types.js';

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  multiselect: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), success: vi.fn(), step: vi.fn(), message: vi.fn() },
  isCancel: vi.fn(() => false),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import * as clack from '@clack/prompts';
import { runToolkitWizard, readRecommendations, filterByAgent } from '../../src/toolkit/wizard.js';

const mockSelect = vi.mocked(clack.select);

const sampleRecs: ToolkitRecommendations = {
  stack: { detected: ['nextjs'], format: 'superpowers', multiAgent: false },
  recommendations: [
    {
      type: 'mcp', name: 'test-mcp', package: '@test/mcp',
      description: 'Test MCP', reason: 'test',
      install: { method: 'mcp-config', config: { command: 'npx', args: ['@test/mcp'] } },
      validated: true, agents: ['claude'], category: 'testing',
    },
    {
      type: 'mcp', name: 'gemini-only', package: '@gemini/mcp',
      description: 'Gemini MCP', reason: 'test',
      install: { method: 'mcp-config', config: { command: 'npx', args: ['@gemini/mcp'] } },
      validated: true, agents: ['gemini'], category: 'testing',
    },
  ],
  workflowGuidance: { complexity: 'medium', suggestedWorkflow: 'spec-driven', reason: 'test' },
};

beforeEach(() => { vi.clearAllMocks(); });

describe('filterByAgent', () => {
  it('filters recommendations by format agent mapping', () => {
    const filtered = filterByAgent(sampleRecs.recommendations, 'superpowers');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('test-mcp');
  });

  it('returns all for openspec format', () => {
    const filtered = filterByAgent(sampleRecs.recommendations, 'openspec');
    expect(filtered).toHaveLength(2);
  });
});

describe('runToolkitWizard', () => {
  it('skips wizard when no recommendations', async () => {
    const empty: ToolkitRecommendations = { ...sampleRecs, recommendations: [] };
    await runToolkitWizard(empty, { format: 'superpowers', ciMode: false, autoMode: false });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('skips interactive prompt in CI mode', async () => {
    await runToolkitWizard(sampleRecs, { format: 'superpowers', ciMode: true, autoMode: false });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('shows select prompt in interactive mode', async () => {
    mockSelect.mockResolvedValueOnce('skip');
    await runToolkitWizard(sampleRecs, { format: 'superpowers', ciMode: false, autoMode: false });
    expect(mockSelect).toHaveBeenCalled();
  });
});

describe('readRecommendations', () => {
  it('returns null for non-existent file', () => {
    const result = readRecommendations('/nonexistent/path');
    expect(result).toBeNull();
  });
});
