import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function getOrbitGlobalDir(): string {
  const home = os.homedir();
  const dir = path.join(home, '.config', 'orbit');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getProjectOrbitDir(cwd: string = process.cwd()): string {
  const dir = path.join(cwd, '.orbit');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function readProjectMemory(cwd: string = process.cwd()): {
  sessionNotes: string;
  decisions: string[];
  blockers: string[];
} {
  const projectOrbit = getProjectOrbitDir(cwd);
  const sessionFile = path.join(projectOrbit, 'SESSION.md');
  const decisionsFile = path.join(projectOrbit, 'DECISIONS.md');
  const bugsFile = path.join(projectOrbit, 'BUGS.md');

  let sessionNotes = '';
  if (fs.existsSync(sessionFile)) {
    sessionNotes = fs.readFileSync(sessionFile, 'utf8');
  }

  const decisions: string[] = [];
  if (fs.existsSync(decisionsFile)) {
    const lines = fs.readFileSync(decisionsFile, 'utf8').split('\n');
    for (const l of lines) {
      if (l.trim().startsWith('- [') || l.trim().startsWith('* ') || l.trim().startsWith('- ')) {
        decisions.push(l.trim().replace(/^[-*]\s+(\[[x ]\]\s+)?/, ''));
      }
    }
  }

  const blockers: string[] = [];
  if (fs.existsSync(bugsFile)) {
    const lines = fs.readFileSync(bugsFile, 'utf8').split('\n');
    for (const l of lines) {
      if (l.trim().startsWith('- ') || l.trim().startsWith('* ')) {
        blockers.push(l.trim().replace(/^[-*]\s+/, ''));
      }
    }
  }

  return {
    sessionNotes,
    decisions,
    blockers
  };
}
