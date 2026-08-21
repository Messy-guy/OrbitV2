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
  GitBranch,
  Terminal,
  ExternalLink
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Workspace } from '../../types/orbit';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAgentStore } from '../../stores/agent.store';
import { clsx } from 'clsx';

interface WorkspaceCardProps {
  workspace: Workspace;
  isSelected?: boolean;
  onSelect: (workspaceId: string) => void;
}

export const WorkspaceCard: React.FC<WorkspaceCardProps> = ({ 
  workspace, 
  isSelected = false,
  onSelect 
}) => {
  const { pinnedProjectIds, togglePinWorkspace, deleteWorkspace } = useWorkspaceStore();
  const { agents } = useAgentStore();
  const isPinned = !!pinnedProjectIds[workspace.id];
  const [copied, setCopied] = useState(false);

  // Split path for terminal-style hierarchy: ~/folder/path vs project name
  const homeRelativePath = workspace.projectPath.replace(/^\/home\/[^/]+/, '~');
  const pathParts = homeRelativePath.split('/');
  const parentDirectory = pathParts.slice(0, -1).join('/') || '~';
  const folderName = pathParts[pathParts.length - 1] || workspace.name;

  // Project agents
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
      className="group relative p-4 rounded-2xl border transition-all duration-150 cursor-pointer select-none flex flex-col justify-between shadow-sm bg-panel-elevated hover:bg-panel-hover border-border hover:border-border-hover"
    >
      <div>
        {/* Top Header: Folder Icon + Path Breadcrumb + Pin / Actions */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-well border border-border flex items-center justify-center text-text-secondary group-hover:text-text-primary transition-colors shrink-0">
              <Folder size={15} strokeWidth={2.2} />
            </div>

            <div className="min-w-0 flex-1 truncate">
              <span className="text-[10px] font-mono text-text-dim block truncate">
                {parentDirectory}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
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

            {/* Radix Dropdown Menu */}
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
          </div>
        </div>

        {/* Project Name */}
        <h3 className="text-sm font-bold text-text-primary tracking-tight font-mono group-hover:text-text-primary transition-colors truncate">
          {workspace.name}
        </h3>

        {/* Agent Badges / Chips */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 min-h-[22px]">
          {projectAgents.length > 0 ? (
            projectAgents.slice(0, 3).map(agent => (
              <span
                key={agent.id}
                className="flex items-center gap-1 text-[9.5px] font-mono px-2 py-0.5 rounded-md bg-well border border-border text-text-secondary font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="truncate max-w-[80px]">{agent.name}</span>
              </span>
            ))
          ) : (
            <span className="text-[10px] font-mono text-text-dim">
              0 configured agents
            </span>
          )}
          {projectAgents.length > 3 && (
            <span className="text-[9.5px] font-mono text-text-dim px-1">
              +{projectAgents.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Footer: Spaces Count & Instant Open */}
      <div className="mt-5 pt-3 border-t border-border flex items-center justify-between text-[11px] font-mono text-text-muted">
        <div className="flex items-center gap-1.5 text-text-dim">
          <Terminal size={11} />
          <span>{workspace.spaces?.length || 1} {(workspace.spaces?.length || 1) === 1 ? 'canvas space' : 'canvas spaces'}</span>
        </div>

        <div className={clsx(
          "flex items-center gap-1 text-text-primary font-bold transition-all duration-150",
          isSelected ? "opacity-100 translate-x-0" : "opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1"
        )}>
          <span>LAUNCH</span>
          <ArrowRight size={11} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
};
