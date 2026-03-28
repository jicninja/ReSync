import { TUIController, type TUIMode } from './controller.js';

export function createTUI(options: { auto?: boolean; ci?: boolean }): TUIController {
  let mode: TUIMode = 'interactive';
  if (options.ci) mode = 'ci';
  else if (options.auto) mode = 'auto';
  return new TUIController(mode);
}
