import React, { useState } from 'react';
import { MoreVertical, Trash2, Plus, Play, Pause, Terminal } from 'lucide-react';
import { Agent, AgentStatus } from '../../types/orbit';
import { Badge } from '../ui/Badge';
import { useAgentStore } from '../../stores/agent.store';
import { clsx } from 'clsx';

interface AgentTileHeaderProps {
  agent: Agent;
}

export const AgentTileHeader: React.FC<AgentTileHeaderProps> = ({ agent }) => {
  const { removeAgent, setAgentStatus, sessions, activeSessionIdByAgent, setActiveSession, createNewSession } = useAgentStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const agentSessions = sessions[agent.id] || [];
  const currentSessionId = activeSessionIdByAgent[agent.id];

  const getStatusDot = (status: AgentStatus) => {
    switch (status) {
      case 'working':
        return <Badge variant="info" dot className="text-[10px] py-0 px-1.5 font-mono">Working</Badge>;
      case 'ready':
        return <Badge variant="success" dot className="text-[10px] py-0 px-1.5 font-mono">Ready</Badge>;
      case 'waiting':
        return <Badge variant="warning" dot className="text-[10px] py-0 px-1.5 font-mono">Waiting</Badge>;
      case 'paused':
        return <Badge variant="secondary" dot className="text-[10px] py-0 px-1.5 font-mono">Paused</Badge>;
      case 'error':
        return <Badge variant="error" dot className="text-[10px] py-0 px-1.5 font-mono">Error</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">{status}</Badge>;
    }
  };

  return (
    <div className="px-3 py-2 bg-panel-elevated/70 border-b border-border flex items-center justify-between select-none handle cursor-move">
      {/* Left: Agent Identifier + Model */}
      <div className="flex items-center gap-2 truncate">
        {getStatusDot(agent.status)}
        <div className="truncate flex items-center gap-1.5">
          <span className="font-mono font-bold text-[11px] tracking-wider uppercase text-text-primary">
            {agent.name}
          </span>
          <span className="text-text-dim text-[11px] font-mono">/</span>
          <span className="text-[11px] font-mono text-text-muted truncate">
            {agent.model}
          </span>
        </div>
      </div>

      {/* Right: Session Switcher & Menu */}
      <div className="flex items-center gap-1.5 no-drag">
        {agentSessions.length > 1 && (
          <select
            value={currentSessionId || ''}
            onChange={(e) => setActiveSession(agent.id, e.target.value)}
            className="bg-background-secondary border border-border rounded text-[10px] font-mono text-text-secondary px-1.5 py-0.5 focus:outline-none focus:border-accent"
          >
            {agentSessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.title.split('—')[0].trim()}
              </option>
            ))}
          </select>
        )}

        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-panel transition-colors"
          >
            <MoreVertical size={13} />
          </button>

          {isMenuOpen && (
            <div
              className="absolute right-0 top-6 w-40 bg-panel-elevated border border-border rounded-panel shadow-elevated py-1 z-50 text-xs font-mono"
              onMouseLeave={() => setIsMenuOpen(false)}
            >
              <button
                onClick={() => {
                  createNewSession(agent.id, agent.workspaceId);
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-panel hover:text-text-primary flex items-center gap-2 text-text-secondary text-[11px]"
              >
                <Plus size={12} />
                <span>New Session</span>
              </button>

              <button
                onClick={() => {
                  setAgentStatus(agent.id, agent.status === 'paused' ? 'ready' : 'paused');
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-panel hover:text-text-primary flex items-center gap-2 text-text-secondary text-[11px]"
              >
                {agent.status === 'paused' ? <Play size={12} /> : <Pause size={12} />}
                <span>{agent.status === 'paused' ? 'Resume' : 'Pause'}</span>
              </button>

              <div className="h-px bg-border my-1" />

              <button
                onClick={() => {
                  removeAgent(agent.id);
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-status-error/15 text-status-error flex items-center gap-2 text-[11px]"
              >
                <Trash2 size={12} />
                <span>Remove Tile</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
