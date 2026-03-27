import * as fs from 'node:fs';
import * as path from 'node:path';
import { DECISIONS_FILENAME } from '../constants.js';
import { timestamp } from '../utils/markdown.js';

export interface Decision {
  id: string;
  question: string;
  choice: string;
  reason: string; // "user chose" | "auto-default" | "ci-default"
}

export class DecisionLog {
  private decisions: Decision[] = [];
  private phase: string = '';

  setPhase(phase: string): void {
    this.phase = phase;
  }

  add(decision: Decision): void {
    this.decisions.push(decision);
  }

  getRecent(n: number): Decision[] {
    return this.decisions.slice(-n);
  }

  getAll(): Decision[] {
    return [...this.decisions];
  }

  write(respecDir: string): void {
    if (this.decisions.length === 0) return;

    const filePath = path.join(respecDir, DECISIONS_FILENAME);
    const lines: string[] = [];

    // If file exists, append. Otherwise create with header.
    const exists = fs.existsSync(filePath);
    if (!exists) {
      lines.push('# ReSpec Decisions Log\n');
    }

    lines.push(`## ${this.phase}`);
    lines.push(`\n**Timestamp:** ${timestamp()}\n`);
    lines.push('| # | Decision | Choice | Reason |');
    lines.push('|---|----------|--------|--------|');

    this.decisions.forEach((d, i) => {
      lines.push(`| ${i + 1} | ${d.question} | ${d.choice} | ${d.reason} |`);
    });

    lines.push('');

    const content = lines.join('\n');
    if (exists) {
      fs.appendFileSync(filePath, '\n' + content);
    } else {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
    }
  }
}
