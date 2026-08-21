import React, { useState, useRef, useEffect } from 'react';
import { Users, Check, ChevronRight, Radio, Minimize2, Maximize2, Terminal } from 'lucide-react';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { clsx } from 'clsx';

export const SwarmBroadcastBar: React.FC = () => {
  const { agents, broadcastCommand, sendTerminalCommand } = useAgentStore();
  const { getActiveWorkspace, activeSpaceIdByProject } = useWorkspaceStore();
  const { maximizedAgentId, isBroadcastCollapsed, toggleBroadcastCollapsed } = useUIStore();

  const [input, setInput] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeWorkspace = getActiveWorkspace();
  const activeSpaceId = (activeWorkspace && activeSpaceIdByProject[activeWorkspace.id]) || activeWorkspace?.spaces?.[0]?.id || `space-${activeWorkspace?.id}-1`;

  const spaceAgents = agents.filter(
    (a) => (a.spaceId || activeWorkspace?.spaces?.[0]?.id || 'default') === activeSpaceId || (!a.spaceId && activeWorkspace?.spaces?.[0]?.id === activeSpaceId)
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (spaceAgents.length === 0 || maximizedAgentId) return null;

  const isBroadcastingToAll = selectedAgentIds.length === 0;

  const toggleAgentTarget = (agentId: string) => {
    if (selectedAgentIds.includes(agentId)) {
      setSelectedAgentIds(selectedAgentIds.filter(id => id !== agentId));
    } else {
      setSelectedAgentIds([...selectedAgentIds, agentId]);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isExecuting) return;

    setIsExecuting(true);
    try {
      const atMatch = trimmed.match(/^@([a-zA-Z0-9_-]+)\s+(.+)$/);
      if (atMatch) {
        const targetHandle = atMatch[1].toLowerCase();
        const subPrompt = atMatch[2];
        const matchedAgent = spaceAgents.find(
          a => a.name.toLowerCase().includes(targetHandle) || a.provider.toLowerCase().includes(targetHandle) || (a.profileId && a.profileId.toLowerCase() === targetHandle)
        );

        if (matchedAgent) {
          const cleanPrompt = subPrompt.trim();
          await sendTerminalCommand(
            matchedAgent.id,
            `${cleanPrompt}\r`,
            activeWorkspace?.projectPath,
            activeWorkspace?.id
          );
        } else {
          await broadcastCommand(trimmed, selectedAgentIds.length > 0 ? selectedAgentIds : undefined, activeWorkspace?.projectPath, activeWorkspace?.id);
        }
      } else {
        await broadcastCommand(
          trimmed,
          selectedAgentIds.length > 0 ? selectedAgentIds : spaceAgents.map(a => a.id),
          activeWorkspace?.projectPath,
          activeWorkspace?.id
        );
      }

      setInput('');
    } catch (e) {
      console.error('Broadcast execution error:', e);
    } finally {
      setIsExecuting(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getTargetSummary = () => {
    if (isBroadcastingToAll) return `All (${spaceAgents.length})`;
    if (selectedAgentIds.length === 1) {
      const single = spaceAgents.find(a => a.id === selectedAgentIds[0]);
      return single ? `@${single.name.toLowerCase()}` : '1 Agent';
    }
    return `${selectedAgentIds.length} Agents`;
  };

  // Collapsed View (Ultra-Minimal Floating Launcher Pill)
  if (isBroadcastCollapsed) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 select-none no-drag pointer-events-auto">
        <button
          onClick={toggleBroadcastCollapsed}
          className="h-8 px-3 rounded-full bg-panel-elevated/90 hover:bg-panel-elevated backdrop-blur-2xl border border-border hover:border-border-hover text-text-secondary hover:text-text-primary text-xs font-mono font-medium flex items-center gap-2 shadow-lg transition-all cursor-pointer group active:scale-95"
          title="Open Swarm Broadcast Bar (Ctrl+K)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Broadcast ({spaceAgents.length})</span>
          <Terminal size={11} className="text-text-muted group-hover:text-text-primary transition-colors" />
        </button>
      </div>
    );
  }

  // Expanded View (Full Monolithic Pill)
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4 select-none no-drag pointer-events-auto">
      
      {/* Target Popover Menu */}
      {isDropdownOpen && (
        <div 
          ref={dropdownRef}
          className="absolute bottom-full left-4 mb-2 w-64 p-1.5 bg-panel-elevated/95 backdrop-blur-2xl border border-border rounded-2xl shadow-2xl flex flex-col gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-text-dim font-bold">
            Target Agents
          </div>

          <button
            onClick={() => {
              setSelectedAgentIds([]);
              setIsDropdownOpen(false);
            }}
            className={clsx(
              "flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer text-left",
              isBroadcastingToAll ? "bg-text-primary text-background font-bold" : "text-text-secondary hover:bg-well hover:text-text-primary"
            )}
          >
            <div className="flex items-center gap-2">
              <Users size={12} className="text-text-muted" />
              <span>All Active Agents</span>
            </div>
            {isBroadcastingToAll && <Check size={12} strokeWidth={3} className="text-emerald-500" />}
          </button>

          {spaceAgents.map((agent) => {
            const isSelected = selectedAgentIds.includes(agent.id);
            return (
              <button
                key={agent.id}
                onClick={() => toggleAgentTarget(agent.id)}
                className={clsx(
                  "flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer text-left",
                  isSelected ? "bg-text-primary text-background font-bold" : "text-text-secondary hover:bg-well hover:text-text-primary"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">@{agent.name.toLowerCase()}</span>
                  {agent.profileId && agent.profileId !== 'default' && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-400 font-bold uppercase">
                      {agent.profileId}
                    </span>
                  )}
                </div>
                {isSelected && <Check size={12} strokeWidth={3} className="text-emerald-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Floating Monolithic Command Pill with Dynamic Theme Tokens */}
      <div className={clsx(
        "h-10 pl-1.5 pr-2 bg-panel-elevated/90 hover:bg-panel-elevated backdrop-blur-2xl border rounded-full flex items-center gap-2 shadow-2xl transition-all duration-200",
        isFocused 
          ? "border-border-hover ring-2 ring-border-hover/20 shadow-lg" 
          : "border-border hover:border-border-hover shadow-md"
      )}>
        
        {/* Target Badge / Selector */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-well hover:bg-panel border border-border text-text-primary text-[11px] font-mono font-medium transition-all cursor-pointer shrink-0 active:scale-95"
          title="Select target agents (or type @agent)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="truncate max-w-[100px]">{getTargetSummary()}</span>
        </button>

        {/* Minimalist Command Input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Broadcast instruction or type @agent..."
          className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-text-primary placeholder:text-text-dim selection:bg-border min-w-0"
        />

        {/* Right Actions: Minimize Pill + Send Button */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={toggleBroadcastCollapsed}
            className="p-1 rounded-full text-text-dim hover:text-text-muted transition-colors cursor-pointer"
            title="Minimize Broadcast Bar"
          >
            <Minimize2 size={11} />
          </button>

          <button
            onClick={handleSend}
            disabled={!input.trim() || isExecuting}
            className={clsx(
              "w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer",
              input.trim() && !isExecuting
                ? "bg-text-primary text-background hover:opacity-90 shadow-sm active:scale-90"
                : "text-text-dim hover:text-text-muted"
            )}
            title="Dispatch (Enter)"
          >
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>

      </div>

    </div>
  );
};
