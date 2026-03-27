import type { FormatAdapter } from './types.js';
import { KiroFormat } from './kiro.js';
import { OpenSpecFormat } from './openspec.js';
import { AntigravityFormat } from './antigravity.js';
import { SuperpowersFormat } from './superpowers.js';
import { FORMAT_KIRO, FORMAT_OPENSPEC, FORMAT_ANTIGRAVITY, FORMAT_SUPERPOWERS } from '../constants.js';

export function createFormatAdapter(format: string): FormatAdapter {
  switch (format) {
    case FORMAT_KIRO:
      return new KiroFormat();
    case FORMAT_OPENSPEC:
      return new OpenSpecFormat();
    case FORMAT_ANTIGRAVITY:
      return new AntigravityFormat();
    case FORMAT_SUPERPOWERS:
      return new SuperpowersFormat();
    default:
      throw new Error(`Unknown format: "${format}". Supported formats: kiro, openspec, antigravity, superpowers`);
  }
}
