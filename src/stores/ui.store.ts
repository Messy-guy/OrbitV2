import { create } from 'zustand';
import { BottomPanelType } from '../types/orbit';

interface UIState {
  activeBottomPanel: BottomPanelType;
  isCreateWorkspaceOpen: boolean;
  isAddAgentOpen: boolean;
  isShareContextOpen: boolean;
  isCreateCheckpointOpen: boolean;
  isShortcutsOpen: boolean;
  isSettingsOpen: boolean;
  activeDiffFile: string | null;
  canvasLayoutPreset: 'auto' | 'split' | 'grid' | 'columns' | 'stack';
  selectedAgentForModal: string | null; // agentId
  maximizedAgentId: string | null; // agentId for fullscreen/maximized terminal

  // Actions
  setActiveBottomPanel: (panel: BottomPanelType) => void;
  toggleBottomPanel: (panel: BottomPanelType) => void;
  setCreateWorkspaceOpen: (open: boolean) => void;
  setAddAgentOpen: (open: boolean) => void;
  setShareContextOpen: (open: boolean, agentId?: string) => void;
  setCreateCheckpointOpen: (open: boolean, agentId?: string) => void;
  setShortcutsOpen: (open: boolean) => void;
  toggleShortcuts: () => void;
  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
  setActiveDiffFile: (file: string | null) => void;
  setCanvasLayoutPreset: (preset: 'auto' | 'split' | 'grid' | 'columns' | 'stack') => void;
  setMaximizedAgentId: (agentId: string | null) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeBottomPanel: null,
  isCreateWorkspaceOpen: false,
  isAddAgentOpen: false,
  isShareContextOpen: false,
  isCreateCheckpointOpen: false,
  isShortcutsOpen: false,
  isSettingsOpen: false,
  activeDiffFile: null,
  canvasLayoutPreset: 'auto',
  selectedAgentForModal: null,
  maximizedAgentId: null,

  setShortcutsOpen: (open: boolean) => {
    set({ isShortcutsOpen: open });
  },

  toggleShortcuts: () => {
    set(state => ({ isShortcutsOpen: !state.isShortcutsOpen }));
  },

  setSettingsOpen: (open: boolean) => {
    set({ isSettingsOpen: open });
  },

  toggleSettings: () => {
    set(state => ({ isSettingsOpen: !state.isSettingsOpen }));
  },

  setActiveDiffFile: (file: string | null) => {
    set({ activeDiffFile: file });
  },

  setCanvasLayoutPreset: (preset) => {
    set({ canvasLayoutPreset: preset });
  },

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
