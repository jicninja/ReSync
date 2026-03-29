import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BoundedContext {
  name: string;
  slug: string;
  description: string;
  entities: string[];
}

function readIfExists(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

export function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
}

export function parseSectionHeaders(content: string): string[] {
  const headers: string[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      headers.push(match[1].trim());
    }
  }
  return headers;
}

export function parseBoundedContexts(analyzedDir: string): BoundedContext[] {
  const bcPath = path.join(analyzedDir, 'domain', 'bounded-contexts.md');
  const bcContent = readIfExists(bcPath);
  if (!bcContent) return [];

  const entitiesContent = readIfExists(path.join(analyzedDir, 'domain', 'entities.md'));
  const allEntityNames = parseSectionHeaders(entitiesContent);

  const contexts: BoundedContext[] = [];
  const lines = bcContent.split('\n');
  let currentName = '';
  let currentLines: string[] = [];

  function flush(): void {
    if (!currentName) return;
    const description = currentLines.join('\n').trim();
    const entities = allEntityNames.filter(
      (entity) => description.toLowerCase().includes(entity.toLowerCase())
    );
    contexts.push({
      name: currentName,
      slug: toKebabCase(currentName),
      description,
      entities,
    });
  }

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      flush();
      currentName = match[1].trim();
      currentLines = [];
    } else if (currentName) {
      currentLines.push(line);
    }
  }
  flush();

  return contexts;
}
