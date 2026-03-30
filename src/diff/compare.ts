import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface DiffResult {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
}

function collectFiles(dir: string, base = ''): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...collectFiles(join(dir, entry.name), rel));
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mermaid')) {
      files.push(rel);
    }
  }
  return files;
}

export function compareDirectories(oldDir: string, newDir: string): DiffResult {
  const oldFiles = new Set(collectFiles(oldDir));
  const newFiles = new Set(collectFiles(newDir));
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  const unchanged: string[] = [];

  for (const file of newFiles) {
    if (!oldFiles.has(file)) {
      added.push(file);
    } else {
      const oldContent = readFileSync(join(oldDir, file), 'utf-8');
      const newContent = readFileSync(join(newDir, file), 'utf-8');
      if (oldContent === newContent) unchanged.push(file);
      else modified.push(file);
    }
  }
  for (const file of oldFiles) {
    if (!newFiles.has(file)) removed.push(file);
  }

  return { added, removed, modified, unchanged };
}
