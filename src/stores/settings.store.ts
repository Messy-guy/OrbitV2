import { create } from 'zustand';
import { SettingsState, ThemeId, AccentId, CanvasGridStyle, TerminalCursorStyle, AgentSettingsConfig } from '../types/settings';
import { SkillItem } from '../types/skills';

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
    name: 'Porcelain & Warm Slate',
    description: 'Modern porcelain canvas with subtle warm slate depth',
    preview: {
      bg: '#f8f7f4',
      sidebar: '#f2f0eb',
      panel: '#ffffff',
      border: 'rgba(28, 25, 23, 0.10)',
    },
  },
};

export const ACCENTS: Record<AccentId, { name: string; hex: string; glow: string }> = {
  emerald: { name: 'Emerald', hex: '#10b981', glow: 'rgba(16, 185, 129, 0.25)' },
  cyan: { name: 'Cyan', hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.25)' },
  violet: { name: 'Violet', hex: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.25)' },
  blue: { name: 'Blue', hex: '#3b82f6', glow: 'rgba(59, 130, 246, 0.25)' },
  amber: { name: 'Amber', hex: '#f59e0b', glow: 'rgba(245, 158, 11, 0.25)' },
};

export const applyThemeTokens = (theme: ThemeId, accent: AccentId) => {
  const root = document.documentElement;
  
  if (theme === 'light') {
    root.style.setProperty('--bg-canvas', '#f8f7f4');
    root.style.setProperty('--bg-chrome', '#f2f0eb');
    root.style.setProperty('--bg-panel', '#ffffff');
    root.style.setProperty('--bg-panel-elevated', '#ffffff');
    root.style.setProperty('--bg-panel-hover', '#f5f3ef');
    root.style.setProperty('--bg-well', '#f2f0eb');
    root.style.setProperty('--bg-well-secondary', '#e8e5de');
    root.style.setProperty('--text-primary', '#1c1917');
    root.style.setProperty('--text-secondary', '#44403c');
    root.style.setProperty('--text-muted', '#78716c');
    root.style.setProperty('--text-dim', '#a8a29e');
    root.style.setProperty('--border-base', 'rgba(28, 25, 23, 0.10)');
    root.style.setProperty('--border-subtle', 'rgba(28, 25, 23, 0.05)');
    root.style.setProperty('--border-hover', 'rgba(28, 25, 23, 0.20)');
    root.style.setProperty('--border-active', 'rgba(28, 25, 23, 0.32)');
    root.style.setProperty('--border-highlight', 'rgba(28, 25, 23, 0.60)');
    document.body.style.backgroundColor = '#f8f7f4';
    document.body.style.color = '#1c1917';
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
    // Default Obsidian Dark (Rich Atmospheric Dark Slate)
    root.style.setProperty('--bg-canvas', '#0e1015');
    root.style.setProperty('--bg-chrome', '#12151c');
    root.style.setProperty('--bg-panel', 'rgba(20, 23, 31, 0.85)');
    root.style.setProperty('--bg-panel-elevated', 'rgba(28, 32, 44, 0.94)');
    root.style.setProperty('--bg-panel-hover', 'rgba(38, 43, 58, 0.7)');
    root.style.setProperty('--bg-well', '#08090d');
    root.style.setProperty('--bg-well-secondary', '#0d0f14');
    root.style.setProperty('--text-primary', '#F3F4F8');
    root.style.setProperty('--text-secondary', '#B4B9C8');
    root.style.setProperty('--text-muted', '#7E8499');
    root.style.setProperty('--text-dim', '#50566A');
    root.style.setProperty('--border-base', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--border-subtle', 'rgba(255, 255, 255, 0.07)');
    root.style.setProperty('--border-hover', 'rgba(255, 255, 255, 0.22)');
    document.body.style.backgroundColor = '#0e1015';
    document.body.style.color = '#F3F4F8';
  }

  const acc = ACCENTS[accent] || ACCENTS.emerald;
  root.style.setProperty('--accent-primary', acc.hex);
  root.style.setProperty('--accent-glow', acc.glow);
};

export const DEFAULT_SETTINGS: Omit<SettingsState, 
  | 'setTheme' 
  | 'setAccent' 
  | 'setCanvasGridStyle' 
  | 'setEnableGlassmorphism' 
  | 'updateAgentConfig' 
  | 'setDefaultHandoffMode' 
  | 'setMaxTokenBudget' 
  | 'setAutoIncludeDiffs' 
  | 'updateTerminalSettings'
  | 'addSavedProfile'
  | 'removeSavedProfile'
  | 'setModeCustomSkills'
  | 'setModeCustomDirective'
  | 'addSkillToMode'
  | 'removeSkillFromMode'
  | 'setTerminalFontFamily'
  | 'setTerminalFontSize'
  | 'setTerminalLineHeight'
  | 'setTerminalCursorStyle'
  | 'setTerminalCursorBlink'
  | 'setEnableDesktopNotifications'
  | 'setEnableSoundAlerts'
  | 'resetToDefaults'
> = {
  theme: 'obsidian',
  accent: 'emerald',
  canvasGridStyle: 'dots',
  enableGlassmorphism: true,

  agentConfigs: {
    antigravity: {
      defaultModel: 'Gemini 2.5 Pro (Deep Research)',
      autoRestartOnCrash: true,
    },
    claude: {
      defaultModel: 'Claude 3.7 Sonnet (Hybrid Thinking)',
      autoRestartOnCrash: true,
    },
    opencode: {
      defaultModel: 'OpenCode Interpreter (Local/Host)',
      autoRestartOnCrash: true,
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

  modeCustomSkills: {
    architect: [],
    implementer: [],
    reviewer: [],
  },
  modeCustomDirectives: {
    architect: '',
    implementer: '',
    reviewer: '',
  },
};

const loadInitialSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { 
        ...DEFAULT_SETTINGS, 
        ...parsed,
        modeCustomSkills: {
          ...DEFAULT_SETTINGS.modeCustomSkills,
          ...(parsed.modeCustomSkills || {})
        },
        modeCustomDirectives: {
          ...DEFAULT_SETTINGS.modeCustomDirectives,
          ...(parsed.modeCustomDirectives || {})
        }
      };
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

  updateAgentConfig: (provider: 'antigravity' | 'claude' | 'opencode', config: Partial<AgentSettingsConfig>) => {
    const agentConfigs = {
      ...get().agentConfigs,
      [provider]: {
        ...get().agentConfigs[provider],
        ...config,
      },
    };
    set({ agentConfigs });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), agentConfigs }));
    } catch {}
  },

  setDefaultHandoffMode: (defaultHandoffMode: 'safe' | 'autonomous') => {
    set({ defaultHandoffMode });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), defaultHandoffMode }));
    } catch {}
  },

  setMaxTokenBudget: (maxTokenBudget: number) => {
    set({ maxTokenBudget });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), maxTokenBudget }));
    } catch {}
  },

  setAutoIncludeDiffs: (autoIncludeDiffs: boolean) => {
    set({ autoIncludeDiffs });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), autoIncludeDiffs }));
    } catch {}
  },

  updateTerminalSettings: (settings: Partial<SettingsState>) => {
    set((state) => ({ ...state, ...settings }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(get()));
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

  removeSavedProfile: (profile: string) => {
    if (profile === 'default') return;
    const updated = get().savedProfiles.filter((p) => p !== profile);
    set({ savedProfiles: updated });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), savedProfiles: updated }));
    } catch {}
  },

  setModeCustomSkills: (mode: string, skills: SkillItem[]) => {
    const updated = {
      ...get().modeCustomSkills,
      [mode]: skills,
    };
    set({ modeCustomSkills: updated });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), modeCustomSkills: updated }));
    } catch {}
  },

  setModeCustomDirective: (mode: string, directive: string) => {
    const updated = {
      ...get().modeCustomDirectives,
      [mode]: directive,
    };
    set({ modeCustomDirectives: updated });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), modeCustomDirectives: updated }));
    } catch {}
  },

  addSkillToMode: (mode: string, skill: SkillItem) => {
    const current = get().modeCustomSkills[mode] || [];
    if (current.some((s) => s.id === skill.id)) return;
    const updatedSkills = [...current, skill];
    get().setModeCustomSkills(mode, updatedSkills);
  },

  removeSkillFromMode: (mode: string, skillId: string) => {
    const current = get().modeCustomSkills[mode] || [];
    const updatedSkills = current.filter((s) => s.id !== skillId);
    get().setModeCustomSkills(mode, updatedSkills);
  },

  setTerminalFontFamily: (terminalFontFamily: string) => {
    set({ terminalFontFamily });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), terminalFontFamily }));
    } catch {}
  },

  setTerminalFontSize: (terminalFontSize: number) => {
    set({ terminalFontSize });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), terminalFontSize }));
    } catch {}
  },

  setTerminalLineHeight: (terminalLineHeight: number) => {
    set({ terminalLineHeight });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), terminalLineHeight }));
    } catch {}
  },

  setTerminalCursorStyle: (terminalCursorStyle: TerminalCursorStyle) => {
    set({ terminalCursorStyle });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), terminalCursorStyle }));
    } catch {}
  },

  setTerminalCursorBlink: (terminalCursorBlink: boolean) => {
    set({ terminalCursorBlink });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), terminalCursorBlink }));
    } catch {}
  },

  setEnableDesktopNotifications: (enableDesktopNotifications: boolean) => {
    set({ enableDesktopNotifications });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), enableDesktopNotifications }));
    } catch {}
  },

  setEnableSoundAlerts: (enableSoundAlerts: boolean) => {
    set({ enableSoundAlerts });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), enableSoundAlerts }));
    } catch {}
  },

  resetToDefaults: () => {
    set(DEFAULT_SETTINGS);
    applyThemeTokens(DEFAULT_SETTINGS.theme, DEFAULT_SETTINGS.accent);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  },
}));
