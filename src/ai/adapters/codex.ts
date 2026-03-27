import { spawn } from 'node:child_process';
import type { AIEngine, AIRunOptions } from '../types.js';
import { DEFAULT_AI_TIMEOUT_SECONDS } from '../../constants.js';

export class CodexAdapter implements AIEngine {
  readonly name = 'codex';

  async run(prompt: string, options?: AIRunOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['-q'];
      if (options?.model) args.push('--model', options.model);
      const child = spawn('codex', args, {
        timeout: (options?.timeout ?? DEFAULT_AI_TIMEOUT_SECONDS) * 1000,
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
