import React, { useState } from 'react';
import { Folder, FolderOpen, FileCode, ChevronRight, ChevronDown, X } from 'lucide-react';
import { useActivityStore } from '../../stores/activity.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { useFileEditorStore } from '../../stores/fileEditor.store';
import { ExternalLink } from 'lucide-react';
import { FileItem } from '../../types/orbit';
import { clsx } from 'clsx';

export const FilesPanel: React.FC = () => {
  const { activeWorkspaceId, getActiveWorkspace } = useWorkspaceStore();
  const { getFiles } = useActivityStore();
  const { setActiveBottomPanel } = useUIStore();
  const { openFile, openInExternalEditor } = useFileEditorStore();

  const activeWorkspace = getActiveWorkspace();
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

  const handleFileClick = (path: string) => {
    openFile(path);
  };

  const renderItem = (item: FileItem, depth: number = 0) => {
    if (item.type === 'directory') {
      const isExpanded = !!expandedFolders[item.path];
      return (
        <div key={item.id} className="select-none">
          <div
            onClick={() => toggleFolder(item.path)}
            className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-panel-hover cursor-pointer text-text-secondary hover:text-text-primary text-[11px] transition-colors"
            style={{ paddingLeft: `${depth * 14 + 4}px` }}
          >
            {isExpanded ? <ChevronDown size={11} className="text-text-dim" /> : <ChevronRight size={11} className="text-text-dim" />}
            {isExpanded ? <FolderOpen size={12} className="text-text-primary" /> : <Folder size={12} className="text-text-muted" />}
            <span className="font-mono text-[11.5px] font-medium">{item.name}/</span>
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
        onClick={() => handleFileClick(item.path)}
        className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-panel-hover text-[11px] group cursor-pointer transition-colors"
        style={{ paddingLeft: `${depth * 14 + 18}px` }}
        title="Click to view/edit file in Orbit"
      >
        <div className="flex items-center gap-1.5 truncate">
          <FileCode size={11} className="text-text-dim group-hover:text-amber-400 shrink-0" />
          <span className={clsx(
            'text-[11px] font-mono truncate group-hover:text-text-primary transition-colors',
            item.status === 'modified' ? 'text-text-primary font-medium' : 'text-text-secondary'
          )}>
            {item.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {item.status === 'modified' && (
            <span className="text-[8.5px] font-mono font-bold px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              MOD
            </span>
          )}
          <span className="text-[9.5px] text-text-dim group-hover:text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
            Open ➜
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="h-72 bg-canvas-chrome border-t border-border flex flex-col overflow-hidden text-xs select-none font-mono shadow-dock">
      {/* Header */}
      <div className="h-7 px-3 bg-panel border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-text-primary font-bold text-[10px]">
            Project Explorer
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openInExternalEditor()}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-well hover:bg-panel text-text-muted hover:text-text-primary text-[10px] border border-border transition-colors cursor-pointer"
            title="Open entire project in VS Code"
          >
            <ExternalLink size={11} />
            <span className="hidden sm:inline">VS Code</span>
          </button>
          <button
            onClick={() => setActiveBottomPanel(null)}
            className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-panel-hover transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Files Tree */}
      <div className="flex-1 overflow-y-auto p-2 font-mono space-y-0.5 surface-well m-2 rounded-panel border-border">
        {files.map(item => renderItem(item, 0))}
      </div>
    </div>
  );
};
