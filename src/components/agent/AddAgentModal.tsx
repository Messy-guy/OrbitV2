import React, { useState, useEffect } from 'react';
import { Check, ArrowRight, Terminal as TerminalIcon, Download, Copy, RefreshCw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CustomSelect } from '../ui/CustomSelect';
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
import { OFFICIAL_AGENT_INSTALLERS } from '../../constants/agentInstallers';
import { tauriService } from '../../services/tauri.service';

const QUICK_INSTALL_PRESETS = [
  { name: 'GitHub Copilot', exec: 'copilot', cmd: 'npm install -g @github/copilot', desc: 'Official GitHub Copilot autonomous terminal coding agent' },
  { name: 'Goose', exec: 'goose', cmd: 'curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | bash', desc: 'Autonomous on-machine developer agent by Block' },
  { name: 'Kiro CLI', exec: 'kiro-cli', cmd: 'curl -fsSL https://cli.kiro.dev/install | bash', desc: 'High-performance autonomous terminal assistant' },
  { name: 'Qwen Code', exec: 'qwen', cmd: 'npm install -g @qwen-code/qwen-code@latest', desc: 'Alibaba Qwen specialized coding agent' },
  { name: 'Mimo Code', exec: 'mimo', cmd: 'npm install -g @mimo-ai/cli', desc: 'Autonomous on-device developer coding agent CLI by Xiaomi' },
  { name: 'Muse Code', exec: 'muse', cmd: 'curl -fsSL https://dev.meta.ai/install.sh | bash', desc: 'Meta AI autonomous terminal coding assistant' },
  { name: 'Mistral Vibe', exec: 'vibe', cmd: 'curl -LsSf https://mistral.ai/vibe/install.sh | bash', desc: 'Mistral AI terminal coding harness powered by Codestral' },
  { name: 'Qoder CLI', exec: 'qodercli', cmd: 'curl -fsSL https://qoder.com/install | bash', desc: 'Intelligent command line coding agent' },
  { name: 'KiloCode', exec: 'kilocode', cmd: 'npm install -g @kilocode/cli', desc: 'Autonomous coding agent CLI' },
  { name: 'Freebuff', exec: 'freebuff', cmd: 'npm install -g freebuff', desc: 'Autonomous AI coding agent CLI' },
  { name: 'Gemini CLI', exec: 'gemini', cmd: 'npm install -g @google/gemini-cli', desc: 'Google Gemini CLI developer harness' },
  { name: 'Open Interpreter', exec: 'interpreter', cmd: 'pip install open-interpreter', desc: 'Natural language computer terminal control' },
];

