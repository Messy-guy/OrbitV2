import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  FolderPlus, 
  Search, 
  LayoutGrid, 
  List, 
  FolderOpen, 
  Pin, 
  Sparkles,
  GitBranch,
  Terminal,
  X,
  CornerDownLeft,
  SlidersHorizontal,
  Bot,
  Github
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { useAgentStore } from '../stores/agent.store';
import { useUIStore } from '../stores/ui.store';
import { WorkspaceCard } from '../components/workspace/WorkspaceCard';
import { WorkspaceRow } from '../components/workspace/WorkspaceRow';
import { ImportGitHubModal } from '../components/workspace/ImportGitHubModal';
import { tauriService } from '../services';
import { clsx } from 'clsx';

type FilterTab = 'all' | 'pinned' | 'with-agents';

export const Home: React.FC = () => {
  const { 
    workspaces, 
    loadWorkspaces, 
    setActiveWorkspace, 
    createWorkspace,
    pinnedProjectIds,
    togglePinWorkspace,
    viewMode,
    setViewMode
  } = useWorkspaceStore();

  const { agents } = useAgentStore();
  const { setCreateWorkspaceOpen } = useUIStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isImportGitHubOpen, setIsImportGitHubOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // Handle folder browsing
  const handlePickAndCreateProject = async () => {
    try {
      const selectedPath = await tauriService.openFolderDialog();
      if (selectedPath) {
        const parts = selectedPath.replace(/\\/g, '/').split('/').filter(Boolean);
        const folderName = parts[parts.length - 1] || 'New Project';
        await createWorkspace(folderName, selectedPath);
        return;
      }
    } catch (e) {
      console.warn('Native folder picker failed or was cancelled:', e);
    }
    setCreateWorkspaceOpen(true);
  };

  // Filtered & Sorted Workspace list
  const { filteredWorkspaces, pinnedList, normalList } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    let result = workspaces.filter(w => 
      !query || 
      w.name.toLowerCase().includes(query) || 
      w.projectPath.toLowerCase().includes(query)
    );

    if (activeFilter === 'pinned') {
      result = result.filter(w => !!pinnedProjectIds[w.id]);
    } else if (activeFilter === 'with-agents') {
      result = result.filter(w => agents.some(a => a.workspaceId === w.id));
    }

    const pinned = result.filter(w => !!pinnedProjectIds[w.id]);
    const others = result.filter(w => !pinnedProjectIds[w.id]);

    // Flat ordered list for keyboard navigation
    const flat = [...pinned, ...others];

    return { 
      filteredWorkspaces: flat, 
      pinnedList: pinned, 
      normalList: others 
    };
  }, [workspaces, searchQuery, activeFilter, pinnedProjectIds, agents]);

  // Keep selected index within bounds
  useEffect(() => {
    if (selectedIndex >= filteredWorkspaces.length) {
      setSelectedIndex(Math.max(0, filteredWorkspaces.length - 1));
    }
  }, [filteredWorkspaces.length, selectedIndex]);

  // Keyboard navigation & Shortcuts Engine
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Press '/' to focus search
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // 2. Press 'Escape' inside search input to blur/clear
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          setSearchQuery('');
        } else {
          searchInputRef.current?.blur();
        }
        return;
      }

      // If typing in input, don't trigger arrow navigation unless explicitly pressing Enter
      if (document.activeElement === searchInputRef.current) {
        if (e.key === 'Enter' && filteredWorkspaces.length > 0) {
          e.preventDefault();
          const target = filteredWorkspaces[selectedIndex] || filteredWorkspaces[0];
          if (target) setActiveWorkspace(target.id);
        }
        return;
      }

      // 3. Arrow Down / J
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredWorkspaces.length));
      }

      // 4. Arrow Up / K
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredWorkspaces.length) % Math.max(1, filteredWorkspaces.length));
      }

      // 5. Enter to Launch
      if (e.key === 'Enter' && filteredWorkspaces.length > 0) {
        e.preventDefault();
        const target = filteredWorkspaces[selectedIndex];
        if (target) setActiveWorkspace(target.id);
      }

      // 6. 'p' to toggle pin
      if ((e.key === 'p' || e.key === 'P') && filteredWorkspaces.length > 0) {
        e.preventDefault();
        const target = filteredWorkspaces[selectedIndex];
        if (target) togglePinWorkspace(target.id);
      }

      // 7. 'c' to copy path
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && filteredWorkspaces.length > 0) {
        e.preventDefault();
        const target = filteredWorkspaces[selectedIndex];
        if (target) navigator.clipboard.writeText(target.projectPath);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredWorkspaces, selectedIndex, searchQuery, setActiveWorkspace, togglePinWorkspace]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-canvas p-6 md:p-8 select-none font-sans">
      <div className="max-w-5xl w-full mx-auto flex flex-col min-h-full space-y-6">
        
        {/* Top Developer Toolbar: Title + Stats + Direct Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-text-primary tracking-wider font-mono uppercase">
              PROJECT REPOSITORIES
            </h1>
            <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-well border border-border text-text-secondary font-bold">
              {workspaces.length}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsImportGitHubOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-panel hover:bg-panel-hover border border-border text-text-primary font-mono text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
              title="Import remote repository from GitHub"
            >
              <Github size={13} strokeWidth={2.5} />
              <span>Import from GitHub…</span>
            </button>

            <button
              onClick={handlePickAndCreateProject}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-text-primary text-background font-mono text-xs font-bold hover:opacity-90 transition-all shadow-sm cursor-pointer active:scale-95"
              title="Open repository folder from disk"
            >
              <FolderOpen size={13} strokeWidth={2.5} />
              <span>Open Folder…</span>
            </button>
          </div>
        </div>

        {/* Raycast-Style Interactive Search & Filter Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Quick Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search projects or directory paths... (Press /)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0);
              }}
              className="w-full pl-9 pr-14 py-2.5 rounded-xl bg-panel border border-border text-text-primary font-mono text-xs placeholder:text-text-dim focus:outline-none focus:border-border-hover transition-colors shadow-inner"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary cursor-pointer"
                title="Clear search (Esc)"
              >
                <X size={12} />
              </button>
            ) : (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-text-dim px-1.5 py-0.5 rounded bg-well border border-border">
                /
              </kbd>
            )}
          </div>

          {/* Filter Pills + View Toggle */}
          <div className="flex items-center justify-between md:justify-end gap-2.5">
            {/* Category Filter Pills */}
            <div className="flex items-center bg-panel border border-border rounded-xl p-1 gap-1 text-[11px] font-mono">
              <button
                onClick={() => { setActiveFilter('all'); setSelectedIndex(0); }}
                className={clsx(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                  activeFilter === 'all'
                    ? "bg-well text-text-primary font-bold shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                )}
              >
                All ({workspaces.length})
              </button>

              <button
                onClick={() => { setActiveFilter('pinned'); setSelectedIndex(0); }}
                className={clsx(
                  "flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                  activeFilter === 'pinned'
                    ? "bg-well text-text-primary font-bold shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                )}
              >
                <Pin size={10} className="fill-amber-500 text-amber-500" />
                <span>Pinned ({Object.values(pinnedProjectIds).filter(Boolean).length})</span>
              </button>

              <button
                onClick={() => { setActiveFilter('with-agents'); setSelectedIndex(0); }}
                className={clsx(
                  "flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                  activeFilter === 'with-agents'
                    ? "bg-well text-text-primary font-bold shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                )}
              >
                <Bot size={11} className="text-emerald-500" />
                <span>Active Agents</span>
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-panel border border-border rounded-xl p-1 gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors cursor-pointer",
                  viewMode === 'grid'
                    ? "bg-well text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                )}
                title="Grid View"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors cursor-pointer",
                  viewMode === 'list'
                    ? "bg-well text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                )}
                title="List View"
              >
                <List size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Empty States */}
        {workspaces.length === 0 ? (
          <div className="flex-1 p-12 rounded-2xl bg-panel border border-border flex flex-col items-center justify-center gap-3.5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-well border border-border flex items-center justify-center text-text-muted">
              <FolderPlus size={24} />
            </div>
            <div>
              <p className="text-sm font-mono font-bold text-text-primary">No repositories open in Orbit</p>
              <p className="text-xs font-mono text-text-muted mt-1 max-w-sm">
                Open any directory from your device to initiate collaborative multi-agent coding sessions.
              </p>
            </div>
            <button
              onClick={handlePickAndCreateProject}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-text-primary text-background font-mono text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-md"
            >
              <FolderOpen size={13} strokeWidth={2.5} />
              <span>Open Local Repository</span>
            </button>
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <div className="flex-1 p-10 rounded-2xl bg-panel border border-border flex flex-col items-center justify-center gap-2 text-center font-mono text-xs text-text-muted">
            <span>No repositories match current filters</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 px-3 py-1.5 rounded-lg bg-well border border-border text-text-primary hover:border-border-hover cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 space-y-6">
            {/* Pinned Section */}
            {pinnedList.length > 0 && activeFilter === 'all' && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-amber-500 uppercase tracking-widest font-bold">
                  <Pin size={11} className="fill-amber-500" />
                  <span>PINNED ({pinnedList.length})</span>
                </div>

                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {pinnedList.map((ws) => {
                      const globalIdx = filteredWorkspaces.findIndex(w => w.id === ws.id);
                      return (
                        <WorkspaceCard
                          key={ws.id}
                          workspace={ws}
                          isSelected={globalIdx === selectedIndex}
                          onSelect={(id) => setActiveWorkspace(id)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pinnedList.map((ws) => {
                      const globalIdx = filteredWorkspaces.findIndex(w => w.id === ws.id);
                      return (
                        <WorkspaceRow
                          key={ws.id}
                          workspace={ws}
                          isSelected={globalIdx === selectedIndex}
                          onSelect={(id) => setActiveWorkspace(id)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* All / Normal Projects Section */}
            {normalList.length > 0 && (
              <div className="space-y-3">
                {pinnedList.length > 0 && activeFilter === 'all' && (
                  <div className="text-[10.5px] font-mono text-text-muted uppercase tracking-widest font-bold">
                    REPOSITORIES ({normalList.length})
                  </div>
                )}

                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {normalList.map((ws) => {
                      const globalIdx = filteredWorkspaces.findIndex(w => w.id === ws.id);
                      return (
                        <WorkspaceCard
                          key={ws.id}
                          workspace={ws}
                          isSelected={globalIdx === selectedIndex}
                          onSelect={(id) => setActiveWorkspace(id)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {normalList.map((ws) => {
                      const globalIdx = filteredWorkspaces.findIndex(w => w.id === ws.id);
                      return (
                        <WorkspaceRow
                          key={ws.id}
                          workspace={ws}
                          isSelected={globalIdx === selectedIndex}
                          onSelect={(id) => setActiveWorkspace(id)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Developer Persistent Bottom Keyboard Shortcut Hint Strip */}
        <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-mono text-text-dim select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-well border border-border text-text-muted font-bold">↑↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-well border border-border text-text-muted font-bold">↵</kbd>
              <span>Launch</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-well border border-border text-text-muted font-bold">P</kbd>
              <span>Pin</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-well border border-border text-text-muted font-bold">C</kbd>
              <span>Copy Path</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-well border border-border text-text-muted font-bold">/</kbd>
              <span>Search</span>
            </span>
          </div>

          <div className="text-text-dim text-[10px]">
            Orbit Launcher v0.1.0
          </div>
        </div>

      </div>

      {/* GitHub Repository Importer Modal */}
      <ImportGitHubModal
        isOpen={isImportGitHubOpen}
        onClose={() => setIsImportGitHubOpen(false)}
      />
    </div>
  );
};
