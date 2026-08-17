import React, { useState } from 'react';
import { Bot, Check, Sparkles, Plus, Terminal } from 'lucide-react';
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
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {AVAILABLE_AGENT_PRESETS.map((preset) => {
            const isSelected = selectedProvider === preset.provider;
            return (
              <div
                key={preset.provider}
                onClick={() => setSelectedProvider(preset.provider)}
                className={clsx(
                  'p-3.5 rounded-panel border cursor-pointer transition-all duration-150 flex flex-col justify-between select-none group',
                  isSelected
                    ? 'bg-panel-elevated border-accent shadow-sm ring-1 ring-accent/30'
                    : 'bg-background-secondary border-border/80 hover:border-border-hover hover:bg-panel'
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs tracking-wider uppercase text-text-primary">
                      {preset.name}
                    </span>
                    <Badge variant="success" dot className="text-[10px]">
                      Connected
                    </Badge>
                  </div>
                  <div className="text-[11px] font-mono text-accent/90 mb-1">
                    {preset.model}
                  </div>
                  <p className="text-[11px] text-text-secondary leading-snug">
                    {preset.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted font-mono uppercase">{preset.provider}</span>
                  <div className={clsx(
                    'w-4 h-4 rounded-full border flex items-center justify-center transition-colors',
                    isSelected ? 'border-accent bg-accent text-background' : 'border-border group-hover:border-text-muted'
                  )}>
                    {isSelected && <Check size={10} strokeWidth={3} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedProvider === 'custom' && (
          <div className="p-3 bg-panel-elevated/80 rounded-panel border border-border mt-2 space-y-2.5">
            <h4 className="text-xs font-semibold text-text-primary">Custom Agent Adapter Configuration</h4>
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

        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border/80">
          <Button
            variant="ghost"
            onClick={() => setAddAgentOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={handleAdd}
            isLoading={isSubmitting}
            className="shadow-accent-glow"
          >
            Add Agent to Workspace
          </Button>
        </div>
      </div>
    </Modal>
  );
};
