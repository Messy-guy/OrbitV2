import React from 'react';
import { Plus, ChevronDown, ChevronRight, FolderGit2, Terminal, Cpu, Code2, PanelLeftClose, PanelLeft, Folder } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAgentStore } from '../../stores/agent.store';
import { useUIStore } from '../../stores/ui.store';
import { tauriService } from '../../services';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
  const {
    workspaces,
    activeWorkspaceId,
    collapsedProjects,
    setActiveWorkspace,
    createWorkspace,
    toggleProjectCollapsed,
  } = useWorkspaceStore();

  const { agents } = useAgentStore();
  const { isSidebarCollapsed, toggleSidebar, setCreateWorkspaceOpen, setAddAgentOpen, setMaximizedAgentId } = useUIStore();

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
      console.warn('Native folder picker fallback:', e);
    }
    setCreateWorkspaceOpen(true);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'antigravity':
        return <span className="text-text-primary font-mono font-bold text-[10.5px]">▲</span>;
      case 'claude':
        return <Cpu size={11} className="text-amber-500" />;
      case 'opencode':
        return <Code2 size={11} className="text-cyan-500" />;
      default:
        return <Terminal size={11} className="text-text-muted" />;
    }
  };

  // Collapsed Sidebar View (Thin Icon Strip)
  if (isSidebarCollapsed) {
    return (
      <aside className="w-12 border-r border-border flex flex-col items-center justify-between py-3 select-none z-20 font-sans transition-all duration-200 bg-chrome">
        <div className="flex flex-col items-center gap-3">
          {/* Expand Sidebar Trigger Button */}
          <button
            onClick={toggleSidebar}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-panel transition-colors cursor-pointer"
            title="Expand Sidebar"
          >
            <PanelLeft size={15} />
          </button>

          <div className="w-6 h-[1px] bg-border my-1" />

          {/* Quick Project Icons */}
          {workspaces.map((project) => {
            const isProjectActive = project.id === activeWorkspaceId;
            return (
              <button
                key={project.id}
                onClick={() => setActiveWorkspace(project.id)}
                className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold transition-all cursor-pointer",
                  isProjectActive
                    ? "bg-text-primary text-background shadow-sm"
                    : "text-text-muted hover:text-text-primary hover:bg-panel"
                )}
                title={project.name}
              >
                {project.name.charAt(0).toUpperCase()}
              </button>
            );
          })}

          <button
            onClick={handlePickAndCreateProject}
            className="w-8 h-8 rounded-lg border border-dashed border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-panel transition-colors cursor-pointer"
            title="Add Project (+)"
          >
            <Plus size={13} />
          </button>
        </div>
      </aside>
    );
  }

  // Expanded Sidebar View (Full Tree)
  return (
    <aside 
      className="w-56 border-r border-border flex flex-col justify-between select-none relative z-20 font-sans transition-all duration-200 bg-chrome"
    >
      {/* Top section: Projects & Agents */}
      <div className="p-3 flex flex-col gap-3 overflow-y-auto flex-1">
        <div className="flex items-center justify-between px-1 pt-0.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold">
            PROJECTS
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePickAndCreateProject}
              className="text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-panel transition-colors cursor-pointer"
              title="Open Local Folder / Project (+)"
            >
              <Plus size={13} strokeWidth={2.5} />
            </button>
            <button
              onClick={toggleSidebar}
              className="text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-panel transition-colors cursor-pointer"
              title="Collapse Sidebar"
            >
              <PanelLeftClose size={13} />
            </button>
          </div>
        </div>

        {/* Clean Line-Separated Project & Agent Tree */}
        <div className="flex flex-col divide-y divide-border">
          {workspaces.map((project) => {
            const isProjectActive = project.id === activeWorkspaceId;
            const isCollapsed = collapsedProjects[project.id] ?? false;
            const projectAgents = agents.filter((a) => a.workspaceId === project.id);

            return (
              <div key={project.id} className="py-2.5 first:pt-1 last:pb-1 flex flex-col gap-1.5">
                {/* Workspace / Project Title Bar */}
                <div
                  onClick={() => setActiveWorkspace(project.id)}
                  className={clsx(
                    'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono font-medium transition-all group cursor-pointer select-none',
                    isProjectActive
                      ? 'bg-panel-elevated text-text-primary shadow-sm border border-border-hover/60 font-bold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-panel'
                  )}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProjectCollapsed(project.id);
                      }}
                      className="text-text-dim group-hover:text-text-primary p-0.5 rounded hover:bg-well transition-colors cursor-pointer shrink-0"
                    >
                      {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    </button>

                    <FolderGit2 size={13} className={isProjectActive ? "text-emerald-500 shrink-0" : "text-text-muted shrink-0"} />
                    <span className="truncate text-xs font-semibold">{project.name}</span>
                  </div>

                  <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.2 rounded bg-well border border-border shrink-0 ml-1">
                    {projectAgents.length}
                  </span>
                </div>

                {/* Sub-Agents under this Project */}
                {!isCollapsed && (
                  <div className="pl-4 pr-1 flex flex-col gap-0.5 border-l border-border ml-3 mt-1">
                    {projectAgents.length === 0 ? (
                      <div className="px-2 py-1 text-[11px] font-mono text-text-dim flex items-center justify-between">
                        <span>No agents active</span>
                        {isProjectActive && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddAgentOpen(true);
                            }}
                            className="text-[10px] font-mono text-text-primary hover:underline cursor-pointer"
                          >
                            + Spawn
                          </button>
                        )}
                      </div>
                    ) : (
                      projectAgents.map((agent) => (
                        <div
                          key={agent.id}
                          onClick={() => {
                            if (!isProjectActive) {
                              setActiveWorkspace(project.id);
                            }
                            setMaximizedAgentId(agent.id);
                          }}
                          className="flex items-center justify-between px-2 py-1 rounded-md text-xs transition-all text-text-secondary hover:text-text-primary hover:bg-panel group cursor-pointer"
                          title="Click to Fullscreen Terminal"
                        >
                          <div className="flex items-center gap-2 truncate flex-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <div className="shrink-0">{getProviderIcon(agent.provider)}</div>
                            <span className="font-mono text-[11px] truncate font-medium text-text-primary">
                              {agent.name}
                            </span>
                          </div>

                          <span className="text-[9.5px] font-mono text-text-dim group-hover:text-text-muted uppercase">
                            {agent.provider}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
