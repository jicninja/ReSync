import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Mock @clack/prompts and child_process before importing
vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  log: { warn: vi.fn(), info: vi.fn() },
  isCancel: vi.fn().mockReturnValue(false),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { offerFrameworkInstall } from '../../src/formats/framework-installer.js';
import * as clack from '@clack/prompts';
import { execSync } from 'node:child_process';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-installer-'));
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('offerFrameworkInstall', () => {
  it('returns false without prompting when checkPath already exists', async () => {
    const checkPath = join(tmpDir, 'framework');
    fs.mkdirSync(checkPath, { recursive: true });
    const result = await offerFrameworkInstall({
      name: 'TestFramework',
      checkPath,
      installCommand: 'echo install',
      cwd: tmpDir,
      ciMode: false,
    });
    expect(result).toBe(false);
    expect(clack.confirm).not.toHaveBeenCalled();
  });

  it('returns false without prompting in CI mode', async () => {
    const result = await offerFrameworkInstall({
      name: 'TestFramework',
      checkPath: join(tmpDir, 'nonexistent'),
      installCommand: 'echo install',
      cwd: tmpDir,
      ciMode: true,
    });
    expect(result).toBe(false);
    expect(clack.confirm).not.toHaveBeenCalled();
    expect(clack.log.info).toHaveBeenCalled();
  });

  it('returns false when user declines', async () => {
    vi.mocked(clack.confirm).mockResolvedValue(false);
    const result = await offerFrameworkInstall({
      name: 'TestFramework',
      checkPath: join(tmpDir, 'nonexistent'),
      installCommand: 'echo install',
      cwd: tmpDir,
      ciMode: false,
    });
    expect(result).toBe(false);
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs install command and returns true on success', async () => {
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));
    const result = await offerFrameworkInstall({
      name: 'TestFramework',
      checkPath: join(tmpDir, 'nonexistent'),
      installCommand: 'echo install',
      cwd: tmpDir,
      ciMode: false,
    });
    expect(result).toBe(true);
    expect(execSync).toHaveBeenCalledWith('echo install', { cwd: tmpDir, stdio: 'inherit' });
  });

  it('returns false and warns on install failure', async () => {
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(execSync).mockImplementation(() => { throw new Error('command not found'); });
    const result = await offerFrameworkInstall({
      name: 'TestFramework',
      checkPath: join(tmpDir, 'nonexistent'),
      installCommand: 'bad-command',
      cwd: tmpDir,
      ciMode: false,
    });
    expect(result).toBe(false);
    expect(clack.log.warn).toHaveBeenCalled();
  });
});
