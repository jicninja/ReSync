import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureDir, writeMarkdown } from '../../utils/fs.js';
import type { Ingestor, IngestorResult } from '../types.js';
import { ConfluenceClient } from './confluence.js';
import { convertHtmlToMarkdown } from './html-to-markdown.js';

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.rst']);

export interface ConfluenceConfig {
  host: string;
  space: string;
  auth: string;
}

export interface DocsConfig {
  confluence?: ConfluenceConfig;
  local?: string[];
}

export class DocsIngestor implements Ingestor {
  readonly name = 'docs';

  constructor(
    private readonly config: DocsConfig,
    private readonly outputDir: string,
    private readonly projectDir: string,
  ) {}

  async ingest(): Promise<IngestorResult> {
    const docsDir = path.join(this.outputDir, 'docs');
    ensureDir(docsDir);

    let fileCount = 0;
    const artifacts: string[] = [];

    // 1. Capture root README.md if it exists
    const readmeSrc = path.join(this.projectDir, 'README.md');
    if (fs.existsSync(readmeSrc)) {
      const readmeDest = path.join(docsDir, 'readme.md');
      const content = fs.readFileSync(readmeSrc, 'utf-8');
      writeMarkdown(readmeDest, content);
      fileCount++;
      artifacts.push(readmeDest);
    }

    // 2. Process local paths
    if (this.config.local && this.config.local.length > 0) {
      const localDir = path.join(docsDir, 'local');
      ensureDir(localDir);

      for (const localPath of this.config.local) {
        if (!fs.existsSync(localPath)) continue;

        const stat = fs.statSync(localPath);
        if (stat.isDirectory()) {
          const copied = this.copyDocDir(localPath, localDir);
          fileCount += copied.length;
          artifacts.push(...copied);
        } else if (stat.isFile()) {
          const ext = path.extname(localPath).toLowerCase();
          if (SUPPORTED_EXTENSIONS.has(ext)) {
            const destFile = path.join(localDir, path.basename(localPath));
            const content = fs.readFileSync(localPath, 'utf-8');
            writeMarkdown(destFile, content);
            fileCount++;
            artifacts.push(destFile);
          }
        }
      }
    }

    // 3. Confluence ingestion
    if (this.config.confluence) {
      const confluenceDir = path.join(docsDir, 'confluence');
      ensureDir(confluenceDir);

      const client = new ConfluenceClient(this.config.confluence);
      const pages: Array<{ id: string; title: string; slug: string; ancestors: Array<{ id: string; title: string }> }> = [];

      for await (const page of client.fetchPages()) {
        const markdown = convertHtmlToMarkdown(page.body);
        const filePath = path.join(confluenceDir, `${page.slug}.md`);
        const header = [
          `# ${page.title}`,
          '',
          ...(page.ancestors.length > 0
            ? [`> **Path:** ${page.ancestors.map((a) => a.title).join(' > ')} > ${page.title}`, '']
            : []),
        ].join('\n');
        writeMarkdown(filePath, header + markdown);
        fileCount++;
        artifacts.push(filePath);
        pages.push({ id: page.id, title: page.title, slug: page.slug, ancestors: page.ancestors });
      }

      // Write manifest
      const manifestLines = [
        '# Confluence Pages — Manifest',
        '',
        `**Space:** ${this.config.confluence.space}`,
        `**Host:** ${this.config.confluence.host}`,
        `**Pages ingested:** ${pages.length}`,
        '',
        '## Pages',
        '',
        ...pages.map((p) => {
          const hierarchy = p.ancestors.length > 0
            ? `${p.ancestors.map((a) => a.title).join(' > ')} > ${p.title}`
            : p.title;
          return `- [${p.title}](./${p.slug}.md) — ${hierarchy}`;
        }),
      ];
      const manifestPath = path.join(confluenceDir, '_manifest.md');
      writeMarkdown(manifestPath, manifestLines.join('\n'));
      artifacts.push(manifestPath);
    }

    return { files: fileCount, artifacts };
  }

  private copyDocDir(srcDir: string, destDir: string): string[] {
    const copied: string[] = [];
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      if (entry.isDirectory()) {
        const subDestDir = path.join(destDir, entry.name);
        ensureDir(subDestDir);
        copied.push(...this.copyDocDir(srcPath, subDestDir));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          const destPath = path.join(destDir, entry.name);
          const content = fs.readFileSync(srcPath, 'utf-8');
          writeMarkdown(destPath, content);
          copied.push(destPath);
        }
      }
    }

    return copied;
  }
}
