import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocsIngestor } from '../../../src/ingestors/docs/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'respec-docs-test-'));
}

describe('DocsIngestor', () => {
  let tmpDir: string;
  let outputDir: string;
  let projectDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    outputDir = path.join(tmpDir, 'output');
    projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ingests local doc files from a directory', async () => {
    // Create local docs directory with some files
    const docsSourceDir = path.join(tmpDir, 'my-docs');
    fs.mkdirSync(docsSourceDir, { recursive: true });
    fs.writeFileSync(path.join(docsSourceDir, 'guide.md'), '# Guide\nSome guide content');
    fs.writeFileSync(path.join(docsSourceDir, 'notes.txt'), 'Some notes');

    const ingestor = new DocsIngestor(
      { local: [docsSourceDir] },
      outputDir,
      projectDir,
    );

    const result = await ingestor.ingest();

    expect(result.files).toBeGreaterThan(0);
    expect(result.artifacts.length).toBeGreaterThan(0);

    const localOutputDir = path.join(outputDir, 'docs', 'local');
    const outputFiles = fs.readdirSync(localOutputDir, { recursive: true }) as string[];
    const fileNames = outputFiles.filter((f) => {
      const full = path.join(localOutputDir, f);
      return fs.statSync(full).isFile();
    });
    expect(fileNames.some((f) => f.includes('guide.md'))).toBe(true);
    expect(fileNames.some((f) => f.includes('notes.txt'))).toBe(true);
  });

  it('ingests a single local doc file', async () => {
    const singleFile = path.join(tmpDir, 'single.md');
    fs.writeFileSync(singleFile, '# Single\nContent');

    const ingestor = new DocsIngestor(
      { local: [singleFile] },
      outputDir,
      projectDir,
    );

    const result = await ingestor.ingest();

    expect(result.files).toBeGreaterThanOrEqual(1);
    const localOutputDir = path.join(outputDir, 'docs', 'local');
    const outputFiles = fs.readdirSync(localOutputDir) as string[];
    expect(outputFiles.some((f) => f === 'single.md')).toBe(true);
  });

  it('captures root README.md into docs/readme.md', async () => {
    fs.writeFileSync(path.join(projectDir, 'README.md'), '# My Project\nProject readme');

    const ingestor = new DocsIngestor({}, outputDir, projectDir);

    const result = await ingestor.ingest();

    const readmePath = path.join(outputDir, 'docs', 'readme.md');
    expect(fs.existsSync(readmePath)).toBe(true);
    const content = fs.readFileSync(readmePath, 'utf-8');
    expect(content).toContain('My Project');
    expect(result.files).toBeGreaterThanOrEqual(1);
    expect(result.artifacts.some((a) => a.endsWith('readme.md'))).toBe(true);
  });

  it('handles missing README gracefully', async () => {
    // projectDir has no README.md
    const ingestor = new DocsIngestor({}, outputDir, projectDir);

    const result = await ingestor.ingest();

    expect(result.files).toBe(0);
    expect(result.artifacts).toHaveLength(0);
  });

  it('ingests confluence pages and writes manifest when confluence config is set', async () => {
    // Set env var so resolveEnvAuth works
    process.env['CONFLUENCE_TOKEN'] = 'user@example.com:fake-api-token';

    // Mock fetch to return two pages then empty
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      callCount++;
      const results = callCount === 1
        ? [
            {
              id: '1',
              title: 'Getting Started',
              body: { storage: { value: '<h1>Getting Started</h1><p>Welcome.</p>' } },
              ancestors: [],
            },
            {
              id: '2',
              title: 'API Reference',
              body: { storage: { value: '<h2>Endpoints</h2><p>See below.</p>' } },
              ancestors: [{ id: '1', title: 'Getting Started' }],
            },
          ]
        : [];
      return {
        ok: true,
        json: async () => ({ results }),
      } as any;
    };

    try {
      const ingestor = new DocsIngestor(
        { confluence: { host: 'https://example.atlassian.net', space: 'PROJ', auth: 'env:CONFLUENCE_TOKEN' } },
        outputDir,
        projectDir,
      );

      const result = await ingestor.ingest();

      const confluenceDir = path.join(outputDir, 'docs', 'confluence');
      expect(fs.existsSync(confluenceDir)).toBe(true);

      // Pages written
      expect(fs.existsSync(path.join(confluenceDir, 'getting-started.md'))).toBe(true);
      expect(fs.existsSync(path.join(confluenceDir, 'api-reference.md'))).toBe(true);

      // Manifest written
      const manifestPath = path.join(confluenceDir, '_manifest.md');
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifest = fs.readFileSync(manifestPath, 'utf-8');
      expect(manifest).toContain('Getting Started');
      expect(manifest).toContain('API Reference');
      expect(manifest).toContain('**Pages ingested:** 2');

      // Artifacts include pages + manifest
      expect(result.artifacts.some((a) => a.endsWith('getting-started.md'))).toBe(true);
      expect(result.artifacts.some((a) => a.endsWith('_manifest.md'))).toBe(true);
      expect(result.files).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env['CONFLUENCE_TOKEN'];
    }
  });

  it('recursively copies nested doc files from a directory', async () => {
    const docsSourceDir = path.join(tmpDir, 'nested-docs');
    const subDir = path.join(docsSourceDir, 'subdir');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(docsSourceDir, 'top.md'), '# Top');
    fs.writeFileSync(path.join(subDir, 'nested.md'), '# Nested');
    fs.writeFileSync(path.join(subDir, 'data.json'), '{}'); // should be ignored

    const ingestor = new DocsIngestor(
      { local: [docsSourceDir] },
      outputDir,
      projectDir,
    );

    const result = await ingestor.ingest();

    expect(result.files).toBe(2); // only .md files
    const localOutputDir = path.join(outputDir, 'docs', 'local');
    const allFiles = fs.readdirSync(localOutputDir, { recursive: true }) as string[];
    const mdFiles = allFiles.filter((f) => {
      const full = path.join(localOutputDir, f);
      return fs.statSync(full).isFile();
    });
    expect(mdFiles.some((f) => f.includes('top.md'))).toBe(true);
    expect(mdFiles.some((f) => f.includes('nested.md'))).toBe(true);
  });

  it('has name "docs"', () => {
    const ingestor = new DocsIngestor({}, outputDir, projectDir);
    expect(ingestor.name).toBe('docs');
  });
});
