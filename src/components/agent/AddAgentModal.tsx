import React, { useState, useEffect } from 'react';
import { Check, ArrowRight, UserCheck, Plus, Sparkles, AlertCircle, ChevronDown } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CustomSelect, SelectOption } from '../ui/CustomSelect';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { AVAILABLE_AGENT_PRESETS } from '../../mock/agents';
import { AgentProvider } from '../../types/orbit';
import { agentService, DetectedAgentDto } from '../../services';
import { useAuthStore } from '../../stores/auth.store';
import { ProUpgradeModal } from './ProUpgradeModal';
import { clsx } from 'clsx';

import { useSettingsStore } from '../../stores/settings.store';

import { OFFICIAL_AGENT_INSTALLERS, AgentInstallerConfig } from '../../constants/agentInstallers';
import { tauriService } from '../../services/tauri.service';
import { Terminal as TerminalIcon, Download, Copy, RefreshCw } from 'lucide-react';

export const AddAgentModal: React.FC = () => {
  const { isAddAgentOpen, setAddAgentOpen, spawnerParentAgentId } = useUIStore();
  const { activeWorkspaceId, getActiveWorkspace, activeSpaceIdByProject } = useWorkspaceStore();
  const { addAgent, agents } = useAgentStore();
  const { user } = useAuthStore();
  const { savedProfiles, addSavedProfile } = useSettingsStore();

  const parentAgent = spawnerParentAgentId ? agents.find(a => a.id === spawnerParentAgentId) : null;

  // Wizard Step: 1 = Select Agent Preset, 2 = Configure Profile / Account
  const [step, setStep] = useState<1 | 2>(1);

  const [selectedProvider, setSelectedProvider] = useState<AgentProvider>('antigravity');
  const [selectedRole, setSelectedRole] = useState<import('../../types/orbit').AgentRoleType>('raw');
  const [taskDirective, setTaskDirective] = useState('');
  const [customName, setCustomName] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [customProfile, setCustomProfile] = useState('default');
  const [isCreatingNewProfile, setIsCreatingNewProfile] = useState(false);
  const [detectedAgents, setDetectedAgents] = useState<DetectedAgentDto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);

  // In-App 1-Click Installer State
  const [isInstalling, setIsInstalling] = useState(false);
  const [installOutput, setInstallOutput] = useState<string | null>(null);
  const [customInstallCmd, setCustomInstallCmd] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Compute unique profiles strictly scoped per agent/provider (e.g. Antigravity only sees Antigravity profiles)
  const existingProfiles = Array.from(
    new Set([
      'default',
      ...(savedProfiles || [])
        .map((p) => {
          if (p.startsWith(`${selectedProvider}:`)) {
            return p.slice(`${selectedProvider}:`.length);
          }
          // The previous un-prefixed profile was created for antigravity, so only show it when antigravity is selected
          if (!p.includes(':') && p !== 'default' && selectedProvider === 'antigravity') {
            return p;
          }
          return null;
        })
        .filter((p): p is string => Boolean(p)),
      ...agents
        .filter((a) => a.provider === selectedProvider)
        .map((a) => a.profileId)
        .filter((p): p is string => Boolean(p) && p !== 'default')
    ])
  );

  const isPro = user?.plan === 'PRO';
  const maxAllowedSlots = isPro ? 999 : 2;
  const currentRunningAgents = agents.filter(a => a.status === 'working' || a.status === 'ready').length;

  const activeWorkspace = getActiveWorkspace();
  const activeSpaceId = (activeWorkspace && activeSpaceIdByProject[activeWorkspace.id]) || activeWorkspace?.spaces?.[0]?.id || `space-${activeWorkspace?.id}-1`;

  const selectedPreset = AVAILABLE_AGENT_PRESETS.find(p => p.provider === selectedProvider);

  useEffect(() => {
    if (isAddAgentOpen) {
      setStep(1);
      setSelectedRole(parentAgent ? 'implementer' : 'architect');
      setTaskDirective('');
      setCustomProfile('default');
      setIsCreatingNewProfile(false);
      agentService.detectInstalledAgents().then((res) => {
        setDetectedAgents(res);
      }).catch(() => {});
    }
  }, [isAddAgentOpen]);

  const refreshDetection = async () => {
    try {
      const res = await agentService.detectInstalledAgents();
      setDetectedAgents(res);
    } catch {}
  };

  const handleInstallAgent = async (cmdToRun?: string) => {
    const installerConfig = OFFICIAL_AGENT_INSTALLERS[selectedProvider];
    const cmd = cmdToRun || (selectedProvider === 'custom' ? customInstallCmd : installerConfig?.command);
    if (!cmd) return;

    setIsInstalling(true);
    setInstallOutput('🚀 Starting installation in Orbit background runner...\n');

    try {
      const output = await tauriService.installAgentCli(cmd);
      setInstallOutput((prev) => `${prev || ''}\n✅ Installation output:\n${output}\n\n🔍 Refreshing detected agents...`);
      await refreshDetection();
    } catch (err: any) {
      setInstallOutput((prev) => `${prev || ''}\n❌ Installation failed:\n${err?.message || err}\n`);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleNextStep = () => {
    if (currentRunningAgents >= maxAllowedSlots) {
      setIsProModalOpen(true);
      return;
    }
    setStep(2);
  };

  const handleCreateAgent = async () => {
    if (!activeWorkspaceId) return;

    try {
      setIsSubmitting(true);
      const cleanProfile = customProfile.trim() || 'default';
      if (cleanProfile !== 'default') {
        addSavedProfile(`${selectedProvider}:${cleanProfile}`);
      }

      const roleLabels: Record<string, string> = {
        architect: 'Plan Architect',
        implementer: 'TDD Builder',
        reviewer: 'Code Auditor',
        raw: 'Shell Terminal',
      };

      const finalAgentName = customName.trim()
        ? customName.trim().slice(0, 24)
        : taskDirective.trim()
        ? taskDirective.trim().slice(0, 24)
        : parentAgent
        ? `${roleLabels[selectedRole] || 'Worker'} (${parentAgent.name.slice(0, 8)})`
        : (selectedProvider === 'custom' ? 'Custom Agent' : undefined);

      await addAgent(
        activeWorkspaceId,
        selectedProvider,
        finalAgentName,
        selectedProvider === 'custom' ? customModel.trim() || 'Local LLM' : undefined,
        activeWorkspace?.projectPath,
        activeSpaceId,
        cleanProfile,
        selectedRole,
        spawnerParentAgentId || undefined,
        undefined,
        taskDirective.trim() || undefined
      );
      setAddAgentOpen(false);
      setStep(1);
      setCustomName('');
      setTaskDirective('');
      setCustomModel('');
      setCustomProfile('default');
      setSelectedRole('raw');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isAddAgentOpen}
        onClose={() => {
          setAddAgentOpen(false);
          setStep(1);
        }}
        title={
          parentAgent
            ? `Spawn Worker for ${parentAgent.name}`
            : "Spawn Agent Worker"
        }
        subtitle={
          parentAgent 
            ? `Select engine and mode for child worker attached to ${parentAgent.name}` 
            : "Choose an AI engine and purpose mode to spawn into this workspace"
        }
        maxWidth="3xl"
        className="max-h-[85vh] p-0 overflow-hidden"
      >
        <div className="flex flex-col font-sans -mx-4 -my-4">
          {/* Main 2-Pane Content Grid */}
          <div className="flex flex-col sm:flex-row h-[500px] overflow-hidden">
            
            {/* Left Pane: Dedicated Scrollable Engine Catalog (Scales to 50+ CLIs) */}
            <div className="w-full sm:w-72 border-b sm:border-b-0 sm:border-r border-border bg-well/30 p-3.5 flex flex-col gap-2.5 shrink-0 select-none">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">
                  1. AI Engine
                </span>
                <span className="text-[9.5px] font-mono text-text-dim">
                  {AVAILABLE_AGENT_PRESETS.length} presets
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {AVAILABLE_AGENT_PRESETS.map((preset) => {
                  const isSelected = selectedProvider === preset.provider;
                  const detected = detectedAgents.find((d) => d.provider === preset.provider);
                  const isAvailableOnHost = detected?.isAvailable ?? true;

                  return (
                    <button
                      key={preset.provider}
                      type="button"
                      onClick={() => setSelectedProvider(preset.provider)}
                      className={clsx(
                        'w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between cursor-pointer select-none group',
                        isSelected ? 'surface-selectable-active' : 'surface-selectable'
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                        <span className={clsx('w-2 h-2 rounded-full shrink-0', isAvailableOnHost ? 'bg-emerald-400 ring-2 ring-emerald-400/20' : 'bg-amber-400 ring-2 ring-amber-400/20')} />
                        <div className="flex flex-col truncate">
                          <span className={clsx('text-xs font-mono font-semibold truncate leading-tight', isSelected ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary')}>
                            {preset.name}
                          </span>
                          <span className="text-[10px] font-mono text-text-dim truncate mt-0.5">
                            {detected?.version || preset.model}
                          </span>
                        </div>
                      </div>

                      {isAvailableOnHost ? (
                        <span className="text-[8.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono shrink-0">
                          Ready
                        </span>
                      ) : (
                        <span className="text-[8.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono shrink-0">
                          Install
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedProvider === 'custom' && (
                <div className="p-2.5 bg-well rounded-xl border border-border space-y-1.5 shrink-0 mt-1">
                  <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-text-muted">Custom CLI Binary</span>
                  <input
                    type="text"
                    placeholder="e.g. aider, mentor"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-panel border border-border text-text-primary text-[11px] font-mono focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            {/* Right Pane: Modes, Directives, Profile & 1-Click Installer */}
            <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto bg-panel gap-4 custom-scrollbar">
              
              {/* If Selected Agent is NOT installed: Clean 1-Click Installer Banner */}
              {detectedAgents.length > 0 && detectedAgents.find(d => d.provider === selectedProvider)?.isAvailable === false && (
                <div className="p-3.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 flex flex-col gap-2.5 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Download size={14} className="text-amber-400" />
                      <span className="font-mono font-bold text-xs text-text-primary">
                        Setup {selectedPreset?.name || 'Agent'} CLI
                      </span>
                    </div>
                    <button
                      onClick={refreshDetection}
                      className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer"
                      title="Re-check installation"
                    >
                      <RefreshCw size={12} className={isInstalling ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  <p className="text-[11px] text-text-muted leading-relaxed">
                    {OFFICIAL_AGENT_INSTALLERS[selectedProvider]?.description || 'Harness binary not detected on your system. Run 1-click install below.'}
                  </p>

                  <div className="flex flex-col gap-2 pt-0.5">
                    {selectedProvider === 'custom' ? (
                      <input
                        type="text"
                        placeholder="e.g. pip install aider-chat"
                        value={customInstallCmd}
                        onChange={(e) => setCustomInstallCmd(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-well border border-border text-text-primary font-mono text-[11px] focus:outline-hidden"
                      />
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-well border border-border font-mono text-[11px] text-text-primary truncate">
                        <span className="truncate text-emerald-400 select-all font-mono">
                          {OFFICIAL_AGENT_INSTALLERS[selectedProvider]?.command || 'npm i -g custom-agent'}
                        </span>
                        <button
                          onClick={() => {
                            const cmd = OFFICIAL_AGENT_INSTALLERS[selectedProvider]?.command;
                            if (cmd) {
                              navigator.clipboard.writeText(cmd);
                              setCopiedCmd(true);
                              setTimeout(() => setCopiedCmd(false), 2000);
                            }
                          }}
                          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-panel transition-colors shrink-0 ml-2 cursor-pointer"
                          title="Copy command"
                        >
                          {copiedCmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    )}

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleInstallAgent()}
                      isLoading={isInstalling}
                      className="font-mono text-xs font-bold gap-2 bg-amber-500 hover:bg-amber-400 text-black border-amber-500 h-8.5 rounded-xl"
                    >
                      <TerminalIcon size={13} />
                      <span>{isInstalling ? 'Installing in Orbit...' : `⚡ 1-Click Install ${selectedPreset?.name || ''}`}</span>
                    </Button>
                  </div>

                  {installOutput && (
                    <div className="p-2.5 rounded-xl bg-black/60 border border-border font-mono text-[10px] text-zinc-300 max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {installOutput}
                    </div>
                  )}
                </div>
              )}

              {/* 2. Operational Mode (Auto-Binds Invariant Skills) */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">
                  2. Operational Mode (Auto-Binds Skills)
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('architect')}
                    className={clsx(
                      'p-3 rounded-xl text-left flex flex-col gap-1.5 cursor-pointer select-none',
                      selectedRole === 'architect' ? 'surface-selectable-active' : 'surface-selectable'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-text-primary">📐 1. Plan</span>
                      <span className="text-[8.5px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md font-semibold">SPEC</span>
                    </div>
                    <span className="text-[9.5px] text-text-muted leading-snug">Strict plan only. Forbids code edits; outputs specs & tests.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('implementer')}
                    className={clsx(
                      'p-3 rounded-xl text-left flex flex-col gap-1.5 cursor-pointer select-none',
                      selectedRole === 'implementer' ? 'surface-selectable-active' : 'surface-selectable'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-text-primary">⚡ 2. Code</span>
                      <span className="text-[8.5px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-md font-semibold">TDD</span>
                    </div>
                    <span className="text-[9.5px] text-text-muted leading-snug">TDD builder. Writes minimal type-safe code to pass tests.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('reviewer')}
                    className={clsx(
                      'p-3 rounded-xl text-left flex flex-col gap-1.5 cursor-pointer select-none',
                      selectedRole === 'reviewer' ? 'surface-selectable-active' : 'surface-selectable'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-text-primary">🛡️ 3. Audit</span>
                      <span className="text-[8.5px] font-mono text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded-md font-semibold">AST</span>
                    </div>
                    <span className="text-[9.5px] text-text-muted leading-snug">AST security auditor. Reviews diffs, OWASP & invariants.</span>
                  </button>
                </div>
              </div>

              {/* 3. Task Directive / Scope */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
                  <span>3. Initial Task Directive</span>
                  <span className="text-[9.5px] text-text-dim lowercase font-mono">optional</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Build auth endpoints with rate limiting, write unit tests"
                  value={taskDirective}
                  onChange={(e) => setTaskDirective(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateAgent();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-well border border-border text-text-primary font-mono text-xs placeholder:text-text-dim focus:outline-hidden focus:border-border-hover transition-colors"
                />
              </div>

              {/* 4. Account Profile / Sandbox */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">
                  4. Account Profile / Sandbox
                </span>
                {!isCreatingNewProfile ? (
                  <CustomSelect
                    value={customProfile}
                    onChange={(val) => {
                      if (val === '__NEW__') {
                        setIsCreatingNewProfile(true);
                        setCustomProfile('');
                      } else {
                        setCustomProfile(val);
                      }
                    }}
                    options={[
                      ...existingProfiles.map((p) => ({
                        value: p,
                        label: p === 'default' ? 'default (Global Auth)' : `Profile: ${p}`,
                        sublabel: p === 'default' ? 'Shared API keys & auth token' : 'Isolated sandbox credentials',
                      })),
                      {
                        value: '__NEW__',
                        label: '+ Create New Account Profile…',
                        isAction: true,
                      },
                    ]}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. work, client-a"
                      value={customProfile}
                      onChange={(e) => setCustomProfile(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      autoFocus
                      className="flex-1 px-3.5 py-2 rounded-xl bg-well border border-border text-text-primary font-mono text-xs focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewProfile(false);
                        setCustomProfile('default');
                      }}
                      className="px-3 py-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-well text-xs font-mono cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
                <div className="flex items-center gap-2">
                  {detectedAgents.length > 0 && !detectedAgents.find(d => d.provider === selectedProvider)?.isAvailable && (
                    <span className="text-[10.5px] font-mono text-amber-400 font-medium flex items-center gap-1.5">
                      💡 Click "1-Click Install" above to setup
                    </span>
                  )}
                  {detectedAgents.find(d => d.provider === selectedProvider)?.isAvailable !== false && (
                    <span className="text-[10px] font-mono text-text-dim">
                      Press <kbd className="px-2 py-0.5 rounded-md bg-well border border-border text-text-muted font-mono text-[9.5px]">Enter ↵</kbd>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddAgentOpen(false)}
                    className="font-mono text-xs px-3 py-1.5 h-8.5 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCreateAgent}
                    isLoading={isSubmitting}
                    disabled={detectedAgents.length > 0 && detectedAgents.find(d => d.provider === selectedProvider)?.isAvailable === false}
                    className="gap-2 font-mono text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed px-4.5 py-1.5 h-8.5 rounded-xl"
                  >
                    <span>Spawn Worker</span>
                    <ArrowRight size={13} strokeWidth={2.5} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ProUpgradeModal
        isOpen={isProModalOpen}
        onClose={() => setIsProModalOpen(false)}
        currentCount={currentRunningAgents}
        maxSlots={maxAllowedSlots}
      />
    </>
  );
};
