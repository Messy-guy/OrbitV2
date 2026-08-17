import React, { useState } from 'react';
import { Target, CheckCircle2, AlertTriangle, FileCode, BookmarkPlus, Plus, X } from 'lucide-react';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
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
      <div className="h-64 flex items-center justify-center text-xs text-text-muted font-mono">
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
    <div className="h-72 bg-panel-elevated border-t border-border flex flex-col overflow-hidden text-xs select-none">
      {/* Panel Header */}
      <div className="h-7 px-3 bg-background-secondary border-b border-border flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-text-secondary font-bold text-[10px]">
            Project Context & Memory
          </span>
          <span className="text-[9px] text-accent px-1.5 py-0.2 rounded bg-accent/10 border border-accent/20">
            SYNCED
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="secondary"
            onClick={() => setCreateCheckpointOpen(true)}
            className="h-5 text-[10px] gap-1 font-mono"
          >
            <BookmarkPlus size={11} />
            <span>+ Checkpoint</span>
          </Button>
          <button
            onClick={() => setActiveBottomPanel(null)}
            className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-panel"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto p-3.5 grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Column 1: Objective & Progress */}
        <div className="space-y-3 bg-panel p-3 rounded border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-text-muted uppercase text-[9px] font-mono font-bold mb-1">
              <Target size={11} className="text-accent" />
              <span>Objective</span>
            </div>
            <p className="font-medium text-text-primary text-[12px] leading-snug">
              {currentContext.goal}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-text-muted text-[10px] mb-1 font-mono">
              <span>PROGRESS</span>
              <span className="text-accent font-bold">{currentContext.progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-background rounded-full overflow-hidden border border-border-subtle">
              <div
                className="h-full bg-accent transition-all duration-300 rounded-full"
                style={{ width: `${currentContext.progress}%` }}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-border text-[10px] text-text-muted font-mono flex items-center justify-between">
            <span>Last Checkpoint:</span>
            <span className="text-text-secondary">{currentContext.lastCheckpointTime || 'None'}</span>
          </div>
        </div>

        {/* Column 2: Architectural Decisions */}
        <div className="space-y-2 bg-panel p-3 rounded border border-border flex flex-col">
          <div className="flex items-center justify-between text-text-muted uppercase text-[9px] font-mono font-bold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-status-success" />
              Decisions ({currentContext.decisions.length})
            </span>
            <button
              onClick={() => setShowAddDecision(!showAddDecision)}
              className="text-text-muted hover:text-text-primary p-0.5"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 font-mono">
            {showAddDecision && (
              <div className="p-2 bg-background rounded border border-border space-y-1 mb-1">
                <Input
                  placeholder="Decision title..."
                  value={newDecisionTitle}
                  onChange={(e) => setNewDecisionTitle(e.target.value)}
                  className="text-xs py-1"
                />
                <div className="flex justify-end gap-1">
                  <Button size="xs" variant="ghost" onClick={() => setShowAddDecision(false)}>Cancel</Button>
                  <Button size="xs" variant="accent" onClick={handleAddDecision}>Add</Button>
                </div>
              </div>
            )}

            {currentContext.decisions.map(d => (
              <div key={d.id} className="p-1.5 rounded bg-background-secondary border border-border-subtle text-[10.5px]">
                <div className="text-text-primary font-medium">• {d.title}</div>
                {d.description && <div className="text-text-muted text-[9.5px] mt-0.5 pl-2 font-sans">{d.description}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Known Issues */}
        <div className="space-y-2 bg-panel p-3 rounded border border-border flex flex-col">
          <div className="flex items-center justify-between text-text-muted uppercase text-[9px] font-mono font-bold">
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={11} className="text-status-warning" />
              Issues ({currentContext.issues.length})
            </span>
            <button
              onClick={() => setShowAddIssue(!showAddIssue)}
              className="text-text-muted hover:text-text-primary p-0.5"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 font-mono">
            {showAddIssue && (
              <div className="p-2 bg-background rounded border border-border space-y-1 mb-1">
                <Input
                  placeholder="Issue title..."
                  value={newIssueTitle}
                  onChange={(e) => setNewIssueTitle(e.target.value)}
                  className="text-xs py-1"
                />
                <div className="flex justify-end gap-1">
                  <Button size="xs" variant="ghost" onClick={() => setShowAddIssue(false)}>Cancel</Button>
                  <Button size="xs" variant="accent" onClick={handleAddIssue}>Add</Button>
                </div>
              </div>
            )}

            {currentContext.issues.map(iss => (
              <div key={iss.id} className="p-1.5 rounded bg-background-secondary border border-border-subtle text-[10.5px] flex items-start gap-1.5">
                <span className="text-status-warning mt-0.5 font-bold">!</span>
                <div className="flex-1">
                  <span className="text-text-primary">{iss.title}</span>
                  <div className="text-[9px] text-text-muted uppercase mt-0.5">
                    {iss.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 4: Relevant Files */}
        <div className="space-y-2 bg-panel p-3 rounded border border-border flex flex-col">
          <div className="flex items-center justify-between text-text-muted uppercase text-[9px] font-mono font-bold">
            <span className="flex items-center gap-1.5">
              <FileCode size={11} className="text-accent" />
              Files ({currentContext.relevantFiles.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[10.5px] pr-0.5">
            {currentContext.relevantFiles.map((file, i) => (
              <div key={i} className="p-1.5 rounded bg-background-secondary border border-border-subtle text-text-primary flex items-center justify-between">
                <span className="truncate">• {file}</span>
                <span className="text-[8.5px] text-accent font-bold px-1 rounded bg-accent/10">MOD</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
