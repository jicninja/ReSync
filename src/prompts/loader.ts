import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUBPROCESS_DIRECTIVE = `IMPORTANT: You are running as a text-generation subprocess. Do NOT attempt to create files, use tools, or interact with any system. Your ONLY output is the raw Markdown text written to stdout. Everything you write goes directly into a single output file.\n\n`;

function getBuiltinPromptsDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // From dist/src/prompts/ → ../../../prompts/
  return join(__dirname, '..', '..', '..', 'prompts');
}

export function loadPromptTemplate(id: string, projectDir: string): string {
  // Check project override first
  const overridePath = join(projectDir, 'prompts', `${id}.md`);
  if (existsSync(overridePath)) {
    const content = readFileSync(overridePath, 'utf-8');
    return SUBPROCESS_DIRECTIVE + content;
  }

  // Fall back to built-in
  const builtinPath = join(getBuiltinPromptsDir(), `${id}.md`);
  if (existsSync(builtinPath)) {
    const content = readFileSync(builtinPath, 'utf-8');
    return SUBPROCESS_DIRECTIVE + content;
  }

  // Default generic template
  return SUBPROCESS_DIRECTIVE + `Analyze the following raw data and produce structured analysis output.\n\n{{CONTEXT}}`;
}
