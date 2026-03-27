import { simpleGit, type SimpleGit } from 'simple-git';

export function createGit(dir: string): SimpleGit {
  return simpleGit(dir);
}

export async function cloneIfRemote(repoPath: string, targetDir: string): Promise<string> {
  if (repoPath.startsWith('http') || repoPath.startsWith('git@')) {
    const git = simpleGit();
    await git.clone(repoPath, targetDir);
    return targetDir;
  }
  return repoPath;
}
