import { create } from 'zustand';
import { SettingsState, ThemeId, AccentId, CanvasGridStyle, TerminalCursorStyle } from '../types/settings';

const STORAGE_KEY = 'orbit_user_settings_v1';

export const THEMES: Record<ThemeId, { name: string; description: string; preview: { bg: string; sidebar: string; panel: string; border: string } }> = {
  obsidian: {
    name: 'Obsidian Dark',
    description: 'Deep graphite & pitch obsidian (Default)',
    preview: {
      bg: '#0b0c0e',
      sidebar: '#090a0d',
      panel: '#121319',
      border: 'rgba(255,255,255,0.1)',
    },
  },
  'tokyo-night': {
    name: 'Tokyo Night',
    description: 'Midnight navy storm & twilight neon accents',
    preview: {
      bg: '#1a1b26',
      sidebar: '#16161e',
      panel: '#24283b',
      border: 'rgba(122,162,247,0.22)',
    },
  },
  vercel: {
    name: 'Vercel Midnight',
    description: 'Radical high-contrast pure black & white',
    preview: {
      bg: '#000000',
      sidebar: '#050505',
      panel: '#0d0d0d',
      border: 'rgba(255,255,255,0.18)',
    },
  },
  catppuccin: {
    name: 'Catppuccin Mocha',
    description: 'Warm soothing pastel dark palette',
    preview: {
      bg: '#1e1e2e',
      sidebar: '#181825',
      panel: '#313244',
      border: 'rgba(205,214,244,0.18)',
    },
  },
  light: {
    name: 'Linear Daylight',
    description: 'Crisp studio daylight & high-contrast slate typography',
    preview: {
      bg: '#f8fafc',
      sidebar: '#f1f5f9',
      panel: '#ffffff',
      border: 'rgba(15, 23, 42, 0.12)',
    },
  },
};

export const ACCENTS: Record<AccentId, { name: string; hex: string; glow: string }> = {
  emerald: { name: 'Emerald', hex: '#10b981', glow: 'rgba(16, 185, 129, 0.25)' },
  cyan: { name: 'Cyan', hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.25)' },
  violet: { name: 'Violet', hex: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.25)' },
  blue: { name: 'Electric Blue', hex: '#3b82f6', glow: 'rgba(59, 130, 246, 0.25)' },
  amber: { name: 'Amber', hex: '#f59e0b', glow: 'rgba(245, 158, 11, 0.25)' },
};

