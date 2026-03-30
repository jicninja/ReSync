export type AgentId = 'claude' | 'gemini' | 'kiro' | 'copilot' | 'cursor' | 'bmad';

export interface McpInstall {
  method: 'mcp-config';
  config: { command: string; args: string[]; env?: Record<string, string> };
}

export interface NpmInstall {
  method: 'npm';
  command: string;
}

export interface CopyInstall {
  method: 'copy';
  source: string;
  target: string;
}

export interface ManualInstall {
  method: 'manual';
  instructions: string;
}

export type InstallMethod = McpInstall | NpmInstall | CopyInstall | ManualInstall;

export interface Recommendation {
  type: 'mcp' | 'skill' | 'plugin' | 'extension';
  name: string;
  package: string;
  description: string;
  reason: string;
  install: InstallMethod;
  validated: boolean | null;
  agents: AgentId[];
  category: string;
}

export interface ToolkitRecommendations {
  stack: {
    detected: string[];
    format: string;
    multiAgent: boolean;
  };
  recommendations: Recommendation[];
  workflowGuidance: {
    complexity: 'simple' | 'medium' | 'complex';
    suggestedWorkflow: string;
    reason: string;
  };
}
