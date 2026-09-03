import React from 'react';
import { Plus, Orbit, X, LayoutGrid, Keyboard, Settings, User as UserIcon, PanelLeft, Map, Smartphone } from 'lucide-react';
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
  const { setAddAgentOpen, setShortcutsOpen, setSettingsOpen, isSidebarCollapsed, toggleSidebar, isMinimapVisible, toggleMinimap, setPairMobileOpen } = useUIStore();
  const { user, isAuthenticated, setAuthModalOpen } = useAuthStore();
  const activeWorkspace = getActiveWorkspace();

  const activeSpaceId =
    (activeWorkspace && activeSpaceIdByProject[activeWorkspace.id]) ||
    activeWorkspace?.spaces?.[0]?.id ||
    `space-${activeWorkspace?.id}-1`;

  return (
    <header 
      className="h-11 border-b px-3.5 flex items-center justify-between select-none z-30 font-sans transition-all duration-200 glass-panel border-white/5"
    >
      {/* Left-Aligned Strip: Sidebar Toggle + Brand Logo + Project Name + Flat Space Tabs */}
      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-x-auto">
        
        {/* Toggle Sidebar Button */}
        {activeWorkspace && (
          <button
            onClick={toggleSidebar}
            className={clsx(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0",
              isSidebarCollapsed
                ? "text-text-muted hover:text-text-primary hover:bg-panel"
                : "text-text-secondary hover:text-text-primary hover:bg-panel"
            )}
            title={isSidebarCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
          >
            <PanelLeft size={14} />
          </button>
        )}

        {/* Brand Icon */}
        <button
          onClick={() => setActiveWorkspace(null)}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors shrink-0 group"
          title="Orbit Home"
        >
          <div className="w-6 h-6 rounded-lg bg-panel border border-border flex items-center justify-center overflow-hidden group-hover:border-border-hover transition-all">
            <img src="/orbit-logo.png" alt="Orbit Logo" className="w-5 h-5 object-contain" />
          </div>
          <span className="font-mono font-bold text-xs tracking-wider text-text-primary">ORBIT</span>
        </button>

        {activeWorkspace && (
          <>
            <span className="text-text-dim font-mono text-xs shrink-0">/</span>
            <span className="text-xs font-semibold text-text-secondary font-mono tracking-tight shrink-0 max-w-[150px] truncate">
              {activeWorkspace.name}
            </span>
            <span className="text-text-dim font-mono text-xs shrink-0">/</span>

            {/* Left-Aligned Flat Space Tabs Strip */}
            <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto py-0.5">
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
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all group cursor-pointer select-none whitespace-nowrap',
                      isSelected
                        ? 'bg-panel-elevated text-text-primary font-bold shadow-sm border border-border'
                        : 'text-text-muted hover:text-text-primary hover:bg-panel'
                    )}
                  >
                    <LayoutGrid size={12} className={isSelected ? 'text-text-primary' : 'text-text-dim'} />
                    <span className="truncate max-w-[130px] text-xs">{space.name}</span>
                    <span
                      className={clsx(
                        'text-[9.5px] px-1.5 py-0.2 rounded font-mono',
                        isSelected ? 'bg-panel text-text-primary' : 'text-text-dim'
                      )}
                    >
                      {spaceAgentCount}
                    </span>

                    {/* Delete Space Button (only on non-primary spaces) */}
                    {activeWorkspace.spaces && activeWorkspace.spaces.length > 1 && space.id !== activeWorkspace.spaces[0].id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSpace(activeWorkspace.id, space.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-text-dim hover:text-red-400 transition-all ml-0.5"
                        title="Delete Space"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add New Space Button */}
              <button
                onClick={() => createSpace(activeWorkspace.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-panel border border-transparent hover:border-border text-xs font-mono transition-all shrink-0 cursor-pointer"
                title="Create New Canvas Space"
              >
                <Plus size={12} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 shrink-0">
        
        {/* Toggle Minimap Navigator */}
        {activeWorkspace && (
          <button
            onClick={toggleMinimap}
            className={clsx(
              "p-2 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono",
              isMinimapVisible
                ? "bg-panel-elevated text-text-primary border-border shadow-xs"
                : "text-text-muted hover:text-text-primary hover:bg-panel border-transparent hover:border-border"
            )}
            title={isMinimapVisible ? "Hide Minimap Radar" : "Show Minimap Radar"}
          >
            <Map size={14} />
          </button>
        )}

        {/* Pair Mobile Trigger */}
        <button
          onClick={() => setPairMobileOpen(true)}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-panel border border-transparent hover:border-border transition-colors cursor-pointer"
          title="Pair Orbit Mobile Cockpit (QR Code)"
        >
          <Smartphone size={14} />
        </button>

        {/* Keyboard Shortcuts Trigger */}
        <button
          onClick={() => setShortcutsOpen(true)}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-panel border border-transparent hover:border-border transition-colors cursor-pointer"
          title="Keyboard Shortcuts & Instructions (?)"
        >
          <Keyboard size={14} strokeWidth={2.2} />
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-panel border border-transparent hover:border-border transition-colors cursor-pointer"
          title="Settings & Preferences (Ctrl+,)"
        >
          <Settings size={14} strokeWidth={2.2} />
        </button>

        {/* User Account / Auth Trigger */}
        {isAuthenticated && user ? (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-well hover:bg-panel border border-border text-text-primary text-xs font-mono transition-colors cursor-pointer"
            title={`${user.name || user.email} (${user.plan} Plan)`}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-4 h-4 rounded-full" />
            ) : (
              <UserIcon size={13} className="text-emerald-500" />
            )}
            <span className="text-[11px] font-bold truncate max-w-[80px]">
              {user.name?.split(' ')[0] || 'User'}
            </span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold uppercase">
              {user.plan}
            </span>
          </button>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-well hover:bg-panel border border-border text-text-primary text-xs font-mono font-bold transition-colors cursor-pointer"
            title="Sign In with GitHub or Google"
          >
            <UserIcon size={13} />
            <span>Sign In</span>
          </button>
        )}

        {activeWorkspace ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAddAgentOpen(true)}
            className="gap-2 font-mono tracking-wider font-bold h-8 px-4 text-xs shadow-md"
          >
            <Plus size={13} strokeWidth={3} />
            <span>ADD AGENT</span>
          </Button>
        ) : (
          <div className="text-[10.5px] font-mono text-text-muted uppercase tracking-widest font-bold px-2.5 py-1 rounded-lg bg-well border border-border">
            Workspace Launcher
          </div>
        )}
      </div>
    </header>
  );
};
