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
    <footer className="h-7 bg-panel border-t border-border px-2 flex items-center justify-between select-none z-20 font-mono text-[11px]">
      <div className="flex items-center gap-0.5">
        {navItems.map(item => {
          const isActive = activeBottomPanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => toggleBottomPanel(item.id)}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-0.5 rounded transition-colors',
                isActive
                  ? 'bg-panel-elevated text-text-primary border border-border shadow-subtle font-medium'
                  : 'text-text-muted hover:text-text-secondary hover:bg-panel-elevated/40 border border-transparent'
              )}
            >
              <span className={clsx(isActive ? 'text-accent' : 'text-text-dim')}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className={clsx(
                    'text-[10px] px-1 rounded',
                    isActive ? 'bg-accent/15 text-accent font-semibold' : 'bg-background text-text-dim'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-text-muted">
        {currentContext?.lastCheckpointTime && (
          <span className="hidden sm:inline">chk: {currentContext.lastCheckpointTime}</span>
        )}
        <button
          onClick={() => toggleBottomPanel(activeBottomPanel || 'context')}
          className="text-text-dim hover:text-text-secondary p-0.5 rounded transition-colors"
          title="Toggle Dock Panel"
        >
          {activeBottomPanel ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>
    </footer>
  );
};
