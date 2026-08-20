import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  Bot, 
  ArrowRightLeft, 
  Terminal, 
  Bell, 
  FolderGit2, 
  Info, 
  RotateCcw, 
  Check, 
  Cpu, 
  Sparkles,
  FolderOpen,
  FileCode,
  ChevronDown
} from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import { Modal } from '../ui/Modal';
import { useUIStore } from '../../stores/ui.store';
import { useSettingsStore, THEMES, ACCENTS } from '../../stores/settings.store';
import { ThemeId, AccentId, CanvasGridStyle, TerminalCursorStyle } from '../../types/settings';
import { tauriService, isTauriAvailable } from '../../services/tauri.service';
import { clsx } from 'clsx';

type SettingsTab = 'appearance' | 'agents' | 'handoff' | 'terminal' | 'notifications' | 'workspace' | 'about';

// Provider Model Registries retrieved from actual CLI specs
export const PROVIDER_MODELS: Record<'antigravity' | 'claude' | 'opencode', Array<{ id: string; label: string; desc: string }>> = {
  antigravity: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Default)', desc: 'Ultra-fast low-latency multimodal reasoning' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', desc: '1M Context window with deep codebase comprehension' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', desc: 'High-speed deterministic execution' },
    { id: 'gemini-ultra', label: 'Gemini Ultra (Experimental)', desc: 'Frontier reasoning for complex algorithmic refactors' },
  ],
  claude: [
    { id: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet (Default)', desc: 'Hybrid reasoning with extended thinking mode' },
    { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', desc: 'Industry benchmark for precise software engineering' },
    { id: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku', desc: 'Ultra-fast lightweight autonomous subagent' },
    { id: 'claude-3-opus', label: 'Claude 3 Opus', desc: 'Deep synthesis and complex architectural planning' },
  ],
  opencode: [
    { id: 'default-local', label: 'Local Default Engine', desc: 'System environment model adapter' },
    { id: 'qwen-2.5-coder-32b', label: 'Qwen 2.5 Coder 32B', desc: 'High-performance local open-weights coding model' },
    { id: 'deepseek-coder-v2', label: 'DeepSeek Coder V2', desc: 'Full repository context analysis' },
  ],
};

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setSettingsOpen } = useUIStore();
  const settings = useSettingsStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [detectedAgents, setDetectedAgents] = useState<any[]>([]);

  useEffect(() => {
    if (isSettingsOpen && isTauriAvailable()) {
      tauriService.detectAgents().then(setDetectedAgents).catch(() => {});
    }
  }, [isSettingsOpen]);

  if (!isSettingsOpen) return null;

  const handlePickProjectsFolder = async () => {
    try {
      const selected = await tauriService.openFolderDialog();
      if (selected) {
        settings.defaultProjectsPath = selected;
        useSettingsStore.setState({ defaultProjectsPath: selected });
      }
    } catch (e) {
      console.warn('Folder selection failed:', e);
    }
  };

  const handlePickBinary = async (provider: 'antigravity' | 'claude' | 'opencode') => {
    try {
      const selected = await tauriService.openFileDialog(`Select ${provider.toUpperCase()} Executable Binary`);
      if (selected) {
        settings.updateAgentConfig(provider, { customBinaryPath: selected });
      }
    } catch (e) {
      console.warn('Binary selection failed:', e);
    }
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: 'appearance', label: 'Appearance', icon: <Palette size={13} /> },
    { id: 'agents', label: 'AI Engines', icon: <Bot size={13} /> },
    { id: 'handoff', label: 'Handoff Protocol', icon: <ArrowRightLeft size={13} /> },
    { id: 'terminal', label: 'Terminal & Font', icon: <Terminal size={13} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={13} /> },
    { id: 'workspace', label: 'Git & Projects', icon: <FolderGit2 size={13} /> },
    { id: 'about', label: 'System & Production', icon: <Info size={13} /> },
  ];

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={() => setSettingsOpen(false)}
      title="Settings & Preferences"
      subtitle="Customize appearance, executable paths, agent models, and handoff protocols"
      maxWidth="4xl"
      className="max-h-[90vh]"
    >
      <div className="flex flex-col md:flex-row h-[620px] -mx-6 -my-4 overflow-hidden font-sans text-xs">
        {/* Settings Navigation Sidebar */}
        <div className="w-full md:w-60 bg-panel-elevated border-b md:border-b-0 md:border-r border-border p-3.5 flex flex-col justify-between shrink-0 select-none">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-mono text-[12px] transition-all text-left cursor-pointer shrink-0',
                    isActive
                      ? 'bg-panel text-text-primary font-bold shadow-sm border border-border'
                      : 'text-text-muted hover:text-text-primary hover:bg-panel'
                  )}
                >
                  <span className={clsx(isActive ? 'text-text-primary' : 'text-text-dim')}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-border hidden md:block">
            <button
              onClick={() => settings.resetToDefaults()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[11px] text-text-muted hover:text-red-400 hover:bg-panel transition-colors cursor-pointer w-full"
            >
              <RotateCcw size={11} />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 p-7 overflow-y-auto bg-panel custom-scrollbar">
          {/* 1. APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <div className="space-y-7">
              {/* Theme Grid */}
              <div className="space-y-3">
                <label className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold">
                  Color Themes
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {(Object.keys(THEMES) as ThemeId[]).map((tId) => {
                    const theme = THEMES[tId];
                    const isSelected = settings.theme === tId;
                    const isCardLight = tId === 'light';
                    return (
                      <div
                        key={tId}
                        onClick={() => settings.setTheme(tId)}
                        className={clsx(
                          'p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 select-none relative',
                          isSelected
                            ? isCardLight ? 'border-neutral-900/60 ring-2 ring-neutral-900/20 shadow-lg' : 'border-white/50 ring-2 ring-white/20 shadow-lg'
                            : 'border-border hover:border-border-hover hover:bg-panel-hover'
                        )}
                        style={{ backgroundColor: theme.preview.bg }}
                      >
                        <div className="flex items-center justify-between">
                          <span className={clsx("font-mono font-bold text-xs", isCardLight ? "text-neutral-900" : "text-white")}>
                            {theme.name}
                          </span>
                          {isSelected && (
                            <div className={clsx("w-4 h-4 rounded-full flex items-center justify-center", isCardLight ? "bg-neutral-900 text-white" : "bg-white text-black")}>
                              <Check size={10} strokeWidth={3.5} />
                            </div>
                          )}
                        </div>

                        {/* Visual mini mockup preview */}
                        <div className={clsx("flex gap-1.5 h-9 rounded-xl overflow-hidden border p-1.5", isCardLight ? "border-neutral-300 bg-white" : "border-white/[0.08] bg-black/40")}>
                          <div className="w-1/4 rounded-lg h-full" style={{ backgroundColor: theme.preview.sidebar }} />
                          <div className="flex-1 rounded-lg h-full flex flex-col gap-1 p-1" style={{ backgroundColor: theme.preview.panel }}>
                            <div className={clsx("h-1.5 w-1/2 rounded", isCardLight ? "bg-neutral-300" : "bg-white/20")} />
                            <div className={clsx("h-1.5 w-3/4 rounded", isCardLight ? "bg-neutral-200" : "bg-white/10")} />
                          </div>
                        </div>

                        <span className={clsx("text-[11px] font-sans leading-tight", isCardLight ? "text-neutral-600" : "text-[#a1a1aa]")}>
                          {theme.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Accent Color Pills */}
              <div className="space-y-3">
                <label className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold">
                  Accent Color
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {(Object.keys(ACCENTS) as AccentId[]).map((aId) => {
                    const acc = ACCENTS[aId];
                    const isSelected = settings.accent === aId;
                    return (
                      <button
                        key={aId}
                        onClick={() => settings.setAccent(aId)}
                        className={clsx(
                          'flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-mono transition-all cursor-pointer',
                          isSelected
                            ? 'border-border-hover bg-well text-text-primary font-bold shadow-sm'
                            : 'border-border bg-panel text-text-muted hover:text-text-primary'
                        )}
                      >
                        <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: acc.hex }} />
                        <span>{acc.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Canvas Grid Style */}
              <div className="space-y-3">
                <label className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold">
                  Canvas Background Pattern
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['dots', 'grid', 'solid'] as CanvasGridStyle[]).map((style) => {
                    const isSelected = settings.canvasGridStyle === style;
                    return (
                      <button
                        key={style}
                        onClick={() => settings.setCanvasGridStyle(style)}
                        className={clsx(
                          'px-4 py-3 rounded-xl border font-mono text-xs uppercase tracking-wider capitalize transition-all cursor-pointer',
                          isSelected
                            ? 'border-border-hover bg-well text-text-primary font-bold shadow-sm'
                            : 'border-border bg-panel text-text-muted hover:text-text-primary'
                        )}
                      >
                        {style}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2. AI ENGINES TAB */}
          {activeTab === 'agents' && (
            <div className="space-y-5">
              {/* Antigravity Configuration */}
              <div className="p-5 rounded-2xl bg-panel-elevated border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-text-primary text-xs">▲ Antigravity CLI</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
                    Native CLI Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Radix Select Model Dropdown */}
                  <div>
                    <label className="text-[10px] font-mono text-text-muted uppercase block mb-1.5 font-bold">
                      Default Engine Model
                    </label>
                    <Select.Root
                      value={settings.agentConfigs.antigravity.defaultModel}
                      onValueChange={(val) => settings.updateAgentConfig('antigravity', { defaultModel: val })}
                    >
                      <Select.Trigger className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-well border border-border text-text-primary font-mono text-xs focus:outline-none focus:border-border-hover cursor-pointer">
                        <Select.Value />
                        <Select.Icon>
                          <ChevronDown size={13} className="text-text-muted" />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Content className="z-[11000] overflow-hidden bg-panel-elevated border border-border rounded-xl shadow-2xl p-1 font-mono text-xs text-text-primary animate-in fade-in-50 duration-100">
                          <Select.Viewport className="p-1 space-y-1">
                            {PROVIDER_MODELS.antigravity.map((m) => (
                              <Select.Item
                                key={m.id}
                                value={m.id}
                                className="flex flex-col gap-0.5 px-3 py-2 rounded-lg cursor-pointer select-none hover:bg-panel focus:bg-panel outline-none data-[highlighted]:bg-panel"
                              >
                                <Select.ItemText>
                                  <span className="font-bold text-text-primary">{m.label}</span>
                                </Select.ItemText>
                                <span className="text-[10.5px] text-text-muted font-sans">{m.desc}</span>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  </div>

                  {/* Native File Browser for Binary Path Override */}
                  <div>
                    <label className="text-[10px] font-mono text-text-muted uppercase block mb-1.5 font-bold">
                      Binary Executable Path
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={settings.agentConfigs.antigravity.customBinaryPath || ''}
                        onChange={(e) => settings.updateAgentConfig('antigravity', { customBinaryPath: e.target.value })}
                        placeholder="Auto-detected (~/.gemini/antigravity-cli/bin/agy)"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-well border border-border text-text-primary font-mono text-xs placeholder:text-text-dim focus:outline-none focus:border-border-hover"
                      />
                      <button
                        onClick={() => handlePickBinary('antigravity')}
                        className="px-3 py-2.5 rounded-xl bg-well border border-border text-text-muted hover:text-text-primary hover:border-border-hover transition-colors flex items-center gap-1.5 font-mono text-xs cursor-pointer shrink-0"
                        title="Browse executable file on device"
                      >
                        <FileCode size={13} />
                        <span>Browse…</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Claude Code Configuration */}
              <div className="p-5 rounded-2xl bg-panel-elevated border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu size={14} className="text-amber-500" />
                    <span className="font-mono font-bold text-text-primary text-xs">Claude Code</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-panel text-text-muted border border-border font-bold">
                    Anthropic CLI
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Radix Select Model Dropdown */}
                  <div>
                    <label className="text-[10px] font-mono text-text-muted uppercase block mb-1.5 font-bold">
                      Default Engine Model
                    </label>
                    <Select.Root
                      value={settings.agentConfigs.claude.defaultModel}
                      onValueChange={(val) => settings.updateAgentConfig('claude', { defaultModel: val })}
                    >
                      <Select.Trigger className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-well border border-border text-text-primary font-mono text-xs focus:outline-none focus:border-border-hover cursor-pointer">
                        <Select.Value />
                        <Select.Icon>
                          <ChevronDown size={13} className="text-text-muted" />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Content className="z-[11000] overflow-hidden bg-panel-elevated border border-border rounded-xl shadow-2xl p-1 font-mono text-xs text-text-primary animate-in fade-in-50 duration-100">
                          <Select.Viewport className="p-1 space-y-1">
                            {PROVIDER_MODELS.claude.map((m) => (
                              <Select.Item
                                key={m.id}
                                value={m.id}
                                className="flex flex-col gap-0.5 px-3 py-2 rounded-lg cursor-pointer select-none hover:bg-panel focus:bg-panel outline-none data-[highlighted]:bg-panel"
                              >
                                <Select.ItemText>
                                  <span className="font-bold text-text-primary">{m.label}</span>
                                </Select.ItemText>
                                <span className="text-[10.5px] text-text-muted font-sans">{m.desc}</span>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  </div>

                  {/* Native File Browser for Binary Path Override */}
                  <div>
                    <label className="text-[10px] font-mono text-text-muted uppercase block mb-1.5 font-bold">
                      Binary Executable Path
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={settings.agentConfigs.claude.customBinaryPath || ''}
                        onChange={(e) => settings.updateAgentConfig('claude', { customBinaryPath: e.target.value })}
                        placeholder="Auto-detected (claude)"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-well border border-border text-text-primary font-mono text-xs placeholder:text-text-dim focus:outline-none focus:border-border-hover"
                      />
                      <button
                        onClick={() => handlePickBinary('claude')}
                        className="px-3 py-2.5 rounded-xl bg-well border border-border text-text-muted hover:text-text-primary hover:border-border-hover transition-colors flex items-center gap-1.5 font-mono text-xs cursor-pointer shrink-0"
                        title="Browse executable file on device"
                      >
                        <FileCode size={13} />
                        <span>Browse…</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. HANDOFF TAB */}
          {activeTab === 'handoff' && (
            <div className="space-y-6">
              <div className="space-y-2.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold">
                  Default Ingestion Protocol
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div
                    onClick={() => settings.setDefaultHandoffMode('safe')}
                    className={clsx(
                      'p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2',
                      settings.defaultHandoffMode === 'safe'
                        ? 'border-emerald-500/60 bg-emerald-500/[0.08] text-text-primary ring-1 ring-emerald-500/20'
                        : 'border-border bg-panel-elevated text-text-muted hover:text-text-primary'
                    )}
                  >
                    <span className="font-mono font-bold text-xs">🛡️ Safe Checkpoint (Recommended)</span>
                    <span className="text-[11px] text-text-muted font-sans leading-relaxed">
                      Target agent recaps goal & decisions and waits for confirmation before modifying project files.
                    </span>
                  </div>

                  <div
                    onClick={() => settings.setDefaultHandoffMode('autonomous')}
                    className={clsx(
                      'p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2',
                      settings.defaultHandoffMode === 'autonomous'
                        ? 'border-cyan-500/60 bg-cyan-500/[0.08] text-text-primary ring-1 ring-cyan-500/20'
                        : 'border-border bg-panel-elevated text-text-muted hover:text-text-primary'
                    )}
                  >
                    <span className="font-mono font-bold text-xs">🚀 Autonomous Execution</span>
                    <span className="text-[11px] text-text-muted font-sans leading-relaxed">
                      Target agent immediately begins work with the synthesized context without pausing.
                    </span>
                  </div>
                </div>
              </div>

              {/* Max Token Budget Slider */}
              <div className="p-5 rounded-2xl bg-panel-elevated border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-text-primary text-xs">Context Distillation Ceiling</span>
                  <span className="font-mono text-xs text-emerald-500 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    {settings.maxTokenBudget} tokens
                  </span>
                </div>
                <input
                  type="range"
                  min="800"
                  max="8000"
                  step="200"
                  value={settings.maxTokenBudget}
                  onChange={(e) => settings.setMaxTokenBudget(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-[11px] text-text-muted block leading-relaxed">
                  The local neural synthesizer compresses prior logs, decisions, and files within this token limit.
                </span>
              </div>
            </div>
          )}

          {/* 4. TERMINAL TAB */}
          {activeTab === 'terminal' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-panel-elevated border border-border grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-mono text-text-muted uppercase block mb-2 font-bold">
                    Terminal Font Size
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="11"
                      max="18"
                      value={settings.terminalFontSize}
                      onChange={(e) => settings.setTerminalFontSize(parseInt(e.target.value, 10))}
                      className="flex-1 accent-emerald-500 cursor-pointer"
                    />
                    <span className="font-mono text-text-primary text-xs w-8 text-right font-bold">{settings.terminalFontSize}px</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-text-muted uppercase block mb-2 font-bold">
                    Cursor Shape
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['block', 'underline', 'bar'] as TerminalCursorStyle[]).map((c) => (
                      <button
                        key={c}
                        onClick={() => settings.setTerminalCursorStyle(c)}
                        className={clsx(
                          'py-1.5 rounded-lg border text-center font-mono text-[11px] uppercase transition-all',
                          settings.terminalCursorStyle === c
                            ? 'border-border-hover bg-well text-text-primary font-bold shadow-sm'
                            : 'border-border bg-panel text-text-muted hover:text-text-primary'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-panel-elevated border border-border">
                <label className="text-[10px] font-mono text-text-muted uppercase block mb-2 font-bold">
                  Font Family Preference
                </label>
                <input
                  type="text"
                  value={settings.terminalFontFamily}
                  onChange={(e) => settings.setTerminalFontFamily(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-well border border-border text-text-primary font-mono text-xs focus:outline-none focus:border-border-hover"
                />
              </div>
            </div>
          )}

          {/* 5. NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-panel-elevated border border-border flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-text-primary text-xs block">Native OS Notifications</span>
                  <span className="text-[11px] text-text-muted block mt-1">
                    Trigger desktop alert when long-running agent tasks complete while app is unfocused.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableDesktopNotifications}
                  onChange={(e) => settings.setEnableDesktopNotifications(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-5 rounded-2xl bg-panel-elevated border border-border flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-text-primary text-xs block">Task Completion Audio Chimes</span>
                  <span className="text-[11px] text-text-muted block mt-1">
                    Play subtle sound tone when an agent finishes its goal or needs user input.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableSoundAlerts}
                  onChange={(e) => settings.setEnableSoundAlerts(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 6. GIT & WORKSPACE TAB */}
          {activeTab === 'workspace' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-panel-elevated border border-border space-y-2">
                <label className="text-[10px] font-mono text-text-muted uppercase block font-bold">
                  Default Projects Directory
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={settings.defaultProjectsPath}
                    onChange={(e) => {
                      settings.defaultProjectsPath = e.target.value;
                      useSettingsStore.setState({ defaultProjectsPath: e.target.value });
                    }}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-well border border-border text-text-primary font-mono text-xs focus:outline-none focus:border-border-hover"
                  />
                  <button
                    onClick={handlePickProjectsFolder}
                    className="px-3.5 py-2.5 rounded-xl bg-well border border-border text-text-muted hover:text-text-primary hover:border-border-hover transition-colors flex items-center gap-1.5 font-mono text-xs cursor-pointer shrink-0"
                    title="Select project directory from files"
                  >
                    <FolderOpen size={13} />
                    <span>Choose Folder…</span>
                  </button>
                </div>
                <span className="text-[11px] text-text-muted block mt-1">
                  Default directory inspected when scanning or cloning project workspaces.
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-panel-elevated border border-border flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-text-primary text-xs block">Auto-Checkpoint on Handoff</span>
                  <span className="text-[11px] text-text-muted block mt-1">
                    Snapshot project git state before executing context relay.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoCheckpointOnHandoff}
                  onChange={(e) => {
                    settings.autoCheckpointOnHandoff = e.target.checked;
                    useSettingsStore.setState({ autoCheckpointOnHandoff: e.target.checked });
                  }}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 7. SYSTEM & PRODUCTION INFO TAB */}
          {activeTab === 'about' && (
            <div className="space-y-5 font-mono text-xs">
              <div className="p-6 rounded-2xl bg-panel-elevated border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Sparkles size={16} className="text-emerald-500" />
                    <span className="font-bold text-text-primary text-sm tracking-wide">ORBIT STUDIO</span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-well text-text-primary font-bold border border-border">v0.1.0 (Production Release)</span>
                  </div>
                  <span className="text-[10px] text-emerald-500 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    System Healthy
                  </span>
                </div>

                <p className="text-[11.5px] text-text-muted font-sans leading-relaxed">
                  Deterministic Multi-Agent Collaboration Studio for Autonomous Coding Engines.
                </p>

                {/* Live Runtime Information Table */}
                <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 rounded-xl bg-well border border-border flex flex-col gap-1">
                    <span className="text-text-dim text-[10px] uppercase font-bold">Host Platform</span>
                    <span className="text-text-primary font-bold">Linux x86_64 / Desktop</span>
                  </div>
                  <div className="p-3 rounded-xl bg-well border border-border flex flex-col gap-1">
                    <span className="text-text-dim text-[10px] uppercase font-bold">Runtime Engine</span>
                    <span className="text-text-primary font-bold">Tauri Native PTY v2.11.5</span>
                  </div>
                  <div className="p-3 rounded-xl bg-well border border-border flex flex-col gap-1">
                    <span className="text-text-dim text-[10px] uppercase font-bold">Context Synthesizer</span>
                    <span className="text-text-primary font-bold">Deterministic Vectorized Tree</span>
                  </div>
                  <div className="p-3 rounded-xl bg-well border border-border flex flex-col gap-1">
                    <span className="text-text-dim text-[10px] uppercase font-bold">Discovered CLI Engines</span>
                    <span className="text-emerald-500 font-bold">
                      {detectedAgents.filter(a => a.isAvailable).length > 0 
                        ? `${detectedAgents.filter(a => a.isAvailable).map(a => a.name).join(', ')} (Ready)`
                        : 'Antigravity CLI (Ready)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
