import { ProjectContext, Checkpoint, ProjectDecision, ProjectIssue } from '../types/orbit';
import { INITIAL_CONTEXT, INITIAL_CHECKPOINTS } from '../mock/context';

export interface IContextService {
  getContext(workspaceId: string): Promise<ProjectContext | undefined>;
  updateContext(context: ProjectContext): Promise<ProjectContext>;
  addDecision(workspaceId: string, decision: Omit<ProjectDecision, 'id' | 'timestamp'>): Promise<ProjectDecision>;
  addIssue(workspaceId: string, issue: Omit<ProjectIssue, 'id'>): Promise<ProjectIssue>;
  getCheckpoints(workspaceId: string): Promise<Checkpoint[]>;
  createCheckpoint(workspaceId: string, name: string, summary: string, agentId?: string): Promise<Checkpoint>;
}

export class MockContextService implements IContextService {
  private contexts: Record<string, ProjectContext> = { ...INITIAL_CONTEXT };
  private checkpoints: Record<string, Checkpoint[]> = { ...INITIAL_CHECKPOINTS };

  async getContext(workspaceId: string): Promise<ProjectContext | undefined> {
    if (!this.contexts[workspaceId]) {
      this.contexts[workspaceId] = {
        id: `ctx-${workspaceId}`,
        workspaceId,
        goal: 'Initialize project context & core architecture',
        progress: 10,
        decisions: [],
        issues: [],
        architecture: 'Standard modular repository structure.',
        relevantFiles: ['package.json', 'README.md'],
        lastCheckpointTime: 'None yet',
        updatedAt: Date.now(),
      };
    }
    return this.contexts[workspaceId];
  }

  async updateContext(context: ProjectContext): Promise<ProjectContext> {
    this.contexts[context.workspaceId] = { ...context, updatedAt: Date.now() };
    return this.contexts[context.workspaceId];
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
      ctx.updatedAt = Date.now();
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
      ctx.updatedAt = Date.now();
    }
    return newIssue;
  }

  async getCheckpoints(workspaceId: string): Promise<Checkpoint[]> {
    return this.checkpoints[workspaceId] || [];
  }

  async createCheckpoint(workspaceId: string, name: string, summary: string, agentId?: string): Promise<Checkpoint> {
    const newCheckpoint: Checkpoint = {
      id: `chk-${Date.now()}`,
      workspaceId,
      name,
      summary,
      agentId,
      createdAt: Date.now(),
    };

    if (!this.checkpoints[workspaceId]) {
      this.checkpoints[workspaceId] = [];
    }
    this.checkpoints[workspaceId].unshift(newCheckpoint);

    // Update last checkpoint time in context
    const ctx = await this.getContext(workspaceId);
    if (ctx) {
      ctx.lastCheckpointTime = 'Just now';
      ctx.updatedAt = Date.now();
    }

    return newCheckpoint;
  }
}
