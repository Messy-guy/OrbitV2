import { create } from 'zustand';
import { BottomPanelType } from '../types/orbit';

interface UIState {
  activeBottomPanel: BottomPanelType;
  isCreateWorkspaceOpen: boolean;
  isAddAgentOpen: boolean;
  spawnerParentAgentId: string | null;
  isShareContextOpen: boolean;
  isCreateCheckpointOpen: boolean;
  isShortcutsOpen: boolean;
  isSettingsOpen: boolean;
  isProUpgradeModalOpen: boolean;
  isPairMobileOpen: boolean;
  isSidebarCollapsed: boolean;
  isBroadcastCollapsed: boolean;
  isMinimapVisible: boolean;
  activeDiffFile: string | null;
  activeDiffStaged: boolean;
  diffViewMode: 'side-by-side' | 'unified';
  canvasLayoutPreset: 'auto' | 'split' | 'grid' | 'columns' | 'stack';
  selectedAgentForModal: string | null; // agentId
  maximizedAgentId: string | null; // agentId for fullscreen/maximized terminal

  // Actions
  openWorkerSpawner: (parentAgentId?: string) => void;
  setActiveBottomPanel: (panel: BottomPanelType) => void;
  toggleBottomPanel: (panel: BottomPanelType) => void;
  setCreateWorkspaceOpen: (open: boolean) => void;
  setAddAgentOpen: (open: boolean, parentAgentId?: string) => void;
  setProUpgradeModalOpen: (open: boolean) => void;
  setPairMobileOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleBroadcastCollapsed: () => void;
  setBroadcastCollapsed: (collapsed: boolean) => void;
  toggleMinimap: () => void;
  setMinimapVisible: (visible: boolean) => void;
  setShareContextOpen: (open: boolean, agentId?: string) => void;
  setCreateCheckpointOpen: (open: boolean, agentId?: string) => void;
  setShortcutsOpen: (open: boolean) => void;
  toggleShortcuts: () => void;
  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
  setActiveDiffFile: (file: string | null, staged?: boolean) => void;
  setDiffViewMode: (mode: 'side-by-side' | 'unified') => void;
  setCanvasLayoutPreset: (preset: 'auto' | 'split' | 'grid' | 'columns' | 'stack') => void;
  setMaximizedAgentId: (agentId: string | null) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeBottomPanel: null,
  isCreateWorkspaceOpen: false,
  isAddAgentOpen: false,
  spawnerParentAgentId: null,
  isProUpgradeModalOpen: false,
  isPairMobileOpen: false,
  isSidebarCollapsed: false,
  isBroadcastCollapsed: true,
  isMinimapVisible: true,
  isShareContextOpen: false,
  isCreateCheckpointOpen: false,
  isShortcutsOpen: false,
  isSettingsOpen: false,
  activeDiffFile: null,
  activeDiffStaged: false,
  diffViewMode: 'side-by-side',
  canvasLayoutPreset: 'auto',
  selectedAgentForModal: null,
  maximizedAgentId: null,

  openWorkerSpawner: (parentAgentId?: string) => set({ isAddAgentOpen: true, spawnerParentAgentId: parentAgentId || null }),
  setAddAgentOpen: (open: boolean, parentAgentId?: string) => set({ isAddAgentOpen: open, spawnerParentAgentId: open ? (parentAgentId || null) : null }),

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

  setActiveDiffFile: (file: string | null, staged: boolean = false) => {
    set({ activeDiffFile: file, activeDiffStaged: staged });
  },

  setDiffViewMode: (mode: 'side-by-side' | 'unified') => {
    set({ diffViewMode: mode });
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

  setCreateWorkspaceOpen: (open: boolean) => set({ isCreateWorkspaceOpen: open }),
  setProUpgradeModalOpen: (open: boolean) => set({ isProUpgradeModalOpen: open }),
  setPairMobileOpen: (open: boolean) => set({ isPairMobileOpen: open }),
  toggleSidebar: () => set(state => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSidebarCollapsed: (collapsed: boolean) => set({ isSidebarCollapsed: collapsed }),
  toggleBroadcastCollapsed: () => set(state => ({ isBroadcastCollapsed: !state.isBroadcastCollapsed })),
  setBroadcastCollapsed: (collapsed: boolean) => set({ isBroadcastCollapsed: collapsed }),
  toggleMinimap: () => set(state => ({ isMinimapVisible: !state.isMinimapVisible })),
  setMinimapVisible: (visible: boolean) => set({ isMinimapVisible: visible }),
  setShareContextOpen: (open: boolean, agentId?: string) => {
    set({ isShareContextOpen: open, selectedAgentForModal: agentId || null });
  },

  setCreateCheckpointOpen: (open: boolean, agentId?: string) => {
    set({ isCreateCheckpointOpen: open, selectedAgentForModal: agentId || null });
  },
}));
