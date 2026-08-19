import { create } from 'zustand';
import { BottomPanelType } from '../types/orbit';

interface UIState {
  activeBottomPanel: BottomPanelType;
  isCreateWorkspaceOpen: boolean;
  isAddAgentOpen: boolean;
  isShareContextOpen: boolean;
  isCreateCheckpointOpen: boolean;
  selectedAgentForModal: string | null; // agentId
  maximizedAgentId: string | null; // agentId for fullscreen/maximized terminal

  // Actions
  setActiveBottomPanel: (panel: BottomPanelType) => void;
  toggleBottomPanel: (panel: BottomPanelType) => void;
  setCreateWorkspaceOpen: (open: boolean) => void;
  setAddAgentOpen: (open: boolean) => void;
  setShareContextOpen: (open: boolean, agentId?: string) => void;
  setCreateCheckpointOpen: (open: boolean, agentId?: string) => void;
  setMaximizedAgentId: (agentId: string | null) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeBottomPanel: null,
  isCreateWorkspaceOpen: false,
  isAddAgentOpen: false,
  isShareContextOpen: false,
  isCreateCheckpointOpen: false,
  selectedAgentForModal: null,
  maximizedAgentId: null,

  setMaximizedAgentId: (agentId: string | null) => {
    set({ maximizedAgentId: agentId });
  },

  setActiveBottomPanel: (panel: BottomPanelType) => {
    set({ activeBottomPanel: panel });
  },

  toggleBottomPanel: (panel: BottomPanelType) => {
    const current = get().activeBottomPanel;
    set({ activeBottomPanel: current === panel ? null : panel });
  },

  setCreateWorkspaceOpen: (open: boolean) => {
    set({ isCreateWorkspaceOpen: open });
  },

  setAddAgentOpen: (open: boolean) => {
    set({ isAddAgentOpen: open });
  },

  setShareContextOpen: (open: boolean, agentId?: string) => {
    set({ isShareContextOpen: open, selectedAgentForModal: agentId || null });
  },

  setCreateCheckpointOpen: (open: boolean, agentId?: string) => {
    set({ isCreateCheckpointOpen: open, selectedAgentForModal: agentId || null });
  },
}));
