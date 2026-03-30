import * as fs from 'node:fs';
import * as path from 'node:path';
import { stringify } from 'yaml';
import {
  DEFAULT_AI_ENGINE,
  DEFAULT_AI_TIMEOUT_SECONDS,
  DEFAULT_MAX_PARALLEL,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_DIAGRAM_TYPE,
  DEFAULT_REPO_BRANCH,
  RESPEC_DIR,
  CONFIG_FILENAME,
} from '../constants.js';
import { detectProject } from '../init/detect.js';
import { detectSiblings } from '../init/siblings.js';

export interface InitOptions {
  repo?: string;
}

export async function runInit(dir: string, options?: InitOptions): Promise<void> {
  const configPath = path.join(dir, CONFIG_FILENAME);

  if (fs.existsSync(configPath)) {
    console.log(`${CONFIG_FILENAME} already exists at ${configPath}`);
    return;
  }

  const project = detectProject(dir);
  const siblings = detectSiblings(dir);

  const config: Record<string, unknown> = {
    project: {
      name: project.name,
      description: project.description,
      ...(project.version ? { version: project.version } : {}),
    },
    sources: {
      repo: {
        path: options?.repo ?? './',
        branch: DEFAULT_REPO_BRANCH,
        include: project.includes,
        exclude: project.excludes,
      },
      ...(siblings.length > 0 ? {
        context: siblings.map(s => ({
          name: s.name,
          path: s.path,
          role: s.role,
        })),
      } : {}),
    },
    ai: {
      engines: { [DEFAULT_AI_ENGINE]: {} },
      max_parallel: DEFAULT_MAX_PARALLEL,
      timeout: DEFAULT_AI_TIMEOUT_SECONDS,
    },
    output: {
      format: DEFAULT_OUTPUT_FORMAT,
      diagrams: DEFAULT_DIAGRAM_TYPE,
      tasks: true,
    },
  };

  let yamlContent = stringify(config);

  // Append Jira/docs guide as comments
  yamlContent += `
# To add Jira and docs context, add to sources:
#   jira:
#     host: https://company.atlassian.net
#     auth: env:JIRA_API_TOKEN
#     filters:
#       projects: [PROJ]
#   docs:
#     confluence:
#       host: https://company.atlassian.net/wiki
#       space: ENG
#       auth: env:CONFLUENCE_TOKEN
#     local: ["./docs", "./README.md"]
`;

  fs.writeFileSync(configPath, yamlContent, 'utf-8');
  console.log(`Created ${CONFIG_FILENAME} at ${configPath}`);

  // Add .respec/ to .gitignore if not already present
  const gitignorePath = path.join(dir, '.gitignore');
  const respecEntry = `${RESPEC_DIR}/`;

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes(respecEntry)) {
      const updated = content.endsWith('\n')
        ? content + respecEntry + '\n'
        : content + '\n' + respecEntry + '\n';
      fs.writeFileSync(gitignorePath, updated, 'utf-8');
      console.log(`Added ${respecEntry} to .gitignore`);
    }
  } else {
    fs.writeFileSync(gitignorePath, respecEntry + '\n', 'utf-8');
    console.log(`Created .gitignore with ${respecEntry}`);
  }
}
