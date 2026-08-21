import React from 'react';
import { Plus, Orbit, X, LayoutGrid, Keyboard, Settings, User as UserIcon, PanelLeft, Map } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAgentStore } from '../../stores/agent.store';
import { useUIStore } from '../../stores/ui.store';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../ui/Button';
import { clsx } from 'clsx';

export const AppHeader: React.FC = () => {
  const {
    activeWorkspaceId,
    getActiveWorkspace,
    setActiveWorkspace,
    activeSpaceIdByProject,
    setActiveSpace,
    createSpace,
    deleteSpace,
  } = useWorkspaceStore();

  const { agents } = useAgentStore();
  const { setAddAgentOpen, setShortcutsOpen, setSettingsOpen, isSidebarCollapsed, toggleSidebar, isMinimapVisible, toggleMinimap } = useUIStore();
  const { user, isAuthenticated, setAuthModalOpen } = useAuthStore();
  const activeWorkspace = getActiveWorkspace();

  const activeSpaceId =
    (activeWorkspace && activeSpaceIdByProject[activeWorkspace.id]) ||
    activeWorkspace?.spaces?.[0]?.id ||
    `space-${activeWorkspace?.id}-1`;

  return (
    <header 
      className="h-10 border-b px-3 flex items-center justify-between select-none z-30 font-sans transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-chrome, #0c0d10)',
        borderColor: 'var(--border-subtle, rgba(255,255,255,0.06))',
      }}
    >
      {/* Left-Aligned Strip: Sidebar Toggle + Brand Logo + Project Name + Flat Space Tabs */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-x-auto">
        
        {/* Toggle Sidebar Button */}
        {activeWorkspace && (
          <button
            onClick={toggleSidebar}
            className={clsx(
              "w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0",
              isSidebarCollapsed
                ? "text-text-muted hover:text-text-primary hover:bg-panel"
                : "text-text-secondary hover:text-text-primary hover:bg-panel"
            )}
            title={isSidebarCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
          >
            <PanelLeft size={13} />
          </button>
        )}

        {/* Brand Icon */}
        <button
          onClick={() => setActiveWorkspace(null)}
          className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0 group"
          title="Orbit Home"
        >
          <div className="w-5 h-5 rounded bg-panel border border-border flex items-center justify-center text-text-primary group-hover:border-border-hover transition-all">
            <Orbit size={11} strokeWidth={2.5} />
          </div>
          <span className="font-mono font-bold text-[11px] tracking-wider text-text-primary">ORBIT</span>
        </button>

        {activeWorkspace && (
          <>
            <span className="text-text-dim font-mono text-xs shrink-0">/</span>
            <span className="text-xs font-semibold text-text-secondary font-mono tracking-tight shrink-0 max-w-[140px] truncate">
              {activeWorkspace.name}
            </span>
            <span className="text-text-dim font-mono text-xs shrink-0">/</span>

            {/* Left-Aligned Flat Space Tabs Strip */}
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto py-0.5">
              {activeWorkspace.spaces?.map((space) => {
                const isSelected = space.id === activeSpaceId;
                const spaceAgentCount = agents.filter(
                  (a) => (a.spaceId || activeWorkspace.spaces?.[0]?.id || 'default') === space.id
                ).length;

                return (
                  <div
                    key={space.id}
                    onClick={() => setActiveSpace(activeWorkspace.id, space.id)}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all group cursor-pointer select-none whitespace-nowrap',
                      isSelected
                        ? 'bg-panel-elevated text-text-primary font-bold shadow-sm border border-border'
                        : 'text-text-muted hover:text-text-primary hover:bg-panel'
                    )}
                  >
                    <LayoutGrid size={11} className={isSelected ? 'text-text-primary' : 'text-text-dim'} />
                    <span className="truncate max-w-[120px] text-[11.5px]">{space.name}</span>
                    <span
                      className={clsx(
                        'text-[9px] px-1 rounded font-mono',
                        isSelected ? 'bg-panel text-text-primary' : 'text-text-dim'
                      )}
                    >
                      {spaceAgentCount}
                    </span>

                    {(activeWorkspace.spaces?.length || 0) > 1 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSpace(activeWorkspace.id, space.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all hover:text-red-400 text-[#6B7082]"
                        title="Close Tab"
                      >
                        <X size={10} />
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Flat '+' Add Space Tab Button */}
              <button
                onClick={() => createSpace(activeWorkspace.id)}
                className="p-1 rounded text-[#5C6070] hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
                title="New Space Tab"
              >
                <Plus size={13} strokeWidth={2.5} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right-Aligned Quick Actions */}
      <div className="flex items-center gap-1.5 shrink-0 pl-3">
        {/* Minimap Toggle */}
        {activeWorkspace && (
          <button
            onClick={toggleMinimap}
            className={clsx(
              "w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer",
              isMinimapVisible
                ? "text-text-primary bg-panel border border-border"
                : "text-text-dim hover:text-text-muted"
            )}
            title={isMinimapVisible ? "Hide Canvas Minimap" : "Show Canvas Minimap"}
          >
            <Map size={12} />
          </button>
        )}

        {/* Keyboard Shortcuts Trigger */}
        <button
          onClick={() => setShortcutsOpen(true)}
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-panel border border-transparent hover:border-border transition-colors cursor-pointer"
          title="Keyboard Shortcuts & Instructions (?)"
        >
          <Keyboard size={13} strokeWidth={2.2} />
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-panel border border-transparent hover:border-border transition-colors cursor-pointer"
          title="Settings & Preferences (Ctrl+,)"
        >
          <Settings size={13} strokeWidth={2.2} />
        </button>

        {/* User Account / Auth Trigger */}
        {isAuthenticated && user ? (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-well hover:bg-panel border border-border text-text-primary text-xs font-mono transition-colors cursor-pointer"
            title={`${user.name || user.email} (${user.plan} Plan)`}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full" />
            ) : (
              <UserIcon size={12} className="text-emerald-500" />
            )}
            <span className="text-[10.5px] font-bold truncate max-w-[70px]">
              {user.name?.split(' ')[0] || 'User'}
            </span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold uppercase">
              {user.plan}
            </span>
          </button>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-well hover:bg-panel border border-border text-text-primary text-[11px] font-mono font-bold transition-colors cursor-pointer"
            title="Sign In with GitHub or Google"
          >
            <UserIcon size={12} />
            <span>Sign In</span>
          </button>
        )}

        {activeWorkspace ? (
          <Button
            variant="primary"
            size="xs"
            onClick={() => setAddAgentOpen(true)}
            className="gap-1.5 font-mono tracking-wider font-bold h-7 px-3 text-[11px]"
          >
            <Plus size={12} strokeWidth={3} />
            <span>ADD AGENT</span>
          </Button>
        ) : (
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest font-bold px-2 py-0.5 rounded-md bg-well border border-border">
            Workspace Launcher
          </div>
        )}
      </div>
    </header>
  );
};