export const AddAgentModal: React.FC = () => {
  const { isAddAgentOpen, setAddAgentOpen, spawnerParentAgentId } = useUIStore();
  const { activeWorkspaceId, getActiveWorkspace, activeSpaceIdByProject } = useWorkspaceStore();
  const { addAgent, agents } = useAgentStore();
  const { user } = useAuthStore();
  const { savedProfiles, addSavedProfile } = useSettingsStore();

  const parentAgent = spawnerParentAgentId ? agents.find(a => a.id === spawnerParentAgentId) : null;

  const [selectedProvider, setSelectedProvider] = useState<AgentProvider>('antigravity');
  const [selectedRole, setSelectedRole] = useState<import('../../types/orbit').AgentRoleType>('raw');
  const [taskDirective, setTaskDirective] = useState('');
  const [customName, setCustomName] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [customProfile, setCustomProfile] = useState('default');
  const [isCreatingNewProfile, setIsCreatingNewProfile] = useState(false);
  const [detectedAgents, setDetectedAgents] = useState<DetectedAgentDto[]>(() =>
    AVAILABLE_AGENT_PRESETS.map((p) => ({
      provider: p.provider,
      name: p.name,
      path: `/usr/local/bin/${p.provider}`,
      version: p.model,
      isAvailable: true,
      description: p.description,
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);

  // 1-Click Installer State
  const [isInstalling, setIsInstalling] = useState(false);
  const [installOutput, setInstallOutput] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const existingProfiles = Array.from(
    new Set([
      'default',
      ...(savedProfiles || [])
        .map((p) => {
          if (p.startsWith(`${selectedProvider}:`)) {
            return p.slice(`${selectedProvider}:`.length);
          }
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
      setSelectedRole(parentAgent ? 'implementer' : 'architect');
      setTaskDirective('');
      setCustomProfile('default');
      setIsCreatingNewProfile(false);
      setInstallOutput(null);
      // Fast background refresh without blocking modal presentation
      agentService.detectInstalledAgents().then(setDetectedAgents).catch(() => {});
    }
  }, [isAddAgentOpen]);

  const refreshDetection = async () => {
    try {
      const res = await agentService.detectInstalledAgents();
      setDetectedAgents(res);
    } catch {}
  };

  const handleInstallOfficialAgent = async () => {
    const installerConfig = OFFICIAL_AGENT_INSTALLERS[selectedProvider];
    const cmd = installerConfig?.command;
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

  const handleSelectPreset = (provider: AgentProvider) => {
    setSelectedProvider(provider);
    setCustomName('');
    setCustomModel('');
    setInstallOutput(null);
  };

  const handleCreateAgent = async () => {
    if (!activeWorkspaceId) return;

    if (currentRunningAgents >= maxAllowedSlots) {
      setIsProModalOpen(true);
      return;
    }

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
        : undefined;

      await addAgent(
        activeWorkspaceId,
        selectedProvider,
        finalAgentName,
        undefined,
        activeWorkspace?.projectPath,
        activeSpaceId,
        cleanProfile,
        selectedRole,
        spawnerParentAgentId || undefined,
        undefined,
        taskDirective.trim() || undefined
      );

      setAddAgentOpen(false);
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

  // Check host availability for current selection
  const isSelectedAvailable = (() => {
    if (selectedProvider === 'terminal') return true;
    const detected = detectedAgents.find(d => d.provider === selectedProvider);
    return detected ? detected.isAvailable : true;
  })();

  return (
    <>
      <Modal
        isOpen={isAddAgentOpen}
        onClose={() => {
          setAddAgentOpen(false);
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
        <div className="flex flex-col font-sans">
          {/* Main 2-Pane Spawner Catalog */}
          <div className="flex flex-col sm:flex-row h-[520px] overflow-hidden">
            
            {/* Left Pane: Agent Catalog */}
            <div className="w-full sm:w-72 border-b sm:border-b-0 sm:border-r border-border bg-well/30 p-3.5 flex flex-col gap-2.5 shrink-0 select-none">
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">
                  Engine Catalog
                </span>
                <span className="text-[10px] font-mono text-text-dim">
                  {AVAILABLE_AGENT_PRESETS.length} Agents
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {AVAILABLE_AGENT_PRESETS.map((preset) => {
                  const isSelected = selectedProvider === preset.provider;
                  const detected = detectedAgents.find((d) => d.provider === preset.provider);
                  const isAvailableOnHost = preset.provider === 'terminal' || (detected ? detected.isAvailable : true);

                  return (
                    <button
                      key={preset.provider}
                      type="button"
                      onClick={() => handleSelectPreset(preset.provider)}
                      className={clsx(
                        'w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between cursor-pointer select-none group transition-all',
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
                        <span className="text-[8.5px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono shrink-0">
                          Ready
                        </span>
                      ) : (
                        <span className="text-[8.5px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono shrink-0">
                          Setup
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Pane: Operational Mode, Task Directives, Profile & Spawner */}
            <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto bg-panel gap-4 custom-scrollbar">
              
              {/* Official 1-Click Installer Banner if uninstalled */}
              {(() => {
                const detected = detectedAgents.find(d => d.provider === selectedProvider);
                const isAvail = selectedProvider === 'terminal' || (detected ? detected.isAvailable : true);
                if (isAvail) return null;

                return (
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
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-well border border-border font-mono text-[11px] text-text-primary truncate">
                        <span className="truncate text-emerald-400 select-all font-mono">
                          {OFFICIAL_AGENT_INSTALLERS[selectedProvider]?.command || 'npm i -g agent'}
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

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleInstallOfficialAgent()}
                        isLoading={isInstalling}
                        className="font-mono text-xs font-bold gap-2 bg-amber-500 hover:bg-amber-400 text-black border-amber-500 h-8.5 rounded-xl cursor-pointer"
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
                );
              })()}

              {/* 2. Operational Mode (Auto-Binds Invariant Skills) */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">
                  Operational Mode
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
                  <span>Initial Task Directive</span>
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
                  Account Profile / Sandbox
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
              <div className="flex items-center justify-between pt-4 border-t border-border mt-auto shrink-0">
                <div className="flex items-center gap-2">
                  {!isSelectedAvailable ? (
                    <span className="text-[11px] font-mono text-amber-400 font-medium flex items-center gap-1.5">
                      💡 Click &quot;1-Click Install&quot; above to setup
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-dim">
                      <span>Press</span>
                      <kbd className="px-1.5 py-0.5 rounded-md bg-well border border-border text-text-muted font-mono text-[10px] shadow-xs">
                        Enter ↵
                      </kbd>
                      <span>to spawn</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => setAddAgentOpen(false)}
                    className="font-mono text-xs px-4 h-9 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleCreateAgent}
                    isLoading={isSubmitting}
                    disabled={!isSelectedAvailable}
                    className="gap-2 font-mono text-xs font-bold px-5 h-9 rounded-xl shadow-md cursor-pointer"
                  >
                    <span>Spawn Worker</span>
                    <ArrowRight size={14} strokeWidth={2.5} />
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
