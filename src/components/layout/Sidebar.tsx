import React from 'react';
import { Plus, ChevronDown, ChevronRight, FolderGit2, Terminal, Cpu, Code2 } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAgentStore } from '../../stores/agent.store';
import { useUIStore } from '../../stores/ui.store';
import { tauriService } from '../../services';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
  const {
    workspaces,
    activeWorkspaceId,
    activeSpaceIdByProject,
    collapsedProjects,
    setActiveWorkspace,
    createWorkspace,
    toggleProjectCollapsed,
  } = useWorkspaceStore();

  const { agents } = useAgentStore();
  const { setCreateWorkspaceOpen, setAddAgentOpen, setMaximizedAgentId } = useUIStore();

  const handlePickAndCreateProject = async () => {
    try {
      const selectedPath = await tauriService.openFolderDialog();
      if (selectedPath) {
        // Extract project name from folder path (e.g. /home/leo/Desktop/my-app -> my-app)
        const parts = selectedPath.replace(/\\/g, '/').split('/').filter(Boolean);
        const folderName = parts[parts.length - 1] || 'New Project';
        await createWorkspace(folderName, selectedPath);
        return;
      }
    } catch (e) {
      console.warn('Native folder picker failed or was cancelled, opening modal fallback:', e);
    }
    // Fallback to modal if native dialog is skipped or unavailable
    setCreateWorkspaceOpen(true);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'antigravity':
        return <span className="text-white font-mono font-bold text-[10.5px]">▲</span>;
      case 'claude':
        return <Cpu size={11} className="text-white/80" />;
      case 'opencode':
        return <Code2 size={11} className="text-white/80" />;
      default:
        return <Terminal size={11} className="text-white/60" />;
    }
  };

  return (
    <aside className="w-56 bg-[#090a0d] border-r border-white/[0.06] flex flex-col justify-between select-none relative z-20 font-sans">
      {/* Top section: Projects & Agents */}
      <div className="p-3 flex flex-col gap-3 overflow-y-auto flex-1">
        <div className="flex items-center justify-between px-1 pt-0.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#7A7E8F] font-bold">
            PROJECTS
          </span>
          <button
            onClick={handlePickAndCreateProject}
            className="text-[#7A7E8F] hover:text-white p-1 rounded hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Open Local Folder / Project (+)"
          >
            <Plus size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Clean Line-Separated Project & Agent Tree */}
        <div className="flex flex-col divide-y divide-white/[0.06]">
          {workspaces.map((project) => {
            const isProjectActive = project.id === activeWorkspaceId;
            const isCollapsed = !!collapsedProjects[project.id];
            const activeSpaceId =
              activeSpaceIdByProject[project.id] || project.spaces?.[0]?.id || `space-${project.id}-1`;

            // Agents belonging to this project
            const projectAgents = agents.filter((a) => a.workspaceId === project.id);
            // Agents in the active space tab
            const spaceAgents = projectAgents.filter(
              (a) => (a.spaceId || project.spaces?.[0]?.id || 'default') === activeSpaceId
            );

            return (
              <div key={project.id} className="py-2 first:pt-0 last:pb-0 flex flex-col gap-0.5">
                {/* Clean Project Header Row */}
                <div
                  onClick={() => setActiveWorkspace(project.id)}
                  className={clsx(
                    'flex items-center justify-between px-1.5 py-1.5 rounded-md cursor-pointer transition-all group select-none',
                    isProjectActive
                      ? 'text-white font-semibold'
                      : 'text-[#8E92A4] hover:text-white hover:bg-white/[0.03]'
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* Collapsible toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProjectCollapsed(project.id);
                      }}
                      className="p-0.5 text-[#5C6070] hover:text-white rounded transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight size={11} strokeWidth={2.5} />
                      ) : (
                        <ChevronDown size={11} strokeWidth={2.5} />
                      )}
                    </button>

                    <FolderGit2
                      size={12}
                      className={clsx(isProjectActive ? 'text-white' : 'text-[#646875]')}
                    />
                    <span className="font-mono text-xs truncate tracking-tight">{project.name}</span>
                  </div>
                </div>

                {/* Indented Child Agents Tree */}
                {!isCollapsed && (
                  <div className="flex flex-col pl-5 pr-1 gap-0.5">
                    {spaceAgents.length === 0 ? (
                      <div className="px-1.5 py-1 text-[10.5px] font-mono text-[#5C6070] italic flex items-center justify-between">
                        <span>No agents active</span>
                        {isProjectActive && (
                          <button
                            onClick={() => setAddAgentOpen(true)}
                            className="text-[#7A7E8F] hover:text-white underline text-[10px] not-italic"
                          >
                            + Spawn
                          </button>
                        )}
                      </div>
                    ) : (
                      spaceAgents.map((agent) => (
                        <div
                          key={agent.id}
                          onClick={() => {
                            if (!isProjectActive) {
                              setActiveWorkspace(project.id);
                            }
                            setMaximizedAgentId(agent.id);
                          }}
                          className="flex items-center justify-between px-1.5 py-1 rounded text-xs transition-all text-[#8E92A4] hover:text-white hover:bg-white/[0.06] group cursor-pointer"
                          title="Click to Fullscreen Terminal"
                        >
                          <div className="flex items-center gap-2 truncate flex-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <div className="shrink-0">{getProviderIcon(agent.provider)}</div>
                            <span className="font-mono text-[11px] truncate text-white/90 group-hover:text-white">
                              {agent.name}
                            </span>
                          </div>

                          <span className="text-[9.5px] font-mono text-[#5C6070] group-hover:text-[#8E92A4] uppercase">
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

        {/* Clean Ghost New Project Button */}
        <button
          onClick={() => setCreateWorkspaceOpen(true)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-mono text-[#7A7E8F] hover:text-white hover:bg-white/[0.04] transition-all text-left mt-2"
        >
          <Plus size={12} strokeWidth={2.5} />
          <span>New Project</span>
        </button>
      </div>

      {/* Bottom section: Environment Info */}
      <div className="p-3 border-t border-white/[0.06] bg-[#07080a]">
        <div className="flex items-center justify-between text-[9.5px] text-[#7A7E8F] font-mono tracking-wider">
          <span>ORBIT RUNTIME</span>
          <span className="text-white font-bold px-1.5 py-0.2 rounded bg-white/[0.08] border border-white/[0.1]">
            ● LOCAL
          </span>
        </div>
      </div>
    </aside>
  );
};
