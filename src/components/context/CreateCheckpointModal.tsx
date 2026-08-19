import React, { useState, useEffect } from 'react';
import { Check, RefreshCw, Plus, Trash2, FolderGit2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAgentStore } from '../../stores/agent.store';
import { useUIStore } from '../../stores/ui.store';
import { ChangedFileItem } from '../../types/orbit';

export const CreateCheckpointModal: React.FC = () => {
  const { isCreateCheckpointOpen, setCreateCheckpointOpen, selectedAgentForModal } = useUIStore();
  const { activeWorkspaceId, getActiveWorkspace } = useWorkspaceStore();
  const { agents } = useAgentStore();
  const { currentContext, gitState, createCheckpoint, loadGitState } = useContextStore();

  const activeWorkspace = getActiveWorkspace();
  const sourceAgent = agents.find((a) => a.id === selectedAgentForModal) || agents[0];

  const [name, setName] = useState('Checkpoint #7 — WebSocket Reconnect');
  const [task, setTask] = useState('Fix playlist synchronization and socket reconnect handshake');
  const [progress, setProgress] = useState('WebSocket reconnect logic implemented with exponential jitter backoff');
  const [decisions, setDecisions] = useState<string[]>([
    'Zustand store used for client playlist state slice',
    'WebSocket protocol version negotiation handshake used for reconnection',
  ]);
  const [newDecision, setNewDecision] = useState('');
  const [knownIssues, setKnownIssues] = useState<string[]>([
    'Reconnect state is not persisted in local storage on page refresh',
  ]);
  const [newIssue, setNewIssue] = useState('');
  const [notes, setNotes] = useState('Ready for verification tests');
  const [changedFiles, setChangedFiles] = useState<ChangedFileItem[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isCreateCheckpointOpen) {
      if (currentContext) {
        if (currentContext.currentTask) setTask(currentContext.currentTask);
        if (currentContext.decisions.length > 0) {
          setDecisions(currentContext.decisions.map((d) => d.title));
        }
        if (currentContext.issues.length > 0) {
          setKnownIssues(currentContext.issues.map((i) => i.title));
        }
      }
      if (activeWorkspace?.projectPath) {
        loadGitState(activeWorkspace.projectPath).then((git) => {
          if (git && git.modifiedFiles.length > 0) {
            setChangedFiles(git.modifiedFiles);
          } else {
            setChangedFiles([
              { path: 'src/store/playlist.store.ts', status: 'modified' },
              { path: 'src/socket/playlist.socket.ts', status: 'modified' },
            ]);
          }
        }).catch(() => {});
      }
    }
  }, [isCreateCheckpointOpen]);

  const handleAutoDetectFiles = async () => {
    if (activeWorkspace?.projectPath) {
      const git = await loadGitState(activeWorkspace.projectPath);
      if (git && git.modifiedFiles.length > 0) {
        setChangedFiles(git.modifiedFiles);
      }
    }
  };

  const handleAddDecision = () => {
    if (newDecision.trim()) {
      setDecisions((prev) => [...prev, newDecision.trim()]);
      setNewDecision('');
    }
  };

  const handleRemoveDecision = (idx: number) => {
    setDecisions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddIssue = () => {
    if (newIssue.trim()) {
      setKnownIssues((prev) => [...prev, newIssue.trim()]);
      setNewIssue('');
    }
  };

  const handleRemoveIssue = (idx: number) => {
    setKnownIssues((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !activeWorkspaceId) return;

    setIsSubmitting(true);
    try {
      await createCheckpoint({
        workspaceId: activeWorkspaceId,
        name: name.trim(),
        task: task.trim(),
        progress: progress.trim(),
        decisions,
        knownIssues,
        notes: notes.trim() || undefined,
        changedFiles,
        agentId: sourceAgent?.id,
        agentName: sourceAgent?.name,
      });

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setCreateCheckpointOpen(false);
      }, 900);
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
      title="Save Project Checkpoint"
      subtitle="Record a structured snapshot of the current state, progress, and architectural decisions"
      maxWidth="lg"
    >
      {isSuccess ? (
        <div className="py-8 flex flex-col items-center justify-center text-center font-mono">
          <div className="w-12 h-12 rounded-full surface-well border border-status-success/40 text-status-success flex items-center justify-center mb-3">
            <Check size={24} strokeWidth={3} />
          </div>
          <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">Checkpoint Saved</h4>
          <p className="text-xs text-text-muted mt-1 font-sans">Project context has been updated and persisted locally.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-mono text-xs">
          {/* Checkpoint Name */}
          <div>
            <label className="text-[10.5px] font-bold text-text-dim uppercase tracking-wider mb-1 block">
              Checkpoint Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Checkpoint #7 — Socket Refactor"
              autoFocus
            />
          </div>

          {/* Current Task */}
          <div>
            <label className="text-[10.5px] font-bold text-text-dim uppercase tracking-wider mb-1 block">
              Current Task
            </label>
            <Input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="What task was being worked on?"
            />
          </div>

          {/* Progress */}
          <div>
            <label className="text-[10.5px] font-bold text-text-dim uppercase tracking-wider mb-1 block">
              Progress & Milestone Summary
            </label>
            <textarea
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              rows={2}
              placeholder="Summary of what was completed and verified..."
              className="w-full surface-well rounded-btn px-3 py-2 text-[12px] text-text-primary placeholder:text-text-dim focus:outline-none focus:border-border-highlight resize-none font-sans"
            />
          </div>

          {/* Decisions */}
          <div>
            <label className="text-[10.5px] font-bold text-text-dim uppercase tracking-wider mb-1 block">
              Architectural Decisions ({decisions.length})
            </label>
            <div className="space-y-1 mb-1.5 max-h-24 overflow-y-auto">
              {decisions.map((dec, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 surface-well rounded-btn text-[11px] text-text-primary">
                  <span className="truncate pr-2">• {dec}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDecision(i)}
                    className="text-text-dim hover:text-status-error p-0.5"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                value={newDecision}
                onChange={(e) => setNewDecision(e.target.value)}
                placeholder="Add new decision..."
                className="text-[11px] py-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDecision();
                  }
                }}
              />
              <Button type="button" size="xs" variant="secondary" onClick={handleAddDecision}>
                <Plus size={11} />
              </Button>
            </div>
          </div>

          {/* Known Issues */}
          <div>
            <label className="text-[10.5px] font-bold text-text-dim uppercase tracking-wider mb-1 block">
              Known Issues & Blockers ({knownIssues.length})
            </label>
            <div className="space-y-1 mb-1.5 max-h-20 overflow-y-auto">
              {knownIssues.map((iss, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 surface-well rounded-btn text-[11px] text-status-warning">
                  <span className="truncate pr-2">⚠ {iss}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveIssue(i)}
                    className="text-text-dim hover:text-status-error p-0.5"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                value={newIssue}
                onChange={(e) => setNewIssue(e.target.value)}
                placeholder="Add known issue..."
                className="text-[11px] py-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddIssue();
                  }
                }}
              />
              <Button type="button" size="xs" variant="secondary" onClick={handleAddIssue}>
                <Plus size={11} />
              </Button>
            </div>
          </div>

          {/* Changed Files with Auto-detect */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10.5px] font-bold text-text-dim uppercase tracking-wider block">
                Changed / Relevant Files ({changedFiles.length})
              </label>
              <button
                type="button"
                onClick={handleAutoDetectFiles}
                className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
              >
                <RefreshCw size={10} />
                <span>Auto-detect from Git</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1 p-2 surface-well rounded-btn max-h-20 overflow-y-auto">
              {changedFiles.length > 0 ? (
                changedFiles.map((f, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-badge bg-panel border border-border text-[10.5px] text-text-secondary flex items-center gap-1">
                    <FolderGit2 size={10} className="text-text-dim" />
                    <span>{f.path}</span>
                    <span className="text-[9px] text-text-dim uppercase">({f.status})</span>
                  </span>
                ))
              ) : (
                <span className="text-text-dim text-[10.5px]">No modified files detected in Git worktree.</span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10.5px] font-bold text-text-dim uppercase tracking-wider mb-1 block">
              Additional Notes (Optional)
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instructions or tips for the next agent..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-border">
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
              Save Checkpoint
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
