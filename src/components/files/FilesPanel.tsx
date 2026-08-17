import React, { useState } from 'react';
import { Folder, FolderOpen, FileCode, ChevronRight, ChevronDown, X } from 'lucide-react';
import { useActivityStore } from '../../stores/activity.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { FileItem } from '../../types/orbit';
import { clsx } from 'clsx';

export const FilesPanel: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceStore();
  const { getFiles } = useActivityStore();
  const { setActiveBottomPanel } = useUIStore();

  const files = activeWorkspaceId ? getFiles(activeWorkspaceId) : [];
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'src': true,
    'src/store': true,
    'src/socket': true,
    'src/server': true,
  });

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderItem = (item: FileItem, depth: number = 0) => {
    if (item.type === 'directory') {
      const isExpanded = !!expandedFolders[item.path];
      return (
        <div key={item.id} className="select-none">
          <div
            onClick={() => toggleFolder(item.path)}
            className="flex items-center gap-1.5 py-0.5 px-1.5 rounded hover:bg-panel cursor-pointer text-text-secondary hover:text-text-primary text-[11px]"
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
          >
            {isExpanded ? <ChevronDown size={11} className="text-text-muted" /> : <ChevronRight size={11} className="text-text-muted" />}
            {isExpanded ? <FolderOpen size={12} className="text-accent" /> : <Folder size={12} className="text-text-muted" />}
            <span className="font-mono text-[11px]">{item.name}/</span>
          </div>

          {isExpanded && item.children && (
            <div>
              {item.children.map(child => renderItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className="flex items-center justify-between py-0.5 px-1.5 rounded hover:bg-panel text-[11px] group cursor-default"
        style={{ paddingLeft: `${depth * 12 + 16}px` }}
      >
        <div className="flex items-center gap-1.5 truncate">
          <FileCode size={11} className="text-text-muted group-hover:text-text-secondary shrink-0" />
          <span className={clsx(
            'text-[11px] font-mono truncate',
            item.status === 'modified' ? 'text-accent font-medium' : 'text-text-secondary'
          )}>
            {item.name}
          </span>
        </div>

        {item.status === 'modified' && (
          <span className="text-[8.5px] font-mono font-bold px-1 rounded bg-accent/15 text-accent">
            MOD
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="h-72 bg-panel-elevated border-t border-border flex flex-col overflow-hidden text-xs select-none font-mono">
      {/* Header */}
      <div className="h-7 px-3 bg-background-secondary border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-text-secondary font-bold text-[10px]">
            Project Explorer
          </span>
        </div>

        <button
          onClick={() => setActiveBottomPanel(null)}
          className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-panel"
        >
          <X size={13} />
        </button>
      </div>

      {/* Files Tree */}
      <div className="flex-1 overflow-y-auto p-2 font-mono space-y-0.5">
        {files.map(item => renderItem(item, 0))}
      </div>
    </div>
  );
};
