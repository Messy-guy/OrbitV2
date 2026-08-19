import React from 'react';
import { Plus, Orbit, X, LayoutGrid } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAgentStore } from '../../stores/agent.store';
import { useUIStore } from '../../stores/ui.store';
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
  const { setAddAgentOpen } = useUIStore();
  const activeWorkspace = getActiveWorkspace();

  const activeSpaceId =
    (activeWorkspace && activeSpaceIdByProject[activeWorkspace.id]) ||
    activeWorkspace?.spaces?.[0]?.id ||
    `space-${activeWorkspace?.id}-1`;

  return (
    <header className="h-10 bg-[#0c0d10] border-b border-white/[0.06] px-3 flex items-center justify-between select-none z-30 font-sans">
      {/* Left-Aligned Strip: Brand Logo + Project Name + Flat Space Tabs */}
      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-x-auto">
        {/* Brand Icon */}
        <button
          onClick={() => setActiveWorkspace(null)}
          className="flex items-center gap-1.5 text-[#8E92A4] hover:text-white transition-colors shrink-0 group"
          title="Orbit Home"
        >
          <div className="w-5 h-5 rounded bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white group-hover:border-white/30 transition-all">
            <Orbit size={11} strokeWidth={2.5} />
          </div>
          <span className="font-mono font-bold text-[11px] tracking-wider text-white">ORBIT</span>
        </button>

        {activeWorkspace && (
          <>
            <span className="text-white/20 font-mono text-xs shrink-0">/</span>
            <span className="text-xs font-semibold text-[#8E92A4] font-mono tracking-tight shrink-0 max-w-[140px] truncate">
              {activeWorkspace.name}
            </span>
            <span className="text-white/20 font-mono text-xs shrink-0">/</span>

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
                        ? 'bg-white/[0.12] text-white font-medium shadow-sm'
                        : 'text-[#6B7082] hover:text-[#B4B8C8] hover:bg-white/[0.04]'
                    )}
                  >
                    <LayoutGrid size={11} className={isSelected ? 'text-white' : 'text-[#525666]'} />
                    <span className="truncate max-w-[120px] text-[11.5px]">{space.name}</span>
                    <span
                      className={clsx(
                        'text-[9px] px-1 rounded font-mono',
                        isSelected ? 'bg-white/15 text-white' : 'text-[#525666]'
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
      <div className="flex items-center gap-2 shrink-0 pl-3">
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
          <div className="text-[10px] font-mono text-text-dim uppercase tracking-widest font-bold">
            Project Hub
          </div>
        )}
      </div>
    </header>
  );
};
