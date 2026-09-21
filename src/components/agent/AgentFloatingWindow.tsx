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
  CornerDownRight,
  Bot,
  Sparkles
} from 'lucide-react';
import { Agent } from '../../types/orbit';
import { AgentTerminal } from './AgentTerminal';
import { AgentChat } from './AgentChat';
import { WorkAreaRoleBadge } from './WorkAreaRoleBadge';
import { useAgentStore } from '../../stores/agent.store';
import { useUIStore } from '../../stores/ui.store';
import { useSkillStore } from '../../stores/skill.store';
import { SkillItem } from '../../types/skills';
import { AgentSkillPickerModal } from '../skills/AgentSkillPickerModal';
import { ProviderSkillAdapterService } from '../../services/providerSkillAdapter.service';
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
  isInteractingWithSelf?: boolean;
  isAnyInteracting?: boolean;
  onFocus: () => void;
  onPositionChange: (pos: { x: number; y: number; width: number; height: number }, direction?: string) => void;
  onInteractionStart?: (agentId: string, action: 'resize' | 'drag', bounds: { x: number; y: number; width: number; height: number }) => void;
  onInteractionUpdate?: (agentId: string, action: 'resize' | 'drag', bounds: { x: number; y: number; width: number; height: number }, direction?: string) => void;
  onInteractionEnd?: () => void;
}

