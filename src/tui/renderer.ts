import chalk from 'chalk';
import ora, { type Ora } from 'ora';

// ── Brand palette ──────────────────────────────────────────────────────────────
const BRAND   = chalk.hex('#EF9F27');
const SUCCESS = chalk.green;
const WARN    = chalk.yellow;
const ERROR   = chalk.red;
const INFO    = chalk.blue;
const DIM     = chalk.dim;
const BOLD    = chalk.bold;

// ── Box drawing ────────────────────────────────────────────────────────────────
const INNER_WIDTH = 48; // characters of inner content area

/** Pad `text` to exactly `width` chars (truncate or space-fill). */
function pad(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + ' '.repeat(width - text.length);
}

/** Build a horizontal rule of `─` repeated `n` times. */
function hrule(n: number, char = '─'): string {
  return char.repeat(n);
}

export function createRenderer(ci: boolean) {
  // Apply a chalk formatter only when not in CI mode.
  const fmt = (fn: (s: string) => string, text: string): string =>
    ci ? text : fn(text);

  // ── Spinner state ────────────────────────────────────────────────────────────
  let spinner: Ora | null = null;

  const clearSpinner = () => {
    if (spinner) {
      spinner.stop();
      spinner = null;
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const stepPrefix = (current: number, total: number): string =>
    `[${current}/${total}]`;

  // ── Public API ───────────────────────────────────────────────────────────────
  return {
    /**
     * Styled:
     *   ╭─ INGEST ──────────────────────────────────────╮
     *   │  Project: MyFrontend                           │
     *   ╰────────────────────────────────────────────────╯
     * CI:
     *   === INGEST ===
     *   Project: MyFrontend
     */
    phaseHeader(title: string, subtitle?: string): void {
      clearSpinner();
      if (ci) {
        console.log(`=== ${title} ===`);
        if (subtitle) console.log(`  ${subtitle}`);
        return;
      }

      // Build top border:  ╭─ TITLE ────────────╮
      const labelSegment = ` ${BRAND(BOLD(title))} `;
      const labelRaw     = ` ${title} `;
      const remaining    = INNER_WIDTH - labelRaw.length - 2; // -2 for ╭ and ╮
      const rightFill    = remaining > 0 ? hrule(remaining) : '';
      const top    = `╭${hrule(1)}${labelSegment}${DIM(rightFill)}╮`;
      const bottom = `╰${DIM(hrule(INNER_WIDTH))}╯`;

      console.log(top);
      if (subtitle) {
        const inner = pad(`  ${subtitle}`, INNER_WIDTH);
        console.log(`│${inner}│`);
      }
      console.log(bottom);
    },

    /**
     * Styled: [2/6] ⠋ Detecting endpoints...  (ora spinner)
     * CI:     [2/6] Detecting endpoints...
     */
    stepProgress(current: number, total: number, message: string): void {
      clearSpinner();
      const prefix = stepPrefix(current, total);
      if (ci) {
        console.log(`${prefix} ${message}`);
        return;
      }
      spinner = ora({
        text: `${fmt(DIM, prefix)} ${message}`,
        color: 'yellow',
      }).start();
    },

    /** Stop the current ora spinner if active. */
    stopSpinner(): void {
      clearSpinner();
    },

    /**
     * Styled: [2/6] ✓ Endpoints — 14 found  (green)
     * CI:     [2/6] OK Endpoints — 14 found
     */
    stepSuccess(current: number, total: number, message: string): void {
      clearSpinner();
      const prefix = stepPrefix(current, total);
      if (ci) {
        console.log(`${prefix} OK ${message}`);
        return;
      }
      console.log(
        `${fmt(DIM, prefix)} ${fmt(SUCCESS, '✓')} ${message}`
      );
    },

    /**
     * Styled: ⚠ message (yellow)
     *           details (dim)
     * CI:     WARN: message
     *           details
     */
    warn(message: string, details?: string): void {
      clearSpinner();
      if (ci) {
        console.log(`WARN: ${message}`);
        if (details) console.log(`  ${details}`);
        return;
      }
      console.log(`${fmt(WARN, '⚠')} ${fmt(WARN, message)}`);
      if (details) console.log(`  ${fmt(DIM, details)}`);
    },

    /**
     * Styled: ✗ message (red)
     * CI:     ERROR: message
     */
    error(message: string): void {
      clearSpinner();
      if (ci) {
        console.log(`ERROR: ${message}`);
        return;
      }
      console.log(`${fmt(ERROR, '✗')} ${fmt(ERROR, message)}`);
    },

    /**
     * Styled: ℹ message (blue)
     * CI:     INFO: message
     */
    info(message: string): void {
      clearSpinner();
      if (ci) {
        console.log(`INFO: ${message}`);
        return;
      }
      console.log(`${fmt(INFO, 'ℹ')} ${message}`);
    },

    /**
     * Styled:
     *   ╭─ INGEST COMPLETE ─────────────────────────────╮
     *   │  repo/     ✓  15 artifacts                     │
     *   │  context/  ✓  2 sources                        │
     *   ╰────────────────────────────────────────────────╯
     * CI:
     *   --- INGEST COMPLETE ---
     *     repo/: 15 artifacts
     *     context/: 2 sources
     */
    phaseSummary(
      title: string,
      rows: Array<{ label: string; status: string; detail: string }>
    ): void {
      clearSpinner();
      if (ci) {
        console.log(`--- ${title} ---`);
        for (const row of rows) {
          console.log(`  ${row.label}: ${row.detail}`);
        }
        return;
      }

      const labelSegment = ` ${fmt(BRAND, BOLD(title))} `;
      const labelRaw     = ` ${title} `;
      const remaining    = INNER_WIDTH - labelRaw.length - 2;
      const rightFill    = remaining > 0 ? hrule(remaining) : '';

      console.log(`╭${hrule(1)}${labelSegment}${fmt(DIM, rightFill)}╮`);

      for (const row of rows) {
        const line = `  ${row.label.padEnd(12)}${fmt(SUCCESS, row.status)}  ${row.detail}`;
        const inner = pad(line, INNER_WIDTH);
        console.log(`│${inner}│`);
      }

      console.log(`╰${fmt(DIM, hrule(INNER_WIDTH))}╯`);
    },

    /**
     * Styled:
     *   ┌─ Context: backend-api (backend) ──────────────┐
     *   │  ✓ 7 files scanned                             │
     *   └───────────────────────────────────────────────┘
     * CI:
     *   Context: backend-api (backend): 7 files scanned
     */
    contextBox(name: string, role: string, stats: Record<string, number>): void {
      clearSpinner();
      const statStr = Object.entries(stats)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');

      if (ci) {
        console.log(`Context: ${name} (${role}): ${statStr}`);
        return;
      }

      const header     = `Context: ${name} (${role})`;
      const labelSeg   = ` ${fmt(BRAND, header)} `;
      const labelRaw   = ` ${header} `;
      const remaining  = INNER_WIDTH - labelRaw.length - 2;
      const rightFill  = remaining > 0 ? hrule(remaining) : '';

      console.log(`┌${hrule(1)}${labelSeg}${fmt(DIM, rightFill)}┐`);
      const inner = pad(`  ${fmt(SUCCESS, '✓')} ${statStr}`, INNER_WIDTH);
      console.log(`│${inner}│`);
      console.log(`└${fmt(DIM, hrule(INNER_WIDTH))}┘`);
    },

    /**
     * Styled: ─────────────────────────────
     * CI:     ---
     */
    divider(): void {
      clearSpinner();
      if (ci) {
        console.log('---');
        return;
      }
      console.log(fmt(DIM, hrule(INNER_WIDTH)));
    },

    /**
     * Returns a formatted mode tag: [interactive] / [auto] / [ci]
     */
    modeTag(mode: string): string {
      if (ci) return `[${mode}]`;
      return fmt(DIM, `[${mode}]`);
    },
  };
}

export type Renderer = ReturnType<typeof createRenderer>;
