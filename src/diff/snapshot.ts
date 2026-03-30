import { existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export function takeSnapshot(sourceDir: string, snapshotsDir: string, phase: string): void {
  if (!existsSync(sourceDir)) return;
  const phaseSnapDir = join(snapshotsDir, phase);
  if (existsSync(phaseSnapDir)) rmSync(phaseSnapDir, { recursive: true });
  mkdirSync(phaseSnapDir, { recursive: true });
  cpSync(sourceDir, phaseSnapDir, { recursive: true });
}

export function getLatestSnapshot(snapshotsDir: string, phase: string): string | null {
  const phaseSnapDir = join(snapshotsDir, phase);
  if (!existsSync(phaseSnapDir)) return null;
  return phaseSnapDir;
}
