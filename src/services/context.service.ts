import { ProjectContext, Checkpoint, ProjectDecision, ProjectIssue, GitState } from '../types/orbit';
import { INITIAL_CONTEXT, INITIAL_CHECKPOINTS } from '../mock/context';
import { isTauriAvailable, tauriService } from './tauri.service';

export interface IContextService {
  getContext(workspaceId: string): Promise<ProjectContext | undefined>;
  updateContext(context: ProjectContext): Promise<ProjectContext>;
  addDecision(workspaceId: string, decision: Omit<ProjectDecision, 'id' | 'timestamp'>): Promise<ProjectDecision>;
  addIssue(workspaceId: string, issue: Omit<ProjectIssue, 'id'>): Promise<ProjectIssue>;
  getCheckpoints(workspaceId: string): Promise<Checkpoint[]>;
  saveCheckpoint(checkpoint: Checkpoint): Promise<Checkpoint>;
  deleteCheckpoint(id: string): Promise<void>;
  getGitState(projectPath: string): Promise<GitState>;
}

export class HybridContextService implements IContextService {
  private fallbackContexts: Record<string, ProjectContext> = {};
  private fallbackCheckpoints: Record<string, Checkpoint[]> = {};

  async getContext(workspaceId: string): Promise<ProjectContext | undefined> {
    if (isTauriAvailable()) {
      try {
        const ctx = await tauriService.getProjectContext(workspaceId);
        if (ctx) return ctx;
      } catch (e) {
        console.warn('Tauri getProjectContext failed, using fallback', e);
      }
    }

    if (!this.fallbackContexts[workspaceId]) {
      this.fallbackContexts[workspaceId] = {
        id: `ctx-${workspaceId}`,
        workspaceId,
        currentTask: 'Initialize project context & core architecture',
        goal: 'Develop modular multi-agent software application',
        progress: 25,
        activeWork: 'Setting up architectural boundaries and baseline tests',
        decisions: [],
        issues: [],
        notes: [],
        architecture: 'Standard modular repository structure.',
        relevantFiles: ['package.json', 'README.md'],
        lastCheckpointTime: 'None yet',
        updatedAt: Date.now(),
      };
    }
    return this.fallbackContexts[workspaceId];
  }

  async updateContext(context: ProjectContext): Promise<ProjectContext> {
    const updated = { ...context, updatedAt: Date.now() };
    if (isTauriAvailable()) {
      try {
        await tauriService.saveProjectContext(updated);
      } catch (e) {
        console.warn('Tauri saveProjectContext failed', e);
      }
    }
    this.fallbackContexts[context.workspaceId] = updated;
    return updated;
  }

  async addDecision(workspaceId: string, decision: Omit<ProjectDecision, 'id' | 'timestamp'>): Promise<ProjectDecision> {
    const ctx = await this.getContext(workspaceId);
    const newDecision: ProjectDecision = {
      ...decision,
      id: `dec-${Date.now()}`,
      timestamp: 'Just now',
    };
    if (ctx) {
      ctx.decisions.unshift(newDecision);
      await this.updateContext(ctx);
    }
    return newDecision;
  }

  async addIssue(workspaceId: string, issue: Omit<ProjectIssue, 'id'>): Promise<ProjectIssue> {
    const ctx = await this.getContext(workspaceId);
    const newIssue: ProjectIssue = {
      ...issue,
      id: `iss-${Date.now()}`,
    };
    if (ctx) {
      ctx.issues.unshift(newIssue);
      await this.updateContext(ctx);
    }
    return newIssue;
  }

  async getCheckpoints(workspaceId: string): Promise<Checkpoint[]> {
    if (isTauriAvailable()) {
      try {
        const list = await tauriService.getCheckpoints(workspaceId);
        if (list && list.length > 0) return list;
      } catch (e) {
        console.warn('Tauri getCheckpoints failed', e);
      }
    }
    return this.fallbackCheckpoints[workspaceId] || [];
  }

  async saveCheckpoint(checkpoint: Checkpoint): Promise<Checkpoint> {
    if (isTauriAvailable()) {
      try {
        await tauriService.saveCheckpoint(checkpoint);
      } catch (e) {
        console.warn('Tauri saveCheckpoint failed', e);
      }
    }

    if (!this.fallbackCheckpoints[checkpoint.workspaceId]) {
      this.fallbackCheckpoints[checkpoint.workspaceId] = [];
    }
    const idx = this.fallbackCheckpoints[checkpoint.workspaceId].findIndex(c => c.id === checkpoint.id);
    if (idx >= 0) {
      this.fallbackCheckpoints[checkpoint.workspaceId][idx] = checkpoint;
    } else {
      this.fallbackCheckpoints[checkpoint.workspaceId].unshift(checkpoint);
    }

    // Update last checkpoint time in context
    const ctx = await this.getContext(checkpoint.workspaceId);
    if (ctx) {
      ctx.lastCheckpointTime = 'Just now';
      await this.updateContext(ctx);
    }

    return checkpoint;
  }

  async deleteCheckpoint(id: string): Promise<void> {
    if (isTauriAvailable()) {
      try {
        await tauriService.deleteCheckpoint(id);
      } catch (e) {
        console.warn('Tauri deleteCheckpoint failed', e);
      }
    }
    for (const wsId in this.fallbackCheckpoints) {
      this.fallbackCheckpoints[wsId] = this.fallbackCheckpoints[wsId].filter(c => c.id !== id);
    }
  }

  async getGitState(projectPath: string): Promise<GitState> {
    return await tauriService.getGitState(projectPath);
  }
}
