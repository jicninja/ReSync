import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import * as clack from '@clack/prompts';
import { TOOLKIT_RECOMMENDATIONS_FILE } from '../constants.js';
import type { ToolkitRecommendations, Recommendation, AgentId } from './types.js';

const FORMAT_TO_AGENTS: Record<string, AgentId[]> = {
  superpowers: ['claude'],
  antigravity: ['gemini'],
  kiro: ['kiro'],
  openspec: ['claude', 'gemini', 'kiro', 'copilot', 'cursor', 'bmad'],
  speckit: ['copilot'],
  bmad: ['bmad'],
};

export function filterByAgent(recommendations: Recommendation[], format: string): Recommendation[] {
  const agents = FORMAT_TO_AGENTS[format];
  if (!agents) return recommendations;
  if (format === 'openspec') return recommendations;
  return recommendations.filter((r) => r.agents.some((a) => agents.includes(a)));
}

export function readRecommendations(generatedDir: string): ToolkitRecommendations | null {
  const filePath = path.join(generatedDir, TOOLKIT_RECOMMENDATIONS_FILE);
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    clack.log.warn(`Failed to read toolkit recommendations: ${message}`);
    return null;
  }
}

interface WizardOptions {
  format: string;
  ciMode: boolean;
  autoMode: boolean;
}

function groupByCategory(recs: Recommendation[]): Record<string, Recommendation[]> {
  const groups: Record<string, Recommendation[]> = {};
  for (const rec of recs) {
    const cat = rec.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(rec);
  }
  return groups;
}

function displayRecommendations(recs: Recommendation[], guidance: ToolkitRecommendations['workflowGuidance']): void {
  clack.log.step(`Suggested workflow: ${guidance.suggestedWorkflow}\n  (${guidance.reason})`);
  clack.log.message('');

  const groups = groupByCategory(recs);
  const unverified = recs.filter((r) => r.validated === false);

  for (const [category, items] of Object.entries(groups)) {
    const verifiedItems = items.filter((r) => r.validated !== false);
    if (verifiedItems.length === 0) continue;
    const label = category.charAt(0).toUpperCase() + category.slice(1);
    const lines = verifiedItems.map((r) => `  ${r.package || r.name} — ${r.description}`);
    clack.log.info(`${label} (${verifiedItems.length} tools)\n${lines.join('\n')}`);
  }

  if (unverified.length > 0) {
    const lines = unverified.map((r) => `  ${r.package || r.name} — ${r.description} [unverified]`);
    clack.log.warn(`Not verified (${unverified.length})\n${lines.join('\n')}`);
  }
}

function installRecommendation(rec: Recommendation): void {
  switch (rec.install.method) {
    case 'mcp-config':
      clack.log.success(`MCP config ready: ${rec.name} (add to your agent's MCP config)`);
      break;
    case 'npm':
      try {
        execSync(rec.install.command, { stdio: 'inherit' });
        clack.log.success(`Installed: ${rec.name}`);
      } catch {
        clack.log.warn(`Failed to install ${rec.name}. Run manually: ${rec.install.command}`);
      }
      break;
    case 'copy':
      clack.log.info(`Copy: ${rec.install.source} → ${rec.install.target}`);
      break;
    case 'manual':
      clack.log.info(`${rec.name}: ${rec.install.instructions}`);
      break;
  }
}

export async function runToolkitWizard(
  recs: ToolkitRecommendations,
  options: WizardOptions,
): Promise<void> {
  const filtered = filterByAgent(recs.recommendations, options.format);

  if (filtered.length === 0) {
    clack.log.info('No toolkit recommendations generated.');
    return;
  }

  displayRecommendations(filtered, recs.workflowGuidance);

  if (options.ciMode) {
    clack.log.info('CI mode — skipping installation. Recommendations logged above.');
    return;
  }

  if (options.autoMode) {
    const verified = filtered.filter((r) => r.validated === true);
    for (const rec of verified) { installRecommendation(rec); }
    clack.log.info(`Auto-installed ${verified.length} verified tools. ${filtered.length - verified.length} skipped (unverified).`);
    return;
  }

  const choice = await clack.select({
    message: 'Install recommendations?',
    options: [
      { value: 'select', label: 'Select individually' },
      { value: 'all', label: 'Yes to all' },
      { value: 'verified', label: 'Yes to all verified only' },
      { value: 'skip', label: 'Skip' },
    ],
  });

  if (clack.isCancel(choice) || choice === 'skip') return;

  let toInstall: Recommendation[] = [];

  if (choice === 'all') {
    toInstall = filtered;
  } else if (choice === 'verified') {
    toInstall = filtered.filter((r) => r.validated === true);
  } else if (choice === 'select') {
    const selected = await clack.multiselect({
      message: 'Select tools to install:',
      options: filtered.map((r) => ({
        value: r.name,
        label: `${r.package || r.name} — ${r.description}${r.validated === false ? ' [unverified]' : ''}`,
      })),
    });

    if (clack.isCancel(selected)) return;
    toInstall = filtered.filter((r) => (selected as string[]).includes(r.name));
  }

  for (const rec of toInstall) { installRecommendation(rec); }
}
