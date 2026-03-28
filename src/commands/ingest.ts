import * as path from 'node:path';
import * as fs from 'node:fs';
import { loadConfig } from '../config/loader.js';
import { StateManager } from '../state/manager.js';
import { RepoIngestor } from '../ingestors/repo/index.js';
import { JiraIngestor } from '../ingestors/jira/index.js';
import { DocsIngestor } from '../ingestors/docs/index.js';
import { rawDir, writeMarkdown } from '../utils/fs.js';
import { timestamp } from '../utils/markdown.js';
import { createTUI } from '../tui/factory.js';

export async function runIngest(
  dir: string,
  options: { source?: string; force?: boolean; auto?: boolean; ci?: boolean }
): Promise<void> {
  const tui = createTUI(options);
  const config = await loadConfig(dir);
  const state = new StateManager(dir);
  const outputDir = rawDir(dir);

  const sourceFilter = options.source;

  let repoFiles = 0;
  let jiraTickets = 0;
  let docsPages = 0;
  let repoRan = false;
  let jiraRan = false;
  let docsRan = false;

  tui.phaseHeader('INGEST', `Project: ${config.project.name}`);

  // Repo ingestor
  if (!sourceFilter || sourceFilter === 'repo') {
    tui.progress('Scanning repository...');
    const repoIngestor = new RepoIngestor(config.sources.repo, outputDir);
    const result = await repoIngestor.ingest();
    repoFiles = result.files;
    repoRan = true;
    tui.success(`repo/ — ${repoFiles} artifacts`);
  }

  // Jira ingestor
  if ((!sourceFilter || sourceFilter === 'jira') && config.sources.jira) {
    tui.progress('Fetching Jira tickets...');
    const jiraIngestor = new JiraIngestor(config.sources.jira, outputDir);
    const result = await jiraIngestor.ingest();
    jiraTickets = result.files;
    jiraRan = true;
    tui.success(`jira/ — ${jiraTickets} artifacts`);
  } else if (sourceFilter === 'jira' && !config.sources.jira) {
    tui.warn('Jira source not configured in respec.config.yaml — skipping');
  }

  // Context sources
  let contextCount = 0;
  if ((!sourceFilter || sourceFilter === 'context') && config.sources.context?.length) {
    tui.progress(`Scanning ${config.sources.context.length} context source(s)...`);
    for (const ctxSource of config.sources.context) {
      const ctxName = ctxSource.name ?? path.basename(ctxSource.path);
      const ctxOutputDir = path.join(outputDir, 'context', ctxName);
      const ctxIngestor = new RepoIngestor(
        { path: ctxSource.path, branch: ctxSource.branch, include: ctxSource.include, exclude: ctxSource.exclude },
        ctxOutputDir,
      );
      const result = await ctxIngestor.ingest();
      contextCount += result.files;

      tui.contextBox(ctxName, ctxSource.role, { files: result.files });

      // Write a role marker so analyzers know this is context, not primary
      writeMarkdown(path.join(ctxOutputDir, '_context-role.md'),
        `# Context Source: ${ctxName}\n\n**Role:** ${ctxSource.role}\n**Path:** ${ctxSource.path}\n\nThis source provides context for analysis but is NOT the target of the SDD.\n`);
    }
    tui.success(`context/ — ${contextCount} total files across ${config.sources.context.length} source(s)`);
  } else if (sourceFilter === 'context' && !config.sources.context?.length) {
    tui.warn('No context sources configured in respec.config.yaml — skipping');
  }

  // Docs ingestor
  if ((!sourceFilter || sourceFilter === 'docs') && config.sources.docs) {
    tui.progress('Ingesting documentation...');
    const docsIngestor = new DocsIngestor(config.sources.docs, outputDir, dir);
    const result = await docsIngestor.ingest();
    docsPages = result.files;
    docsRan = true;
    tui.success(`docs/ — ${docsPages} files written`);
  } else if (sourceFilter === 'docs' && !config.sources.docs) {
    tui.warn('Docs source not configured in respec.config.yaml — skipping');
  }

  // Write _manifest.md
  const manifestLines = [
    '# Raw Ingest Manifest',
    '',
    `**Generated:** ${timestamp()}`,
    `**Project:** ${config.project.name}`,
    '',
    '## Sources Ingested',
    '',
    `- **repo (primary)**: ${repoRan ? `yes (${repoFiles} files)` : 'skipped'}`,
    `- **context**: ${contextCount > 0 ? `yes (${contextCount} files across ${config.sources.context?.length ?? 0} sources)` : config.sources.context?.length ? 'skipped' : 'not configured'}`,
    `- **jira**: ${jiraRan ? `yes (${jiraTickets} artifacts)` : config.sources.jira ? 'skipped' : 'not configured'}`,
    `- **docs**: ${docsRan ? `yes (${docsPages} files)` : config.sources.docs ? 'skipped' : 'not configured'}`,
  ];

  if (config.sources.context?.length) {
    manifestLines.push('', '## Context Sources', '');
    for (const ctx of config.sources.context) {
      const name = ctx.name ?? path.basename(ctx.path);
      manifestLines.push(`- **${name}** — role: \`${ctx.role}\`, path: \`${ctx.path}\``);
    }
  }

  const manifestPath = path.join(outputDir, '_manifest.md');
  writeMarkdown(manifestPath, manifestLines.join('\n'));

  state.completeIngest({
    sources: {
      repo: repoRan,
      jira: jiraRan,
      docs: docsRan,
      context: contextCount > 0,
    },
    stats: {
      files: repoFiles,
      tickets: jiraTickets,
      pages: docsPages,
    },
  });

  tui.phaseSummary('INGEST COMPLETE', [
    { label: 'repo/', status: repoRan ? '✓' : '─', detail: repoRan ? `${repoFiles} artifacts` : 'skipped' },
    { label: 'context/', status: contextCount > 0 ? '✓' : '─', detail: contextCount > 0 ? `${contextCount} files` : 'skipped' },
    { label: 'jira/', status: jiraRan ? '✓' : '─', detail: jiraRan ? `${jiraTickets} artifacts` : config.sources.jira ? 'skipped' : 'not configured' },
    { label: 'docs/', status: docsRan ? '✓' : '─', detail: docsRan ? `${docsPages} files` : config.sources.docs ? 'skipped' : 'not configured' },
  ]);

  tui.setPhase('ingest');
  tui.writeDecisionLog(path.join(dir, '.respec'));
  tui.destroy();
}
