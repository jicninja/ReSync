import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseBoundedContexts } from '../../src/formats/context-parser.js';

let tmpDir: string;
let analyzedDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-ctx-parser-'));
  analyzedDir = join(tmpDir, 'analyzed');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relativePath: string, content: string): void {
  const filePath = join(analyzedDir, relativePath);
  fs.mkdirSync(join(filePath, '..'), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('parseBoundedContexts', () => {
  it('returns empty array when bounded-contexts.md does not exist', () => {
    fs.mkdirSync(analyzedDir, { recursive: true });
    expect(parseBoundedContexts(analyzedDir)).toEqual([]);
  });

  it('returns empty array when file has no ## headers', () => {
    writeFile('domain/bounded-contexts.md', '# Overview\n\nSome text without sections.\n');
    expect(parseBoundedContexts(analyzedDir)).toEqual([]);
  });

  it('parses contexts with name, slug, and description', () => {
    writeFile('domain/bounded-contexts.md', [
      '## OrderManagement',
      'Handles orders and fulfillment.',
      '',
      '## UserAuth',
      'Handles authentication and authorization.',
      '',
    ].join('\n'));
    const contexts = parseBoundedContexts(analyzedDir);
    expect(contexts).toHaveLength(2);
    expect(contexts[0].name).toBe('OrderManagement');
    expect(contexts[0].slug).toBe('order-management');
    expect(contexts[0].description).toContain('Handles orders');
    expect(contexts[1].name).toBe('UserAuth');
    expect(contexts[1].slug).toBe('user-auth');
  });

  it('extracts entity names by cross-referencing entities.md', () => {
    writeFile('domain/bounded-contexts.md', [
      '## Billing',
      'Manages Invoice and Payment entities.',
      '',
    ].join('\n'));
    writeFile('domain/entities.md', [
      '## Invoice',
      'An invoice entity.',
      '',
      '## Payment',
      'A payment entity.',
      '',
      '## User',
      'A user entity.',
      '',
    ].join('\n'));
    const contexts = parseBoundedContexts(analyzedDir);
    expect(contexts[0].entities).toContain('Invoice');
    expect(contexts[0].entities).toContain('Payment');
    expect(contexts[0].entities).not.toContain('User');
  });

  it('returns empty entities when entities.md does not exist', () => {
    writeFile('domain/bounded-contexts.md', '## Billing\nManages invoices.\n');
    const contexts = parseBoundedContexts(analyzedDir);
    expect(contexts[0].entities).toEqual([]);
  });
});
