import * as readline from 'node:readline';
import { createRenderer, type Renderer } from './renderer.js';
import { DecisionLog, type Decision } from './decision-log.js';
import { KeypressHandler } from './keypress.js';

export type TUIMode = 'interactive' | 'auto' | 'ci';

export interface AskQuestion {
  id: string;
  message: string;
  choices: string[];
  default: string;
}

export class TUIController {
  private mode: TUIMode;
  private renderer: Renderer;
  private decisionLog: DecisionLog;
  private keypress: KeypressHandler | null;
  private stepCount = 0;
  private stepTotal = 0;

  constructor(mode: TUIMode) {
    this.mode = mode;
    this.renderer = createRenderer(mode === 'ci');
    this.decisionLog = new DecisionLog();

    if (mode !== 'ci') {
      this.keypress = new KeypressHandler((key) => {
        if (key === 'a') this.setMode('auto');
        if (key === 'p') this.setMode('interactive');
      });
      this.keypress.start();
    } else {
      this.keypress = null;
    }
  }

  // -- Rendering --

  phaseHeader(title: string, subtitle?: string): void {
    this.renderer.phaseHeader(title, subtitle);
  }

  setSteps(total: number): void { this.stepTotal = total; this.stepCount = 0; }

  progress(message: string): void {
    this.stepCount++;
    this.renderer.stepProgress(this.stepCount, this.stepTotal, message);
  }

  success(message: string): void {
    this.renderer.stepSuccess(this.stepCount, this.stepTotal, message);
  }

  warn(message: string, details?: string): void {
    this.renderer.stopSpinner();
    this.renderer.warn(message, details);
  }

  error(message: string): void {
    this.renderer.stopSpinner();
    this.renderer.error(message);
  }

  info(message: string): void {
    this.renderer.info(message);
  }

  phaseSummary(title: string, rows: Array<{ label: string; status: string; detail: string }>): void {
    this.renderer.phaseSummary(title, rows);
  }

  contextBox(name: string, role: string, stats: Record<string, number>): void {
    this.renderer.contextBox(name, role, stats);
  }

  // -- Questions --

  async ask(question: AskQuestion): Promise<string> {
    if (this.mode === 'ci') {
      this.decisionLog.add({
        id: question.id,
        question: question.message,
        choice: question.default,
        reason: 'ci-default',
      });
      return question.default;
    }

    if (this.mode === 'auto') {
      this.decisionLog.add({
        id: question.id,
        question: question.message,
        choice: question.default,
        reason: 'auto-default',
      });
      this.renderer.info(`Auto: ${question.message} → ${question.default}`);
      return question.default;
    }

    // Interactive mode — pause keypress, ask user, resume
    this.renderer.stopSpinner();
    this.keypress?.pause();

    const answer = await this.promptUser(question);

    this.decisionLog.add({
      id: question.id,
      question: question.message,
      choice: answer,
      reason: 'user chose',
    });

    this.keypress?.resume();
    return answer;
  }

  private promptUser(question: AskQuestion): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const choiceStr = question.choices.map((c) =>
        c === question.default ? `(${c})` : c
      ).join(' ');

      rl.question(`  ${question.message} ${choiceStr}: `, (answer) => {
        rl.close();
        const trimmed = answer.trim();
        // If empty, use default. If matches a choice, use it. Otherwise default.
        if (!trimmed) return resolve(question.default);
        const match = question.choices.find(c => c.startsWith(trimmed.toLowerCase()));
        resolve(match ?? question.default);
      });
    });
  }

  // -- Mode --

  setMode(mode: TUIMode): void {
    const prev = this.mode;
    this.mode = mode;
    if (mode === 'interactive' && prev === 'auto') {
      // Show recent auto-decisions for context
      const recent = this.decisionLog.getRecent(3);
      if (recent.length > 0) {
        this.renderer.info('Recent auto-decisions:');
        for (const d of recent) {
          this.renderer.info(`  ${d.question} → ${d.choice}`);
        }
      }
    }
    this.renderer.info(`Mode: ${mode} ${this.renderer.modeTag(mode)}`);
  }

  getMode(): TUIMode { return this.mode; }

  // -- Lifecycle --

  setPhase(phase: string): void {
    this.decisionLog.setPhase(phase);
  }

  writeDecisionLog(respecDir: string): void {
    this.decisionLog.write(respecDir);
  }

  destroy(): void {
    this.renderer.stopSpinner();
    this.keypress?.stop();
  }
}
