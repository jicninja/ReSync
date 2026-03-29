import type { FormatAdapter } from './types.js';
import { KiroFormat } from './kiro.js';
import { OpenSpecFormat } from './openspec.js';
import { AntigravityFormat } from './antigravity.js';
import { SuperpowersFormat } from './superpowers.js';
import { SpecKitFormat } from './speckit.js';
import { BmadFormat } from './bmad.js';
import { FORMAT_KIRO, FORMAT_OPENSPEC, FORMAT_ANTIGRAVITY, FORMAT_SUPERPOWERS, FORMAT_SPECKIT, FORMAT_BMAD } from '../constants.js';

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
    case FORMAT_SPECKIT:
      return new SpecKitFormat();
    case FORMAT_BMAD:
      return new BmadFormat();
    default:
      throw new Error(`Unknown format: "${format}". Supported formats: kiro, openspec, antigravity, superpowers, speckit, bmad`);
  }
}
