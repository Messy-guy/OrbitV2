export type ThemeId = 'obsidian' | 'tokyo-night' | 'vercel' | 'catppuccin' | 'light';
export type AccentId = 'emerald' | 'cyan' | 'violet' | 'blue' | 'amber';
export type CanvasGridStyle = 'dots' | 'grid' | 'solid';
export type TerminalCursorStyle = 'block' | 'underline' | 'bar';

export interface AgentSettingsConfig {
  customBinaryPath?: string;
  defaultModel: string;
  autoRestartOnCrash: boolean;
}

export interface SettingsState {
  // 1. Appearance
  theme: ThemeId;
  accent: AccentId;
  canvasGridStyle: CanvasGridStyle;
  enableGlassmorphism: boolean;

  // 2. AI Agents Configuration
  agentConfigs: {
    antigravity: AgentSettingsConfig;
    claude: AgentSettingsConfig;
    opencode: AgentSettingsConfig;
  };
  maxConcurrentAgents: number;

  // 3. Handoff & Context
  defaultHandoffMode: 'safe' | 'autonomous';
  maxTokenBudget: number;
  autoIncludeDiffs: boolean;
  autoCleanAnsiLogs: boolean;

  // 4. Terminal & Typography
  terminalFontFamily: string;
  terminalFontSize: number;
  terminalLineHeight: number;
  terminalCursorStyle: TerminalCursorStyle;
  terminalCursorBlink: boolean;
  terminalScrollback: number;
  copyOnSelect: boolean;

  // 5. Notifications & System Alerts
  enableDesktopNotifications: boolean;
  enableSoundAlerts: boolean;
  minimizeToTray: boolean;

  // 6. Git & Workspaces
  defaultProjectsPath: string;
  autoCheckpointOnHandoff: boolean;

  // 7. Global Multi-Account Profiles
  savedProfiles: string[];

  // 8. Operating Modes & Default Bound Skills
  modeCustomSkills: Record<string, import('./skills').SkillItem[]>;
  modeCustomDirectives: Record<string, string>;

  // Actions
  setTheme: (theme: ThemeId) => void;
  setAccent: (accent: AccentId) => void;
  setCanvasGridStyle: (style: CanvasGridStyle) => void;
  setEnableGlassmorphism: (enable: boolean) => void;
  updateAgentConfig: (provider: 'antigravity' | 'claude' | 'opencode', config: Partial<AgentSettingsConfig>) => void;
  setDefaultHandoffMode: (mode: 'safe' | 'autonomous') => void;
  setMaxTokenBudget: (budget: number) => void;
  setAutoIncludeDiffs: (include: boolean) => void;
  updateTerminalSettings: (settings: Partial<SettingsState>) => void;
  addSavedProfile: (profile: string) => void;
  removeSavedProfile: (profile: string) => void;
  setModeCustomSkills: (mode: string, skills: import('./skills').SkillItem[]) => void;
  setModeCustomDirective: (mode: string, directive: string) => void;
  addSkillToMode: (mode: string, skill: import('./skills').SkillItem) => void;
  removeSkillFromMode: (mode: string, skillId: string) => void;
  setTerminalFontFamily: (font: string) => void;
  setTerminalFontSize: (size: number) => void;
  setTerminalLineHeight: (lineHeight: number) => void;
  setTerminalCursorStyle: (style: TerminalCursorStyle) => void;
  setTerminalCursorBlink: (blink: boolean) => void;
  setEnableDesktopNotifications: (enable: boolean) => void;
  setEnableSoundAlerts: (enable: boolean) => void;
  resetToDefaults: () => void;
}