export const AgentFloatingWindowComponent: React.FC<AgentFloatingWindowProps> = ({
  agent,
  initialPosition,
  zIndex,
  isActive,
  scale = 1,
  isInteractingWithSelf = false,
  isAnyInteracting = false,
  onFocus,
  onPositionChange,
  onInteractionStart,
  onInteractionUpdate,
  onInteractionEnd,
}) => {
  const removeAgent = useAgentStore(s => s.removeAgent);
  const setAgentRole = useAgentStore(s => s.setAgentRole);
  const parentAgent = useAgentStore(s => agent.parentId ? s.agents.find(a => a.id === agent.parentId) : null);
  const currentSessionId = useAgentStore(s => s.activeSessionIdByAgent[agent.id]);
  const { setShareContextOpen, maximizedAgentId, setMaximizedAgentId } = useUIStore();
  const { equipSkillToAgent, getEquippedSkills, unequipSkillFromAgent, assignmentsByAgent } = useSkillStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverType, setDragOverType] = useState<'role' | 'skill' | null>(null);
  const [isSkillPickerOpen, setIsSkillPickerOpen] = useState(false);

  const equippedSkills = getEquippedSkills(agent.id);
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

  const isTerminal = agent.viewMode !== 'chat';

  const getProviderIcon = () => {
    switch (agent.provider) {
      case 'antigravity':
        return <span className="font-mono font-bold text-[11px] text-text-primary">▲</span>;
      case 'claude':
        return <Cpu size={12} className="text-amber-500" />;
      case 'opencode':
        return <Code2 size={12} className="text-cyan-500" />;
      case 'kilocode':
        return <Code2 size={12} className="text-orange-400" />;
      case 'freebuff':
        return <Cpu size={12} className="text-emerald-400" />;
      case 'cline':
        return <Code2 size={12} className="text-blue-400" />;
      case 'copilot':
        return <Cpu size={12} className="text-violet-400" />;
      case 'goose':
        return <Bot size={12} className="text-yellow-400" />;
      case 'kiro':
        return <Code2 size={12} className="text-rose-400" />;
      case 'qwen':
        return <Cpu size={12} className="text-purple-400" />;
      case 'mimo':
        return <Bot size={12} className="text-emerald-400" />;
      case 'muse':
        return <Sparkles size={12} className="text-blue-400" />;
      case 'continue':
        return <Code2 size={12} className="text-teal-400" />;
      case 'aider':
        return <Bot size={12} className="text-green-400" />;
      case 'vibe':
        return <Sparkles size={12} className="text-orange-400" />;
      case 'qoder':
        return <Code2 size={12} className="text-indigo-400" />;
      default:
        return <Terminal size={12} className="text-text-muted" />;
    }
  };

  const getProviderLabel = () => {
    if (agent.provider === 'antigravity') return 'Antigravity CLI';
    if (agent.provider === 'claude') return 'Claude Code';
    if (agent.provider === 'opencode') return 'OpenCode';
    if (agent.provider === 'kilocode') return 'KiloCode';
    if (agent.provider === 'freebuff') return 'Freebuff';
    if (agent.provider === 'cline') return 'Cline';
    if (agent.provider === 'copilot') return 'GitHub Copilot';
    if (agent.provider === 'goose') return 'Goose';
    if (agent.provider === 'kiro') return 'Kiro CLI';
    if (agent.provider === 'qwen') return 'Qwen Code';
    if (agent.provider === 'mimo') return 'Mimo Code';
    if (agent.provider === 'muse') return 'Muse Code';
    if (agent.provider === 'continue') return 'Continue';
    if (agent.provider === 'aider') return 'Aider';
    if (agent.provider === 'vibe') return 'Mistral Vibe';
    if (agent.provider === 'qoder') return 'Qoder CLI';
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
        onInteractionStart?.(agent.id, 'drag', initialPosition);
      }}
      onDrag={(_e, d) => {
        onInteractionUpdate?.(agent.id, 'drag', {
          ...initialPosition,
          x: d.x,
          y: d.y,
        });
      }}
      onDragStop={(_e, d) => {
        setIsDragging(false);
        onInteractionEnd?.();
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
        onInteractionStart?.(agent.id, 'resize', initialPosition);
      }}
      onResize={(_e, direction, ref, _delta, position) => {
        const nextWidth = parseInt(ref.style.width, 10);
        const nextHeight = parseInt(ref.style.height, 10);
        onInteractionUpdate?.(agent.id, 'resize', {
          x: position.x,
          y: position.y,
          width: nextWidth,
          height: nextHeight,
        }, direction);
      }}
      onResizeStop={(_e, direction, ref, _delta, position) => {
        setIsDragging(false);
        onInteractionEnd?.();
        if (!isMaximized) {
          onPositionChange({
            x: position.x,
            y: position.y,
            width: parseInt(ref.style.width, 10),
            height: parseInt(ref.style.height, 10),
          }, direction);
        }
      }}
      minWidth={280}
      minHeight={180}
      scale={isMaximized ? 1 : scale}
      dragHandleClassName="floating-window-header"
      cancel=".no-drag, input, textarea, button, select"
      disableDragging={isMaximized}
      enableResizing={!isMaximized}
      className={clsx(
        "rounded-xl flex flex-col overflow-hidden border transition-shadow",
        isActive 
          ? "border-border-active shadow-2xl ring-1 ring-white/10" 
          : "border-border/70 shadow-lg",
        isDragging && "border-accent/80 cursor-grabbing ring-2 ring-accent/30 shadow-2xl"
      )}
      style={{
        zIndex: isMaximized ? 9999 : zIndex,
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        backfaceVisibility: 'hidden',
        backgroundColor: 'var(--bg-panel, #0f1015)',
        transition: isInteractingWithSelf || isAnyInteracting
          ? 'none'
          : 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1), width 0.26s cubic-bezier(0.16, 1, 0.3, 1), height 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseDown={onFocus}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Minimal Visual Drop Highlight Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md z-50 pointer-events-none flex items-center justify-center border-2 border-dashed border-emerald-400/50 rounded-xl animate-pulse">
          <div className="px-3.5 py-1.5 rounded-xl bg-panel-elevated border border-emerald-400/30 shadow-2xl flex items-center gap-2">
            <span className="font-mono font-bold text-xs text-emerald-400">
              {dragOverType === 'skill' ? '+ Equip Skill' : 'Assign Role'}
            </span>
          </div>
        </div>
      )}

      {/* Corner Resize Gripper Indicator */}
      {!isMaximized && (
        <div className="absolute bottom-1 right-1 pointer-events-none text-text-muted/30 select-none z-10">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M7 1L1 7M7 4L4 7M7 7H7.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* Top Titlebar */}
      <div
        className="floating-window-header h-9 px-3 border-b border-border/80 flex items-center justify-between select-none cursor-grab active:cursor-grabbing flex-shrink-0 bg-panel-elevated/95 backdrop-blur-sm transition-colors"
        onDoubleClick={handleToggleMaximize}
      >
        {/* Left: Provider Icon + Agent Name + Status Pulse + Work Area Badge + Active Skill Badges */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden mr-2">
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-well/80 border border-border/60 shrink-0">
            {getProviderIcon()}
          </div>
          <span className="text-xs font-bold font-mono text-text-primary tracking-tight truncate shrink-0 max-w-[120px] sm:max-w-[150px]">
            {getProviderLabel()}
          </span>

          {/* Active session pulsing indicator */}
          <span className="relative flex h-1.5 w-1.5 shrink-0" title="Terminal session active">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>

          {/* Work Area Responsibility Badge */}
          <div className="shrink-0 hidden xs:flex">
            <WorkAreaRoleBadge role={agent.role || 'raw'} />
          </div>

          {/* Active Equipped Skills Chips (Compact) */}
          {equippedSkills.slice(0, 1).map((skill) => (
            <span
              key={skill.id}
              onClick={(e) => {
                e.stopPropagation();
                unequipSkillFromAgent(agent.id, skill.id);
              }}
              className="group flex items-center gap-1 px-1.5 py-0.5 rounded bg-well hover:bg-well/80 border border-border text-text-secondary hover:text-text-primary font-mono text-[9px] font-medium transition-all cursor-pointer no-drag shrink-0"
              title={`Equipped: ${skill.name}. Click to remove.`}
            >
              <span className="truncate max-w-[70px]">{skill.shortLabel || skill.name}</span>
              <span className="text-[8px] opacity-40 group-hover:opacity-100">✕</span>
            </span>
          ))}
          {equippedSkills.length > 1 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setIsSkillPickerOpen(true);
              }}
              className="px-1.5 py-0.5 rounded bg-well hover:bg-well/80 border border-border text-text-muted hover:text-text-primary font-mono text-[9px] font-medium transition-all cursor-pointer no-drag shrink-0"
              title={`${equippedSkills.length} skills equipped. Click to manage.`}
            >
              +{equippedSkills.length - 1}
            </span>
          )}

          {/* Child Worker Subtitle Link */}
          {parentAgent && (
            <span 
              className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono text-[9px] font-bold shrink-0"
              title={`Child worker attached to ${parentAgent.name}`}
            >
              <CornerDownRight size={9} />
              <span className="truncate max-w-[70px]">{parentAgent.name}</span>
            </span>
          )}
        </div>

        {/* Right: Quick Actions (+ Skill, Copy, Clear, Handoff) + Dedicated Window Controls */}
        <div className="flex items-center gap-1 shrink-0 no-drag">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSkillPickerOpen(true);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-md transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
            title="Equip an AI Skill to this Agent"
          >
            <Plus size={10} />
            <span className="hidden sm:inline">Skill</span>
          </button>

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
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-well rounded-md transition-colors cursor-pointer shrink-0"
            title="Copy all terminal output to clipboard"
          >
            <Copy size={11} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              const sessId = currentSessionId || 'default';
              tauriService.sendAgentInput(agent.id, sessId, 'clear\n').catch(() => {});
            }}
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-well rounded-md transition-colors cursor-pointer shrink-0"
            title="Clear Terminal Buffer"
          >
            <Trash2 size={11} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShareContextOpen(true, agent.id);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10.5px] font-mono text-text-secondary hover:text-text-primary bg-well/70 hover:bg-well border border-border hover:border-border-hover rounded-md transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
            title="Continue this task with another agent (Handoff)"
          >
            <ArrowLeftRight size={11} className="text-emerald-400 shrink-0" />
            <span className="hidden md:inline">Handoff</span>
          </button>

          {/* Clean Vertical Divider */}
          <div className="h-3.5 w-px bg-border/80 mx-1 shrink-0" />

          {/* Dedicated Window Controls: Maximize/Restore & Close */}
          <button
            onClick={handleToggleMaximize}
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-well rounded-md transition-colors cursor-pointer shrink-0"
            title={isMaximized ? "Restore Window (Ctrl+Shift+F)" : "Maximize Window (Ctrl+Shift+F)"}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              removeAgent(agent.id);
            }}
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-rose-400 hover:bg-rose-500/20 rounded-md transition-all cursor-pointer shrink-0 group"
            title="Close Terminal"
          >
            <X size={13} className="group-hover:scale-110 transition-transform" />
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

      {/* Direct Agent Skill Picker Modal */}
      <AgentSkillPickerModal
        isOpen={isSkillPickerOpen}
        onClose={() => setIsSkillPickerOpen(false)}
        agentId={agent.id}
      />
    </Rnd>
  );
};

export const AgentFloatingWindow = React.memo(AgentFloatingWindowComponent);
