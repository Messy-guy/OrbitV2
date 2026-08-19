import React from 'react';
import { MessageSquare, BookmarkPlus, X } from 'lucide-react';
import { useAgentStore } from '../../stores/agent.store';
import { useContextStore } from '../../stores/context.store';
import { useUIStore } from '../../stores/ui.store';
import { clsx } from 'clsx';

export const SessionsPanel: React.FC = () => {
  const { agents, sessions, activeSessionIdByAgent, setActiveSession } = useAgentStore();
  const { checkpoints } = useContextStore();
  const { setActiveBottomPanel } = useUIStore();

  return (
    <div className="h-72 bg-canvas-chrome border-t border-border flex flex-col overflow-hidden text-xs select-none font-mono shadow-dock">
      {/* Header */}
      <div className="h-7 px-3 bg-panel border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-text-primary font-bold text-[10px]">
            Agent Sessions & Checkpoints
          </span>
        </div>

        <button
          onClick={() => setActiveBottomPanel(null)}
          className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-panel-hover transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* Grid: Sessions List + Checkpoints History */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Sessions list */}
        <div className="p-3 rounded-panel surface-well border border-border flex flex-col">
          <span className="text-[9.5px] uppercase tracking-widest text-text-dim font-bold mb-2 flex items-center gap-1.5">
            <MessageSquare size={11} className="text-text-primary" />
            <span>Agent Sessions</span>
          </span>

          <div className="space-y-1 flex-1 overflow-y-auto font-mono">
            {agents.flatMap(agent => (sessions[agent.id] || []).map(sess => {
              const isActive = activeSessionIdByAgent[agent.id] === sess.id;
              return (
                <div
                  key={sess.id}
                  onClick={() => setActiveSession(agent.id, sess.id)}
                  className={clsx(
                    'p-2 rounded-btn border cursor-pointer flex items-center justify-between transition-colors',
                    isActive
                      ? 'btn-primary text-canvas-chrome font-bold'
                      : 'bg-panel border-border hover:border-border-hover text-text-secondary hover:text-text-primary'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'w-1.5 h-1.5 rounded-full',
                      isActive ? 'bg-canvas-chrome' : (sess.status === 'active' ? 'bg-status-success' : 'bg-text-dim')
                    )} />
                    <div>
                      <div className={clsx("font-bold text-[11px] flex items-center gap-1.5", isActive ? "text-canvas-chrome" : "text-text-primary")}>
                        <span>{agent.name}</span>
                        <span className={clsx("text-[10px] font-normal", isActive ? "text-canvas-chrome/70" : "text-text-muted")}>
                          · {sess.title}
                        </span>
                      </div>
                      <div className={clsx("text-[9.5px] mt-0.5", isActive ? "text-canvas-chrome/80" : "text-text-dim")}>
                        {sess.lastActivityTime || 'Active'}
                      </div>
                    </div>
                  </div>

                  <span className={clsx(
                    'text-[9px] px-1 py-0.2 rounded font-bold uppercase',
                    isActive ? 'bg-canvas-chrome text-white' : (sess.status === 'active' ? 'bg-status-success/20 text-status-success' : 'bg-well text-text-dim border border-border-subtle')
                  )}>
                    {sess.status}
                  </span>
                </div>
              );
            }))}
          </div>
        </div>

        {/* Checkpoints History */}
        <div className="p-3 rounded-panel surface-well border border-border flex flex-col">
          <span className="text-[9.5px] uppercase tracking-widest text-text-dim font-bold mb-2 flex items-center gap-1.5">
            <BookmarkPlus size={11} className="text-status-warning" />
            <span>Checkpoints ({checkpoints.length})</span>
          </span>

          <div className="space-y-1.5 flex-1 overflow-y-auto font-mono">
            {checkpoints.map(chk => (
              <div
                key={chk.id}
                className="p-2 rounded-btn bg-panel border border-border text-[11px]"
              >
                <div className="flex items-center justify-between font-medium text-text-primary mb-0.5">
                  <span className="font-bold">{chk.name}</span>
                  <span className="text-[9.5px] text-text-dim font-mono">
                    {new Date(chk.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary font-sans leading-snug">{chk.progress || chk.task}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
