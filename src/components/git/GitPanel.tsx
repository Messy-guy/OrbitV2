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
    <div className="h-72 bg-canvas-chrome border-t border-border flex flex-col overflow-hidden text-xs select-none font-mono shadow-dock">
      {/* Header */}
      <div className="h-7 px-3 bg-panel border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-text-primary font-bold text-[10px]">
            Git Status & Worktree
          </span>
          {gitState && (
            <span className="text-[10px] text-text-secondary px-1.5 py-0.2 rounded-badge bg-well border border-border-subtle font-bold">
              {gitState.currentBranch}
            </span>
          )}
        </div>

        <button
          onClick={() => setActiveBottomPanel(null)}
          className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-panel-hover transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* Grid: Branches + Working Tree Changes */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Branches */}
        <div className="p-3 rounded-panel surface-well border border-border flex flex-col">
          <span className="text-[9.5px] uppercase tracking-widest text-text-dim font-bold mb-2 flex items-center gap-1.5">
            <GitBranch size={11} className="text-text-primary" />
            <span>Branches</span>
          </span>

          <div className="space-y-1 flex-1 overflow-y-auto font-mono text-[11px]">
            {gitState?.branches.map(b => (
              <div
                key={b.name}
                className={clsx(
                  'p-2 rounded-btn border flex flex-col gap-0.5 transition-colors',
                  b.isCurrent
                    ? 'btn-primary text-canvas-chrome font-bold'
                    : 'bg-panel border-border text-text-secondary hover:text-text-primary'
                )}
              >
                <div className="flex items-center justify-between font-semibold text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <GitBranch size={11} className={b.isCurrent ? 'text-canvas-chrome' : 'text-text-dim'} />
                    <span>{b.name}</span>
                  </div>
                  {b.isCurrent && (
                    <span className="text-[8.5px] uppercase px-1 rounded bg-canvas-chrome text-white font-bold">
                      HEAD
                    </span>
                  )}
                </div>
                <div className={clsx("text-[9.5px] truncate mt-0.5 font-sans", b.isCurrent ? "text-canvas-chrome/70" : "text-text-dim")}>
                  {b.lastCommit}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modified Files */}
        <div className="p-3 rounded-panel surface-well border border-border flex flex-col">
          <span className="text-[9.5px] uppercase tracking-widest text-text-dim font-bold mb-2 flex items-center gap-1.5">
            <FileCode size={11} className="text-status-warning" />
            <span>Working Tree Changes ({gitState?.modifiedFiles.length || 0})</span>
          </span>

          <div className="space-y-1 flex-1 overflow-y-auto font-mono text-[11px]">
            {gitState?.modifiedFiles.map((m, i) => (
              <div
                key={i}
                className="p-2 rounded-btn bg-panel border border-border flex items-center justify-between"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-3 text-center font-bold text-text-primary">{m.status}</span>
                  <span className="text-text-primary truncate">{m.path}</span>
                </div>
                <span className="text-[9px] text-text-dim uppercase font-bold">MODIFIED</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
