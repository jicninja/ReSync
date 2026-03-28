import * as fs from 'node:fs';
import * as path from 'node:path';
import { stringify } from 'yaml';
import {
  DEFAULT_AI_ENGINE,
  DEFAULT_AI_TIMEOUT_SECONDS,
  DEFAULT_MAX_PARALLEL,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_DIAGRAM_TYPE,
  DEFAULT_REPO_BRANCH,
  RESPEC_DIR,
  CONFIG_FILENAME,
} from '../constants.js';

export async function runInit(dir: string): Promise<void> {
  const configPath = path.join(dir, CONFIG_FILENAME);

  if (fs.existsSync(configPath)) {
    console.log(`${CONFIG_FILENAME} already exists at ${configPath}`);
    return;
  }

  const defaultConfig = {
    project: {
      name: 'my-project',
      version: '1.0',
      description: 'Describe your project here',
    },
    sources: {
      repo: {
        path: './',
        branch: DEFAULT_REPO_BRANCH,
        role: 'primary',
        include: ['src/**'],
        exclude: ['node_modules/**', 'dist/**', '.git/**'],
      },
    },
    ai: {
      engines: {
        [DEFAULT_AI_ENGINE]: {},
      },
      max_parallel: DEFAULT_MAX_PARALLEL,
      timeout: DEFAULT_AI_TIMEOUT_SECONDS,
    },
    output: {
      dir: DEFAULT_OUTPUT_DIR,
      format: DEFAULT_OUTPUT_FORMAT,
      diagrams: DEFAULT_DIAGRAM_TYPE,
      tasks: true,
    },
  };

  let yamlContent = stringify(defaultConfig);

  // Append multi-engine example as comments
  yamlContent += `
# Multi-engine alternative (use EITHER simple engines: {claude: {}} OR this advanced format):
# ai:
#   engines:
#     claude:
#       model: opus
#       timeout: 900
#     gemini:
#       model: pro
#   phases:
#     analyze: [claude, gemini]
#     generate: gemini
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
    } else {
      console.log(`.gitignore already contains ${respecEntry}`);
    }
  } else {
    fs.writeFileSync(gitignorePath, respecEntry + '\n', 'utf-8');
    console.log(`Created .gitignore with ${respecEntry}`);
  }
}
