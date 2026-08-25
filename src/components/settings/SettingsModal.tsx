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
  ChevronDown,
  Layers,
  Star,
  Plus,
  Trash2,
  ExternalLink
} from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import { Modal } from '../ui/Modal';
import { useUIStore } from '../../stores/ui.store';
import { useSettingsStore, THEMES, ACCENTS } from '../../stores/settings.store';
import { useSkillStore } from '../../stores/skill.store';
import { ThemeId, AccentId, CanvasGridStyle, TerminalCursorStyle } from '../../types/settings';
import { AgentRoleType } from '../../types/orbit';
import { AGENT_ROLE_CONFIGS } from '../../constants/roles';
import { tauriService, isTauriAvailable } from '../../services/tauri.service';
import { clsx } from 'clsx';

type SettingsTab = 'appearance' | 'agents' | 'modes' | 'handoff' | 'terminal' | 'notifications' | 'workspace' | 'about';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setSettingsOpen } = useUIStore();
  const settings = useSettingsStore();
  const { setBrowserModalOpen, favoriteSkills, installedSkills } = useSkillStore();
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [detectedAgents, setDetectedAgents] = useState<any[]>([]);
  const [selectedConfigMode, setSelectedConfigMode] = useState<'architect' | 'implementer' | 'reviewer'>('implementer');
  const [favoriteDropdownOpen, setFavoriteDropdownOpen] = useState(false);

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
    { id: 'modes', label: 'Modes & Skills', icon: <Layers size={13} /> },
    { id: 'handoff', label: 'Continuity Flow', icon: <ArrowRightLeft size={13} /> },
    { id: 'terminal', label: 'Terminal & Font', icon: <Terminal size={13} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={13} /> },
    { id: 'workspace', label: 'Git & Projects', icon: <FolderGit2 size={13} /> },
    { id: 'about', label: 'System & Production', icon: <Info size={13} /> },
  ];

  const currentModeConfig = AGENT_ROLE_CONFIGS[selectedConfigMode];
  const customModeSkills = settings.modeCustomSkills[selectedConfigMode] || [];
  const customModeDirective = settings.modeCustomDirectives[selectedConfigMode] || '';

  // All available candidate skills (starred favorites + installed)
  const candidateSkills = favoriteSkills.length > 0 ? favoriteSkills : installedSkills;

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={() => setSettingsOpen(false)}
      title="Settings & Preferences"
      subtitle="Customize appearance, operating mode skills, executable paths, and handoff protocols"
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
                          <div className="w-1/3 rounded-lg bg-well border border-border flex flex-col justify-center px-2">
                            <span className="w-8 h-1 rounded bg-text-dim/40 block mb-1" />
                            <span className="w-5 h-1 rounded bg-text-dim/20 block" />
                          </div>
                          <div className="flex-1 rounded-lg bg-panel border border-border flex flex-col justify-center px-2">
                            <span className="w-12 h-1 rounded bg-accent-primary block mb-1" />
                            <span className="w-16 h-1 rounded bg-text-dim/30 block" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Accent Color Strip */}
              <div className="space-y-3">
                <label className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold">
                  Accent Focus Light
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {(Object.keys(ACCENTS) as AccentId[]).map((accId) => {
                    const acc = ACCENTS[accId];
                    const isSelected = settings.accent === accId;
                    return (
                      <button
                        key={accId}
                        onClick={() => settings.setAccent(accId)}
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

                <div>
                  <label className="text-[10px] font-mono text-text-muted uppercase block mb-1.5 font-bold">
                    Binary Executable Path Override
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Default system path (/usr/local/bin/agy)"
                      value={settings.agentConfigs.antigravity.customBinaryPath || ''}
                      onChange={(e) => settings.updateAgentConfig('antigravity', { customBinaryPath: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl bg-well border border-border text-text-primary font-mono text-xs focus:outline-hidden"
                    />
                    <button
                      onClick={() => handlePickBinary('antigravity')}
                      className="px-3 py-2 rounded-xl bg-panel hover:bg-panel-hover border border-border text-text-primary font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileCode size={13} />
                      <span>Browse…</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Claude Code Configuration */}
              <div className="p-5 rounded-2xl bg-panel-elevated border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu size={14} className="text-amber-500" />
                    <span className="font-mono font-bold text-text-primary text-xs">Claude Code CLI</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
                    Host Harness Ready
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-text-muted uppercase block mb-1.5 font-bold">
                    Binary Executable Path Override
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Default system path (/usr/local/bin/claude)"
                      value={settings.agentConfigs.claude.customBinaryPath || ''}
                      onChange={(e) => settings.updateAgentConfig('claude', { customBinaryPath: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl bg-well border border-border text-text-primary font-mono text-xs focus:outline-hidden"
                    />
                    <button
                      onClick={() => handlePickBinary('claude')}
                      className="px-3 py-2 rounded-xl bg-panel hover:bg-panel-hover border border-border text-text-primary font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileCode size={13} />
                      <span>Browse…</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. OPERATING MODES & SKILLS TAB */}
          {activeTab === 'modes' && (
            <div className="space-y-6">
              {/* Header Title */}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold block mb-1">
                  Operating Mode Skill Configurations
                </span>
                <p className="text-[11.5px] text-text-muted font-sans leading-relaxed">
                  Configure default industrial skills and invariant directives automatically bound to each operating mode.
                </p>
              </div>

              {/* 3 Mode Selection Tabs */}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedConfigMode('architect')}
                  className={clsx(
                    'p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer select-none',
                    selectedConfigMode === 'architect'
                      ? 'bg-well border-border-hover shadow-sm ring-1 ring-border-hover'
                      : 'bg-panel-elevated hover:bg-well border-border text-text-muted'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-text-primary">📐 1. Plan</span>
                    <span className="text-[8.5px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded font-bold">
                      Spec Invariants
                    </span>
                  </div>
                  <span className="text-[10px] text-text-muted leading-tight">RFC design & test contracts.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedConfigMode('implementer')}
                  className={clsx(
                    'p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer select-none',
                    selectedConfigMode === 'implementer'
                      ? 'bg-well border-border-hover shadow-sm ring-1 ring-border-hover'
                      : 'bg-panel-elevated hover:bg-well border-border text-text-muted'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-text-primary">⚡ 2. Code</span>
                    <span className="text-[8.5px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.2 rounded font-bold">
                      TDD Builders
                    </span>
                  </div>
                  <span className="text-[10px] text-text-muted leading-tight">Type-safe test implementer.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedConfigMode('reviewer')}
                  className={clsx(
                    'p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer select-none',
                    selectedConfigMode === 'reviewer'
                      ? 'bg-well border-border-hover shadow-sm ring-1 ring-border-hover'
                      : 'bg-panel-elevated hover:bg-well border-border text-text-muted'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-text-primary">🛡️ 3. Audit</span>
                    <span className="text-[8.5px] font-mono text-sky-400 bg-sky-400/10 px-1.5 py-0.2 rounded font-bold">
                      AST & Security
                    </span>
                  </div>
                  <span className="text-[10px] text-text-muted leading-tight">Security diff review.</span>
                </button>
              </div>

              {/* Mode Detail Card */}
              <div className="p-5 rounded-2xl bg-panel-elevated border border-border space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-text-primary text-xs uppercase">
                      {currentModeConfig.name} Mode Profile
                    </span>
                    <span className="text-[11px] text-text-muted font-sans mt-0.5">
                      {currentModeConfig.description}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-well border border-border text-text-secondary font-semibold">
                    {selectedConfigMode === 'implementer' ? '--mode accept-edits' : '--mode plan'}
                  </span>
                </div>

                {/* Attached Industry Skills Container */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold flex items-center justify-between">
                    <span>Bound Industry Skills & Presets</span>
                    <span className="text-[9.5px] text-emerald-400 font-bold">
                      {customModeSkills.length + 2} Active Skills
                    </span>
                  </label>

                  {/* Built-in Core Invariants */}
                  <div className="flex flex-wrap gap-1.5">
                    {currentModeConfig.invariants.map((inv, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded-md bg-well border border-border/80 text-text-primary font-mono text-[10.5px] flex items-center gap-1.5"
                      >
                        <Check size={11} className="text-emerald-400" />
                        <span>{inv}</span>
                      </span>
                    ))}

                    {/* User Attached Custom Skills */}
                    {customModeSkills.map((skill) => (
                      <span
                        key={skill.id}
                        className="px-2 py-1 rounded-md bg-well border border-border-hover text-text-primary font-mono text-[10.5px] flex items-center gap-1.5 group"
                      >
                        <Star size={11} className="text-amber-400 fill-amber-400" />
                        <span>{skill.shortLabel || skill.name}</span>
                        <button
                          type="button"
                          onClick={() => settings.removeSkillFromMode(selectedConfigMode, skill.id)}
                          className="text-text-dim hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                          title="Remove custom skill from mode"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Add Skills Actions Strip */}
                <div className="pt-2 flex items-center gap-2">
                  {/* Select from Favorites Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setFavoriteDropdownOpen(!favoriteDropdownOpen)}
                      className="px-3 py-1.5 rounded-xl bg-well hover:bg-panel border border-border text-text-primary font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Star size={12} className="text-amber-400" />
                      <span>Attach from Favorites</span>
                      <ChevronDown size={11} />
                    </button>

                    {favoriteDropdownOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-full left-0 mt-1.5 w-64 p-1.5 rounded-xl bg-well border border-border shadow-2xl z-50 flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar"
                      >
                        {candidateSkills.length === 0 ? (
                          <div className="p-2 text-center text-text-dim font-mono text-[10.5px]">
                            No favorites yet. Star skills in the Skill Hub!
                          </div>
                        ) : (
                          candidateSkills.map((sk) => {
                            const isAlreadyBound = customModeSkills.some((s) => s.id === sk.id);
                            return (
                              <button
                                key={sk.id}
                                type="button"
                                disabled={isAlreadyBound}
                                onClick={() => {
                                  settings.addSkillToMode(selectedConfigMode, sk);
                                  setFavoriteDropdownOpen(false);
                                }}
                                className={clsx(
                                  'px-2 py-1.5 rounded-lg text-left text-xs font-mono flex items-center justify-between transition-colors cursor-pointer',
                                  isAlreadyBound
                                    ? 'opacity-40 cursor-not-allowed bg-transparent text-text-dim'
                                    : 'hover:bg-panel text-text-primary'
                                )}
                              >
                                <span className="truncate max-w-[170px]">{sk.shortLabel || sk.name}</span>
                                {isAlreadyBound ? (
                                  <span className="text-[9px] text-emerald-400">Attached</span>
                                ) : (
                                  <Plus size={11} />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Browse 1,200+ Skills in Skill Hub */}
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      setBrowserModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-panel hover:bg-well border border-border hover:border-border-hover text-text-primary font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ExternalLink size={12} />
                    <span>Browse 1,200+ Live Skills</span>
                  </button>
                </div>

                {/* Custom Directive Override */}
                <div className="pt-2 border-t border-border space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold">
                    Custom Mode Directive Override (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder={`e.g. Always use strict Tailwind CSS design tokens, and enforce Vitest unit coverage for all new files.`}
                    value={customModeDirective}
                    onChange={(e) => settings.setModeCustomDirective(selectedConfigMode, e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-well border border-border text-text-primary font-mono text-xs focus:outline-hidden focus:border-border-hover placeholder:text-text-dim resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. HANDOFF TAB */}
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

          {/* 5. TERMINAL & FONT TAB */}
          {activeTab === 'terminal' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-panel-elevated border border-border space-y-4">
                <span className="font-mono font-bold text-text-primary text-xs block">
                  Typography & Geometry
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono text-text-muted uppercase block mb-1.5 font-bold">
                      Font Family
                    </label>
                    <input
                      type="text"
                      value={settings.terminalFontFamily}
                      onChange={(e) => settings.setTerminalFontFamily(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-well border border-border text-text-primary font-mono text-xs focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-text-muted uppercase block mb-1.5 font-bold">
                      Font Size ({settings.terminalFontSize}px)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={24}
                      value={settings.terminalFontSize}
                      onChange={(e) => settings.setTerminalFontSize(parseInt(e.target.value, 10) || 13)}
                      className="w-full px-3 py-2 rounded-xl bg-well border border-border text-text-primary font-mono text-xs focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-panel-elevated border border-border flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-text-primary text-xs block">
                    Desktop System Notifications
                  </span>
                  <span className="text-[11px] text-text-muted block mt-1">
                    Receive host OS alerts when agents conclude long test runs or ask for input.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableDesktopNotifications}
                  onChange={(e) => settings.setEnableDesktopNotifications(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-2xl bg-panel-elevated border border-border flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-text-primary text-xs block">
                    Acoustic Task Chimes
                  </span>
                  <span className="text-[11px] text-text-muted block mt-1">
                    Subtle tactile audio chime when tests pass green.
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

          {/* 7. GIT & WORKSPACES TAB */}
          {activeTab === 'workspace' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-panel-elevated border border-border space-y-3">
                <span className="font-mono font-bold text-text-primary text-xs block">
                  Default Projects Repository Directory
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.defaultProjectsPath}
                    onChange={(e) => {
                      settings.defaultProjectsPath = e.target.value;
                      useSettingsStore.setState({ defaultProjectsPath: e.target.value });
                    }}
                    className="flex-1 px-3 py-2 rounded-xl bg-well border border-border text-text-primary font-mono text-xs focus:outline-hidden"
                  />
                  <button
                    onClick={handlePickProjectsFolder}
                    className="px-3 py-2 rounded-xl bg-panel hover:bg-panel-hover border border-border text-text-primary font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderOpen size={13} />
                    <span>Select…</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-panel-elevated border border-border flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-text-primary text-xs block">
                    Auto-Checkpoint on Handoff
                  </span>
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

          {/* 8. SYSTEM & PRODUCTION INFO TAB */}
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
