import { create } from 'zustand';
import { Workspace } from '../types/orbit';
import { workspaceService } from '../services';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeSpaceIdByProject: Record<string, string>; // projectId -> spaceId
  collapsedProjects: Record<string, boolean>; // projectId -> isCollapsed
  isLoading: boolean;
  
  // Actions
  loadWorkspaces: () => Promise<void>;
  setActiveWorkspace: (id: string | null) => void;
  createWorkspace: (name: string, projectPath: string) => Promise<Workspace>;
  getActiveWorkspace: () => Workspace | undefined;
  
  // Space / Tab Management
  createSpace: (projectId: string, name?: string) => string;
  setActiveSpace: (projectId: string, spaceId: string) => void;
  getActiveSpaceId: (projectId: string) => string;
  deleteSpace: (projectId: string, spaceId: string) => void;
  toggleProjectCollapsed: (projectId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  activeSpaceIdByProject: {},
  collapsedProjects: {},
  isLoading: false,

  loadWorkspaces: async () => {
    set({ isLoading: true });
    try {
      const list = await workspaceService.getWorkspaces();
      // Ensure each project has at least 1 default space
      const enriched = list.map(w => ({
        ...w,
        spaces: (w.spaces && w.spaces.length > 0) ? w.spaces : [
          { id: `space-${w.id}-1`, projectId: w.id, name: 'Main Canvas', createdAt: Date.now() }
        ]
      }));
      set({ workspaces: enriched, isLoading: false });
    } catch (e) {
      console.error('Failed to load workspaces', e);
      set({ isLoading: false });
    }
  },

  setActiveWorkspace: (id: string | null) => {
    set({ activeWorkspaceId: id });
  },

  createWorkspace: async (name: string, projectPath: string) => {
    const rawWs = await workspaceService.createWorkspace(name, projectPath);
    const defaultSpace = { id: `space-${rawWs.id}-1`, projectId: rawWs.id, name: 'Main Canvas', createdAt: Date.now() };
    const newWs: Workspace = {
      ...rawWs,
      spaces: [defaultSpace],
      activeSpaceId: defaultSpace.id,
    };

    set(state => ({
      workspaces: [newWs, ...state.workspaces],
      activeWorkspaceId: newWs.id,
      activeSpaceIdByProject: {
        ...state.activeSpaceIdByProject,
        [newWs.id]: defaultSpace.id,
      }
    }));
    return newWs;
  },

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find(w => w.id === activeWorkspaceId);
  },

  createSpace: (projectId: string, name?: string) => {
    const spaceCount = (get().workspaces.find(w => w.id === projectId)?.spaces?.length || 0) + 1;
    const newSpaceId = `space-${projectId}-${Date.now()}`;
    const newSpace = {
      id: newSpaceId,
      projectId,
      name: name || `Space ${spaceCount}`,
      createdAt: Date.now(),
    };

    set(state => ({
      workspaces: state.workspaces.map(w => {
        if (w.id === projectId) {
          const spaces = [...(w.spaces || []), newSpace];
          return { ...w, spaces };
        }
        return w;
      }),
      activeSpaceIdByProject: {
        ...state.activeSpaceIdByProject,
        [projectId]: newSpaceId,
      }
    }));

    return newSpaceId;
  },

  setActiveSpace: (projectId: string, spaceId: string) => {
    set(state => ({
      activeSpaceIdByProject: {
        ...state.activeSpaceIdByProject,
        [projectId]: spaceId,
      }
    }));
  },

  getActiveSpaceId: (projectId: string) => {
    const current = get().activeSpaceIdByProject[projectId];
    if (current) return current;
    const ws = get().workspaces.find(w => w.id === projectId);
    return ws?.spaces?.[0]?.id || `space-${projectId}-1`;
  },

  deleteSpace: (projectId: string, spaceId: string) => {
    set(state => {
      const ws = state.workspaces.find(w => w.id === projectId);
      if (!ws || !ws.spaces || ws.spaces.length <= 1) return state; // Don't delete last space

      const nextSpaces = ws.spaces.filter(s => s.id !== spaceId);
      const nextActiveId = nextSpaces[0]?.id || `space-${projectId}-1`;

      return {
        workspaces: state.workspaces.map(w => (w.id === projectId ? { ...w, spaces: nextSpaces } : w)),
        activeSpaceIdByProject: {
          ...state.activeSpaceIdByProject,
          [projectId]: state.activeSpaceIdByProject[projectId] === spaceId ? nextActiveId : state.activeSpaceIdByProject[projectId],
        }
      };
    });
  },

  toggleProjectCollapsed: (projectId: string) => {
    set(state => ({
      collapsedProjects: {
        ...state.collapsedProjects,
        [projectId]: !state.collapsedProjects[projectId],
      }
    }));
  },
}));
