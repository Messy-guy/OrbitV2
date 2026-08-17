import { Workspace } from '../types/orbit';
import { INITIAL_WORKSPACES } from '../mock/workspaces';

export interface IWorkspaceService {
  getWorkspaces(): Promise<Workspace[]>;
  getWorkspaceById(id: string): Promise<Workspace | undefined>;
  createWorkspace(name: string, projectPath: string): Promise<Workspace>;
}

export class MockWorkspaceService implements IWorkspaceService {
  private workspaces: Workspace[] = [...INITIAL_WORKSPACES];

  async getWorkspaces(): Promise<Workspace[]> {
    return [...this.workspaces];
  }

  async getWorkspaceById(id: string): Promise<Workspace | undefined> {
    return this.workspaces.find(w => w.id === id);
  }

  async createWorkspace(name: string, projectPath: string): Promise<Workspace> {
    const newWs: Workspace = {
      id: `ws-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`,
      name,
      projectPath: projectPath || `/home/leo/projects/${name.toLowerCase().replace(/\s+/g, '-')}`,
      agentCount: 0,
      lastActive: 'Just created',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.workspaces.unshift(newWs);
    return newWs;
  }
}
