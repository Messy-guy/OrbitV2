import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';

export const CreateCheckpointModal: React.FC = () => {
  const { isCreateCheckpointOpen, setCreateCheckpointOpen, selectedAgentForModal } = useUIStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { createCheckpoint } = useContextStore();

  const [name, setName] = useState('Playlist sync — reconnect investigation');
  const [summary, setSummary] = useState('WebSocket implementation complete. Reconnect synchronization remains broken.');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !activeWorkspaceId) return;

    setIsSubmitting(true);
    try {
      await createCheckpoint(activeWorkspaceId, name.trim(), summary.trim(), selectedAgentForModal || undefined);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setCreateCheckpointOpen(false);
      }, 1000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isCreateCheckpointOpen}
      onClose={() => setCreateCheckpointOpen(false)}
      title="Create Checkpoint"
      subtitle="Save a milestone snapshot of the current project state and decisions"
      maxWidth="md"
    >
      {isSuccess ? (
        <div className="py-8 flex flex-col items-center justify-center text-center font-mono">
          <div className="w-12 h-12 rounded-full surface-well border border-status-success/40 text-status-success flex items-center justify-center mb-3">
            <Check size={24} strokeWidth={3} />
          </div>
          <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">Checkpoint Created</h4>
          <p className="text-xs text-text-muted mt-1 font-sans">Project memory state has been saved.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-mono">
          <div>
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wider mb-1.5 block">
              Checkpoint Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Auth module finished, Socket refactor"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wider mb-1.5 block">
              Summary of Progress & State
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Describe current milestone achievements, architectural changes, or open blockers..."
              className="w-full surface-well rounded-btn px-3 py-2 text-[12px] text-text-primary placeholder:text-text-dim focus:outline-none focus:border-border-highlight resize-none font-sans"
            />
          </div>

          <div className="flex items-center justify-end gap-2 mt-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateCheckpointOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="tracking-wider font-bold"
            >
              Create Checkpoint
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
