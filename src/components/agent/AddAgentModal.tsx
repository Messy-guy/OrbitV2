import React, { useState, useEffect } from 'react';
import { Check, ArrowRight, UserCheck, Plus, Sparkles, AlertCircle, ChevronDown } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
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

  useEffect(() => {
    setCustomProfile('default');
    setIsCreatingNewProfile(false);
  }, [selectedProvider]);

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
          <div className="flex flex-col sm:flex-row h-[420px] overflow-hidden">
            
            {/* Left Pane: Compact AI Engine Picker (Internal Scroll only) */}
            <div className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-border bg-panel-elevated p-3 flex flex-col gap-2 shrink-0 select-none">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">
                  1. Engine / Harness
                </span>
                <span className="text-[9px] font-mono text-text-dim">
                  {AVAILABLE_AGENT_PRESETS.length} Available
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
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
                        'w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer select-none',
                        isSelected
                          ? 'bg-panel border-border-hover shadow-xs ring-1 ring-border-hover'
                          : 'bg-well/50 hover:bg-panel border-border text-text-muted'
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', isSelected ? 'bg-text-primary' : 'bg-text-dim')} />
                        <div className="flex flex-col truncate">
                          <span className={clsx('text-xs font-mono font-bold truncate', isSelected ? 'text-text-primary' : 'text-text-secondary')}>
                            {preset.name}
                          </span>
                          <span className="text-[10px] font-mono text-text-dim truncate">
                            {detected?.version || preset.model}
                          </span>
                        </div>
                      </div>

                      {isAvailableOnHost ? (
                        <span className="text-[8.5px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono shrink-0">
                          Installed
                        </span>
                      ) : (
                        <span className="text-[8.5px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono shrink-0">
                          Not Installed
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedProvider === 'custom' && (
                <div className="p-2 bg-well rounded-xl border border-border space-y-1.5 shrink-0">
                  <span className="text-[9.5px] font-mono font-bold uppercase text-text-secondary">Custom CLI</span>
                  <input
                    type="text"
                    placeholder="Binary/Command (e.g. aider)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-2 py-1 rounded-lg bg-panel border border-border text-text-primary text-[11px] font-mono focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            {/* Right Pane: Mode, Directive & Profile Controls */}
            <div className="flex-1 p-4 flex flex-col justify-between overflow-y-auto bg-panel gap-3.5">
              
              {/* Purpose & Mode Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">
                  2. Operating Mode (Auto-Binds Invariant Skills)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('architect')}
                    className={clsx(
                      'p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer select-none',
                      selectedRole === 'architect'
                        ? 'bg-panel-hover border-border-hover shadow-xs ring-1 ring-border-hover'
                        : 'bg-panel-elevated hover:bg-panel-hover border-border text-text-muted'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-text-primary">📐 1. Plan</span>
                      <span className="text-[8.5px] font-mono text-amber-400 bg-amber-400/10 px-1 rounded">Spec Skill</span>
                    </div>
                    <span className="text-[9.5px] text-text-muted leading-tight">Strict plan only. Forbids raw edits; produces architecture & tests.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('implementer')}
                    className={clsx(
                      'p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer select-none',
                      selectedRole === 'implementer'
                        ? 'bg-panel-hover border-border-hover shadow-xs ring-1 ring-border-hover'
                        : 'bg-panel-elevated hover:bg-panel-hover border-border text-text-muted'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-text-primary">⚡ 2. Code</span>
                      <span className="text-[8.5px] font-mono text-emerald-400 bg-emerald-400/10 px-1 rounded">TDD Skill</span>
                    </div>
                    <span className="text-[9.5px] text-text-muted leading-tight">TDD implementer. Writes clean, type-safe minimal code to pass tests.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('reviewer')}
                    className={clsx(
                      'p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer select-none',
                      selectedRole === 'reviewer'
                        ? 'bg-panel-hover border-border-hover shadow-xs ring-1 ring-border-hover'
                        : 'bg-panel-elevated hover:bg-panel-hover border-border text-text-muted'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-text-primary">🛡️ 3. Audit</span>
                      <span className="text-[8.5px] font-mono text-sky-400 bg-sky-400/10 px-1 rounded">AST Skill</span>
                    </div>
                    <span className="text-[9.5px] text-text-muted leading-tight">AST security auditor. Reviews git diffs, OWASP leaks, and invariants.</span>
                  </button>
                </div>
              </div>

              {/* Task Directive / Goal input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary flex items-center justify-between">
                  <span>3. Task Directive / Scope</span>
                  <span className="text-[9px] text-text-dim lowercase">optional</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Run test suite on auth endpoints, implement JWT rotation"
                  value={taskDirective}
                  onChange={(e) => setTaskDirective(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateAgent();
                  }}
                  className="px-3 py-2 rounded-xl bg-panel-elevated border border-border text-text-primary font-mono text-xs placeholder:text-text-dim focus:outline-hidden focus:border-border-hover transition-colors"
                />
              </div>

              {/* Account Profile Context */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">
                  4. Account Profile / Sandbox
                </span>
                {!isCreatingNewProfile ? (
                  <div className="relative">
                    <select
                      value={customProfile}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          setIsCreatingNewProfile(true);
                          setCustomProfile('');
                        } else {
                          setCustomProfile(e.target.value);
                        }
                      }}
                      className="w-full appearance-none px-3 py-2 rounded-xl bg-[#0e0f13] border border-white/[0.12] hover:border-white/[0.2] text-[#ededed] font-mono text-xs focus:outline-hidden cursor-pointer pr-8 shadow-inner"
                      style={{ color: '#ededed', backgroundColor: '#0e0f13' }}
                    >
                      {existingProfiles.map((p) => (
                        <option key={p} value={p} style={{ backgroundColor: '#14151b', color: '#f3f4f8' }}>
                          {p === 'default' ? 'default (Main Global Auth)' : `Profile: ${p}`}
                        </option>
                      ))}
                      <option value="__NEW__" style={{ backgroundColor: '#14151b', color: '#fbbf24', fontWeight: 'bold' }}>
                        + Create New Account Profile…
                      </option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                      <ChevronDown size={12} />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. work, client-a"
                      value={customProfile}
                      onChange={(e) => setCustomProfile(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      autoFocus
                      className="flex-1 px-3 py-2 rounded-xl bg-[#0e0f13] border border-white/[0.15] text-[#ededed] font-mono text-xs focus:outline-hidden"
                      style={{ color: '#ededed', backgroundColor: '#0e0f13' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewProfile(false);
                        setCustomProfile('default');
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-text-muted hover:text-text-primary text-xs font-mono"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border mt-auto">
                <div className="flex items-center gap-1.5">
                  {detectedAgents.length > 0 && !detectedAgents.find(d => d.provider === selectedProvider)?.isAvailable && (
                    <span className="text-[10px] font-mono text-rose-400 font-bold flex items-center gap-1">
                      ⚠️ Binary not installed on host
                    </span>
                  )}
                  {detectedAgents.find(d => d.provider === selectedProvider)?.isAvailable !== false && (
                    <span className="text-[10px] font-mono text-text-dim">
                      Press <kbd className="px-1.5 py-0.5 rounded bg-well text-text-secondary font-mono">Enter</kbd>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setAddAgentOpen(false)}
                    className="font-mono text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleCreateAgent}
                    isLoading={isSubmitting}
                    disabled={detectedAgents.length > 0 && detectedAgents.find(d => d.provider === selectedProvider)?.isAvailable === false}
                    className="gap-1.5 font-mono text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Spawn Worker</span>
                    <ArrowRight size={13} />
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
