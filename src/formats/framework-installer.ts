import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import * as clack from '@clack/prompts';

export interface FrameworkInstallOptions {
  name: string;
  checkPath: string;
  installCommand: string;
  cwd: string;
  ciMode: boolean;
}

export async function offerFrameworkInstall(options: FrameworkInstallOptions): Promise<boolean> {
  const { name, checkPath, installCommand, cwd, ciMode } = options;

  if (fs.existsSync(checkPath)) {
    return false;
  }

  if (ciMode) {
    clack.log.info(`Skipping ${name} install (CI mode). Run \`${installCommand}\` manually.`);
    return false;
  }

  const shouldInstall = await clack.confirm({
    message: `Install ${name} framework? This runs \`${installCommand}\`.`,
  });

  if (!shouldInstall || clack.isCancel(shouldInstall)) {
    clack.log.info(`Skipping ${name} install. Run \`${installCommand}\` manually to set up the framework.`);
    return false;
  }

  try {
    execSync(installCommand, { cwd, stdio: 'inherit' });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    clack.log.warn(`${name} install failed: ${message}. Run \`${installCommand}\` manually.`);
    return false;
  }
}
