import React from 'react';
import { Folder, Users, ArrowRight } from 'lucide-react';
import { Workspace } from '../../types/orbit';

interface WorkspaceCardProps {
  workspace: Workspace;
  onSelect: (workspaceId: string) => void;
}

export const WorkspaceCard: React.FC<WorkspaceCardProps> = ({ workspace, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(workspace.id)}
      className="group relative bg-panel border border-border hover:border-border-hover rounded-panel p-4 cursor-pointer transition-all duration-150 flex flex-col justify-between shadow-panel select-none hover:-translate-y-0.5"
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="w-8 h-8 rounded bg-background border border-border flex items-center justify-center text-text-secondary group-hover:text-accent group-hover:border-accent/40 transition-colors">
            <Folder size={15} />
          </div>
          <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-background border border-border-subtle">
            {workspace.lastActive}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-text-primary tracking-tight font-mono group-hover:text-white transition-colors">
          {workspace.name}
        </h3>
        <p className="text-[11px] text-text-muted font-mono truncate mt-0.5">
          {workspace.projectPath}
        </p>
      </div>

      <div className="mt-5 pt-2.5 border-t border-border flex items-center justify-between text-[11px] font-mono text-text-muted">
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-text-dim" />
          <span>{workspace.agentCount || 0} {(workspace.agentCount || 0) === 1 ? 'agent' : 'agents'}</span>
        </div>
        <div className="flex items-center gap-1 text-accent opacity-0 group-hover:opacity-100 transition-opacity font-bold">
          <span>OPEN</span>
          <ArrowRight size={11} />
        </div>
      </div>
    </div>
  );
};
