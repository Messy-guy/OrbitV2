import React from 'react';
import { MessageSquare, BookmarkPlus, X } from 'lucide-react';
import { useAgentStore } from '../../stores/agent.store';
import { useContextStore } from '../../stores/context.store';
import { useUIStore } from '../../stores/ui.store';
import { Badge } from '../ui/Badge';
import { clsx } from 'clsx';

export const SessionsPanel: React.FC = () => {
  const { agents, sessions, activeSessionIdByAgent, setActiveSession } = useAgentStore();
  const { checkpoints } = useContextStore();
  const { setActiveBottomPanel } = useUIStore();

  return (
    <div className="h-72 bg-panel-elevated border-t border-border flex flex-col overflow-hidden text-xs select-none font-mono">
      {/* Header */}
      <div className="h-7 px-3 bg-background-secondary border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-text-secondary font-bold text-[10px]">
            Agent Sessions & Checkpoints
          </span>
        </div>

        <button
          onClick={() => setActiveBottomPanel(null)}
          className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-panel"
        >
          <X size={13} />
        </button>
      </div>

      {/* Grid: Sessions List + Checkpoints History */}
      <div className="flex-1 overflow-y-auto p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Sessions list */}
        <div className="p-3 rounded bg-panel border border-border flex flex-col">
          <span className="text-[9.5px] uppercase tracking-widest text-text-muted font-bold mb-2 flex items-center gap-1.5">
            <MessageSquare size={11} className="text-accent" />
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
                    'p-2 rounded border cursor-pointer flex items-center justify-between transition-colors',
                    isActive
                      ? 'bg-accent/10 border-accent/30 text-text-primary'
                      : 'bg-background-secondary border-border-subtle hover:border-border text-text-secondary'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'w-1.5 h-1.5 rounded-full',
                      sess.status === 'active' ? 'bg-status-success' : 'bg-text-dim'
                    )} />
                    <div>
                      <div className="font-bold text-[11px] text-text-primary flex items-center gap-1.5">
                        <span>{agent.name}</span>
                        <span className="text-[10px] text-text-muted font-normal">
                          · {sess.title}
                        </span>
                      </div>
                      <div className="text-[9.5px] text-text-muted mt-0.5">
                        {sess.lastActivityTime || 'Active'}
                      </div>
                    </div>
                  </div>

                  <span className={clsx(
                    'text-[9.5px] px-1.5 py-0.2 rounded font-bold uppercase',
                    sess.status === 'active' ? 'bg-status-success/15 text-status-success' : 'bg-background text-text-dim'
                  )}>
                    {sess.status}
                  </span>
                </div>
              );
            }))}
          </div>
        </div>

        {/* Checkpoints History */}
        <div className="p-3 rounded bg-panel border border-border flex flex-col">
          <span className="text-[9.5px] uppercase tracking-widest text-text-muted font-bold mb-2 flex items-center gap-1.5">
            <BookmarkPlus size={11} className="text-status-warning" />
            <span>Checkpoints ({checkpoints.length})</span>
          </span>

          <div className="space-y-1 flex-1 overflow-y-auto font-mono">
            {checkpoints.map(chk => (
              <div
                key={chk.id}
                className="p-2 rounded bg-background-secondary border border-border-subtle text-[11px]"
              >
                <div className="flex items-center justify-between font-medium text-text-primary mb-0.5">
                  <span className="font-bold">{chk.name}</span>
                  <span className="text-[9.5px] text-text-muted">
                    {new Date(chk.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[10.5px] text-text-secondary font-sans leading-snug">{chk.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
