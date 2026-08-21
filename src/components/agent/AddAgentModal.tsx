import React, { useState, useEffect } from 'react';
import { Check, CheckCircle2, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { AVAILABLE_AGENT_PRESETS } from '../../mock/agents';
import { AgentProvider } from '../../types/orbit';
import { agentService, DetectedAgentDto } from '../../services';
import { useAuthStore } from '../../stores/auth.store';
import { ProUpgradeModal } from './ProUpgradeModal';
import { clsx } from 'clsx';

export const AddAgentModal: React.FC = () => {
  const { isAddAgentOpen, setAddAgentOpen } = useUIStore();
  const { activeWorkspaceId, getActiveWorkspace, activeSpaceIdByProject } = useWorkspaceStore();
  const { addAgent, agents } = useAgentStore();
  const { user } = useAuthStore();

  const [selectedProvider, setSelectedProvider] = useState<AgentProvider>('antigravity');
  const [customName, setCustomName] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [detectedAgents, setDetectedAgents] = useState<DetectedAgentDto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);

  const isPro = user?.plan === 'PRO';
  const maxAllowedSlots = isPro ? 999 : 2;
  const currentRunningAgents = agents.filter(a => a.status === 'running' || a.status === 'idle').length;

  const activeWorkspace = getActiveWorkspace();
  const activeSpaceId = (activeWorkspace && activeSpaceIdByProject[activeWorkspace.id]) || activeWorkspace?.spaces?.[0]?.id || `space-${activeWorkspace?.id}-1`;

  useEffect(() => {
    if (isAddAgentOpen) {
      agentService.detectInstalledAgents().then((res) => {
        setDetectedAgents(res);
      }).catch(() => {});
    }
  }, [isAddAgentOpen]);

  const handleAdd = async () => {
    if (!activeWorkspaceId) return;

    // Check slot limit for Free users
    if (!isPro && currentRunningAgents >= maxAllowedSlots) {
      setAddAgentOpen(false);
      setIsProModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await addAgent(
        activeWorkspaceId,
        selectedProvider,
        selectedProvider === 'custom' ? customName.trim() || 'Custom Agent' : undefined,
        selectedProvider === 'custom' ? customModel.trim() || 'Local LLM' : undefined,
        activeWorkspace?.projectPath,
        activeSpaceId
      );
      setAddAgentOpen(false);
      setCustomName('');
      setCustomModel('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isAddAgentOpen}
      onClose={() => setAddAgentOpen(false)}
      title="Add Agent / Terminal Harness"
      subtitle="Select a local AI coding CLI or interactive shell to spawn in this workspace"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-3.5 font-sans">
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
            onClick={handleAdd}
            isLoading={isSubmitting}
          >
            Spawn in Workspace
          </Button>
        </div>
      </div>
    </Modal>
  );
};
