import React, { useEffect } from 'react';
import { GitBranch, FileCode, X, GitCommit } from 'lucide-react';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';

export const GitPanel: React.FC = () => {
  const { activeWorkspaceId, getActiveWorkspace } = useWorkspaceStore();
  const { gitState, loadGitState } = useContextStore();
  const { setActiveBottomPanel } = useUIStore();

  const activeWorkspace = getActiveWorkspace();

  useEffect(() => {
    if (activeWorkspace?.projectPath) {
      loadGitState(activeWorkspace.projectPath).catch(() => {});
    }
  }, [activeWorkspace?.projectPath]);

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
              {gitState.currentBranch} · {gitState.headCommit}
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

      {/* Grid: Recent Commits + Working Tree Changes */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Recent Commits */}
        <div className="p-3 rounded-panel surface-well border border-border flex flex-col">
          <span className="text-[9.5px] uppercase tracking-widest text-text-dim font-bold mb-2 flex items-center gap-1.5">
            <GitCommit size={11} className="text-text-primary" />
            <span>Recent Commits</span>
          </span>

          <div className="space-y-1 flex-1 overflow-y-auto font-mono text-[11px]">
            {gitState?.recentCommits && gitState.recentCommits.length > 0 ? (
              gitState.recentCommits.map((c, i) => (
                <div
                  key={i}
                  className="p-2 rounded-btn bg-panel border border-border text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
                >
                  <GitCommit size={11} className="text-text-dim shrink-0" />
                  <span className="truncate">{c}</span>
                </div>
              ))
            ) : (
              <div className="text-text-dim text-[11px] p-2">No recent commits detected.</div>
            )}
          </div>
        </div>

        {/* Modified Files */}
        <div className="p-3 rounded-panel surface-well border border-border flex flex-col">
          <span className="text-[9.5px] uppercase tracking-widest text-text-dim font-bold mb-2 flex items-center gap-1.5">
            <FileCode size={11} className="text-status-warning" />
            <span>Working Tree Changes ({gitState?.modifiedFiles.length || 0})</span>
          </span>

          <div className="space-y-1 flex-1 overflow-y-auto font-mono text-[11px]">
            {gitState?.modifiedFiles && gitState.modifiedFiles.length > 0 ? (
              gitState.modifiedFiles.map((m, i) => (
                <div
                  key={i}
                  onClick={() => useUIStore.getState().setActiveDiffFile(m.path)}
                  className="p-2 rounded-btn bg-panel border border-border hover:border-white/20 text-text-secondary hover:text-white flex items-center justify-between transition-colors cursor-pointer group"
                  title="Click to view file diff"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-status-warning font-bold text-[9px] uppercase px-1 rounded bg-panel">
                      {m.status}
                    </span>
                    <span className="text-text-primary group-hover:text-white truncate">{m.path}</span>
                  </div>
                  <span className="text-[10px] text-[#71717a] group-hover:text-white/80 font-mono">
                    View Diff ➜
                  </span>
                </div>
              ))
            ) : (
              <div className="text-text-dim text-[11px] p-2">Clean working tree (0 uncommitted files).</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
