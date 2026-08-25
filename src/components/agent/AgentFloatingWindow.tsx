import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { 
  X, 
  Plus,
  Maximize2, 
  Minimize2, 
  Terminal, 
  Cpu, 
  Code2, 
  Layers, 
  Copy, 
  Trash2, 
  Bookmark, 
  ArrowLeftRight,
  GitFork,
  ChevronDown,
  FlaskConical,
  Zap,
  ShieldCheck,
  CornerDownRight
} from 'lucide-react';
import { Agent } from '../../types/orbit';
import { AgentTerminal } from './AgentTerminal';
import { AgentChat } from './AgentChat';
import { WorkAreaRoleBadge } from './WorkAreaRoleBadge';
import { useAgentStore } from '../../stores/agent.store';
import { useUIStore } from '../../stores/ui.store';
import { useSkillStore } from '../../stores/skill.store';
import { SkillItem } from '../../types/skills';
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
  const { agents, removeAgent, setAgentRole } = useAgentStore();
  const { activeSessionIdByAgent } = useAgentStore();
  const { setShareContextOpen, maximizedAgentId, setMaximizedAgentId } = useUIStore();
  const { equipSkillToAgent, getEquippedSkills, unequipSkillFromAgent } = useSkillStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverType, setDragOverType] = useState<'role' | 'skill' | null>(null);

  const equippedSkills = getEquippedSkills(agent.id);
  const parentAgent = agent.parentId ? agents.find(a => a.id === agent.parentId) : null;
  const isMaximized = maximizedAgentId === agent.id;
  const [prevBounds, setPrevBounds] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-orbit-skill')) {
      e.preventDefault();
      setIsDragOver(true);
      setDragOverType('skill');
    } else if (e.dataTransfer.types.includes('application/x-orbit-role')) {
      e.preventDefault();
      setIsDragOver(true);
      setDragOverType('role');
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
    setDragOverType(null);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragOverType(null);

    // 1. Skill Drop Handling (Equip & Live Stream to PTY)
    const skillDataStr = e.dataTransfer.getData('application/x-orbit-skill');
    if (skillDataStr) {
      try {
        const skillData = JSON.parse(skillDataStr);
        const allInstalled = useSkillStore.getState().installedSkills;
        const matchingSkill = allInstalled.find(s => s.id === skillData.id) || {
          id: skillData.id,
          name: skillData.name,
          shortLabel: skillData.name,
          description: '',
          source: 'custom',
          sourceLabel: 'Custom',
          category: 'workflow',
          tags: [],
          directive: skillData.directive || `Follow rules for ${skillData.name}`,
        };
        await equipSkillToAgent(agent.id, matchingSkill as any);
        return;
      } catch (err) {
        console.warn('Skill drop parse notice:', err);
      }
    }

    // 2. Role Drop Handling
    const droppedRole = e.dataTransfer.getData('application/x-orbit-role') as import('../../types/orbit').AgentRoleType;
    if (droppedRole) {
      setAgentRole(agent.id, droppedRole);
    }
  };

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
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Minimal Visual Drop Highlight Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xs z-50 pointer-events-none flex items-center justify-center border-2 border-dashed border-text-muted rounded-2xl">
          <div className="px-3 py-1 rounded-md bg-panel-elevated border border-border shadow-xl flex items-center gap-2">
            <span className="font-mono font-medium text-xs text-text-primary">
              {dragOverType === 'skill' ? '+ Equip Skill' : 'Assign Role'}
            </span>
          </div>
        </div>
      )}

      {/* Top Titlebar */}
      <div
        className="floating-window-header h-8 px-3 border-b border-border flex items-center justify-between select-none cursor-grab active:cursor-grabbing flex-shrink-0 bg-panel-elevated transition-colors"
        onDoubleClick={handleToggleMaximize}
      >
        {/* Left: Provider Icon + Agent Name + Work Area Badge + Active Skill Badges */}
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex items-center justify-center w-4 h-4 shrink-0">
            {getProviderIcon()}
          </div>
          <span className="text-[12px] font-bold font-mono text-text-primary tracking-tight truncate max-w-[130px]">
            {getProviderLabel()}
          </span>

          {/* Active Equipped Skills Chips */}
          {equippedSkills.map((skill) => (
            <span
              key={skill.id}
              onClick={(e) => {
                e.stopPropagation();
                unequipSkillFromAgent(agent.id, skill.id);
              }}
              className="group flex items-center gap-1 px-1.5 py-0.5 rounded bg-well hover:bg-well/80 border border-border text-text-secondary hover:text-text-primary font-mono text-[9.5px] font-medium transition-all cursor-pointer no-drag shrink-0"
              title={`Equipped: ${skill.name}. Click to remove.`}
            >
              <span className="truncate max-w-[80px]">{skill.shortLabel || skill.name}</span>
              <span className="text-[8px] opacity-40 group-hover:opacity-100">✕</span>
            </span>
          ))}

          {/* Clean Work Area Responsibility Badge */}
          <WorkAreaRoleBadge role={agent.role || 'raw'} />

          {/* Child Worker Subtitle Link */}
          {parentAgent && (
            <span 
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono text-[9px] font-bold shrink-0"
              title={`Child worker attached to ${parentAgent.name}`}
            >
              <CornerDownRight size={9} />
              <span className="truncate max-w-[80px]">{parentAgent.name}</span>
            </span>
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

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShareContextOpen(true, agent.id);
            }}
            className="flex items-center gap-1.5 px-2 py-0.5 text-[10.5px] font-mono text-text-primary hover:text-white bg-well hover:bg-panel-elevated border border-border hover:border-border-hover rounded-md transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="Continue this task with another agent"
          >
            <ArrowLeftRight size={11} className="text-emerald-400" />
            <span>Continue with...</span>
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
