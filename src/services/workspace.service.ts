import { Workspace } from '../types/orbit';
import { INITIAL_WORKSPACES } from '../mock/workspaces';
import { isTauriAvailable, tauriService } from './tauri.service';

export interface IWorkspaceService {
  getWorkspaces(): Promise<Workspace[]>;
  getWorkspaceById(id: string): Promise<Workspace | undefined>;
  createWorkspace(name: string, projectPath: string): Promise<Workspace>;
  deleteWorkspace(id: string): Promise<void>;
}

export class HybridWorkspaceService implements IWorkspaceService {
  private fallbackWorkspaces: Workspace[] = [...INITIAL_WORKSPACES];

  async getWorkspaces(): Promise<Workspace[]> {
    if (isTauriAvailable()) {
      try {
        const list = await tauriService.getWorkspaces();
        if (list && list.length > 0) return list;
      } catch (e) {
        console.warn('Tauri getWorkspaces failed, falling back to in-memory state', e);
      }
    }
    return [...this.fallbackWorkspaces];
  }

  async getWorkspaceById(id: string): Promise<Workspace | undefined> {
    const list = await this.getWorkspaces();
    return list.find(w => w.id === id);
  }

  async createWorkspace(name: string, projectPath: string): Promise<Workspace> {
    if (isTauriAvailable()) {
      try {
        return await tauriService.createWorkspace(name, projectPath);
      } catch (e) {
        console.warn('Tauri createWorkspace failed, using fallback', e);
      }
    }

    const newWs: Workspace = {
      id: `ws-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`,
      name,
      projectPath: projectPath || `~/projects/${name.toLowerCase().replace(/\s+/g, '-')}`,
      agentCount: 0,
      lastActive: 'Just created',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.fallbackWorkspaces.unshift(newWs);
    return newWs;
  }

  async deleteWorkspace(id: string): Promise<void> {
    if (isTauriAvailable()) {
      try {
        await tauriService.deleteWorkspace(id);
      } catch (e) {
        console.warn('Tauri deleteWorkspace failed', e);
      }
    }
    this.fallbackWorkspaces = this.fallbackWorkspaces.filter(w => w.id !== id);
  }
}
