#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('respec')
  .description('Reverse Engineering to Specification')
  .version('0.1.0');

program.parse();
