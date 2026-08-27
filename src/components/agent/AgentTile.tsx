import React from 'react';
import { Agent } from '../../types/orbit';
import { AgentTileHeader } from './AgentTileHeader';
import { AgentTerminal } from './AgentTerminal';
import { AgentChat } from './AgentChat';
import { useAgentStore } from '../../stores/agent.store';
import { useUIStore } from '../../stores/ui.store';
import { Database, Share2, BookmarkPlus } from 'lucide-react';

interface AgentTileProps {
  agent: Agent;
}

export const AgentTile: React.FC<AgentTileProps> = ({ agent }) => {
  const { activeSessionIdByAgent, sessions, setAgentRole } = useAgentStore();
  const { setShareContextOpen, setCreateCheckpointOpen, setActiveBottomPanel } = useUIStore();
  const [isDragOver, setIsDragOver] = React.useState(false);

  const currentSessionId = activeSessionIdByAgent[agent.id] || sessions[agent.id]?.[0]?.id;
  const isTerminal = agent.viewMode !== 'chat';

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-orbit-role')) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedRole = e.dataTransfer.getData('application/x-orbit-role') as import('../../types/orbit').AgentRoleType;
    if (droppedRole) {
      setAgentRole(agent.id, droppedRole);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`h-full w-full surface-panel rounded-2xl shadow-panel flex flex-col overflow-hidden transition-all relative ${
        isDragOver
          ? 'ring-2 ring-emerald-500/80 border-emerald-500/50 scale-[1.005] shadow-2xl'
          : 'focus-within:border-border-hover'
      }`}
    >
      {/* Visual Role Drop Highlight Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-xs z-40 pointer-events-none flex items-center justify-center border-2 border-dashed border-emerald-400/80 rounded-2xl">
          <div className="px-3.5 py-2 rounded-full bg-[#10121A] border border-emerald-400 shadow-xl flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-mono font-bold text-xs text-emerald-400 uppercase tracking-wider">
              Drop to Assign Role
            </span>
          </div>
        </div>
      )}

      {/* Header with CLI / Chat Switcher */}
      <AgentTileHeader agent={agent} />

      {/* Main Terminal Harness / Conversation Stream */}
      {isTerminal ? (
        <AgentTerminal agent={agent} />
      ) : currentSessionId ? (
        <AgentChat agent={agent} sessionId={currentSessionId} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-text-muted font-mono surface-well">
          Session not attached
        </div>
      )}

      {/* Footer Quick Actions */}
      <div className="h-9 px-3.5 bg-[#111217]/80 backdrop-blur-md border-t border-white/[0.08] flex items-center justify-between text-xs font-mono select-none no-drag">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveBottomPanel('context')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-text-muted hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Open Project Context"
          >
            <Database size={12} className="text-[#00e5ff]/70" />
            <span className="font-medium">Context</span>
          </button>

          <button
            onClick={() => setShareContextOpen(true, agent.id)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-white/90 text-black font-bold transition-all shadow-sm active:translate-y-[0.5px] cursor-pointer"
            title="Share Context to another Agent"
          >
            <Share2 size={12} strokeWidth={2.5} />
            <span className="tracking-wide text-[11px]">Handoff</span>
          </button>

          <button
            onClick={() => setCreateCheckpointOpen(true, agent.id)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-text-muted hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Save Checkpoint of current Workspace & Logs"
          >
            <BookmarkPlus size={12} />
            <span>Checkpoint</span>
          </button>
        </div>

        <div className="text-[10px] text-text-dim font-mono">
          Session ID: <span className="text-text-muted font-bold">{currentSessionId?.slice(0, 8) || 'raw'}</span>
        </div>
      </div>
    </div>
  );
};
