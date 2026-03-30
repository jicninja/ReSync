import { execSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TOOLKIT_VALIDATE_TIMEOUT, TOOLKIT_VALIDATE_CONCURRENCY } from '../constants.js';
import type { Recommendation } from './types.js';

const execFileAsync = promisify(execFile);

export function isNpmAvailable(): boolean {
  try {
    execSync('npm --version', { timeout: TOOLKIT_VALIDATE_TIMEOUT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function validateSinglePackage(pkg: string): Promise<boolean> {
  try {
    await execFileAsync('npm', ['view', pkg, 'name'], { timeout: TOOLKIT_VALIDATE_TIMEOUT });
    return true;
  } catch {
    return false;
  }
}

export async function validatePackages(recommendations: Recommendation[]): Promise<Recommendation[]> {
  const toValidate = recommendations.filter((r) => r.package && r.package.length > 0);
  const skipValidation = recommendations.filter((r) => !r.package || r.package.length === 0);

  const results: Recommendation[] = [...skipValidation];

  for (let i = 0; i < toValidate.length; i += TOOLKIT_VALIDATE_CONCURRENCY) {
    const batch = toValidate.slice(i, i + TOOLKIT_VALIDATE_CONCURRENCY);
    const validated = await Promise.all(
      batch.map(async (rec) => ({
        ...rec,
        validated: await validateSinglePackage(rec.package),
      }))
    );
    results.push(...validated);
  }

  return results;
}
