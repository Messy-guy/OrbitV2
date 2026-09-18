import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import {
  ProjectHealthSnapshot,
  ProjectHealthTechItem,
  ProjectHealthWorkingTreeStatus,
  ProjectHealthUnresolvedIssue,
  ProjectHealthArchitecturalDecision,
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
  private getRelevantDirectories(projectPath: string, touchedPaths: string[] = []): string[] {
    const result = new Set<string>();
    const ignored = new Set(['.git', 'node_modules', 'dist', 'target', 'build', '.cache', '.corrupted_events']);

    if (typeof fs !== 'undefined' && fs.existsSync && fs.existsSync(projectPath)) {
      try {
        const entries = fs.readdirSync(projectPath, { withFileTypes: true });
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
    fallbackGit?: GitState
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

    const exec = cp?.execSync;
    if (typeof process !== 'undefined' && typeof fs !== 'undefined' && typeof exec === 'function') {
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
    if (techStack.length === 0 && typeof fs !== 'undefined' && fs.existsSync) {
      const pkgPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
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
      const cargoPath = path.join(projectPath, 'src-tauri', 'Cargo.toml');
      if (fs.existsSync(cargoPath)) {
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
    const { gitBranch, gitHead, workingTreeStatus } = this.resolveGitStatus(projectPath, gitState);

    // 4. Resolve relevant directories
    const touchedPaths = projectedState.changes.map((c) => c.path);
    const relevantDirectories = this.getRelevantDirectories(projectPath, touchedPaths);

    // 5. Active Task
    const activeTask =
      projectedState.mission.currentTask ||
      projectedState.mission.primaryGoal ||
      'Active workspace implementation';

    // 6. Authoritative decisions & unresolved issues derived from EventReplayEngine projection
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

    return {
      schemaVersion: 1,
      projectName: projectedState.project.name || options.workspaceName || path.basename(projectPath),
      projectPath,
      techStack,
      gitBranch,
      gitHead,
      workingTreeStatus,
      relevantDirectories,
      activeTask,
      unresolvedIssues,
      architecturalDecisions,
      generatedAt: Date.now(),
    };
  }
}

export const projectHealthService: IProjectHealthService = new ProjectHealthService();
