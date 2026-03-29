import * as fs from 'node:fs';
import * as path from 'node:path';
import { Version2Client } from 'jira.js';
import { loadConfig, resolveEnvAuth } from '../config/loader.js';
import { specsDir } from '../utils/fs.js';
import { parseEpics } from '../push/epic-parser.js';
import { createJiraIssues } from '../push/jira-pusher.js';

export async function runPushJira(
  dir: string,
  options: {
    project?: string;
    prefix?: string;
    epicsOnly?: boolean;
    dryRun?: boolean;
    ci?: boolean;
  },
): Promise<void> {
  const config = await loadConfig(dir);

  if (!config.sources.jira) {
    throw new Error('Jira not configured in respec.config.yaml. Add sources.jira with host and auth.');
  }

  const outputDir = specsDir(dir, config.output.dir);
  const epicsPath = path.join(outputDir, 'tasks', 'epics.md');

  if (!fs.existsSync(epicsPath)) {
    throw new Error(`No epics found at ${epicsPath}. Run 'respec generate' first.`);
  }

  const markdown = fs.readFileSync(epicsPath, 'utf-8');
  const epics = parseEpics(markdown);

  if (epics.length === 0) {
    throw new Error('No epics found in the generated tasks file.');
  }

  const project = options.project
    ?? config.sources.jira.filters?.projects?.[0];

  if (!project) {
    throw new Error('No Jira project specified. Use --project or configure jira.filters.projects.');
  }

  const prefix = options.prefix ?? '[ReSpec]';
  const epicsOnly = options.epicsOnly ?? false;

  // Dry run
  if (options.dryRun) {
    console.log(`\nDRY RUN — would create in ${project}:\n`);
    for (const epic of epics) {
      console.log(`  ${prefix} ${epic.id}: ${epic.title} (${epic.complexity})`);
      if (!epicsOnly) {
        for (const story of epic.stories) {
          console.log(`    ${prefix} ${story.title}`);
        }
      }
    }
    const storyCount = epicsOnly ? 0 : epics.reduce((sum, e) => sum + e.stories.length, 0);
    console.log(`\n  Total: ${epics.length} epics, ${storyCount} stories`);
    console.log(`  Label: respec`);
    return;
  }

  // Create Jira client
  const token = resolveEnvAuth(config.sources.jira.auth);
  const client = new Version2Client({
    host: config.sources.jira.host,
    authentication: {
      oauth2: { accessToken: token },
    },
  });

  console.log(`Pushing to Jira project ${project}...`);

  const result = await createJiraIssues(client, epics, {
    project,
    prefix,
    epicsOnly,
  });

  console.log(`\nCreated ${result.epicsCreated} epics, ${result.storiesCreated} stories in ${project}`);
  for (const issue of result.issues) {
    console.log(`  ${issue.key}: ${issue.summary}`);
  }
}
