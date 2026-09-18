import { isAbsolutePath, pathJoin, pathBasename, getNodeFs } from '../utils/pathUtils';

async function getNodeCp(): Promise<any> {
  try {
    // eslint-disable-next-line no-new-func
    const dynamicImport = new Function('return import("node:child_process")');
    const mod = await dynamicImport();
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}
import {
  ProjectHealthSnapshot,
  ProjectHealthTechItem,
  ProjectHealthWorkingTreeStatus,
  ProjectHealthUnresolvedIssue,
  ProjectHealthArchitecturalDecision,
  ProjectHealthVerifiedFileChange,
  GitState,
} from '../types/orbit';
import { VerificationLevel } from '../types/provenance';
import { OrbitEvent } from '../types/events';
import { EventStore, getCanonicalProjectSlug } from './evidence/EventStore';
import { EventReplayEngine, ProjectedProjectState } from './evidence/EventReplayEngine';
import { isTauriAvailable, tauriService } from './tauri.service';

export interface GenerateHealthSnapshotOptions {
  projectPath?: string;
  workspaceName?: string;
  projectSlug?: string;
  gitState?: GitState;
  events?: OrbitEvent[];
}

export interface IProjectHealthService {
  generateSnapshot(options?: GenerateHealthSnapshotOptions): Promise<ProjectHealthSnapshot>;
}

export class ProjectHealthService implements IProjectHealthService {
  /**
   * Resolves relevant software directories at root and touched directories
   */
  private getRelevantDirectories(projectPath: string, touchedPaths: string[] = [], nodeFs?: any): string[] {
    const result = new Set<string>();
    const ignored = new Set(['.git', 'node_modules', 'dist', 'target', 'build', '.cache', '.corrupted_events']);

    if (nodeFs && nodeFs.existsSync && nodeFs.existsSync(projectPath)) {
      try {
        const entries = nodeFs.readdirSync(projectPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const dirName = entry.name;
            if (!dirName.startsWith('.') && !ignored.has(dirName)) {
              result.add(dirName);
            } else if (dirName === '.orbit' || dirName === '.github' || dirName === '.agents') {
              result.add(dirName);
            }
          }
        }
      } catch {
        // Safe fallback
      }
    }

    for (const p of touchedPaths) {
      const clean = p.replace(/^[/\\]+/, '');
      const topDir = clean.split(/[/\\]/)[0];
      if (topDir && !ignored.has(topDir) && !topDir.includes('.')) {
        result.add(topDir);
      }
    }

    return Array.from(result).sort();
  }

  /**
   * Resolves Git branch, HEAD commit, and working-tree status
   */
  private resolveGitStatus(
    projectPath: string,
    fallbackGit?: GitState,
    nodeFs?: any,
    nodeCp?: any
  ): {
    gitBranch: string;
    gitHead: string;
    workingTreeStatus: ProjectHealthWorkingTreeStatus;
  } {
    if (fallbackGit) {
      const modified = fallbackGit.modifiedFiles.map((f) => f.path);
      const untracked = fallbackGit.untrackedFiles?.map((f) => f.path) || [];
      return {
        gitBranch: fallbackGit.currentBranch,
        gitHead: fallbackGit.headCommit,
        workingTreeStatus: {
          isClean: modified.length === 0 && untracked.length === 0,
          modifiedFiles: modified,
          untrackedFiles: untracked,
          diffSummary: modified.length === 0 ? 'Clean working tree' : `${modified.length} modified file(s)`,
        },
      };
    }

    const exec = nodeCp?.execSync;
    if (nodeFs && typeof exec === 'function') {
      try {
        const branch: string = exec('git rev-parse --abbrev-ref HEAD', {
          cwd: projectPath,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 2000,
        }).trim() || 'main';

        const head: string = exec('git log -1 --format="%h %s"', {
          cwd: projectPath,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 2000,
        }).trim() || 'initial';

        const statusOutput: string = exec('git status --porcelain', {
          cwd: projectPath,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 2000,
        }).trim();

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

        let diffSummary = 'Clean working tree';
        if (modifiedFiles.length > 0 || untrackedFiles.length > 0) {
          try {
            diffSummary = exec('git diff --stat', {
              cwd: projectPath,
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'ignore'],
              timeout: 2000,
            }).trim() || `${modifiedFiles.length} file(s) modified, ${untrackedFiles.length} untracked`;
          } catch {
            diffSummary = `${modifiedFiles.length} file(s) modified, ${untrackedFiles.length} untracked`;
          }
        }

        return {
          gitBranch: branch,
          gitHead: head,
          workingTreeStatus: {
            isClean: modifiedFiles.length === 0 && untrackedFiles.length === 0,
            modifiedFiles,
            untrackedFiles,
            diffSummary,
          },
        };
      } catch {
        // Fallback below
      }
    }

    return {
      gitBranch: 'none',
      gitHead: 'none',
      workingTreeStatus: {
        isClean: true,
        modifiedFiles: [],
        untrackedFiles: [],
        diffSummary: 'Not a git repository or git unavailable',
      },
    };
  }


  public async generateSnapshot(options: GenerateHealthSnapshotOptions = {}): Promise<ProjectHealthSnapshot> {
    const projectPath = options.projectPath || (typeof process !== 'undefined' ? process.cwd() : '.');
    const slug = options.projectSlug || getCanonicalProjectSlug(options.workspaceName, projectPath);
    const [nodeFs, nodeCp] = await Promise.all([getNodeFs(), getNodeCp()]);

    // 1. Replay events for project metadata, tech stack, and active task
    const events = options.events || (await EventStore.getEvents(slug));
    const projectedState: ProjectedProjectState = EventReplayEngine.replay(slug, events);

    // 2. Resolve tech stack
    let techStack: ProjectHealthTechItem[] = projectedState.project.techStack.map((t) => ({
      name: t.name,
      category: t.category,
      verificationLevel: t.verificationLevel,
      source: t.source,
    }));

    // Fallback: If tech stack empty, inspect package.json / Cargo.toml directly
    if (techStack.length === 0 && nodeFs && nodeFs.existsSync) {
      const pkgPath = pathJoin(projectPath, 'package.json');
      if (nodeFs.existsSync(pkgPath)) {
        techStack.push({
          name: 'Node.js',
          category: 'runtime',
          verificationLevel: 'file_verified',
          source: 'package.json',
        });
        techStack.push({
          name: 'TypeScript',
          category: 'language',
          verificationLevel: 'file_verified',
          source: 'package.json',
        });
      }
      const cargoPath = pathJoin(projectPath, 'src-tauri', 'Cargo.toml');
      if (nodeFs.existsSync(cargoPath)) {
        techStack.push({
          name: 'Rust',
          category: 'language',
          verificationLevel: 'file_verified',
          source: 'src-tauri/Cargo.toml',
        });
      }
    }

    // 3. Resolve Git status
    let gitState = options.gitState;
    if (!gitState && isTauriAvailable()) {
      try {
        gitState = await tauriService.getGitState(projectPath);
      } catch {}
    }
    const { gitBranch, gitHead, workingTreeStatus } = this.resolveGitStatus(projectPath, gitState, nodeFs, nodeCp);

    // 4. Resolve relevant directories
    const touchedPaths = projectedState.changes.map((c) => c.path);
    const relevantDirectories = this.getRelevantDirectories(projectPath, touchedPaths, nodeFs);

    // 5. Active Task
    const activeTask =
      projectedState.mission.currentTask ||
      projectedState.mission.primaryGoal ||
      'Active workspace implementation';

    // 6. Completed Work:
    // Gather from event replay progress.completed, resolved issues, and Git commit log if needed
    const completedSet = new Set<string>();
    for (const item of projectedState.mission.progress.completed) {
      if (item && item.trim()) {
        completedSet.add(item.trim());
      }
    }
    for (const issue of projectedState.issues) {
      if (issue.status === 'resolved' && issue.issue) {
        completedSet.add(`Resolved: ${issue.issue}`);
      }
    }
    if (completedSet.size === 0 && gitState?.recentCommits && gitState.recentCommits.length > 0) {
      for (const commit of gitState.recentCommits.slice(0, 5)) {
        if (commit && commit.trim()) completedSet.add(commit.trim());
      }
    } else if (completedSet.size === 0 && nodeCp && typeof nodeCp.execSync === 'function') {
      try {
        const commitLog = nodeCp.execSync('git log -5 --format="%s"', {
          cwd: projectPath,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 2000,
        }).trim();
        if (commitLog) {
          for (const line of commitLog.split('\n')) {
            if (line.trim()) completedSet.add(line.trim());
          }
        }
      } catch {}
    }
    const completedWork = Array.from(completedSet);

    // 7. Authoritative decisions & unresolved issues derived from EventReplayEngine projection
    const architecturalDecisions: ProjectHealthArchitecturalDecision[] = projectedState.decisions
      .filter((d) => d.status === 'active')
      .map((d) => ({
        id: d.id,
        decision: d.decision,
        rationale: d.rationale,
        status: d.status,
        effectiveLevel: d.effectiveLevel,
      }));

    const unresolvedIssues: ProjectHealthUnresolvedIssue[] = projectedState.issues
      .filter((i) => i.status === 'open' || i.status === 'investigating')
      .map((i) => ({
        id: i.id,
        issue: i.issue,
        status: i.status as 'open' | 'investigating',
        verificationLevel: i.verificationLevel,
      }));

    // 8. Verified Changed Files:
    // Reconcile EventStore verified file changes and live working-tree modified files verified on disk
    const verifiedFileMap = new Map<string, ProjectHealthVerifiedFileChange>();

    // Add verified changes from projected state
    for (const change of projectedState.changes) {
      if (
        change.verificationLevel === 'file_verified' ||
        change.verificationLevel === 'git_verified' ||
        change.verificationLevel === 'behavior_verified'
      ) {
        verifiedFileMap.set(change.path, {
          path: change.path,
          status: change.status || 'modified',
          verificationLevel: change.verificationLevel,
          additions: change.additions,
          deletions: change.deletions,
          diffSnippet: change.diffSnippet,
        });
      }
    }

    // Check live working tree modified files: if they exist on disk, verify them
    for (const relPath of workingTreeStatus.modifiedFiles) {
      const absPath = isAbsolutePath(relPath) ? relPath : pathJoin(projectPath, relPath);
      const existsOnDisk = nodeFs && nodeFs.existsSync && nodeFs.existsSync(absPath);
      if (existsOnDisk) {
        const existing = verifiedFileMap.get(relPath);
        if (existing) {
          existing.status = 'modified';
          if (existing.verificationLevel === 'claimed') {
            existing.verificationLevel = 'git_verified';
          }
        } else {
          verifiedFileMap.set(relPath, {
            path: relPath,
            status: 'modified',
            verificationLevel: 'git_verified',
          });
        }
      }
    }

    const verifiedChangedFiles = Array.from(verifiedFileMap.values()).sort((a, b) =>
      a.path.localeCompare(b.path)
    );

    return {
      schemaVersion: 1,
      projectName: projectedState.project.name || options.workspaceName || pathBasename(projectPath),
      projectPath,
      techStack,
      gitBranch,
      gitHead,
      workingTreeStatus,
      relevantDirectories,
      activeTask,
      completedWork,
      unresolvedIssues,
      architecturalDecisions,
      verifiedChangedFiles,
      generatedAt: Date.now(),
    };
  }
}

export const projectHealthService: IProjectHealthService = new ProjectHealthService();
