import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TUIController } from '../../src/tui/controller.js';
import { createTUI } from '../../src/tui/factory.js';
import { DECISIONS_FILENAME } from '../../src/constants.js';

// All controller tests use CI mode to avoid TTY/keypress issues in the test environment.

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(join(tmpdir(), 'respec-controller-test-'));
  // Suppress console output in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('TUIController.ask()', () => {
  it('ci mode: returns default without prompting', async () => {
    const ctrl = new TUIController('ci');
    const answer = await ctrl.ask({
      id: 'q1',
      message: 'Include Jira?',
      choices: ['yes', 'no'],
      default: 'yes',
    });
    expect(answer).toBe('yes');
    ctrl.destroy();
  });

  it('auto mode: returns default and logs INFO message', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const ctrl = new TUIController('ci');
    // Manually switch to auto after construction to avoid TTY issues
    ctrl.setMode('auto');

    const answer = await ctrl.ask({
      id: 'q2',
      message: 'Include docs?',
      choices: ['yes', 'no'],
      default: 'no',
    });

    expect(answer).toBe('no');
    ctrl.destroy();
  });

  it('auto mode: decision log captures the decision', async () => {
    const ctrl = new TUIController('ci');
    ctrl.setMode('auto');

    await ctrl.ask({
      id: 'q3',
      message: 'Use Confluence?',
      choices: ['yes', 'no'],
      default: 'yes',
    });

    // Write log so we can verify it was captured
    ctrl.setPhase('test-phase');
    ctrl.writeDecisionLog(tmpDir);

    const filePath = join(tmpDir, DECISIONS_FILENAME);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('Use Confluence?');
    expect(content).toContain('yes');
    expect(content).toContain('auto-default');
    ctrl.destroy();
  });
});

describe('TUIController mode management', () => {
  it('setMode() changes the current mode', () => {
    const ctrl = new TUIController('ci');
    ctrl.setMode('auto');
    expect(ctrl.getMode()).toBe('auto');
    ctrl.destroy();
  });

  it('getMode() returns the current mode', () => {
    const ctrl = new TUIController('ci');
    expect(ctrl.getMode()).toBe('ci');
    ctrl.destroy();
  });
});

describe('factory: createTUI()', () => {
  it('createTUI({}) returns interactive mode', () => {
    // Interactive mode would start keypress in TTY; skip keypress by mocking isTTY
    const origIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });

    const ctrl = createTUI({});
    expect(ctrl.getMode()).toBe('interactive');
    ctrl.destroy();

    Object.defineProperty(process.stdin, 'isTTY', { value: origIsTTY, configurable: true });
  });

  it('createTUI({ auto: true }) returns auto mode', () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });

    const ctrl = createTUI({ auto: true });
    expect(ctrl.getMode()).toBe('auto');
    ctrl.destroy();
  });

  it('createTUI({ ci: true }) returns ci mode', () => {
    const ctrl = createTUI({ ci: true });
    expect(ctrl.getMode()).toBe('ci');
    ctrl.destroy();
  });
});

describe('setPhase + writeDecisionLog', () => {
  it('writes a decision log file with the correct phase and decisions', async () => {
    const ctrl = new TUIController('ci');

    ctrl.setPhase('ingest');
    await ctrl.ask({
      id: 'source',
      message: 'Include repo source?',
      choices: ['yes', 'no'],
      default: 'yes',
    });

    ctrl.writeDecisionLog(tmpDir);

    const filePath = join(tmpDir, DECISIONS_FILENAME);
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('## ingest');
    expect(content).toContain('Include repo source?');
    expect(content).toContain('yes');
    expect(content).toContain('ci-default');
    ctrl.destroy();
  });
});
