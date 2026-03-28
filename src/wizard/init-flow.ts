// src/wizard/init-flow.ts
import * as clack from '@clack/prompts';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { detectProject } from '../init/detect.js';
import { detectSiblings, type SiblingRepo } from '../init/siblings.js';
import {
  DEFAULT_AI_ENGINE,
  DEFAULT_AI_TIMEOUT_SECONDS,
  DEFAULT_MAX_PARALLEL,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_DIAGRAM_TYPE,
  RESPEC_DIR,
  CONFIG_FILENAME,
  OUTPUT_FORMATS,
} from '../constants.js';

export async function runInteractiveInit(dir: string): Promise<void> {
  const configPath = join(dir, CONFIG_FILENAME);

  if (fs.existsSync(configPath)) {
    clack.log.warn(`${CONFIG_FILENAME} already exists`);
    return;
  }

  const detected = detectProject(dir);
  const siblings = detectSiblings(dir);

  // Project name
  const name = await clack.text({
    message: 'Project name?',
    initialValue: detected.name,
  });
  if (clack.isCancel(name)) return;

  // Description
  const description = await clack.text({
    message: 'Description?',
    initialValue: detected.description,
  });
  if (clack.isCancel(description)) return;

  // Includes
  const includes = await clack.text({
    message: 'Source include patterns? (comma-separated)',
    initialValue: detected.includes.join(', '),
  });
  if (clack.isCancel(includes)) return;

  // Context sources
  let selectedSiblings: SiblingRepo[] = [];
  if (siblings.length > 0) {
    const choices = await clack.multiselect({
      message: `Found ${siblings.length} sibling repo(s). Add as context?`,
      options: siblings.map(s => ({
        value: s.name,
        label: `${s.name} (${s.role})`,
        hint: s.path,
      })),
      required: false,
    });
    if (!clack.isCancel(choices)) {
      selectedSiblings = siblings.filter(s => (choices as string[]).includes(s.name));
    }
  }

  // Jira
  let jiraConfig: Record<string, unknown> | undefined;
  const useJira = await clack.confirm({
    message: 'Connect Jira for ticket context?',
    initialValue: false,
  });
  if (!clack.isCancel(useJira) && useJira) {
    const host = await clack.text({
      message: 'Jira host?',
      placeholder: 'https://company.atlassian.net',
    });
    if (clack.isCancel(host)) return;

    const authVar = await clack.text({
      message: 'Jira auth (env variable name)?',
      initialValue: 'JIRA_API_TOKEN',
    });
    if (clack.isCancel(authVar)) return;

    const projects = await clack.text({
      message: 'Filter by projects? (comma-separated, empty to skip)',
      initialValue: '',
    });

    jiraConfig = {
      host: host as string,
      auth: `env:${authVar as string}`,
      ...(projects && !clack.isCancel(projects) && (projects as string).trim()
        ? { filters: { projects: (projects as string).split(',').map(p => p.trim()) } }
        : {}),
    };
  }

  // Confluence
  let docsConfig: Record<string, unknown> | undefined;
  const useConfluence = await clack.confirm({
    message: 'Connect Confluence for docs?',
    initialValue: false,
  });
  if (!clack.isCancel(useConfluence) && useConfluence) {
    const host = await clack.text({
      message: 'Confluence host?',
      placeholder: 'https://company.atlassian.net/wiki',
    });
    if (clack.isCancel(host)) return;

    const space = await clack.text({
      message: 'Confluence space key?',
      placeholder: 'ENG',
    });
    if (clack.isCancel(space)) return;

    const authVar = await clack.text({
      message: 'Confluence auth (env variable name)?',
      initialValue: 'CONFLUENCE_TOKEN',
    });
    if (clack.isCancel(authVar)) return;

    docsConfig = {
      confluence: {
        host: host as string,
        space: space as string,
        auth: `env:${authVar as string}`,
      },
    };
  }

  // Local docs
  const localDocs = await clack.text({
    message: 'Local docs paths? (comma-separated, empty to skip)',
    initialValue: '',
  });
  if (!clack.isCancel(localDocs) && (localDocs as string).trim()) {
    docsConfig = {
      ...docsConfig,
      local: (localDocs as string).split(',').map(p => p.trim()),
    };
  }

  // Output format
  const format = await clack.select({
    message: 'Output format?',
    options: OUTPUT_FORMATS.map(f => ({ value: f, label: f })),
  });
  if (clack.isCancel(format)) return;

  // Build config
  const includeList = (includes as string).split(',').map(p => p.trim()).filter(Boolean);
  const config: Record<string, unknown> = {
    project: {
      name: name as string,
      description: description as string,
      ...(detected.version ? { version: detected.version } : {}),
    },
    sources: {
      repo: {
        path: './',
        include: includeList,
        exclude: detected.excludes,
      },
      ...(selectedSiblings.length > 0 ? {
        context: selectedSiblings.map(s => ({
          name: s.name,
          path: s.path,
          role: s.role,
        })),
      } : {}),
      ...(jiraConfig ? { jira: jiraConfig } : {}),
      ...(docsConfig ? { docs: docsConfig } : {}),
    },
    ai: {
      engines: { [DEFAULT_AI_ENGINE]: {} },
      max_parallel: DEFAULT_MAX_PARALLEL,
      timeout: DEFAULT_AI_TIMEOUT_SECONDS,
    },
    output: {
      dir: DEFAULT_OUTPUT_DIR,
      format: format as string,
      diagrams: DEFAULT_DIAGRAM_TYPE,
      tasks: true,
    },
  };

  fs.writeFileSync(configPath, stringify(config), 'utf-8');
  clack.log.success(`Created ${CONFIG_FILENAME}`);

  // .gitignore
  const gitignorePath = join(dir, '.gitignore');
  const respecEntry = `${RESPEC_DIR}/`;
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes(respecEntry)) {
      fs.writeFileSync(gitignorePath, content.endsWith('\n')
        ? content + respecEntry + '\n'
        : content + '\n' + respecEntry + '\n', 'utf-8');
    }
  } else {
    fs.writeFileSync(gitignorePath, respecEntry + '\n', 'utf-8');
  }
}
