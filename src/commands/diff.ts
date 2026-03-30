import * as path from 'node:path';
import { RESPEC_DIR } from '../constants.js';
import { getLatestSnapshot } from '../diff/snapshot.js';
import { compareDirectories } from '../diff/compare.js';
import { analyzedDir, generatedDir } from '../utils/fs.js';
import { loadConfig } from '../config/loader.js';

export async function runDiff(
  dir: string,
  options: { phase?: string; ci?: boolean },
): Promise<void> {
  const snapshotsDir = path.join(dir, RESPEC_DIR, 'snapshots');
  const phases = options.phase ? [options.phase] : ['analyzed', 'specs'];

  for (const phase of phases) {
    const snapshot = getLatestSnapshot(snapshotsDir, phase);
    if (!snapshot) {
      console.log(`No snapshot found for ${phase}. Run analyze/generate first, then re-run to see diff.`);
      continue;
    }

    let currentDir: string;
    if (phase === 'analyzed') {
      currentDir = analyzedDir(dir);
    } else {
      const config = await loadConfig(dir);
      currentDir = generatedDir(dir, config.output.dir);
    }

    const result = compareDirectories(snapshot, currentDir);

    console.log(`\n=== ${phase.toUpperCase()} DIFF ===\n`);

    if (result.modified.length === 0 && result.added.length === 0 && result.removed.length === 0) {
      console.log('  No changes detected.');
      continue;
    }

    for (const f of result.modified) console.log(`  ~ Modified: ${f}`);
    for (const f of result.added) console.log(`  + Added: ${f}`);
    for (const f of result.removed) console.log(`  - Removed: ${f}`);
    console.log(`\n  Summary: ${result.modified.length} modified, ${result.added.length} added, ${result.removed.length} removed, ${result.unchanged.length} unchanged`);
  }
}
