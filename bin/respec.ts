#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from '../src/commands/init.js';
import { runIngest } from '../src/commands/ingest.js';
import { runAnalyze } from '../src/commands/analyze.js';
import { runGenerate } from '../src/commands/generate.js';
import { runExport } from '../src/commands/export.js';
import { runStatus } from '../src/commands/status.js';
import { runValidate } from '../src/commands/validate.js';

function wrapAction(fn: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  };
}

const program = new Command();

program
  .name('respec')
  .description('Reverse Engineering to Specification')
  .version('0.1.0')
  .option('--auto', 'Auto-continue mode (no interaction)')
  .option('--ci', 'CI mode (no colors, no interaction)')
  .option('--autopilot', 'Run full remaining pipeline (non-interactive)')
  .option('--reset', 'Wipe .respec/ and specs/ before running');

program
  .command('init')
  .description('Create respec.config.yaml with sensible defaults')
  .option('--repo <path>', 'Repository path or git URL (default: ./)')
  .action(wrapAction(async (cmdOpts: { repo?: string }) => {
    await runInit(process.cwd(), { repo: cmdOpts.repo });
  }));

program
  .command('ingest')
  .description('Read all sources and write raw data to .respec/raw/')
  .option('--source <source>', 'Only run a specific ingestor (repo, jira, docs)')
  .option('--force', 'Bypass phase prerequisite checks')
  .action(wrapAction(async (cmdOpts: { source?: string; force?: boolean }) => {
    const globalOpts = program.opts();
    await runIngest(process.cwd(), { ...globalOpts, ...cmdOpts });
  }));

program
  .command('analyze')
  .description('AI analysis of raw data, writes to .respec/analyzed/')
  .option('--only <analyzer>', 'Only run a specific analyzer by id')
  .option('--force', 'Bypass phase prerequisite checks')
  .action(wrapAction(async (cmdOpts: { only?: string; force?: boolean }) => {
    const globalOpts = program.opts();
    await runAnalyze(process.cwd(), { ...globalOpts, ...cmdOpts });
  }));

program
  .command('generate')
  .description('Generate final specs from analyzed data into /specs/')
  .option('--only <generator>', 'Only run a specific generator by id')
  .option('--force', 'Bypass phase prerequisite checks')
  .action(wrapAction(async (cmdOpts: { only?: string; force?: boolean }) => {
    const globalOpts = program.opts();
    await runGenerate(process.cwd(), { ...globalOpts, ...cmdOpts });
  }));

program
  .command('export')
  .description('Package /specs/ into a Claude Code skill set or other format')
  .option('--format <format>', 'Output format (kiro, openspec, antigravity, superpowers, speckit, bmad)')
  .option('--output <dir>', 'Output directory (defaults to specs dir from config)')
  .action(wrapAction(async (cmdOpts: { format?: string; output?: string }) => {
    const globalOpts = program.opts();
    await runExport(process.cwd(), { ...globalOpts, ...cmdOpts });
  }));

program
  .command('status')
  .description('Show current pipeline state and phase coverage')
  .option('--verbose', 'Show detailed stats for each phase')
  .action(wrapAction(async (cmdOpts: { verbose?: boolean }) => {
    const globalOpts = program.opts();
    await runStatus(process.cwd(), { ...globalOpts, ...cmdOpts });
  }));

program
  .command('validate')
  .description('Validate integrity of current phase outputs')
  .option('--phase <phase>', 'Validate a specific phase (raw, analyzed, specs)')
  .action(wrapAction(async (options: { phase?: string }) => {
    await runValidate(process.cwd(), options);
  }));

// Default action: no subcommand → wizard or autopilot
program.action(wrapAction(async () => {
  const opts = program.opts();
  const dir = process.cwd();

  // --reset: wipe pipeline data
  if (opts.reset) {
    const { existsSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { RESPEC_DIR } = await import('../src/constants.js');
    const respecPath = join(dir, RESPEC_DIR);
    const specsPath = join(dir, 'specs');
    if (existsSync(respecPath)) rmSync(respecPath, { recursive: true });
    if (existsSync(specsPath)) rmSync(specsPath, { recursive: true });
    console.log('Wiped .respec/ and specs/');
  }

  // --autopilot: run full pipeline non-interactively
  if (opts.autopilot) {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { CONFIG_FILENAME } = await import('../src/constants.js');

    if (!existsSync(join(dir, CONFIG_FILENAME))) {
      await runInit(dir);
    }
    await runIngest(dir, { ci: true, force: true });
    await runAnalyze(dir, { ci: true, force: true });
    await runGenerate(dir, { ci: true, force: true });
    await runExport(dir, {});
    console.log('Autopilot complete.');
    return;
  }

  // No flags → interactive wizard
  const { runWizard } = await import('../src/wizard/index.js');
  await runWizard(dir);
}));

program.parse();
