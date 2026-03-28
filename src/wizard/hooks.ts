import * as clack from '@clack/prompts';
import type { SubagentResult, BatchAction, OrchestratorHooks } from '../ai/types.js';
import { buildPauseMenuOptions, formatOutputPreview, buildRetryOptions } from './pause.js';

let pauseRequested = false;

export function requestPause(): void {
  pauseRequested = true;
}

export function createInteractiveHooks(): OrchestratorHooks {
  return {
    async onBatchComplete(results: SubagentResult[]): Promise<BatchAction> {
      if (!pauseRequested) return { action: 'continue' };
      pauseRequested = false;

      clack.log.warn('Paused');

      const options = buildPauseMenuOptions(results);

      const choice = await clack.select({
        message: 'What do you want to do?',
        options: options.map(o => ({ value: o.value, label: o.label })),
      });

      if (clack.isCancel(choice) || choice === 'abort') {
        return { action: 'abort' };
      }

      if (choice === 'resume') {
        return { action: 'continue' };
      }

      if (choice === 'add-instructions') {
        const instructions = await clack.text({
          message: 'Additional instructions for remaining tasks:',
          placeholder: 'e.g., Focus on the payment flow...',
        });
        if (clack.isCancel(instructions)) return { action: 'continue' };
        return { action: 'continue', extraPrompt: instructions as string };
      }

      if (choice === 'view-outputs') {
        const outputOptions = results
          .filter(r => r.status === 'success' && r.output)
          .map(r => ({ value: r.id, label: `${r.id} (${Math.round(r.durationMs / 1000)}s)` }));

        if (outputOptions.length === 0) {
          clack.log.info('No outputs to view.');
        } else {
          const selected = await clack.select({
            message: 'Which output to view?',
            options: outputOptions,
          });
          if (!clack.isCancel(selected)) {
            const result = results.find(r => r.id === selected);
            if (result?.output) {
              clack.log.info(`── ${result.id} output ──\n\n${formatOutputPreview(result.output)}`);
            }
          }
        }
        // After viewing, show pause menu again (recursive via onBatchComplete)
        return this.onBatchComplete!(results);
      }

      if (choice === 'retry-task') {
        const retryOptions = buildRetryOptions(results);
        const selected = await clack.select({
          message: 'Which task to retry?',
          options: retryOptions,
        });
        if (clack.isCancel(selected)) return { action: 'continue' };

        const instructions = await clack.text({
          message: `Additional instructions for ${selected}:`,
          placeholder: 'e.g., Focus on the authentication module...',
        });
        if (clack.isCancel(instructions)) return { action: 'continue' };

        return {
          action: 'continue',
          retryTasks: [{ id: selected as string, extraPrompt: instructions as string }],
        };
      }

      return { action: 'continue' };
    },
  };
}
