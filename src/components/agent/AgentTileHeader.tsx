import React, { useState } from 'react';
import { MoreVertical, Trash2, Plus, Play, Pause, Terminal, MessageSquare } from 'lucide-react';
import { Agent, AgentStatus } from '../../types/orbit';
import { Badge } from '../ui/Badge';
import { useAgentStore } from '../../stores/agent.store';

interface AgentTileHeaderProps {
  agent: Agent;
}

export const AgentTileHeader: React.FC<AgentTileHeaderProps> = ({ agent }) => {
  const { removeAgent, setAgentStatus, sessions, activeSessionIdByAgent, setActiveSession, createNewSession, toggleAgentViewMode } = useAgentStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const agentSessions = sessions[agent.id] || [];
  const currentSessionId = activeSessionIdByAgent[agent.id];
  const isTerminal = agent.viewMode !== 'chat';

  const getStatusDot = (status: AgentStatus) => {
    switch (status) {
      case 'working':
        return <Badge variant="default" dot className="text-[9.5px] py-0 px-1.5 font-mono uppercase font-bold text-text-primary">Running</Badge>;
      case 'ready':
        return <Badge variant="success" dot className="text-[9.5px] py-0 px-1.5 font-mono uppercase font-bold">Idle</Badge>;
      case 'waiting':
        return <Badge variant="warning" dot className="text-[9.5px] py-0 px-1.5 font-mono uppercase font-bold">Waiting</Badge>;
      case 'paused':
        return <Badge variant="secondary" dot className="text-[9.5px] py-0 px-1.5 font-mono uppercase font-bold">Paused</Badge>;
      case 'error':
        return <Badge variant="error" dot className="text-[9.5px] py-0 px-1.5 font-mono uppercase font-bold">Error</Badge>;
      default:
        return <Badge variant="secondary" className="text-[9.5px] py-0 px-1.5 font-mono">{status}</Badge>;
    }
  };

  return (
    <div className="px-3.5 py-2 bg-[#171821]/80 backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between select-none handle cursor-move relative">
      {/* Left: Agent Identifier + Model */}
      <div className="flex items-center gap-2.5 truncate">
        {getStatusDot(agent.status)}
        <div className="truncate flex items-center gap-1.5">
          <span className="font-mono font-extrabold text-xs tracking-wider uppercase text-white">
            {agent.name}
          </span>
          <span className="text-white/20 text-xs font-mono">/</span>
          <span className="text-[10px] font-mono text-[#8e93a0] truncate font-medium">
            {agent.model}
          </span>
        </div>
      </div>

      {/* Right: View Mode Toggle (Terminal vs Chat) + Session Switcher + Menu */}
      <div className="flex items-center gap-1.5 no-drag">
        {/* Toggle Mode Button */}
        <button
          onClick={() => toggleAgentViewMode(agent.id)}
          className="px-2 py-0.5 rounded-md text-[10px] font-mono flex items-center gap-1.5 bg-black/40 hover:bg-white/[0.08] text-text-secondary hover:text-white border border-white/[0.08] transition-all"
          title={isTerminal ? "Switch to Structured Chat View" : "Switch to Raw Terminal CLI"}
        >
          {isTerminal ? (
            <>
              <Terminal size={11} className="text-[#00e5ff]" />
              <span className="font-bold tracking-wider">CLI</span>
            </>
          ) : (
            <>
              <MessageSquare size={11} className="text-emerald-400" />
              <span className="font-bold tracking-wider">CHAT</span>
            </>
          )}
        </button>

        {agentSessions.length > 1 && (
          <select
            value={currentSessionId || ''}
            onChange={(e) => setActiveSession(agent.id, e.target.value)}
            className="bg-black/40 border border-white/[0.08] rounded-md text-[10px] font-mono text-text-secondary px-2 py-0.5 focus:outline-none focus:border-[#00e5ff]/50"
          >
            {agentSessions.map(s => (
              <option key={s.id} value={s.id} className="bg-[#14151c] text-white">
                {s.title.split('—')[0].trim()}
              </option>
            ))}
          </select>
        )}

        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-text-muted hover:text-white p-1 rounded-md hover:bg-white/[0.08] transition-colors"
          >
            <MoreVertical size={13} />
          </button>

          {isMenuOpen && (
            <div
              className="absolute right-0 top-7 w-44 surface-elevated rounded-lg shadow-2xl py-1.5 z-50 text-xs font-mono border border-white/[0.12]"
              onMouseLeave={() => setIsMenuOpen(false)}
            >
              <button
                onClick={() => {
                  createNewSession(agent.id, agent.workspaceId);
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-white/[0.08] hover:text-white flex items-center gap-2 text-text-secondary text-[11px] transition-colors"
              >
                <Plus size={12} />
                <span>New Session</span>
              </button>

              <button
                onClick={() => {
                  setAgentStatus(agent.id, agent.status === 'paused' ? 'ready' : 'paused');
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-white/[0.08] hover:text-white flex items-center gap-2 text-text-secondary text-[11px] transition-colors"
              >
                {agent.status === 'paused' ? <Play size={12} /> : <Pause size={12} />}
                <span>{agent.status === 'paused' ? 'Resume Process' : 'Pause Process'}</span>
              </button>

              <div className="h-px bg-white/[0.08] my-1" />

              <button
                onClick={() => {
                  removeAgent(agent.id);
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-500/20 text-red-400 flex items-center gap-2 text-[11px] transition-colors font-semibold"
              >
                <Trash2 size={12} />
                <span>Delete Terminal</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
