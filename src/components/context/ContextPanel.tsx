import React, { useState } from 'react';
import { Target, CheckCircle2, AlertTriangle, FileCode, BookmarkPlus, Plus, X } from 'lucide-react';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export const ContextPanel: React.FC = () => {
  const { currentContext, addDecision, addIssue } = useContextStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { setCreateCheckpointOpen, setActiveBottomPanel } = useUIStore();

  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [showAddDecision, setShowAddDecision] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [showAddIssue, setShowAddIssue] = useState(false);

  if (!currentContext) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-text-muted font-mono surface-well">
        No context initialized.
      </div>
    );
  }

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
    <div className="h-72 bg-canvas-chrome border-t border-border flex flex-col overflow-hidden text-xs select-none shadow-dock">
      {/* Panel Header */}
      <div className="h-7 px-3 bg-panel border-b border-border flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-text-primary font-bold text-[10px]">
            Project Context & Memory
          </span>
          <span className="text-[9px] text-text-muted px-1.5 py-0.2 rounded-badge bg-well border border-border-subtle font-bold">
            ● SYNCED
          </span>
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
          <button
            onClick={() => setActiveBottomPanel(null)}
            className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-panel-hover transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 md:grid-cols-4 gap-2.5 font-mono">
        {/* Column 1: Objective & Progress */}
        <div className="space-y-2.5 surface-well p-3 rounded-panel flex flex-col justify-between border-border">
          <div>
            <div className="flex items-center gap-1.5 text-text-dim uppercase text-[9px] font-bold mb-1 tracking-wider">
              <Target size={11} className="text-text-primary" />
              <span>Objective</span>
            </div>
            <p className="font-medium text-text-primary text-[12px] leading-snug font-sans">
              {currentContext.goal}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-text-muted text-[10px] mb-1 font-mono">
              <span className="text-text-dim uppercase tracking-wider font-bold">Progress</span>
              <span className="text-text-primary font-bold">{currentContext.progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-panel rounded-full overflow-hidden border border-border-subtle">
              <div
                className="h-full bg-text-primary transition-all duration-300 rounded-full"
                style={{ width: `${currentContext.progress}%` }}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-border-subtle text-[10px] text-text-muted font-mono flex items-center justify-between">
            <span className="text-text-dim">Checkpoint:</span>
            <span className="text-text-secondary font-bold">{currentContext.lastCheckpointTime || 'None'}</span>
          </div>
        </div>

        {/* Column 2: Architectural Decisions */}
        <div className="space-y-2 surface-well p-3 rounded-panel flex flex-col border-border">
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

            {currentContext.decisions.map(d => (
              <div key={d.id} className="p-1.5 rounded-btn surface-well-subtle text-[11px] border-border-subtle">
                <div className="text-text-primary font-medium">• {d.title}</div>
                {d.description && <div className="text-text-muted text-[10px] mt-0.5 pl-2 font-sans">{d.description}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Known Issues */}
        <div className="space-y-2 surface-well p-3 rounded-panel flex flex-col border-border">
          <div className="flex items-center justify-between text-text-dim uppercase text-[9px] font-bold tracking-wider">
            <span className="flex items-center gap-1.5 text-status-warning">
              <AlertTriangle size={11} />
              <span>Issues ({currentContext.issues.length})</span>
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

            {currentContext.issues.map(iss => (
              <div key={iss.id} className="p-1.5 rounded-btn surface-well-subtle text-[11px] flex items-start gap-1.5 border-border-subtle">
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

        {/* Column 4: Relevant Files */}
        <div className="space-y-2 surface-well p-3 rounded-panel flex flex-col border-border">
          <div className="flex items-center justify-between text-text-dim uppercase text-[9px] font-bold tracking-wider">
            <span className="flex items-center gap-1.5 text-text-primary">
              <FileCode size={11} className="text-text-muted" />
              <span>Files ({currentContext.relevantFiles.length})</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px] pr-0.5">
            {currentContext.relevantFiles.map((file, i) => (
              <div key={i} className="p-1.5 rounded-btn surface-well-subtle text-text-primary flex items-center justify-between border-border-subtle">
                <span className="truncate text-text-secondary">• {file}</span>
                <span className="text-[8.5px] text-text-muted font-bold px-1 rounded bg-panel border border-border">MOD</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
