import React, { useState } from 'react';
import { 
  Folder, 
  Users, 
  ArrowRight, 
  Pin, 
  MoreHorizontal, 
  Trash2, 
  Copy, 
  Check, 
  Terminal,
  ExternalLink 
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Workspace } from '../../types/orbit';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAgentStore } from '../../stores/agent.store';
import { clsx } from 'clsx';

interface WorkspaceRowProps {
  workspace: Workspace;
  isSelected?: boolean;
  onSelect: (workspaceId: string) => void;
}

export const WorkspaceRow: React.FC<WorkspaceRowProps> = ({ 
  workspace, 
  isSelected = false,
  onSelect 
}) => {
  const { pinnedProjectIds, togglePinWorkspace, deleteWorkspace } = useWorkspaceStore();
  const { agents } = useAgentStore();
  const isPinned = !!pinnedProjectIds[workspace.id];
  const [copied, setCopied] = useState(false);

  const homeRelativePath = workspace.projectPath.replace(/^\/home\/[^/]+/, '~');
  const projectAgents = agents.filter(a => a.workspaceId === workspace.id);

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(workspace.projectPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePinWorkspace(workspace.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteWorkspace(workspace.id);
  };

  return (
    <div
      onClick={() => onSelect(workspace.id)}
      className="group px-4 py-3 rounded-xl border transition-all duration-150 cursor-pointer select-none flex items-center justify-between gap-4 shadow-sm bg-panel-elevated hover:bg-panel-hover border-border hover:border-border-hover"
    >
      {/* Left: Folder icon + Name + Path + Agent Chips */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-xl bg-well border border-border flex items-center justify-center text-text-secondary group-hover:text-text-primary transition-colors shrink-0">
          <Folder size={14} strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1 flex flex-col md:flex-row md:items-center md:gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-text-primary font-mono truncate">
              {workspace.name}
            </span>
            {isPinned && (
              <span className="flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold shrink-0">
                <Pin size={8} className="fill-amber-500" />
                <span>PIN</span>
              </span>
            )}
          </div>

          <span className="text-[11px] text-text-muted font-mono truncate" title={workspace.projectPath}>
            {homeRelativePath}
          </span>
        </div>

        {/* Inline Agent Badges */}
        <div className="hidden lg:flex items-center gap-1.5 shrink-0">
          {projectAgents.slice(0, 2).map(a => (
            <span key={a.id} className="text-[9.5px] font-mono px-2 py-0.5 rounded-md bg-well border border-border text-text-secondary">
              {a.name}
            </span>
          ))}
          {projectAgents.length > 2 && (
            <span className="text-[9.5px] font-mono text-text-dim px-1">
              +{projectAgents.length - 2}
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={handleTogglePin}
            className={clsx(
              "p-1.5 rounded-lg border transition-all cursor-pointer",
              isPinned
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500 opacity-100"
                : "bg-well border-border text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100"
            )}
            title={isPinned ? "Unpin project (P)" : "Pin project to top (P)"}
          >
            <Pin size={12} className={isPinned ? "fill-amber-500" : ""} />
          </button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="p-1.5 rounded-lg bg-well border border-border text-text-muted hover:text-text-primary transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                title="More options"
              >
                <MoreHorizontal size={12} />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-[11000] min-w-[170px] bg-panel-elevated border border-border rounded-xl shadow-2xl p-1 font-mono text-xs text-text-primary animate-in fade-in-50"
                onClick={e => e.stopPropagation()}
              >
                <DropdownMenu.Item
                  onClick={handleCopyPath}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-panel focus:bg-panel cursor-pointer outline-none"
                >
                  <div className="flex items-center gap-2">
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy Path'}</span>
                  </div>
                  <span className="text-[9.5px] text-text-dim">C</span>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onClick={handleTogglePin}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-panel focus:bg-panel cursor-pointer outline-none"
                >
                  <div className="flex items-center gap-2">
                    <Pin size={12} />
                    <span>{isPinned ? 'Unpin' : 'Pin to Top'}</span>
                  </div>
                  <span className="text-[9.5px] text-text-dim">P</span>
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="h-px bg-border my-1" />

                <DropdownMenu.Item
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 text-red-500 focus:bg-red-500/10 cursor-pointer outline-none font-bold"
                >
                  <Trash2 size={12} />
                  <span>Remove from Orbit</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <button
            onClick={() => onSelect(workspace.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-text-primary text-background font-bold text-[11px] hover:opacity-90 transition-opacity ml-1 cursor-pointer"
          >
            <span>OPEN</span>
            <ArrowRight size={11} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
};
