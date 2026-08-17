import React, { useEffect } from 'react';
import { Plus, Orbit, FolderPlus, Terminal } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { useUIStore } from '../stores/ui.store';
import { WorkspaceCard } from '../components/workspace/WorkspaceCard';
import { Button } from '../components/ui/Button';

export const Home: React.FC = () => {
  const { workspaces, loadWorkspaces, setActiveWorkspace } = useWorkspaceStore();
  const { setCreateWorkspaceOpen } = useUIStore();

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-background p-6 md:p-8 select-none font-sans">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
          <div>
            <div className="flex items-center gap-1.5 mb-1 text-accent font-mono text-[10.5px] uppercase tracking-widest font-semibold">
              <Orbit size={13} />
              <span>Multi-Agent Desktop Workspace</span>
            </div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight font-mono">
              Projects & Workspaces
            </h1>
            <p className="text-xs text-text-muted mt-0.5 font-sans">
              Select a project directory or spawn an isolated workspace to collaborate with coding agents.
            </p>
          </div>

          <Button
            variant="accent"
            size="sm"
            onClick={() => setCreateWorkspaceOpen(true)}
            className="gap-1.5 self-start sm:self-auto font-mono text-xs"
          >
            <Plus size={13} />
            <span>New Workspace</span>
          </Button>
        </div>

        {/* Workspaces Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {workspaces.map(ws => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              onSelect={(id) => setActiveWorkspace(id)}
            />
          ))}

          {/* New Workspace Dashed Card */}
          <button
            onClick={() => setCreateWorkspaceOpen(true)}
            className="h-36 rounded-panel border border-dashed border-border hover:border-border-active bg-panel/30 hover:bg-panel/60 p-4 flex flex-col items-center justify-center gap-2 text-text-muted hover:text-text-primary transition-colors group"
          >
            <div className="w-8 h-8 rounded bg-background border border-border group-hover:border-border-hover flex items-center justify-center text-text-dim group-hover:text-text-primary transition-colors">
              <FolderPlus size={15} />
            </div>
            <span className="text-xs font-mono font-medium">Create New Workspace</span>
          </button>
        </div>
      </div>
    </div>
  );
};
