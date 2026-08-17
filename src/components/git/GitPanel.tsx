import React from 'react';
import { GitBranch, FileCode, X } from 'lucide-react';
import { useActivityStore } from '../../stores/activity.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { clsx } from 'clsx';

export const GitPanel: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceStore();
  const { getGitState } = useActivityStore();
  const { setActiveBottomPanel } = useUIStore();

  const gitState = activeWorkspaceId ? getGitState(activeWorkspaceId) : undefined;

  return (
    <div className="h-72 bg-panel-elevated border-t border-border flex flex-col overflow-hidden text-xs select-none font-mono">
      {/* Header */}
      <div className="h-7 px-3 bg-background-secondary border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-text-secondary font-bold text-[10px]">
            Git Status & Worktree
          </span>
          {gitState && (
            <span className="text-[10px] text-accent px-1.5 py-0.2 rounded bg-accent/10 border border-accent/20">
              {gitState.currentBranch}
            </span>
          )}
        </div>

        <button
          onClick={() => setActiveBottomPanel(null)}
          className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-panel"
        >
          <X size={13} />
        </button>
      </div>

      {/* Grid: Branches + Working Tree Changes */}
      <div className="flex-1 overflow-y-auto p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Branches */}
        <div className="p-3 rounded bg-panel border border-border flex flex-col">
          <span className="text-[9.5px] uppercase tracking-widest text-text-muted font-bold mb-2 flex items-center gap-1.5">
            <GitBranch size={11} className="text-accent" />
            <span>Branches</span>
          </span>

          <div className="space-y-1 flex-1 overflow-y-auto font-mono text-[11px]">
            {gitState?.branches.map(b => (
              <div
                key={b.name}
                className={clsx(
                  'p-2 rounded border flex flex-col gap-0.5',
                  b.isCurrent
                    ? 'bg-accent/10 border-accent/30 text-text-primary'
                    : 'bg-background-secondary border-border-subtle text-text-secondary'
                )}
              >
                <div className="flex items-center justify-between font-semibold text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <GitBranch size={11} className={b.isCurrent ? 'text-accent' : 'text-text-muted'} />
                    <span>{b.name}</span>
                  </div>
                  {b.isCurrent && (
                    <span className="text-[8.5px] uppercase px-1 rounded bg-accent text-white font-bold">
                      HEAD
                    </span>
                  )}
                </div>
                <div className="text-[9.5px] text-text-muted truncate mt-0.5 font-sans">
                  {b.lastCommit}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modified Files */}
        <div className="p-3 rounded bg-panel border border-border flex flex-col">
          <span className="text-[9.5px] uppercase tracking-widest text-text-muted font-bold mb-2 flex items-center gap-1.5">
            <FileCode size={11} className="text-status-warning" />
            <span>Working Tree Changes ({gitState?.modifiedFiles.length || 0})</span>
          </span>

          <div className="space-y-1 flex-1 overflow-y-auto font-mono text-[11px]">
            {gitState?.modifiedFiles.map((m, i) => (
              <div
                key={i}
                className="p-1.5 rounded bg-background-secondary border border-border-subtle flex items-center justify-between"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-3 text-center font-bold text-accent">{m.status}</span>
                  <span className="text-text-primary truncate">{m.path}</span>
                </div>
                <span className="text-[9.5px] text-text-muted">modified</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
