import React from 'react';
import { Plus, Orbit, Layers, FolderGit2, Terminal } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAgentStore } from '../../stores/agent.store';
import { useUIStore } from '../../stores/ui.store';
import { Button } from '../ui/Button';

export const AppHeader: React.FC = () => {
  const { activeWorkspaceId, getActiveWorkspace, setActiveWorkspace } = useWorkspaceStore();
  const { agents } = useAgentStore();
  const { setAddAgentOpen } = useUIStore();
  const activeWorkspace = getActiveWorkspace();

  return (
    <header className="h-10 bg-canvas-chrome border-b border-border-subtle px-3.5 flex items-center justify-between select-none z-30 font-sans shadow-subtle">
      {/* Left: Orbit logo + Workspace Breadcrumbs */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setActiveWorkspace(null)}
          className="flex items-center gap-2 text-text-primary hover:text-white transition-colors group"
        >
          <div className="w-5 h-5 rounded-btn btn-base flex items-center justify-center text-text-primary group-hover:border-border-hover transition-all">
            <Orbit size={12} strokeWidth={2.5} />
          </div>
          <span className="font-mono font-bold text-xs tracking-wider text-text-primary">ORBIT</span>
        </button>

        {activeWorkspace && (
          <>
            <span className="text-text-dim font-mono text-xs">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary font-mono tracking-tight">{activeWorkspace.name}</span>
              <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.2 rounded-badge bg-well border border-border-subtle flex items-center gap-1">
                <Terminal size={10} className="text-status-success" />
                <span>{agents.length} {agents.length === 1 ? 'TERMINAL' : 'TERMINALS'}</span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* Center: Repository Path status chip */}
      {activeWorkspace && (
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 surface-well rounded-btn text-[11px] font-mono text-text-muted">
          <FolderGit2 size={11} className="text-text-dim" />
          <span className="truncate max-w-[340px] text-text-secondary">{activeWorkspace.projectPath}</span>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {activeWorkspace ? (
          <>
            <Button
              variant="primary"
              size="xs"
              onClick={() => setAddAgentOpen(true)}
              className="gap-1 font-mono tracking-wider font-bold"
            >
              <Plus size={12} strokeWidth={2.5} />
              <span>+ TERMINAL / AGENT</span>
            </Button>

            <button
              onClick={() => setActiveWorkspace(null)}
              className="text-[11px] font-mono text-text-muted hover:text-text-primary px-2.5 py-1 rounded-btn btn-base transition-colors flex items-center gap-1.5"
              title="Return to Workspaces Hub"
            >
              <Layers size={12} />
              <span>Workspaces</span>
            </button>
          </>
        ) : (
          <div className="text-[10px] font-mono text-text-dim uppercase tracking-widest font-bold">
            Workspace Hub
          </div>
        )}
      </div>
    </header>
  );
};
