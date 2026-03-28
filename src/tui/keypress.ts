import * as readline from 'node:readline';

export type HotkeyCallback = (key: 'a' | 'p') => void;

export class KeypressHandler {
  private active = false;
  private rl: readline.Interface | null = null;

  constructor(private onKey: HotkeyCallback) {}

  start(): void {
    if (this.active) return;
    if (!process.stdin.isTTY) return; // skip in non-TTY (piped/CI)

    this.active = true;
    process.stdin.setRawMode(true);
    process.stdin.resume();

    readline.emitKeypressEvents(process.stdin);

    const handler = (_str: string, key: readline.Key) => {
      if (key.ctrl && key.name === 'c') {
        this.stop();
        process.exit(0);
      }
      if (key.name === 'a') this.onKey('a');
      if (key.name === 'p') this.onKey('p');
    };

    process.stdin.on('keypress', handler);
    // Store handler ref for cleanup
    (this as any)._handler = handler;
  }

  pause(): void {
    if (!this.active) return;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    this.active = false;
  }

  resume(): void {
    if (this.active) return;
    if (!process.stdin.isTTY) return;

    process.stdin.setRawMode(true);
    process.stdin.resume();
    this.active = true;
  }

  stop(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.removeAllListeners('keypress');
    process.stdin.pause();
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }
}
