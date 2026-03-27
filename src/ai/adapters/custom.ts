import { spawn } from 'node:child_process';
import type { AIEngine, AIRunOptions } from '../types.js';

export class CustomAdapter implements AIEngine {
  readonly name = 'custom';

  constructor(private readonly command: string) {}

  async run(prompt: string, options?: AIRunOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      // Split command into executable and existing args
      const parts = this.command.split(/\s+/);
      const executable = parts[0];
      const baseArgs = parts.slice(1);

      const child = spawn(executable, baseArgs, {
        timeout: (options?.timeout ?? 300) * 1000,
        shell: false,
      });

      let stdout = '';
      let stderr = '';

      child.stdin.write(prompt);
      child.stdin.end();

      child.stdout.on('data', (d: Buffer) => { stdout += d; });
      child.stderr.on('data', (d: Buffer) => { stderr += d; });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Exit code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }
}
