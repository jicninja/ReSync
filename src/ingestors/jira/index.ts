import * as path from 'node:path';
import { Version2Client } from 'jira.js';
import { resolveEnvAuth } from '../../config/loader.js';
import { writeMarkdown, ensureDir } from '../../utils/fs.js';
import { buildJQL, type JiraFilters } from './query-builder.js';
import { formatTicket, groupByType, type JiraTicket } from './formatter.js';
import type { Ingestor, IngestorResult } from '../types.js';

export interface JiraIngestorConfig {
  host: string;
  auth: string;
  filters?: JiraFilters;
}

export class JiraIngestor implements Ingestor {
  readonly name = 'jira';

  private config: JiraIngestorConfig;
  private outputDir: string;

  constructor(config: JiraIngestorConfig, outputDir: string) {
    this.config = config;
    this.outputDir = outputDir;
  }

  async ingest(): Promise<IngestorResult> {
    const artifacts: string[] = [];

    const token = resolveEnvAuth(this.config.auth);
    const jql = buildJQL(this.config.filters);

    const client = new Version2Client({
      host: this.config.host,
      authentication: {
        personalAccessToken: token,
      },
    });

    const tickets = await this.fetchAllTickets(client, jql);

    const jiraOutputDir = path.join(this.outputDir, 'jira');
    ensureDir(jiraOutputDir);

    const grouped = groupByType(tickets);

    // Determine file name for each type
    const typeFileMap: Record<string, string> = {
      'Epic': 'epics.md',
      'Story': 'stories.md',
      'Bug': 'bugs.md',
    };

    for (const [typeName, typeTickets] of grouped) {
      const fileName = typeFileMap[typeName] ?? `${typeName.toLowerCase().replace(/\s+/g, '-')}.md`;
      const filePath = path.join(jiraOutputDir, fileName);

      const lines: string[] = [
        `# ${typeName}s`,
        '',
        `_${typeTickets.length} ticket(s) ingested_`,
        '',
      ];

      for (const ticket of typeTickets) {
        lines.push(formatTicket(ticket));
        lines.push('');
      }

      writeMarkdown(filePath, lines.join('\n'));
      artifacts.push(filePath);
    }

    // Write manifest
    const manifestLines = [
      '# Raw Ingest Manifest — Jira',
      '',
      `**Ingested at:** ${new Date().toISOString()}`,
      `**Host:** ${this.config.host}`,
      `**JQL:** ${jql || '(none)'}`,
      `**Total tickets:** ${tickets.length}`,
      '',
      '## Artifacts Produced',
      '',
      ...artifacts.map((a) => `- \`${path.relative(this.outputDir, a)}\``),
    ];

    const manifestPath = path.join(jiraOutputDir, '_manifest.md');
    writeMarkdown(manifestPath, manifestLines.join('\n'));
    artifacts.push(manifestPath);

    return {
      files: artifacts.length,
      artifacts,
    };
  }

  private async fetchAllTickets(client: Version2Client, jql: string): Promise<JiraTicket[]> {
    const allTickets: JiraTicket[] = [];
    const batchSize = 100;
    let startAt = 0;
    let total = Infinity;

    while (startAt < total) {
      const response = await client.issueSearch.searchForIssuesUsingJql({
        jql: jql || undefined,
        startAt,
        maxResults: batchSize,
        fields: ['summary', 'issuetype', 'status', 'labels', 'description', 'issuelinks', 'comment'],
      });

      const issues = (response.issues ?? []) as JiraTicket[];
      allTickets.push(...issues);

      total = response.total ?? 0;
      startAt += issues.length;

      // Break if we got fewer than requested (end of results)
      if (issues.length < batchSize) {
        break;
      }
    }

    return allTickets;
  }
}
