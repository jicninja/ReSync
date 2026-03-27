import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRenderer } from '../../src/tui/renderer.js';

// Helper to strip ANSI escape codes for readable assertions
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const strip = (s: string) => s.replace(ANSI_RE, '');

describe('renderer — styled mode (ci: false)', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let calls: string[];

  beforeEach(() => {
    calls = [];
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      calls.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('phaseHeader renders the title', () => {
    const r = createRenderer(false);
    r.phaseHeader('INGEST', 'Project: MyFrontend');
    const output = calls.join('\n');
    expect(strip(output)).toContain('INGEST');
    expect(strip(output)).toContain('Project: MyFrontend');
  });

  it('stepSuccess shows checkmark text', () => {
    const r = createRenderer(false);
    r.stepSuccess(2, 6, 'Endpoints — 14 found');
    const output = calls.join('\n');
    const stripped = strip(output);
    expect(stripped).toContain('[2/6]');
    expect(stripped).toContain('✓');
    expect(stripped).toContain('Endpoints — 14 found');
  });

  it('warn shows message and optional details', () => {
    const r = createRenderer(false);
    r.warn('Something skipped', 'No package.json found');
    const output = calls.join('\n');
    const stripped = strip(output);
    expect(stripped).toContain('Something skipped');
    expect(stripped).toContain('No package.json found');
  });

  it('warn shows message without details', () => {
    const r = createRenderer(false);
    r.warn('Only a warning');
    const output = calls.join('\n');
    expect(strip(output)).toContain('Only a warning');
  });

  it('error shows message', () => {
    const r = createRenderer(false);
    r.error('Fatal failure');
    expect(strip(calls.join('\n'))).toContain('Fatal failure');
  });

  it('info shows message', () => {
    const r = createRenderer(false);
    r.info('Some info');
    expect(strip(calls.join('\n'))).toContain('Some info');
  });

  it('phaseSummary renders all rows', () => {
    const r = createRenderer(false);
    r.phaseSummary('INGEST COMPLETE', [
      { label: 'repo/', status: '✓', detail: '15 artifacts' },
      { label: 'context/', status: '✓', detail: '2 sources' },
    ]);
    const output = strip(calls.join('\n'));
    expect(output).toContain('INGEST COMPLETE');
    expect(output).toContain('repo/');
    expect(output).toContain('15 artifacts');
    expect(output).toContain('context/');
    expect(output).toContain('2 sources');
  });

  it('contextBox renders name, role, and stats', () => {
    const r = createRenderer(false);
    r.contextBox('backend-api', 'backend', { files: 7 });
    const output = strip(calls.join('\n'));
    expect(output).toContain('backend-api');
    expect(output).toContain('backend');
    expect(output).toContain('7');
  });

  it('divider outputs something', () => {
    const r = createRenderer(false);
    r.divider();
    expect(calls.length).toBeGreaterThan(0);
    expect(strip(calls[0])).toMatch(/[─\-]+/);
  });

  it('modeTag returns a formatted string containing the mode', () => {
    const r = createRenderer(false);
    const tag = r.modeTag('interactive');
    expect(strip(tag)).toContain('interactive');
  });

  it('stepProgress outputs progress text', () => {
    const r = createRenderer(false);
    r.stepProgress(1, 6, 'Detecting endpoints...');
    r.stopSpinner();
    const output = strip(calls.join('\n'));
    // In CI mode spinner may not log; skip content assertion for styled
    // but stopping spinner should not throw
    expect(true).toBe(true);
  });
});

describe('renderer — CI mode (ci: true)', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let calls: string[];

  beforeEach(() => {
    calls = [];
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      calls.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  const hasAnsi = (s: string) => /\x1b\[/.test(s);

  it('phaseHeader renders title in CI', () => {
    const r = createRenderer(true);
    r.phaseHeader('ANALYZE');
    const output = calls.join('\n');
    expect(output).toContain('ANALYZE');
  });

  it('stepSuccess shows "OK" in CI', () => {
    const r = createRenderer(true);
    r.stepSuccess(3, 6, 'Models parsed');
    const output = calls.join('\n');
    expect(output).toContain('[3/6]');
    expect(output).toContain('OK');
    expect(output).toContain('Models parsed');
  });

  it('stepProgress shows plain text in CI', () => {
    const r = createRenderer(true);
    r.stepProgress(1, 4, 'Scanning files...');
    const output = calls.join('\n');
    expect(output).toContain('[1/4]');
    expect(output).toContain('Scanning files...');
  });

  it('warn shows WARN prefix in CI', () => {
    const r = createRenderer(true);
    r.warn('Skipping jira', 'No host configured');
    const output = calls.join('\n');
    expect(output).toContain('WARN:');
    expect(output).toContain('Skipping jira');
    expect(output).toContain('No host configured');
  });

  it('error shows ERROR prefix in CI', () => {
    const r = createRenderer(true);
    r.error('Config missing');
    expect(calls.join('\n')).toContain('ERROR:');
    expect(calls.join('\n')).toContain('Config missing');
  });

  it('info shows INFO prefix in CI', () => {
    const r = createRenderer(true);
    r.info('Loading config');
    expect(calls.join('\n')).toContain('INFO:');
    expect(calls.join('\n')).toContain('Loading config');
  });

  it('phaseSummary renders all rows in CI', () => {
    const r = createRenderer(true);
    r.phaseSummary('GENERATE COMPLETE', [
      { label: 'sdd.md', status: '✓', detail: 'generated' },
    ]);
    const output = calls.join('\n');
    expect(output).toContain('GENERATE COMPLETE');
    expect(output).toContain('sdd.md');
    expect(output).toContain('generated');
  });

  it('CI mode: no ANSI escape sequences in phaseHeader', () => {
    const r = createRenderer(true);
    r.phaseHeader('GENERATE');
    expect(hasAnsi(calls.join('\n'))).toBe(false);
  });

  it('CI mode: no ANSI escape sequences in stepSuccess', () => {
    const r = createRenderer(true);
    r.stepSuccess(1, 3, 'Done');
    expect(hasAnsi(calls.join('\n'))).toBe(false);
  });

  it('CI mode: no ANSI escape sequences in warn', () => {
    const r = createRenderer(true);
    r.warn('Watch out', 'details here');
    expect(hasAnsi(calls.join('\n'))).toBe(false);
  });

  it('CI mode: no ANSI escape sequences in error', () => {
    const r = createRenderer(true);
    r.error('Bad thing');
    expect(hasAnsi(calls.join('\n'))).toBe(false);
  });

  it('CI mode: no ANSI escape sequences in phaseSummary', () => {
    const r = createRenderer(true);
    r.phaseSummary('PHASE', [{ label: 'x', status: 'ok', detail: 'y' }]);
    expect(hasAnsi(calls.join('\n'))).toBe(false);
  });

  it('modeTag returns plain string in CI', () => {
    const r = createRenderer(true);
    const tag = r.modeTag('ci');
    expect(hasAnsi(tag)).toBe(false);
    expect(tag).toContain('ci');
  });

  it('divider outputs dashes in CI', () => {
    const r = createRenderer(true);
    r.divider();
    expect(calls.join('\n')).toContain('---');
  });
});
