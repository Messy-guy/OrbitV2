import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getGitContext, GitContext } from './git.js';

export interface CliProjectHealthSnapshot {
  schemaVersion: 1;
  projectName: string;
  projectPath: string;
  techStack: Array<{ name: string; category: string; verificationLevel: string; source: string }>;
  gitBranch: string;
  gitHead: string;
  workingTreeStatus: {
    isClean: boolean;
    modifiedFiles: string[];
    untrackedFiles: string[];
    diffSummary: string;
  };
  relevantDirectories: string[];
  activeTask: string;
  completedWork: string[];
  unresolvedIssues: Array<{ id: string; issue: string; status: string; verificationLevel: string }>;
  architecturalDecisions: Array<{ id: string; decision: string; rationale?: string; status: string; effectiveLevel: string }>;
  verifiedChangedFiles: Array<{ path: string; status: string; verificationLevel: string; additions?: number; deletions?: number }>;
  generatedAt: number;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]+/g, '-').replace(/^-|-$/g, '') || 'default';
}

export function getProjectHealthSnapshot(cwd: string = process.cwd()): CliProjectHealthSnapshot {
  const git: GitContext = getGitContext(cwd);
  const home = os.homedir() || '.';
  const projectName = path.basename(cwd);
  const slug = slugify(projectName);
  const canonicalDir = path.join(home, '.orbit', 'projects', slug);

  // 1. Tech stack detection
  const techStack: Array<{ name: string; category: string; verificationLevel: string; source: string }> = [];
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      techStack.push({ name: 'Node.js', category: 'runtime', verificationLevel: 'file_verified', source: 'package.json' });
      if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) {
        techStack.push({ name: 'TypeScript', category: 'language', verificationLevel: 'file_verified', source: 'package.json' });
      }
      if (pkg.dependencies?.react) {
        techStack.push({ name: 'React', category: 'framework', verificationLevel: 'file_verified', source: 'package.json' });
      }
    } catch {}
  }
  const cargoPath = path.join(cwd, 'src-tauri', 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    techStack.push({ name: 'Rust', category: 'language', verificationLevel: 'file_verified', source: 'src-tauri/Cargo.toml' });
    techStack.push({ name: 'Tauri', category: 'framework', verificationLevel: 'file_verified', source: 'src-tauri/Cargo.toml' });
  }

  // 2. Relevant directories
  const relevantDirectories: string[] = [];
  const ignored = new Set(['.git', 'node_modules', 'dist', 'target', 'build', '.cache', '.corrupted_events']);
  try {
    const entries = fs.readdirSync(cwd, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !ignored.has(entry.name)) {
        if (!entry.name.startsWith('.') || entry.name === '.orbit' || entry.name === '.agents') {
          relevantDirectories.push(entry.name);
        }
      }
    }
  } catch {}
  relevantDirectories.sort();

  // 3. Projections from canonical Orbit store
  let activeTask = 'Active workspace implementation and verification';
  const completedWork: string[] = [];
  const architecturalDecisions: Array<{ id: string; decision: string; rationale?: string; status: string; effectiveLevel: string }> = [];
  const unresolvedIssues: Array<{ id: string; issue: string; status: string; verificationLevel: string }> = [];
  const verifiedChangedFiles: Array<{ path: string; status: string; verificationLevel: string; additions?: number; deletions?: number }> = [];

  const decisionsJson = path.join(canonicalDir, 'decisions.json');
  if (fs.existsSync(decisionsJson)) {
    try {
      const decs = JSON.parse(fs.readFileSync(decisionsJson, 'utf8'));
      if (Array.isArray(decs)) {
        for (const d of decs) {
          if (d.status === 'active') {
            architecturalDecisions.push({
              id: d.id,
              decision: d.decision,
              rationale: d.rationale,
              status: d.status,
              effectiveLevel: d.effectiveLevel || 'observed',
            });
          }
        }
      }
    } catch {}
  }

  const issuesJson = path.join(canonicalDir, 'issues.json');
  if (fs.existsSync(issuesJson)) {
    try {
      const issues = JSON.parse(fs.readFileSync(issuesJson, 'utf8'));
      if (Array.isArray(issues)) {
        for (const i of issues) {
          if (i.status === 'open' || i.status === 'investigating') {
            unresolvedIssues.push({
              id: i.id,
              issue: i.issue,
              status: i.status,
              verificationLevel: i.verificationLevel || 'observed',
            });
          } else if (i.status === 'resolved') {
            completedWork.push(`Resolved: ${i.issue}`);
          }
        }
      }
    } catch {}
  }

  const changesJson = path.join(canonicalDir, 'changes.json');
  if (fs.existsSync(changesJson)) {
    try {
      const changes = JSON.parse(fs.readFileSync(changesJson, 'utf8'));
      if (Array.isArray(changes)) {
        for (const c of changes) {
          if (c.verificationLevel === 'file_verified' || c.verificationLevel === 'git_verified') {
            verifiedChangedFiles.push({
              path: c.path,
              status: c.status || 'modified',
              verificationLevel: c.verificationLevel,
              additions: c.additions,
              deletions: c.deletions,
            });
          }
        }
      }
    } catch {}
  }

  // Live working-tree verified files
  for (const m of git.modifiedFiles) {
    if (!verifiedChangedFiles.some((c) => c.path === m)) {
      if (fs.existsSync(path.join(cwd, m))) {
        verifiedChangedFiles.push({
          path: m,
          status: 'modified',
          verificationLevel: 'git_verified',
        });
      }
    }
  }

  return {
    schemaVersion: 1,
    projectName,
    projectPath: cwd,
    techStack,
    gitBranch: git.branch,
    gitHead: git.headCommit,
    workingTreeStatus: {
      isClean: git.modifiedFiles.length === 0 && git.untrackedFiles.length === 0,
      modifiedFiles: git.modifiedFiles,
      untrackedFiles: git.untrackedFiles,
      diffSummary: git.diffSummary || (git.modifiedFiles.length === 0 ? 'Clean working tree' : `${git.modifiedFiles.length} file(s) modified`),
    },
    relevantDirectories,
    activeTask,
    completedWork,
    unresolvedIssues,
    architecturalDecisions,
    verifiedChangedFiles,
    generatedAt: Date.now(),
  };
}
