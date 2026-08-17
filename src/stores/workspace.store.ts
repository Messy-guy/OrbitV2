import { create } from 'zustand';
import { Workspace } from '../types/orbit';
import { workspaceService } from '../services';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  
  // Actions
  loadWorkspaces: () => Promise<void>;
  setActiveWorkspace: (id: string | null) => void;
  createWorkspace: (name: string, projectPath: string) => Promise<Workspace>;
  getActiveWorkspace: () => Workspace | undefined;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  isLoading: false,

  loadWorkspaces: async () => {
    set({ isLoading: true });
    try {
      const list = await workspaceService.getWorkspaces();
      set({ workspaces: list, isLoading: false });
    } catch (e) {
      console.error('Failed to load workspaces', e);
      set({ isLoading: false });
    }
  },

  setActiveWorkspace: (id: string | null) => {
    set({ activeWorkspaceId: id });
  },

  createWorkspace: async (name: string, projectPath: string) => {
    const newWs = await workspaceService.createWorkspace(name, projectPath);
    set(state => ({
      workspaces: [newWs, ...state.workspaces],
      activeWorkspaceId: newWs.id
    }));
    return newWs;
  },

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find(w => w.id === activeWorkspaceId);
  }
}));
