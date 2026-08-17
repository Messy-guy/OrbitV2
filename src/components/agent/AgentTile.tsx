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
  const { activeSessionIdByAgent, sessions } = useAgentStore();
  const { setShareContextOpen, setCreateCheckpointOpen, setActiveBottomPanel } = useUIStore();

  const currentSessionId = activeSessionIdByAgent[agent.id] || sessions[agent.id]?.[0]?.id;
  const isTerminal = agent.viewMode !== 'chat';

  return (
    <div className="h-full w-full surface-panel rounded-panel shadow-panel flex flex-col overflow-hidden transition-colors focus-within:border-border-hover">
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
      <div className="h-7 px-2.5 bg-panel-elevated/70 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono select-none no-drag">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveBottomPanel('context')}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-text-muted hover:text-text-primary hover:bg-panel transition-colors"
            title="Open Project Context"
          >
            <Database size={11} />
            <span>Context</span>
          </button>

          <button
            onClick={() => setShareContextOpen(true, agent.id)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-btn btn-base text-text-primary hover:text-white font-semibold transition-all"
            title="Share Context to another Agent"
          >
            <Share2 size={11} />
            <span>Share</span>
          </button>

          <button
            onClick={() => setCreateCheckpointOpen(true, agent.id)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-text-muted hover:text-text-primary hover:bg-panel transition-colors"
            title="Create Project Checkpoint"
          >
            <BookmarkPlus size={11} />
            <span>Checkpoint</span>
          </button>
        </div>

        <div className="text-[9.5px] text-text-dim uppercase font-bold tracking-wider">
          {agent.provider}
        </div>
      </div>
    </div>
  );
};
