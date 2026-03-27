import * as fs from 'node:fs';
import * as path from 'node:path';

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeMarkdown(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function readMarkdown(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function rawDir(projectDir: string): string {
  return path.join(projectDir, '.respec', 'raw');
}

export function analyzedDir(projectDir: string): string {
  return path.join(projectDir, '.respec', 'analyzed');
}

export function specsDir(projectDir: string, outputDir: string): string {
  return path.resolve(projectDir, outputDir);
}
