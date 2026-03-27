import { spawn } from 'node:child_process';
import type { AIEngine, AIRunOptions } from '../types.js';

export class GeminiAdapter implements AIEngine {
  readonly name = 'gemini';

  async run(prompt: string, options?: AIRunOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['-p'];
      if (options?.model) args.push('--model', options.model);
      const child = spawn('gemini', args, {
        timeout: (options?.timeout ?? 300) * 1000,
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
