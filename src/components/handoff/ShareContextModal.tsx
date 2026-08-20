import React, { useState, useEffect } from 'react';
import { ArrowRight, Terminal, Cpu, Code2, ShieldCheck, Check, ChevronDown, Sparkles } from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import { Modal } from '../ui/Modal';
import { useAgentStore } from '../../stores/agent.store';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { handoffService } from '../../services';
import { UniversalSessionExtractor } from '../../services/extractor.service';
import { SessionDistillerService } from '../../services/distiller.service';
import { isTauriAvailable, tauriService } from '../../services/tauri.service';
import { clsx } from 'clsx';

export const ShareContextModal: React.FC = () => {
  const { isShareContextOpen, setShareContextOpen, selectedAgentForModal } = useUIStore();
  const { agents, activeSessionIdByAgent } = useAgentStore();
  const { currentContext, gitState, executeHandoff } = useContextStore();
  const { activeWorkspaceId, getActiveWorkspace } = useWorkspaceStore();

  const activeWorkspace = getActiveWorkspace();
  const sourceAgent = agents.find(a => a.id === selectedAgentForModal) || agents[0];
  const targetAgents = agents.filter(a => a.id !== sourceAgent?.id);

  const [targetAgentId, setTargetAgentId] = useState<string>(targetAgents[0]?.id || '');
  const [customNote, setCustomNote] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [distilledBrief, setDistilledBrief] = useState<any>(null);

  const validTarget = targetAgents.find(a => a.id === targetAgentId) || targetAgents[0];
  const sourceSessionId = (sourceAgent && activeSessionIdByAgent[sourceAgent.id]) || `sess-${sourceAgent?.id || 'src'}-1`;
  const targetSessionId = (validTarget && activeSessionIdByAgent[validTarget.id]) || `sess-${validTarget?.id || 'tgt'}-1`;

  // Auto-sync target agent selection
  useEffect(() => {
    if (targetAgents.length > 0 && (!targetAgentId || !targetAgents.some(a => a.id === targetAgentId))) {
      setTargetAgentId(targetAgents[0].id);
    }
  }, [selectedAgentForModal, targetAgents]);

  const effectiveContext = currentContext || {
    id: `ctx-${activeWorkspaceId || 'default'}`,
    workspaceId: activeWorkspaceId || '',
    currentTask: 'Active workspace development',
    goal: 'Build modular architecture with multi-agent context relay',
    progress: 75,
    activeWork: 'Piping PTY streaming events into deterministic context engine',
    decisions: [],
    issues: [],
    notes: [],
    architecture: 'Tauri v2 + React 18 + xterm.js',
    relevantFiles: gitState?.modifiedFiles.map(f => f.path) || [],
    updatedAt: Date.now(),
  };

  useEffect(() => {
    if (!sourceAgent) return;
    const fetchSessionMemory = async () => {
      try {
        let rawHistory = '';
        if (isTauriAvailable()) {
          rawHistory = await tauriService.getAgentTerminalHistory(sourceAgent.id);
        }
        let sessionData;
        if (rawHistory && rawHistory.length > 20) {
          sessionData = UniversalSessionExtractor.extractFromTerminalHistory(sourceAgent.id, sourceSessionId, rawHistory);
        } else {
          const chatMsgs = useAgentStore.getState().messages[sourceSessionId] || [];
          sessionData = UniversalSessionExtractor.extractFromChatMessages(sourceAgent.id, sourceSessionId, chatMsgs);
        }
        const brief = SessionDistillerService.distillSession(sessionData, 1200);
        setDistilledBrief(brief);
      } catch (err) {
        console.warn('Session extraction error:', err);
      }
    };
    fetchSessionMemory();
  }, [sourceAgent?.id, sourceSessionId]);

  const previewData = sourceAgent && validTarget
    ? handoffService.generateHandoffPreview(
        effectiveContext,
        sourceAgent.name,
        'Active Session',
        validTarget.name,
        {
          includeCurrentTask: true,
          includeProgress: true,
          includeDecisions: true,
          includeKnownIssues: true,
          includeChangedFiles: true,
          includeGitState: true,
          includeRelevantConversation: true,
          includeFullConversation: false,
          requireConfirmation: true,
        },
        gitState || undefined,
        distilledBrief ? {
          ...distilledBrief,
          summaryNarrative: customNote.trim() 
            ? `${distilledBrief.summaryNarrative || ''}\n\n**User Directive:** ${customNote.trim()}`
            : distilledBrief.summaryNarrative
        } : undefined
      )
    : null;

  const handleExecuteHandoff = async () => {
    if (!activeWorkspaceId || !sourceAgent || !validTarget || !previewData) return;
    setIsTransferring(true);
    try {
      await executeHandoff({
        workspaceId: activeWorkspaceId,
        workspaceName: activeWorkspace?.name || 'Workspace',
        projectPath: activeWorkspace?.projectPath || '/tmp',
        sourceAgentId: sourceAgent.id,
        sourceAgentName: sourceAgent.name,
        sourceSessionId,
        targetAgentId: validTarget.id,
        targetAgentName: validTarget.name,
        targetProvider: validTarget.provider,
        targetSessionId,
        selection: {
          includeCurrentTask: true,
          includeProgress: true,
          includeDecisions: true,
          includeKnownIssues: true,
          includeChangedFiles: true,
          includeGitState: true,
          includeRelevantConversation: true,
          includeFullConversation: false,
          requireConfirmation: true,
        },
        previewSummary: previewData,
      });
      setCustomNote('');
      setShareContextOpen(false);
    } catch (e) {
      console.error('Handoff error:', e);
    } finally {
      setIsTransferring(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'antigravity':
        return <span className="font-mono font-bold text-[10px] text-white">▲</span>;
      case 'claude':
        return <Cpu size={12} className="text-amber-400" />;
      case 'opencode':
        return <Code2 size={12} className="text-cyan-400" />;
      default:
        return <Terminal size={12} className="text-zinc-400" />;
    }
  };

  if (!isShareContextOpen || !sourceAgent) return null;

  return (
    <Modal
      isOpen={isShareContextOpen}
      onClose={() => setShareContextOpen(false)}
      title="Handoff Context"
      subtitle="Relay conversation memory & project state"
      maxWidth="sm"
    >
      <div className="flex flex-col gap-4 font-sans text-xs pt-1">
        {/* Source -> Target Relay Card */}
        <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 p-2.5 rounded-xl bg-[#08090c] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          {/* Source Agent Pill */}
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[9.5px] font-mono uppercase tracking-widest text-[#71717a] font-bold px-0.5">
              Source
            </span>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#14151b] border border-white/[0.08] truncate shadow-sm">
              <div className="w-4 h-4 rounded bg-white/[0.06] flex items-center justify-center shrink-0">
                {getProviderIcon(sourceAgent.provider)}
              </div>
              <span className="font-mono font-bold text-white text-[11.5px] truncate">
                {sourceAgent.name}
              </span>
            </div>
          </div>

          {/* Transfer Flow Icon */}
          <div className="flex items-center justify-center pt-3 text-[#52525b]">
            <ArrowRight size={14} strokeWidth={2.5} />
          </div>

          {/* Target Agent Radix Dropdown */}
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[9.5px] font-mono uppercase tracking-widest text-[#71717a] font-bold px-0.5">
              Target
            </span>
            {targetAgents.length === 0 ? (
              <div className="px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 font-mono text-[10.5px] truncate">
                No active target
              </div>
            ) : (
              <Select.Root value={validTarget?.id} onValueChange={(val) => setTargetAgentId(val)}>
                <Select.Trigger className="w-full inline-flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#14151b] hover:bg-[#1a1b23] border border-white/[0.12] hover:border-white/25 text-white font-mono font-semibold text-[11.5px] focus:outline-none focus:ring-1 focus:ring-white/40 transition-all cursor-pointer shadow-sm">
                  <div className="flex items-center gap-1.5 truncate">
                    {validTarget && getProviderIcon(validTarget.provider)}
                    <Select.Value placeholder="Select Agent..." />
                  </div>
                  <Select.Icon className="text-[#a1a1aa]">
                    <ChevronDown size={12} strokeWidth={2.5} />
                  </Select.Icon>
                </Select.Trigger>

                <Select.Portal>
                  <Select.Content 
                    position="popper" 
                    sideOffset={4}
                    className="z-50 min-w-[180px] overflow-hidden rounded-xl bg-[#121319] border border-white/[0.12] shadow-[0_16px_36px_rgba(0,0,0,0.85)] animate-in fade-in-80 zoom-in-95 duration-150"
                  >
                    <Select.Viewport className="p-1">
                      {targetAgents.map((agent) => (
                        <Select.Item
                          key={agent.id}
                          value={agent.id}
                          className="relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-mono text-[#d4d4d8] hover:text-white hover:bg-white/[0.08] focus:bg-white/[0.1] focus:text-white outline-none cursor-pointer select-none transition-colors data-[state=checked]:bg-white/[0.06] data-[state=checked]:text-white data-[state=checked]:font-bold"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div className="w-4 h-4 rounded bg-white/[0.06] flex items-center justify-center shrink-0">
                              {getProviderIcon(agent.provider)}
                            </div>
                            <Select.ItemText>{agent.name}</Select.ItemText>
                          </div>
                          <Select.ItemIndicator className="text-white">
                            <Check size={12} strokeWidth={3} />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            )}
          </div>
        </div>

        {/* Custom Directive Input with Tactile Shadow */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-[#71717a] font-bold">
            Instruction / Directive (Optional)
          </label>
          <div className="relative">
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && validTarget && !isTransferring) {
                  e.preventDefault();
                  handleExecuteHandoff();
                }
              }}
              placeholder="e.g. Focus on verifying tests and resolving bugs..."
              autoFocus
              className="w-full px-3 py-2 rounded-xl bg-[#08090c] border border-white/[0.08] hover:border-white/20 text-[#EDEDED] font-sans text-xs placeholder:text-[#52525b] focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
            />
          </div>
        </div>

        {/* Safe Mode Protocol Shield Banner */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 text-emerald-300 text-[11px] font-mono">
          <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
          <span className="truncate">
            Safe Mode: {validTarget?.name || 'Target'} will recap memory & wait for confirmation.
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] mt-0.5">
          <span className="text-[10.5px] font-mono text-[#52525b] flex items-center gap-1">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[#a1a1aa] text-[9.5px]">Enter ↵</kbd>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShareContextOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-[#71717a] hover:text-[#EDEDED] hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteHandoff}
              disabled={!validTarget || isTransferring || targetAgents.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white hover:bg-white/90 active:bg-white/80 text-black font-mono font-bold text-xs transition-all shadow-[0_2px_12px_rgba(255,255,255,0.15)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] cursor-pointer disabled:opacity-40"
            >
              <span>{isTransferring ? 'Relaying...' : 'Handoff'}</span>
              <ArrowRight size={12} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
