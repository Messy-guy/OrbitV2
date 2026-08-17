import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { AVAILABLE_AGENT_PRESETS } from '../../mock/agents';
import { AgentProvider } from '../../types/orbit';
import { clsx } from 'clsx';

export const AddAgentModal: React.FC = () => {
  const { isAddAgentOpen, setAddAgentOpen } = useUIStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { addAgent } = useAgentStore();

  const [selectedProvider, setSelectedProvider] = useState<AgentProvider>('antigravity');
  const [customName, setCustomName] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!activeWorkspaceId) return;
    setIsSubmitting(true);
    try {
      await addAgent(
        activeWorkspaceId,
        selectedProvider,
        selectedProvider === 'custom' ? customName.trim() || 'Custom Agent' : undefined,
        selectedProvider === 'custom' ? customModel.trim() || 'Local LLM' : undefined
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
      title="Add Agent"
      subtitle="Select an AI coding agent to connect to this workspace"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {AVAILABLE_AGENT_PRESETS.map((preset) => {
            const isSelected = selectedProvider === preset.provider;
            return (
              <div
                key={preset.provider}
                onClick={() => setSelectedProvider(preset.provider)}
                className={clsx(
                  'p-3.5 rounded-panel border cursor-pointer transition-all flex flex-col justify-between select-none group',
                  isSelected
                    ? 'bg-panel-elevated border-border-highlight shadow-elevated'
                    : 'bg-panel border-border hover:border-border-hover hover:bg-panel-hover'
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs tracking-wider uppercase text-text-primary font-mono">
                      {preset.name}
                    </span>
                    <Badge variant="success" dot className="text-[9.5px] uppercase font-bold">
                      Connected
                    </Badge>
                  </div>
                  <div className="text-[11px] font-mono text-text-secondary mb-1">
                    {preset.model}
                  </div>
                  <p className="text-[11.5px] text-text-muted leading-snug">
                    {preset.description}
                  </p>
                </div>

                <div className="mt-3.5 pt-2 border-t border-border flex items-center justify-between text-[10.5px]">
                  <span className="text-text-dim font-mono uppercase font-bold">{preset.provider}</span>
                  <div className={clsx(
                    'w-4 h-4 rounded-full border flex items-center justify-center transition-colors',
                    isSelected ? 'border-white bg-white text-canvas-chrome font-bold' : 'border-border-hover group-hover:border-border-highlight'
                  )}>
                    {isSelected && <Check size={10} strokeWidth={3.5} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedProvider === 'custom' && (
          <div className="p-3.5 surface-well rounded-panel border border-border mt-1 space-y-2.5">
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
            Add Agent to Workspace
          </Button>
        </div>
      </div>
    </Modal>
  );
};
