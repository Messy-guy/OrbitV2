import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  Terminal, 
  Cpu, 
  Code2, 
  Layers, 
  Copy, 
  Trash2, 
  Bookmark, 
  ArrowLeftRight 
} from 'lucide-react';
import { Agent } from '../../types/orbit';
import { AgentTerminal } from './AgentTerminal';
import { AgentChat } from './AgentChat';
import { useAgentStore } from '../../stores/agent.store';
import { useUIStore } from '../../stores/ui.store';
import { tauriService } from '../../services';
import { clsx } from 'clsx';

interface AgentFloatingWindowProps {
  agent: Agent;
  initialPosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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
  const { removeAgent, activeSessionIdByAgent } = useAgentStore();
  const { 
    setShareContextOpen, 
    setCreateCheckpointOpen, 
    maximizedAgentId, 
    setMaximizedAgentId 
  } = useUIStore();

  const isMaximized = maximizedAgentId === agent.id;
  const [prevBounds, setPrevBounds] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);

  const currentSessionId = activeSessionIdByAgent[agent.id];
  const isTerminal = agent.viewMode !== 'chat';

  const getProviderIcon = () => {
    switch (agent.provider) {
      case 'antigravity':
        return <span className="font-mono font-bold text-[11px] text-text-primary">▲</span>;
      case 'claude':
        return <Cpu size={12} className="text-amber-500" />;
      case 'opencode':
        return <Code2 size={12} className="text-cyan-500" />;
      default:
        return <Terminal size={12} className="text-text-muted" />;
    }
  };

  const getProviderLabel = () => {
    if (agent.provider === 'antigravity') return 'Antigravity CLI';
    if (agent.provider === 'claude') return 'Claude Code';
    if (agent.provider === 'opencode') return 'OpenCode Interpreter';
    return agent.name || 'Terminal';
  };

  const handleToggleMaximize = () => {
    if (!isMaximized) {
      setPrevBounds(initialPosition);
      setMaximizedAgentId(agent.id);
    } else {
      setMaximizedAgentId(null);
      onPositionChange(prevBounds);
    }
  };

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
      className={clsx(
        "rounded-2xl flex flex-col overflow-hidden shadow-panel border",
        !isDragging && "transition-[border-color,box-shadow,opacity] duration-150",
        isActive 
          ? "border-border-hover shadow-2xl ring-1 ring-border" 
          : "border-border opacity-95",
        isDragging && "shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-border-hover cursor-grabbing ring-2 ring-emerald-500/30"
      )}
      style={{
        zIndex: isMaximized ? 9999 : zIndex,
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        transform: 'translate3d(0,0,0)',
        backfaceVisibility: 'hidden',
        willChange: isDragging ? 'transform' : 'auto',
        backgroundColor: 'var(--bg-panel, #090a0f)',
      }}
      onMouseDown={onFocus}
    >
      {/* Top Titlebar */}
      <div
        className="floating-window-header h-8 px-3 border-b border-border flex items-center justify-between select-none cursor-grab active:cursor-grabbing flex-shrink-0 bg-panel-elevated transition-colors"
        onDoubleClick={handleToggleMaximize}
      >
        {/* Left: Provider Icon + Agent Name + Live Usage Cap Badge */}
        <div className="flex items-center gap-2 truncate">
          <div className="flex items-center justify-center w-4 h-4">
            {getProviderIcon()}
          </div>
          <span className="text-[12px] font-bold font-mono text-text-primary tracking-tight truncate">
            {getProviderLabel()}
          </span>
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
            className="p-1 text-text-muted hover:text-text-primary hover:bg-well rounded-lg transition-colors cursor-pointer"
            title="Copy all terminal output to clipboard"
          >
            <Copy size={11} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              const sessId = activeSessionIdByAgent[agent.id] || 'default';
              tauriService.sendAgentInput(agent.id, sessId, 'clear\n').catch(() => {});
            }}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-well rounded-lg transition-colors cursor-pointer"
            title="Clear Terminal Buffer"
          >
            <Trash2 size={11} />
          </button>

          <div className="h-3 w-px bg-border mx-0.5" />

          <button
            onClick={(e) => {
              e.stopPropagation();
              setCreateCheckpointOpen(true, agent.id);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-text-muted hover:text-text-primary hover:bg-well rounded-lg transition-colors cursor-pointer"
            title="Create Checkpoint snapshot for this agent"
          >
            <Bookmark size={11} />
            <span className="hidden sm:inline">Checkpoint</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShareContextOpen(true, agent.id);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-text-muted hover:text-text-primary hover:bg-well rounded-lg transition-colors cursor-pointer"
            title="Handoff context to another agent"
          >
            <ArrowLeftRight size={11} />
            <span className="hidden sm:inline">Handoff</span>
          </button>

          <div className="h-3 w-px bg-border mx-0.5" />

          <button
            onClick={handleToggleMaximize}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-well rounded-lg transition-colors cursor-pointer"
            title={isMaximized ? "Restore Window (Ctrl+Shift+F)" : "Maximize Window (Ctrl+Shift+F)"}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={() => removeAgent(agent.id)}
            className="p-1 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
            title="Close Terminal"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Center: Terminal Harness / Chat */}
      <div
        className={clsx(
          "flex-1 flex flex-col min-h-0 relative overflow-hidden bg-canvas",
          isDragging && "pointer-events-none select-none"
        )}
      >
        {isTerminal ? (
          <AgentTerminal agent={agent} />
        ) : currentSessionId ? (
          <AgentChat agent={agent} sessionId={currentSessionId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-text-muted font-mono">
            Session not attached
          </div>
        )}
      </div>
    </Rnd>
  );
};
