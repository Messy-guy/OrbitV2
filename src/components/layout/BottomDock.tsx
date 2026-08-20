import React from 'react';
import { Database, Activity as ActivityIcon, FolderTree, GitBranch, MessageSquare, ChevronUp, ChevronDown } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { useContextStore } from '../../stores/context.store';
import { useActivityStore } from '../../stores/activity.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { BottomPanelType } from '../../types/orbit';
import { clsx } from 'clsx';

export const BottomDock: React.FC = () => {
  const { activeBottomPanel, toggleBottomPanel } = useUIStore();
  const { currentContext, checkpoints } = useContextStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { getActivities } = useActivityStore();

  const activities = activeWorkspaceId ? getActivities(activeWorkspaceId) : [];

  const navItems: Array<{
    id: BottomPanelType;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }> = [
    {
      id: 'context',
      label: 'Context',
      icon: <Database size={12} />,
      badge: currentContext ? `${currentContext.progress}%` : undefined,
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: <ActivityIcon size={12} />,
      badge: activities.length > 0 ? activities.length : undefined,
    },
    {
      id: 'files',
      label: 'Files',
      icon: <FolderTree size={12} />,
      badge: currentContext?.relevantFiles.length,
    },
    {
      id: 'git',
      label: 'Git',
      icon: <GitBranch size={12} />,
      badge: '3 mod',
    },
    {
      id: 'sessions',
      label: 'Sessions',
      icon: <MessageSquare size={12} />,
      badge: checkpoints.length > 0 ? `${checkpoints.length} chk` : undefined,
    },
  ];

  return (
    <footer 
      className="h-8 border-t px-3 flex items-center justify-between select-none z-20 font-mono text-[11px] shadow-sm transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-chrome, #121318)',
        borderColor: 'var(--border-subtle, rgba(255,255,255,0.08))',
      }}
    >
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {navItems.map(item => {
          const isActive = activeBottomPanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => toggleBottomPanel(item.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1 rounded-md transition-all shrink-0',
                isActive
                  ? 'bg-white/[0.1] text-white border border-white/[0.15] font-bold shadow-inner'
                  : 'text-text-muted hover:text-white hover:bg-white/[0.04] border border-transparent'
              )}
            >
              <span className={clsx(isActive ? 'text-white' : 'text-text-dim')}>
                {item.icon}
              </span>
              <span className="tracking-tight">{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className={clsx(
                    'text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold',
                    isActive ? 'bg-white/20 text-white border border-white/30' : 'bg-white/[0.05] text-text-dim'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-text-muted shrink-0 font-mono">
        {/* Minimal Persistent Keyboard Hints */}
        <div 
          onClick={() => useUIStore.getState().setShortcutsOpen(true)}
          className="hidden md:flex items-center gap-2 text-[#7A7E8F] hover:text-white cursor-pointer transition-colors px-2 py-0.5 rounded hover:bg-white/[0.04]"
          title="Click to view all keyboard shortcuts (?)"
        >
          <span><kbd className="px-1 py-0.2 rounded bg-white/[0.06] text-[#B4B7C4] text-[9px]">^H</kbd> Handoff</span>
          <span className="text-white/10">•</span>
          <span><kbd className="px-1 py-0.2 rounded bg-white/[0.06] text-[#B4B7C4] text-[9px]">^1-9</kbd> Focus</span>
          <span className="text-white/10">•</span>
          <span><kbd className="px-1 py-0.2 rounded bg-white/[0.06] text-[#B4B7C4] text-[9px]">?</kbd> Help</span>
        </div>

        {currentContext?.lastCheckpointTime && (
          <span className="hidden lg:inline font-mono text-text-dim">chk: <strong className="text-text-secondary">{currentContext.lastCheckpointTime}</strong></span>
        )}
        <button
          onClick={() => toggleBottomPanel(activeBottomPanel || 'context')}
          className="text-text-dim hover:text-white p-1 rounded-md hover:bg-white/[0.08] transition-colors"
          title="Toggle Dock Drawer"
        >
          {activeBottomPanel ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>
    </footer>
  );
};
