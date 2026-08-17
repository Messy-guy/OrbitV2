import React from 'react';
import { Plus } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
  const { workspaces, activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore();
  const { setCreateWorkspaceOpen } = useUIStore();

  return (
    <aside className="w-52 bg-canvas-chrome border-r border-border-subtle flex flex-col justify-between select-none relative">
      {/* Top section: Workspace List */}
      <div className="p-2.5 flex flex-col gap-3">
        <div className="flex items-center justify-between px-2 pt-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-text-dim font-bold">
            Workspaces
          </span>
          <button
            onClick={() => setCreateWorkspaceOpen(true)}
            className="text-text-muted hover:text-text-primary p-1 rounded-btn hover:bg-panel-hover transition-colors border border-transparent hover:border-border"
            title="Create Workspace"
          >
            <Plus size={12} strokeWidth={2.5} />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {workspaces.map(ws => {
            const isActive = ws.id === activeWorkspaceId;
            return (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws.id)}
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-btn text-left text-xs transition-colors group relative',
                  isActive
                    ? 'bg-panel text-text-primary border border-border font-semibold shadow-subtle'
                    : 'text-text-muted hover:text-text-primary hover:bg-panel/50 border border-transparent'
                )}
              >
                <div className={clsx(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  isActive ? 'bg-white' : 'bg-border-active group-hover:bg-text-muted'
                )} />
                
                <div className="flex-1 truncate">
                  <div className="truncate font-mono text-[11.5px] tracking-tight">{ws.name}</div>
                  <div className="text-[9.5px] text-text-dim font-mono truncate">{ws.lastActive}</div>
                </div>
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => setCreateWorkspaceOpen(true)}
          className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-btn text-[11px] font-mono text-text-muted hover:text-text-primary bg-panel-subtle hover:bg-panel border border-dashed border-border transition-colors mt-1"
        >
          <Plus size={11} />
          <span>New Project</span>
        </button>
      </div>

      {/* Bottom section: Environment & Version Info */}
      <div className="p-2.5 border-t border-border-subtle bg-well/40">
        <div className="flex items-center justify-between text-[9.5px] text-text-dim font-mono tracking-wider">
          <span>ORBIT RUNTIME</span>
          <span className="text-text-secondary font-bold px-1.5 py-0.2 rounded-badge bg-panel-elevated border border-border">
            ● LOCAL
          </span>
        </div>
      </div>
    </aside>
  );
};