// Real-time CSS Variable Injector
export const applyThemeTokens = (theme: ThemeId, accent: AccentId) => {
  const root = document.documentElement;

  if (theme === 'light') {
    root.style.setProperty('--bg-canvas', '#f8fafc');
    root.style.setProperty('--bg-chrome', '#f1f5f9');
    root.style.setProperty('--bg-panel', '#ffffff');
    root.style.setProperty('--bg-panel-elevated', '#ffffff');
    root.style.setProperty('--bg-panel-hover', '#f1f5f9');
    root.style.setProperty('--bg-well', '#e2e8f0');
    root.style.setProperty('--bg-well-secondary', '#cbd5e1');
    root.style.setProperty('--text-primary', '#0f172a');
    root.style.setProperty('--text-secondary', '#334155');
    root.style.setProperty('--text-muted', '#64748b');
    root.style.setProperty('--text-dim', '#94a3b8');
    root.style.setProperty('--border-base', 'rgba(15, 23, 42, 0.12)');
    root.style.setProperty('--border-subtle', 'rgba(15, 23, 42, 0.06)');
    root.style.setProperty('--border-hover', 'rgba(15, 23, 42, 0.25)');
    document.body.style.backgroundColor = '#f8fafc';
    document.body.style.color = '#0f172a';
  } else if (theme === 'tokyo-night') {
    root.style.setProperty('--bg-canvas', '#1a1b26');
    root.style.setProperty('--bg-chrome', '#16161e');
    root.style.setProperty('--bg-panel', '#24283b');
    root.style.setProperty('--bg-panel-elevated', '#2f354a');
    root.style.setProperty('--bg-panel-hover', '#383e58');
    root.style.setProperty('--bg-well', '#13141c');
    root.style.setProperty('--bg-well-secondary', '#1a1b26');
    root.style.setProperty('--text-primary', '#c0caf5');
    root.style.setProperty('--text-secondary', '#9aa5ce');
    root.style.setProperty('--text-muted', '#787c99');
    root.style.setProperty('--text-dim', '#565f89');
    root.style.setProperty('--border-base', 'rgba(122, 162, 247, 0.22)');
    root.style.setProperty('--border-subtle', 'rgba(122, 162, 247, 0.12)');
    root.style.setProperty('--border-hover', 'rgba(122, 162, 247, 0.35)');
    document.body.style.backgroundColor = '#1a1b26';
    document.body.style.color = '#c0caf5';
  } else if (theme === 'vercel') {
    root.style.setProperty('--bg-canvas', '#000000');
    root.style.setProperty('--bg-chrome', '#050505');
    root.style.setProperty('--bg-panel', '#0d0d0d');
    root.style.setProperty('--bg-panel-elevated', '#141414');
    root.style.setProperty('--bg-panel-hover', '#1c1c1c');
    root.style.setProperty('--bg-well', '#000000');
    root.style.setProperty('--bg-well-secondary', '#0a0a0a');
    root.style.setProperty('--text-primary', '#ffffff');
    root.style.setProperty('--text-secondary', '#a1a1aa');
    root.style.setProperty('--text-muted', '#71717a');
    root.style.setProperty('--text-dim', '#52525b');
    root.style.setProperty('--border-base', 'rgba(255, 255, 255, 0.18)');
    root.style.setProperty('--border-subtle', 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--border-hover', 'rgba(255, 255, 255, 0.30)');
    document.body.style.backgroundColor = '#000000';
    document.body.style.color = '#ffffff';
  } else if (theme === 'catppuccin') {
    root.style.setProperty('--bg-canvas', '#1e1e2e');
    root.style.setProperty('--bg-chrome', '#181825');
    root.style.setProperty('--bg-panel', '#313244');
    root.style.setProperty('--bg-panel-elevated', '#3b3d54');
    root.style.setProperty('--bg-panel-hover', '#45475a');
    root.style.setProperty('--bg-well', '#11111b');
    root.style.setProperty('--bg-well-secondary', '#181825');
    root.style.setProperty('--text-primary', '#cdd6f4');
    root.style.setProperty('--text-secondary', '#a6adc8');
    root.style.setProperty('--text-muted', '#9399b2');
    root.style.setProperty('--text-dim', '#6c7086');
    root.style.setProperty('--border-base', 'rgba(205, 214, 244, 0.18)');
    root.style.setProperty('--border-subtle', 'rgba(205, 214, 244, 0.10)');
    root.style.setProperty('--border-hover', 'rgba(205, 214, 244, 0.30)');
    document.body.style.backgroundColor = '#1e1e2e';
    document.body.style.color = '#cdd6f4';
  } else {
    // Default Obsidian Dark
    root.style.setProperty('--bg-canvas', '#0b0c0e');
    root.style.setProperty('--bg-chrome', '#090a0d');
    root.style.setProperty('--bg-panel', '#121319');
    root.style.setProperty('--bg-panel-elevated', '#181920');
    root.style.setProperty('--bg-panel-hover', '#22242d');
    root.style.setProperty('--bg-well', '#060709');
    root.style.setProperty('--bg-well-secondary', '#0a0b0d');
    root.style.setProperty('--text-primary', '#EDEDED');
    root.style.setProperty('--text-secondary', '#B4B7C4');
    root.style.setProperty('--text-muted', '#7A7E8F');
    root.style.setProperty('--text-dim', '#4E5262');
    root.style.setProperty('--border-base', 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--border-subtle', 'rgba(255, 255, 255, 0.06)');
    root.style.setProperty('--border-hover', 'rgba(255, 255, 255, 0.2)');
    document.body.style.backgroundColor = '#0b0c0e';
    document.body.style.color = '#EDEDED';
  }

  // Accent Color injection
  const acc = ACCENTS[accent] || ACCENTS.emerald;
  root.style.setProperty('--accent-primary', acc.hex);
  root.style.setProperty('--accent-glow', acc.glow);
};

const DEFAULT_SETTINGS: Omit<SettingsState, 
  'setTheme' | 'setAccent' | 'setCanvasGridStyle' | 'setEnableGlassmorphism' | 
  'updateAgentConfig' | 'setDefaultHandoffMode' | 'setMaxTokenBudget' | 
  'setAutoIncludeDiffs' | 'addSavedProfile' | 'setTerminalFontFamily' | 'setTerminalFontSize' | 
  'setTerminalLineHeight' | 'setTerminalCursorStyle' | 'setTerminalCursorBlink' | 
  'setEnableDesktopNotifications' | 'setEnableSoundAlerts' | 'resetToDefaults'> = {
  theme: 'obsidian',
  accent: 'emerald',
  canvasGridStyle: 'dots',
  enableGlassmorphism: true,

  agentConfigs: {
    antigravity: {
      defaultModel: 'gemini-2.0-flash',
      autoRestartOnCrash: true,
    },
    claude: {
      defaultModel: 'claude-3-7-sonnet',
      autoRestartOnCrash: true,
    },
    opencode: {
      defaultModel: 'default-local',
      autoRestartOnCrash: false,
    },
  },
  maxConcurrentAgents: 4,

  defaultHandoffMode: 'safe',
  maxTokenBudget: 2400,
  autoIncludeDiffs: true,
  autoCleanAnsiLogs: true,

  terminalFontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
  terminalFontSize: 13,
  terminalLineHeight: 1.35,
  terminalCursorStyle: 'block',
  terminalCursorBlink: true,
  terminalScrollback: 10000,
  copyOnSelect: true,

  enableDesktopNotifications: true,
  enableSoundAlerts: false,
  minimizeToTray: false,

  defaultProjectsPath: '~/Desktop/personal_projects',
  autoCheckpointOnHandoff: true,
  savedProfiles: ['default'],
};

const loadInitialSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load settings from localStorage', e);
  }
  return DEFAULT_SETTINGS;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadInitialSettings(),

  setTheme: (theme: ThemeId) => {
    set({ theme });
    applyThemeTokens(theme, get().accent);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), theme }));
    } catch {}
  },

  setAccent: (accent: AccentId) => {
    set({ accent });
    applyThemeTokens(get().theme, accent);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), accent }));
    } catch {}
  },

  setCanvasGridStyle: (canvasGridStyle: CanvasGridStyle) => {
    set({ canvasGridStyle });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), canvasGridStyle }));
    } catch {}
  },

  setEnableGlassmorphism: (enableGlassmorphism: boolean) => {
    set({ enableGlassmorphism });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), enableGlassmorphism }));
    } catch {}
  },

  updateAgentConfig: (provider, config) => {
    set(state => {
      const current = state.agentConfigs[provider];
      const updated = {
        ...state.agentConfigs,
        [provider]: { ...current, ...config },
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, agentConfigs: updated }));
      } catch {}
      return { agentConfigs: updated };
    });
  },

  setDefaultHandoffMode: (defaultHandoffMode) => {
    set({ defaultHandoffMode });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), defaultHandoffMode }));
    } catch {}
  },

  setMaxTokenBudget: (maxTokenBudget) => {
    set({ maxTokenBudget });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), maxTokenBudget }));
    } catch {}
  },

  setAutoIncludeDiffs: (autoIncludeDiffs) => {
    set({ autoIncludeDiffs });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), autoIncludeDiffs }));
    } catch {}
  },

  setTerminalFontFamily: (terminalFontFamily) => {
    set({ terminalFontFamily });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), terminalFontFamily }));
    } catch {}
  },

  setTerminalFontSize: (terminalFontSize) => {
    set({ terminalFontSize });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), terminalFontSize }));
    } catch {}
  },

  setTerminalLineHeight: (terminalLineHeight) => {
    set({ terminalLineHeight });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), terminalLineHeight }));
    } catch {}
  },

  setTerminalCursorStyle: (terminalCursorStyle) => {
    set({ terminalCursorStyle });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), terminalCursorStyle }));
    } catch {}
  },

  setTerminalCursorBlink: (terminalCursorBlink) => {
    set({ terminalCursorBlink });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), terminalCursorBlink }));
    } catch {}
  },

  setEnableDesktopNotifications: (enableDesktopNotifications) => {
    set({ enableDesktopNotifications });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), enableDesktopNotifications }));
    } catch {}
  },

  setEnableSoundAlerts: (enableSoundAlerts) => {
    set({ enableSoundAlerts });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), enableSoundAlerts }));
    } catch {}
  },

  addSavedProfile: (profile: string) => {
    const clean = profile.trim().toLowerCase();
    if (!clean) return;
    const current = get().savedProfiles || ['default'];
    if (!current.includes(clean)) {
      const updated = [...current, clean];
      set({ savedProfiles: updated });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), savedProfiles: updated }));
      } catch {}
    }
  },

  resetToDefaults: () => {
    set(DEFAULT_SETTINGS);
    applyThemeTokens(DEFAULT_SETTINGS.theme, DEFAULT_SETTINGS.accent);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  },
}));
