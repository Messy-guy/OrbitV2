import React, { useState } from 'react';
import { Target, CheckCircle2, AlertTriangle, FileCode, BookmarkPlus, Plus, X, ArrowRight, History, Layers } from 'lucide-react';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export const ContextPanel: React.FC = () => {
  const { currentContext, checkpoints, handoffHistory, addDecision, addIssue, updateCurrentTask, updateProgress, gitState } = useContextStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { setCreateCheckpointOpen, setActiveBottomPanel, setShareContextOpen } = useUIStore();

  const [activeTab, setActiveTab] = useState<'context' | 'checkpoints' | 'handoffs'>('context');
  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [showAddDecision, setShowAddDecision] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [taskInput, setTaskInput] = useState('');

  if (!currentContext) {
    return (
      <div className="h-72 flex items-center justify-center text-xs text-text-muted font-mono surface-well">
        No project context initialized.
      </div>
    );
  }

  const handleSaveTask = async () => {
    if (taskInput.trim() && activeWorkspaceId) {
      await updateCurrentTask(activeWorkspaceId, taskInput.trim());
      setIsEditingTask(false);
    }
  };

  const handleAddDecision = async () => {
    if (!newDecisionTitle.trim() || !activeWorkspaceId) return;
    await addDecision(activeWorkspaceId, {
      title: newDecisionTitle.trim(),
      authorAgent: 'USER'
    });
    setNewDecisionTitle('');
    setShowAddDecision(false);
  };

  const handleAddIssue = async () => {
    if (!newIssueTitle.trim() || !activeWorkspaceId) return;
    await addIssue(activeWorkspaceId, {
      title: newIssueTitle.trim(),
      severity: 'warning',
      status: 'open'
    });
    setNewIssueTitle('');
    setShowAddIssue(false);
  };

  return (
    <div className="h-80 bg-canvas-chrome border-t border-border flex flex-col overflow-hidden text-xs select-none shadow-dock font-mono">
      {/* Panel Header with Tabs */}
      <div className="h-8 px-3 bg-panel border-b border-border flex items-center justify-between font-mono">
        <div className="flex items-center gap-3">
          <span className="uppercase tracking-wider text-text-primary font-bold text-[10.5px]">
            PROJECT CONTEXT LAYER
          </span>

          <div className="flex items-center gap-1 bg-well p-0.5 rounded-btn border border-border">
            <button
              onClick={() => setActiveTab('context')}
              className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold transition-colors ${
                activeTab === 'context' ? 'bg-panel text-text-primary shadow-subtle' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Live Context
            </button>
            <button
              onClick={() => setActiveTab('checkpoints')}
              className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold transition-colors ${
                activeTab === 'checkpoints' ? 'bg-panel text-text-primary shadow-subtle' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Checkpoints ({checkpoints.length})
            </button>
            <button
              onClick={() => setActiveTab('handoffs')}
              className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold transition-colors ${
                activeTab === 'handoffs' ? 'bg-panel text-text-primary shadow-subtle' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Handoff History ({handoffHistory.length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="secondary"
            onClick={() => setCreateCheckpointOpen(true)}
            className="h-5 text-[9.5px] gap-1 font-mono tracking-wider font-bold"
          >
            <BookmarkPlus size={11} />
            <span>+ Checkpoint</span>
          </Button>

          <Button
            size="xs"
            variant="primary"
            onClick={() => setShareContextOpen(true)}
            className="h-5 text-[9.5px] gap-1 font-mono tracking-wider font-bold"
          >
            <ArrowRight size={11} />
            <span>Share Context</span>
          </Button>

          <button
            onClick={() => setActiveBottomPanel(null)}
            className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-panel-hover transition-colors ml-1"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Tab 1: Live Context Grid */}
      {activeTab === 'context' && (
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 md:grid-cols-4 gap-2.5">
          {/* Col 1: Current Task & Progress */}
          <div className="space-y-2 surface-well p-3 rounded-panel flex flex-col justify-between border border-border">
            <div>
              <div className="flex items-center justify-between text-text-dim uppercase text-[9px] font-bold mb-1 tracking-wider">
                <span className="flex items-center gap-1 text-text-primary">
                  <Target size={11} />
                  <span>Current Task</span>
                </span>
                <button
                  onClick={() => {
                    setTaskInput(currentContext.currentTask || currentContext.goal);
                    setIsEditingTask(!isEditingTask);
                  }}
                  className="text-text-muted hover:text-text-primary text-[9px]"
                >
                  {isEditingTask ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {isEditingTask ? (
                <div className="space-y-1.5">
                  <textarea
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    rows={2}
                    className="w-full surface-elevated rounded-btn p-1.5 text-xs text-text-primary focus:outline-none font-sans"
                  />
                  <Button size="xs" variant="primary" onClick={handleSaveTask}>Save</Button>
                </div>
              ) : (
                <p className="font-medium text-text-primary text-[12px] leading-snug font-sans">
                  {currentContext.currentTask || currentContext.goal}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-text-muted text-[10px] mb-1 font-mono">
                <span className="text-text-dim uppercase tracking-wider font-bold">Progress</span>
                <span className="text-text-primary font-bold">{currentContext.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-panel rounded-full overflow-hidden border border-border-subtle">
                <div
                  className="h-full bg-status-success transition-all duration-300 rounded-full"
                  style={{ width: `${currentContext.progress}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border-subtle text-[10px] text-text-muted font-mono flex items-center justify-between">
              <span className="text-text-dim">Git Branch:</span>
              <span className="text-text-primary font-bold">{gitState?.currentBranch || 'main'}</span>
            </div>
          </div>

          {/* Col 2: Architectural Decisions */}
          <div className="space-y-2 surface-well p-3 rounded-panel flex flex-col border border-border">
            <div className="flex items-center justify-between text-text-dim uppercase text-[9px] font-bold tracking-wider">
              <span className="flex items-center gap-1.5 text-text-primary">
                <CheckCircle2 size={11} className="text-status-success" />
                <span>Decisions ({currentContext.decisions.length})</span>
              </span>
              <button
                onClick={() => setShowAddDecision(!showAddDecision)}
                className="text-text-muted hover:text-text-primary p-0.5 rounded btn-base"
              >
                <Plus size={11} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 font-mono">
              {showAddDecision && (
                <div className="p-2 surface-elevated rounded-btn border border-border space-y-1.5 mb-1 shadow-subtle">
                  <Input
                    placeholder="Decision title..."
                    value={newDecisionTitle}
                    onChange={(e) => setNewDecisionTitle(e.target.value)}
                    className="text-xs py-1"
                  />
                  <div className="flex justify-end gap-1">
                    <Button size="xs" variant="ghost" onClick={() => setShowAddDecision(false)}>Cancel</Button>
                    <Button size="xs" variant="primary" onClick={handleAddDecision}>Add</Button>
                  </div>
                </div>
              )}

              {currentContext.decisions.map((d) => (
                <div key={d.id} className="p-1.5 rounded-btn surface-well-subtle text-[11px] border border-border-subtle">
                  <div className="text-text-primary font-medium">• {d.title}</div>
                  {d.description && <div className="text-text-muted text-[10px] mt-0.5 pl-2 font-sans">{d.description}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Col 3: Known Issues */}
          <div className="space-y-2 surface-well p-3 rounded-panel flex flex-col border border-border">
            <div className="flex items-center justify-between text-text-dim uppercase text-[9px] font-bold tracking-wider">
              <span className="flex items-center gap-1.5 text-status-warning">
                <AlertTriangle size={11} />
                <span>Known Issues ({currentContext.issues.length})</span>
              </span>
              <button
                onClick={() => setShowAddIssue(!showAddIssue)}
                className="text-text-muted hover:text-text-primary p-0.5 rounded btn-base"
              >
                <Plus size={11} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 font-mono">
              {showAddIssue && (
                <div className="p-2 surface-elevated rounded-btn border border-border space-y-1.5 mb-1 shadow-subtle">
                  <Input
                    placeholder="Issue title..."
                    value={newIssueTitle}
                    onChange={(e) => setNewIssueTitle(e.target.value)}
                    className="text-xs py-1"
                  />
                  <div className="flex justify-end gap-1">
                    <Button size="xs" variant="ghost" onClick={() => setShowAddIssue(false)}>Cancel</Button>
                    <Button size="xs" variant="primary" onClick={handleAddIssue}>Add</Button>
                  </div>
                </div>
              )}

              {currentContext.issues.map((iss) => (
                <div key={iss.id} className="p-1.5 rounded-btn surface-well-subtle text-[11px] flex items-start gap-1.5 border border-border-subtle">
                  <span className="text-status-warning mt-0.5 font-bold">!</span>
                  <div className="flex-1">
                    <span className="text-text-primary font-medium">{iss.title}</span>
                    <div className="text-[9px] text-text-dim uppercase mt-0.5 font-bold">
                      {iss.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Col 4: Changed Files from Git */}
          <div className="space-y-2 surface-well p-3 rounded-panel flex flex-col border border-border">
            <div className="flex items-center justify-between text-text-dim uppercase text-[9px] font-bold tracking-wider">
              <span className="flex items-center gap-1.5 text-text-primary">
                <FileCode size={11} className="text-text-muted" />
                <span>Changed Files ({gitState?.modifiedFiles.length || currentContext.relevantFiles.length})</span>
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px] pr-0.5">
              {(gitState?.modifiedFiles && gitState.modifiedFiles.length > 0) ? (
                gitState.modifiedFiles.map((f, i) => (
                  <div key={i} className="p-1.5 rounded-btn surface-well-subtle text-text-primary flex items-center justify-between border border-border-subtle">
                    <span className="truncate text-text-secondary pr-1">• {f.path}</span>
                    <span className="text-[8.5px] text-status-warning font-bold px-1 rounded bg-panel uppercase">{f.status}</span>
                  </div>
                ))
              ) : (
                currentContext.relevantFiles.map((file, i) => (
                  <div key={i} className="p-1.5 rounded-btn surface-well-subtle text-text-primary flex items-center justify-between border border-border-subtle">
                    <span className="truncate text-text-secondary">• {file}</span>
                    <span className="text-[8.5px] text-text-muted font-bold px-1 rounded bg-panel">REF</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Checkpoint History */}
      {activeTab === 'checkpoints' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {checkpoints.length === 0 ? (
            <div className="text-center py-8 text-text-dim">No checkpoints saved yet for this workspace.</div>
          ) : (
            checkpoints.map((chk) => (
              <div key={chk.id} className="p-3 surface-well rounded-panel border border-border flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary text-[12px]">{chk.name}</span>
                    {chk.agentName && (
                      <span className="px-1.5 py-0.2 rounded-badge bg-panel text-text-muted text-[9.5px]">
                        {chk.agentName}
                      </span>
                    )}
                  </div>
                  <p className="text-text-secondary text-[11.5px] font-sans">{chk.progress}</p>
                  {chk.decisions.length > 0 && (
                    <div className="text-[10px] text-text-muted">
                      Decisions: {chk.decisions.join(' · ')}
                    </div>
                  )}
                  {chk.changedFiles.length > 0 && (
                    <div className="text-[10px] text-text-dim">
                      Files: {chk.changedFiles.map((f) => f.path).join(', ')}
                    </div>
                  )}
                </div>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => setShareContextOpen(true, chk.agentId)}
                  className="gap-1 text-[10px]"
                >
                  <ArrowRight size={10} />
                  <span>Share</span>
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Handoff History */}
      {activeTab === 'handoffs' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {handoffHistory.length === 0 ? (
            <div className="text-center py-8 text-text-dim">No context handoffs recorded yet.</div>
          ) : (
            handoffHistory.map((h) => (
              <div key={h.id} className="p-3 surface-well rounded-panel border border-border flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary text-[11.5px]">{h.sourceAgentName}</span>
                    <ArrowRight size={12} className="text-text-dim" />
                    <span className="font-bold text-text-primary text-[11.5px]">{h.targetAgentName}</span>
                    <span className="text-[9.5px] text-status-success uppercase font-bold px-1.5 py-0.2 rounded bg-status-success/10">
                      {h.status}
                    </span>
                  </div>
                  <p className="text-text-secondary text-[11px] font-sans">{h.task}</p>
                  <div className="text-[10px] text-text-dim">
                    Package: {h.contextPackage.decisions.length} decisions, {h.contextPackage.changedFiles.length} files (~{h.contextPackage.estimatedTokens} tokens)
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
