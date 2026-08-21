import React, { useState, useEffect } from 'react';
import { Check, ArrowRight, UserCheck, Plus, Sparkles, AlertCircle } from 'lucide-react';
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
  const { isAddAgentOpen, setAddAgentOpen } = useUIStore();
  const { activeWorkspaceId, getActiveWorkspace, activeSpaceIdByProject } = useWorkspaceStore();
  const { addAgent, agents } = useAgentStore();
  const { user } = useAuthStore();
  const { savedProfiles, addSavedProfile } = useSettingsStore();

  // Wizard Step: 1 = Select Agent Preset, 2 = Configure Profile / Account
  const [step, setStep] = useState<1 | 2>(1);

  const [selectedProvider, setSelectedProvider] = useState<AgentProvider>('antigravity');
  const [customName, setCustomName] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [customProfile, setCustomProfile] = useState('default');
  const [isCreatingNewProfile, setIsCreatingNewProfile] = useState(false);
  const [detectedAgents, setDetectedAgents] = useState<DetectedAgentDto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);

  // Compute all unique profiles across all projects (global persistent settings + current active agents)
  const existingProfiles = Array.from(
    new Set(['default', ...(savedProfiles || []), ...agents.map((a) => a.profileId).filter(Boolean) as string[]])
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
      agentService.detectInstalledAgents().then((res) => {
        setDetectedAgents(res);
      }).catch(() => {});
    }
  }, [isAddAgentOpen]);

  const handleNextStep = () => {
    // Check slot limit for Free users before proceeding to step 2
    if (!isPro && currentRunningAgents >= maxAllowedSlots) {
      setAddAgentOpen(false);
      setIsProModalOpen(true);
      return;
    }
    setStep(2);
  };

  const handleSpawn = async () => {
    if (!activeWorkspaceId) return;

    setIsSubmitting(true);
    try {
      const cleanProfile = customProfile.trim().toLowerCase() || 'default';
      if (cleanProfile !== 'default') {
        addSavedProfile(cleanProfile);
      }

      await addAgent(
        activeWorkspaceId,
        selectedProvider,
        selectedProvider === 'custom' ? customName.trim() || 'Custom Agent' : undefined,
        selectedProvider === 'custom' ? customModel.trim() || 'Local LLM' : undefined,
        activeWorkspace?.projectPath,
        activeSpaceId,
        cleanProfile
      );
      setAddAgentOpen(false);
      setStep(1);
      setCustomName('');
      setCustomModel('');
      setCustomProfile('default');
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
        title={step === 1 ? "Add Agent / Harness" : "Configure Account & Profile"}
        subtitle={step === 1 
          ? "Select a local AI coding CLI or interactive shell to spawn in this workspace" 
          : `Choose the account profile or authentication context for ${selectedPreset?.name || selectedProvider}`}
        maxWidth="lg"
      >
        <div className="flex flex-col gap-4 font-sans">
          {step === 1 ? (
            /* STEP 1: Select AI Agent Preset */
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AVAILABLE_AGENT_PRESETS.map((preset) => {
                  const isSelected = selectedProvider === preset.provider;
                  const detected = detectedAgents.find((d) => d.provider === preset.provider);
                  const isAvailableOnHost = detected?.isAvailable ?? true;

                  return (
                    <div
                      key={preset.provider}
                      onClick={() => setSelectedProvider(preset.provider)}
                      className={clsx(
                        'p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none group shadow-sm',
                        isSelected
                          ? 'bg-panel-hover border-border-hover shadow-md ring-1 ring-border-hover'
                          : 'bg-panel-elevated hover:bg-panel-hover border-border hover:border-border-hover'
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-xs tracking-wider uppercase text-text-primary font-mono flex items-center gap-2">
                            <span className={clsx('w-2 h-2 rounded-full transition-colors', isSelected ? 'bg-text-primary' : 'bg-text-dim')} />
                            <span>{preset.name}</span>
                          </span>
                          {isAvailableOnHost ? (
                            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-mono">
                              Installed
                            </span>
                          ) : (
                            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-md bg-well border border-border text-text-muted font-mono">
                              Available
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-text-secondary mb-1.5 font-medium">
                          {detected?.version || preset.model}
                        </div>
                        <p className="text-[11.5px] text-text-muted leading-snug">
                          {preset.description}
                        </p>
                      </div>

                      <div className="mt-4 pt-2.5 border-t border-border flex items-center justify-between text-[10.5px]">
                        <span className="text-text-dim font-mono uppercase font-bold tracking-wider">{preset.provider}</span>
                        <div className={clsx(
                          'w-4 h-4 rounded-full border flex items-center justify-center transition-all',
                          isSelected 
                            ? 'border-text-primary bg-text-primary text-background font-bold shadow-sm' 
                            : 'border-border group-hover:border-border-hover'
                        )}>
                          {isSelected && <Check size={10} strokeWidth={3.5} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedProvider === 'custom' && (
                <div className="p-3.5 bg-well rounded-panel border border-border mt-1 space-y-2.5">
                  <h4 className="text-xs font-bold text-text-primary font-mono uppercase">Custom Agent Adapter Configuration</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Agent Name (e.g. Aider, Cursor CLI)"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                    />
                    <Input
                      placeholder="Model (e.g. Qwen 2.5 Coder 32B)"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={() => setAddAgentOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleNextStep}
                  className="gap-1.5 font-mono text-xs font-bold"
                >
                  <span>Configure & Spawn</span>
                  <ArrowRight size={13} />
                </Button>
              </div>
            </div>
          ) : (
            /* STEP 2: Configure Account Profile & Launch */
            <div className="flex flex-col gap-4 py-1">
              
              {/* Selected Agent Summary Banner */}
              <div className="p-3.5 rounded-2xl bg-panel-elevated border border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-well border border-border flex items-center justify-center text-text-primary font-mono font-bold text-xs">
                    {selectedProvider[0].toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-xs text-text-primary uppercase">
                      {selectedPreset?.name || selectedProvider}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      {selectedPreset?.model || 'Default Model'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-well border border-border text-text-secondary font-bold uppercase">
                  Step 2 of 2
                </span>
              </div>

              {/* Profile Account Picker Card */}
              <div className="p-4 rounded-2xl bg-well border border-border flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono font-bold text-xs text-text-primary">Profile / Account Context</span>
                  <span className="text-[11.5px] text-text-muted">
                    Each profile maintains an isolated login token and auth sandbox in Orbit.
                  </span>
                </div>

                {!isCreatingNewProfile ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
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
                      className="flex-1 px-3 py-2 rounded-xl bg-panel border border-border text-text-primary font-mono text-xs focus:outline-none focus:border-border-hover cursor-pointer"
                    >
                      {existingProfiles.map((p) => (
                        <option key={p} value={p}>
                          {p === 'default' ? 'default (Main Global Login)' : `Profile: ${p}`}
                        </option>
                      ))}
                      <option value="__NEW__">+ Create New Account Profile…</option>
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Enter profile name (e.g. work, client-a)"
                      value={customProfile}
                      onChange={(e) => setCustomProfile(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      autoFocus
                      className="flex-1 px-3 py-2 rounded-xl bg-panel border border-border text-text-primary font-mono text-xs placeholder:text-text-dim focus:outline-none focus:border-border-hover transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewProfile(false);
                        setCustomProfile('default');
                      }}
                      className="px-3 py-2 rounded-xl text-text-muted hover:text-text-primary text-xs font-mono hover:bg-panel transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSpawn}
                  isLoading={isSubmitting}
                  className="font-mono text-xs font-bold"
                >
                  Spawn in Workspace
                </Button>
              </div>
            </div>
          )}
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
