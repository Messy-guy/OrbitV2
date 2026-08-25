import React from 'react';
import { Plus, ChevronDown, ChevronRight, FolderGit2, Terminal, Cpu, Code2, PanelLeftClose, PanelLeft, Folder, Star } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAgentStore } from '../../stores/agent.store';
import { useUIStore } from '../../stores/ui.store';
import { useSkillStore } from '../../stores/skill.store';
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
  const { installedSkills, favoriteSkills, setBrowserModalOpen, setDraggedSkill } = useSkillStore();

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
        return <Terminal size={11} className="text-emerald-500" />;
    }
  };

  // Merge installed skills and favorite skills to display in sidebar rack
  const rackSkills = React.useMemo(() => {
    const map = new Map<string, typeof installedSkills[0]>();
    for (const fav of favoriteSkills) map.set(fav.id, fav);
    for (const inst of installedSkills) {
      if (!map.has(inst.id)) map.set(inst.id, inst);
    }
    return Array.from(map.values());
  }, [installedSkills, favoriteSkills]);

  if (isSidebarCollapsed) {
    return (
      <aside className="w-10 bg-panel border-r border-border flex flex-col items-center py-2 flex-shrink-0 z-20">
        <button
          onClick={toggleSidebar}
          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-well rounded-md transition-colors cursor-pointer"
          title="Expand Sidebar"
        >
          <PanelLeft size={14} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-56 bg-panel border-r border-border flex flex-col flex-shrink-0 select-none z-20 font-sans">
      {/* Sidebar Header */}
      <div className="h-9 px-3 border-b border-border flex items-center justify-between">
        <span className="text-[11px] font-mono font-bold text-text-primary tracking-wider uppercase">
          WORKSPACE
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePickAndCreateProject}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-well rounded-md transition-colors cursor-pointer"
            title="Open Local Folder / New Project"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={toggleSidebar}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-well rounded-md transition-colors cursor-pointer"
            title="Collapse Sidebar"
          >
            <PanelLeftClose size={13} />
          </button>
        </div>
      </div>

      {/* Project & Agent Tree */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scroll">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold">
            PROJECTS
          </span>
          <button
            onClick={handlePickAndCreateProject}
            className="text-[10px] font-mono text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            + Open
          </button>
        </div>

        {workspaces.map((project) => {
          const isActive = project.id === activeWorkspaceId;
          const isCollapsed = collapsedProjects[project.id] ?? false;
          const projectAgents = agents.filter(
            (a) => a.workspaceId === project.id || (!a.workspaceId && project.id === activeWorkspaceId)
          );

          return (
            <div key={project.id} className="flex flex-col">
              {/* Project Header Row */}
              <div
                onClick={() => setActiveWorkspace(project.id)}
                className={clsx(
                  'flex items-center justify-between px-2 py-1 rounded-md text-xs font-mono transition-colors group cursor-pointer',
                  isActive
                    ? 'bg-well text-text-primary font-semibold border border-border/80'
                    : 'text-text-muted hover:text-text-primary hover:bg-well/50 border border-transparent'
                )}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProjectCollapsed(project.id);
                    }}
                    className="text-text-dim hover:text-text-primary"
                  >
                    {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  </button>
                  <FolderGit2 size={12} className={clsx(isActive ? 'text-text-primary' : 'text-text-muted')} />
                  <span className="truncate">{project.name}</span>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveWorkspace(project.id);
                      setAddAgentOpen(true);
                    }}
                    className="p-0.5 hover:text-text-primary text-text-muted rounded cursor-pointer"
                    title="Add Agent CLI to this project"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>

              {/* Sub-tree: Agents running in this project */}
              {!isCollapsed && (
                <div className="pl-4 pr-1 py-0.5 flex flex-col gap-0.5 border-l border-border/50 ml-2.5 my-0.5">
                  {projectAgents.length === 0 ? (
                    <div className="text-[10px] font-mono text-text-dim px-2 py-0.5 italic">
                      No active agents
                    </div>
                  ) : (
                    projectAgents.map((agent) => (
                      <div
                        key={agent.id}
                        onClick={() => {
                          setActiveWorkspace(project.id);
                          setMaximizedAgentId(agent.id);
                        }}
                        className="flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {getProviderIcon(agent.provider)}
                          <span className="truncate">{agent.name}</span>
                        </div>
                        <span className="text-[9px] font-mono text-text-dim uppercase">
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

        {/* 🧩 SKILL RACK (Draggable Skills for Live PTY Terminal Equipping) */}
        <div className="mt-4 pt-3 border-t border-border flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-1 mb-0.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold">
              SKILLS
            </span>
            <button
              onClick={() => setBrowserModalOpen(true)}
              className="text-[10px] font-mono text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              + Add
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {rackSkills.length === 0 ? (
              <div
                onClick={() => setBrowserModalOpen(true)}
                className="text-[10.5px] font-mono text-text-dim px-2 py-2 border border-dashed border-border rounded-md text-center hover:text-text-primary hover:bg-well/50 cursor-pointer transition-colors"
              >
                + Browse & Star Skills
              </div>
            ) : (
              rackSkills.map((skill) => (
                <div
                  key={skill.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-orbit-skill', JSON.stringify({
                      id: skill.id,
                      name: skill.name,
                      directive: skill.directive,
                    }));
                    setDraggedSkill({
                      id: skill.id,
                      name: skill.name,
                      source: skill.source,
                      directive: skill.directive,
                    });
                  }}
                  onDragEnd={() => {
                    setDraggedSkill(null);
                  }}
                  className="px-2 py-1.5 rounded-md hover:bg-panel-elevated border border-transparent hover:border-border transition-all flex items-center justify-between group cursor-grab active:cursor-grabbing select-none"
                  title="Drag onto any terminal to equip"
                >
                  <span className="font-mono text-[11px] font-medium text-text-secondary group-hover:text-text-primary truncate">
                    {skill.shortLabel || skill.name}
                  </span>
                  <span className="text-[9px] font-mono text-text-dim uppercase">
                    {skill.sourceLabel || skill.author || 'Open'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
