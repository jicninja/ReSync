import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { detectProject } from '../../src/init/detect.js';

describe('detectProject', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respec-detect-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true }); });

  it('detects name and description from package.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'my-app', description: 'A cool app', version: '2.0.0',
    }));
    const info = detectProject(tmpDir);
    expect(info.name).toBe('my-app');
    expect(info.description).toContain('A cool app');
    expect(info.version).toBe('2.0.0');
  });

  it('detects name from go.mod', () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module github.com/user/my-service\n\ngo 1.21\n');
    const info = detectProject(tmpDir);
    expect(info.name).toBe('my-service');
  });

  it('detects name from pyproject.toml', () => {
    fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '[project]\nname = "my-python-app"\ndescription = "A Python app"\nversion = "1.0.0"\n');
    const info = detectProject(tmpDir);
    expect(info.name).toBe('my-python-app');
    expect(info.description).toContain('Python app');
  });

  it('detects name from Cargo.toml', () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "my-rust-app"\nversion = "0.1.0"\n');
    const info = detectProject(tmpDir);
    expect(info.name).toBe('my-rust-app');
  });

  it('detects name from composer.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'composer.json'), JSON.stringify({
      name: 'vendor/my-php-app', description: 'A PHP project',
    }));
    const info = detectProject(tmpDir);
    expect(info.name).toBe('my-php-app');
  });

  it('falls back to directory basename when no manifest', () => {
    const info = detectProject(tmpDir);
    expect(info.name).toBe(path.basename(tmpDir));
  });

  it('detects src/ as include pattern', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    const info = detectProject(tmpDir);
    expect(info.includes).toContain('src/**');
  });

  it('detects lib/ as include pattern', () => {
    fs.mkdirSync(path.join(tmpDir, 'lib'));
    const info = detectProject(tmpDir);
    expect(info.includes).toContain('lib/**');
  });

  it('reads .gitignore for exclude patterns', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\ndist\n.env\n');
    const info = detectProject(tmpDir);
    expect(info.excludes).toContain('node_modules/**');
    expect(info.excludes).toContain('dist/**');
  });

  it('enriches description with framework detection', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'my-app',
      dependencies: { react: '^18.0.0' },
      devDependencies: { vite: '^5.0.0', typescript: '^5.0.0' },
    }));
    const info = detectProject(tmpDir);
    expect(info.description).toMatch(/react/i);
  });
});
