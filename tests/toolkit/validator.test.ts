import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePackages, isNpmAvailable } from '../../src/toolkit/validator.js';
import type { Recommendation } from '../../src/toolkit/types.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  execFile: vi.fn(),
}));

import { execSync, execFile } from 'node:child_process';
const mockExecSync = vi.mocked(execSync);
const mockExecFile = vi.mocked(execFile);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isNpmAvailable', () => {
  it('returns true when npm --version succeeds', () => {
    mockExecSync.mockReturnValueOnce(Buffer.from('10.0.0'));
    expect(isNpmAvailable()).toBe(true);
  });

  it('returns false when npm --version throws', () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(isNpmAvailable()).toBe(false);
  });
});

describe('validatePackages', () => {
  it('marks packages as validated when npm view succeeds', async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
      if (typeof _opts === 'function') {
        cb = _opts;
      }
      cb(null, { stdout: '{}', stderr: '' });
      return {} as any;
    });
    const recs: Recommendation[] = [
      {
        type: 'mcp',
        name: 'test',
        package: '@test/pkg',
        description: 'test',
        reason: 'test',
        install: { method: 'mcp-config', config: { command: 'npx', args: ['@test/pkg'] } },
        validated: null,
        agents: ['claude'],
        category: 'test',
      },
    ];
    const result = await validatePackages(recs);
    expect(result[0].validated).toBe(true);
  });

  it('marks packages as false when npm view fails', async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
      if (typeof _opts === 'function') {
        cb = _opts;
      }
      cb(new Error('404'));
      return {} as any;
    });
    const recs: Recommendation[] = [
      {
        type: 'mcp',
        name: 'test',
        package: '@bad/pkg',
        description: 'test',
        reason: 'test',
        install: { method: 'mcp-config', config: { command: 'npx', args: ['@bad/pkg'] } },
        validated: null,
        agents: ['claude'],
        category: 'test',
      },
    ];
    const result = await validatePackages(recs);
    expect(result[0].validated).toBe(false);
  });

  it('skips validation for empty package field', async () => {
    const recs: Recommendation[] = [
      {
        type: 'extension',
        name: 'test',
        package: '',
        description: 'test',
        reason: 'test',
        install: { method: 'manual', instructions: 'do it' },
        validated: null,
        agents: ['claude'],
        category: 'test',
      },
    ];
    const result = await validatePackages(recs);
    expect(result[0].validated).toBeNull();
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});
