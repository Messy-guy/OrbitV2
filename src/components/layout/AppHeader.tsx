import React from 'react';
import { Plus, Orbit, ChevronRight, Layers, Terminal, Sparkles } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAgentStore } from '../../stores/agent.store';
import { useUIStore } from '../../stores/ui.store';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export const AppHeader: React.FC = () => {
  const { activeWorkspaceId, getActiveWorkspace, setActiveWorkspace } = useWorkspaceStore();
  const { agents } = useAgentStore();
  const { setAddAgentOpen } = useUIStore();
  const activeWorkspace = getActiveWorkspace();

  return (
    <header className="h-10 bg-panel border-b border-border px-3.5 flex items-center justify-between select-none z-30 font-sans">
      {/* Left: Orbit logo + Workspace Breadcrumbs */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setActiveWorkspace(null)}
          className="flex items-center gap-2 text-text-primary hover:text-white transition-colors group"
        >
          <div className="w-5 h-5 rounded bg-accent/15 border border-accent/30 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-colors">
            <Orbit size={12} strokeWidth={2.5} />
          </div>
          <span className="font-mono font-semibold text-xs tracking-tight">ORBIT</span>
        </button>

        {activeWorkspace && (
          <>
            <span className="text-text-muted font-mono text-xs">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-primary font-mono">{activeWorkspace.name}</span>
              <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.2 rounded bg-background-tertiary border border-border-subtle">
                {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Center: Repository Path status chip */}
      {activeWorkspace && (
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-background-secondary rounded-btn border border-border-subtle text-[11px] font-mono text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
          <span className="truncate max-w-[320px]">{activeWorkspace.projectPath}</span>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {activeWorkspace ? (
          <>
            <Button
              variant="accent"
              size="xs"
              onClick={() => setAddAgentOpen(true)}
              className="gap-1 font-mono"
            >
              <Plus size={12} />
              <span>+ AGENT</span>
            </Button>

            <button
              onClick={() => setActiveWorkspace(null)}
              className="text-[11px] font-mono text-text-muted hover:text-text-primary px-2 py-1 rounded hover:bg-panel-elevated transition-colors flex items-center gap-1.5 border border-transparent hover:border-border"
              title="Return to Workspaces"
            >
              <Layers size={12} />
              <span>Projects</span>
            </button>
          </>
        ) : (
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
            Workspace Hub
          </div>
        )}
      </div>
    </header>
  );
};
