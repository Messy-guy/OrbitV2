import React from 'react';
import { Plus, Folder, Layers, Terminal } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
  const { workspaces, activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore();
  const { setCreateWorkspaceOpen } = useUIStore();

  return (
    <aside className="w-52 bg-background-secondary border-r border-border flex flex-col justify-between select-none">
      {/* Top section: Workspace List */}
      <div className="p-2.5 flex flex-col gap-3">
        <div className="flex items-center justify-between px-2 pt-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold">
            Workspaces
          </span>
          <button
            onClick={() => setCreateWorkspaceOpen(true)}
            className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-panel-elevated transition-colors"
            title="Create Workspace"
          >
            <Plus size={13} />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5">
          {workspaces.map(ws => {
            const isActive = ws.id === activeWorkspaceId;
            return (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws.id)}
                className={clsx(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-btn text-left text-xs transition-colors group relative',
                  isActive
                    ? 'bg-panel-elevated text-text-primary border border-border font-medium shadow-subtle'
                    : 'text-text-secondary hover:text-text-primary hover:bg-panel border border-transparent'
                )}
              >
                <div className={clsx(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  isActive ? 'bg-accent' : 'bg-border-hover group-hover:bg-text-muted'
                )} />
                
                <div className="flex-1 truncate">
                  <div className="truncate font-mono text-[11px]">{ws.name}</div>
                  <div className="text-[9px] text-text-muted font-mono truncate">{ws.lastActive}</div>
                </div>
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => setCreateWorkspaceOpen(true)}
          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-btn text-[11px] font-mono text-text-muted hover:text-text-primary hover:bg-panel border border-dashed border-border transition-colors mt-1"
        >
          <Plus size={11} />
          <span>New Project</span>
        </button>
      </div>

      {/* Bottom section: Environment & Version Info */}
      <div className="p-2.5 border-t border-border-subtle bg-panel/30">
        <div className="flex items-center justify-between text-[10px] text-text-muted font-mono">
          <span>ORBIT CLI BRIDGE</span>
          <span className="text-status-success font-semibold">ONLINE</span>
        </div>
      </div>
    </aside>
  );
};
