import React, { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Maximize2, Minimize2, X, Terminal as TerminalIcon, Cpu, Code2, Bot, Bookmark, ArrowLeftRight, Activity, Copy, Trash2 } from 'lucide-react';
import { Agent, AgentUsageStats } from '../../types/orbit';
import { AgentTerminal } from './AgentTerminal';
import { AgentChat } from './AgentChat';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { tauriService } from '../../services/tauri.service';

interface AgentFloatingWindowProps {
  agent: Agent;
  initialPosition: { x: number; y: number; width: number; height: number };
  zIndex: number;
  isActive: boolean;
  scale?: number;
  onFocus: () => void;
  onPositionChange: (pos: { x: number; y: number; width: number; height: number }) => void;
}

export const AgentFloatingWindow: React.FC<AgentFloatingWindowProps> = ({
  agent,
  initialPosition,
  zIndex,
  isActive,
  scale = 1,
  onFocus,
  onPositionChange,
}) => {
  const { removeAgent, activeSessionIdByAgent, sessions } = useAgentStore();
  const { getActiveWorkspace } = useWorkspaceStore();
  const { setCreateCheckpointOpen, setShareContextOpen, maximizedAgentId, setMaximizedAgentId } = useUIStore();
  const [prevBounds, setPrevBounds] = useState(initialPosition);
  const [usage, setUsage] = useState<AgentUsageStats | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchUsage = async () => {
      const stats = await tauriService.getAgentUsageStats(agent.id, agent.provider);
      if (isMounted && stats) {
        setUsage(stats);
      }
    };

    fetchUsage();
    const interval = setInterval(fetchUsage, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [agent.id, agent.provider]);

  const activeWorkspace = getActiveWorkspace();
  const currentSessionId = activeSessionIdByAgent[agent.id] || sessions[agent.id]?.[0]?.id;
  const isTerminal = agent.viewMode !== 'chat';

  const getProviderIcon = () => {
    switch (agent.provider) {
      case 'antigravity':
        return <span className="text-white font-mono font-bold text-[11px]">▲</span>;
      case 'claude':
        return <Cpu size={12} className="text-white/80" />;
      case 'opencode':
        return <Code2 size={12} className="text-white/80" />;
      case 'codex':
        return <TerminalIcon size={12} className="text-white/80" />;
      default:
        return <TerminalIcon size={12} className="text-white/60" />;
    }
  };

  const getProviderLabel = () => {
    switch (agent.provider) {
      case 'antigravity':
        return 'Antigravity';
      case 'claude':
        return 'Claude Code';
      case 'opencode':
        return 'OpenCode';
      case 'codex':
        return 'Codex CLI';
      default:
        return agent.name || 'Terminal';
    }
  };

  const isMaximized = maximizedAgentId === agent.id;

  const handleToggleMaximize = () => {
    if (!isMaximized) {
      setPrevBounds(initialPosition);
      setMaximizedAgentId(agent.id);
    } else {
      setMaximizedAgentId(null);
      onPositionChange(prevBounds);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  return (
    <Rnd
      size={
        isMaximized
          ? { width: '100%', height: '100%' }
          : { width: initialPosition.width, height: initialPosition.height }
      }
      position={isMaximized ? { x: 0, y: 0 } : { x: initialPosition.x, y: initialPosition.y }}
      onDragStart={() => {
        setIsDragging(true);
        onFocus();
      }}
      onDragStop={(_e, d) => {
        setIsDragging(false);
        if (!isMaximized) {
          onPositionChange({
            ...initialPosition,
            x: d.x,
            y: d.y,
          });
        }
      }}
      onResizeStart={() => {
        setIsDragging(true);
        onFocus();
      }}
      onResizeStop={(_e, _direction, ref, _delta, position) => {
        setIsDragging(false);
        if (!isMaximized) {
          onPositionChange({
            x: position.x,
            y: position.y,
            width: parseInt(ref.style.width, 10),
            height: parseInt(ref.style.height, 10),
          });
        }
      }}
      minWidth={300}
      minHeight={200}
      scale={isMaximized ? 1 : scale}
      dragHandleClassName="floating-window-header"
      cancel=".no-drag, input, textarea, button, select"
      disableDragging={isMaximized}
      enableResizing={!isMaximized}
      bounds="parent"
      className={`rounded-xl flex flex-col overflow-hidden transition-colors duration-200 ${
        isActive
          ? 'shadow-[0_14px_44px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-white/10'
          : 'shadow-xl opacity-95'
      }`}
      style={{
        zIndex: isMaximized ? 9999 : zIndex,
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        willChange: isDragging ? 'transform' : 'auto',
        backgroundColor: 'var(--bg-panel, #090a0f)',
        borderColor: isActive ? 'var(--border-hover, rgba(255,255,255,0.25))' : 'var(--border-base, rgba(255,255,255,0.1))',
        borderWidth: 1,
        borderStyle: 'solid',
      }}
      onMouseDown={onFocus}
    >
      {/* Top Titlebar */}
      <div
        className="floating-window-header h-8 px-3 border-b flex items-center justify-between select-none cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors duration-200"
        style={{
          backgroundColor: isActive ? 'var(--bg-panel-elevated, #181920)' : 'var(--bg-chrome, #121317)',
          borderColor: 'var(--border-subtle, rgba(255,255,255,0.08))',
        }}
        onDoubleClick={handleToggleMaximize}
      >
        {/* Left: Provider Icon + Agent Name + Live Usage Cap Badge */}
        <div className="flex items-center gap-2 truncate">
          <div className="flex items-center justify-center w-4 h-4">
            {getProviderIcon()}
          </div>
          <span className="text-[12px] font-medium font-mono text-[#e4e4e7] tracking-tight truncate">
            {getProviderLabel()}
          </span>

          {/* Antigravity Real-Time Usage & Context Cap Indicator */}
          {usage && agent.provider === 'antigravity' && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[9.5px] font-mono text-[#A0A4B4] ml-1"
              title={`Antigravity Token Cap: ${(usage.activeTokens / 1000).toFixed(1)}k / 1,000k context (${usage.percentageUsed.toFixed(1)}%) · ${usage.transcriptTurns} turns`}
            >
              <span className="text-white font-semibold">
                {(usage.activeTokens / 1000).toFixed(1)}k
              </span>
              <span className="text-[#5C6070]">/ 1M</span>
              <span className="text-emerald-400 font-bold ml-0.5">
                {usage.percentageUsed.toFixed(0)}%
              </span>
            </div>
          )}
        </div>

        {/* Right: Quick Actions (Copy, Checkpoint, Handoff) + Window Controls */}
        <div className="flex items-center gap-1 no-drag">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const history = await tauriService.getAgentTerminalHistory(agent.id);
                if (history) {
                  await navigator.clipboard.writeText(history);
                }
              } catch (err) {
                console.warn('Copy terminal history failed:', err);
              }
            }}
            className="p-1 text-[#8e93a0] hover:text-[#f3f4f8] hover:bg-[#252834] rounded transition-colors"
            title="Copy all terminal output to clipboard"
          >
            <Copy size={11} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              // Send clear command (\x0c or clear)
              const sessId = activeSessionIdByAgent[agent.id] || 'default';
              tauriService.sendAgentInput(agent.id, sessId, 'clear\n').catch(() => {});
            }}
            className="p-1 text-[#8e93a0] hover:text-[#f3f4f8] hover:bg-[#252834] rounded transition-colors"
            title="Clear Terminal Buffer"
          >
            <Trash2 size={11} />
          </button>

          <div className="h-3 w-px bg-[#292b35] mx-0.5" />

          <button
            onClick={(e) => {
              e.stopPropagation();
              setCreateCheckpointOpen(true, agent.id);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-[#8e93a0] hover:text-[#f3f4f8] hover:bg-[#252834] rounded transition-colors"
            title="Create Checkpoint snapshot for this agent"
          >
            <Bookmark size={11} className="text-white/60" />
            <span className="hidden sm:inline">Checkpoint</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShareContextOpen(true, agent.id);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-[#8e93a0] hover:text-[#f3f4f8] hover:bg-[#252834] rounded transition-colors"
            title="Handoff context to another agent"
          >
            <ArrowLeftRight size={11} className="text-white/60" />
            <span className="hidden sm:inline">Handoff</span>
          </button>

          <div className="h-3 w-px bg-[#292b35] mx-0.5" />

          <button
            onClick={handleToggleMaximize}
            className="p-1 text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#1c1e24] rounded transition-colors"
            title={isMaximized ? "Restore Window (Ctrl+Shift+F)" : "Maximize Window (Ctrl+Shift+F)"}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={() => removeAgent(agent.id)}
            className="p-1 text-[#71717a] hover:text-[#ef4444] hover:bg-[#1c1e24] rounded transition-colors"
            title="Close Terminal"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Center: Terminal Harness / Chat */}
      <div
        className={`flex-1 flex flex-col min-h-0 relative overflow-hidden bg-[#090a0f] ${
          isDragging ? 'pointer-events-none select-none' : ''
        }`}
      >
        {isTerminal ? (
          <AgentTerminal agent={agent} />
        ) : currentSessionId ? (
          <AgentChat agent={agent} sessionId={currentSessionId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-[#71717a] font-mono">
            Session not attached
          </div>
        )}
      </div>
    </Rnd>
  );
};

