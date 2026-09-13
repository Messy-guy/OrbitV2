import { execSync } from 'child_process';

export interface GitContext {
  branch: string;
  headCommit: string;
  modifiedFiles: string[];
  untrackedFiles: string[];
  diffSummary: string;
}

export function getGitContext(cwd: string = process.cwd()): GitContext {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const headCommit = execSync('git log -1 --format="%h - %s (%cr)"', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    
    const statusOutput = execSync('git status --porcelain', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const modifiedFiles: string[] = [];
    const untrackedFiles: string[] = [];

    if (statusOutput) {
      for (const line of statusOutput.split('\n')) {
        const code = line.slice(0, 2);
        const file = line.slice(3).trim();
        if (code.includes('?')) {
          untrackedFiles.push(file);
        } else {
          modifiedFiles.push(file);
        }
      }
    }

    let diffSummary = '';
    try {
      diffSummary = execSync('git diff --stat', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      diffSummary = 'No staged/unstaged diff';
    }

    return {
      branch,
      headCommit,
      modifiedFiles,
      untrackedFiles,
      diffSummary
    };
  } catch {
    return {
      branch: 'none',
      headCommit: 'none',
      modifiedFiles: [],
      untrackedFiles: [],
      diffSummary: 'Not a git repository'
    };
  }
}
