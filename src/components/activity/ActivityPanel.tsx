import React from 'react';
import { Activity as ActivityIcon, Bot, FileCode, CheckCircle2, AlertOctagon, BookmarkPlus, Share2, X } from 'lucide-react';
import { useActivityStore } from '../../stores/activity.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { ActivityType } from '../../types/orbit';

export const ActivityPanel: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceStore();
  const { getActivities } = useActivityStore();
  const { setActiveBottomPanel } = useUIStore();

  const activities = activeWorkspaceId ? getActivities(activeWorkspaceId) : [];

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'agent_started':
        return <Bot size={12} className="text-text-secondary" />;
      case 'file_changed':
        return <FileCode size={12} className="text-status-info" />;
      case 'test_run':
        return <CheckCircle2 size={12} className="text-status-success" />;
      case 'test_failed':
        return <AlertOctagon size={12} className="text-status-error" />;
      case 'checkpoint':
        return <BookmarkPlus size={12} className="text-status-warning" />;
      case 'handoff':
        return <Share2 size={12} className="text-accent" />;
      default:
        return <ActivityIcon size={12} className="text-text-muted" />;
    }
  };

  return (
    <div className="h-72 bg-panel-elevated border-t border-border flex flex-col overflow-hidden text-xs select-none font-mono">
      {/* Header */}
      <div className="h-7 px-3 bg-background-secondary border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-text-secondary font-bold text-[10px]">
            Activity Timeline
          </span>
          <span className="text-[10px] text-text-muted">
            ({activities.length} events)
          </span>
        </div>

        <button
          onClick={() => setActiveBottomPanel(null)}
          className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-panel"
        >
          <X size={13} />
        </button>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activities.map((act) => (
          <div key={act.id} className="flex items-start gap-2.5 text-[11px] font-mono group">
            <span className="text-text-muted text-[10px] w-10 shrink-0 pt-0.5">{act.timeString}</span>

            <div className="w-5 h-5 rounded bg-background border border-border flex items-center justify-center shrink-0">
              {getActivityIcon(act.type)}
            </div>

            <div className="flex-1 min-w-0 pt-0.5 font-sans">
              <p className="text-text-primary text-[11.5px] leading-tight">
                {act.description}
              </p>
              {act.details && (
                <p className="text-[10px] text-text-muted font-mono mt-0.5">
                  {act.details}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
