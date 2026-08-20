import React, { useState, useEffect } from 'react';
import { ArrowRight, Terminal, Cpu, Code2, ShieldCheck, Zap } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAgentStore } from '../../stores/agent.store';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { handoffService } from '../../services';
import { UniversalSessionExtractor } from '../../services/extractor.service';
import { SessionDistillerService } from '../../services/distiller.service';
import { isTauriAvailable, tauriService } from '../../services/tauri.service';

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
        return <Cpu size={12} className="text-[#EDEDED]" />;
      case 'opencode':
        return <Code2 size={12} className="text-[#EDEDED]" />;
      default:
        return <Terminal size={12} className="text-[#7A7E8F]" />;
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
      <div className="flex flex-col gap-3 font-sans text-xs pt-1">
        {/* Source -> Target Relay Row */}
        <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 p-2 rounded-lg bg-[#060709] border border-white/[0.08]">
          {/* Source Agent */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#121318] border border-white/[0.06] truncate">
            <div className="w-4 h-4 rounded bg-white/[0.06] flex items-center justify-center shrink-0">
              {getProviderIcon(sourceAgent.provider)}
            </div>
            <span className="font-mono font-semibold text-[#EDEDED] text-[11.5px] truncate">
              {sourceAgent.name}
            </span>
          </div>

          {/* Arrow */}
          <div className="text-[#4E5262] flex items-center justify-center">
            <ArrowRight size={13} strokeWidth={2} />
          </div>

          {/* Target Agent Selector */}
          {targetAgents.length === 0 ? (
            <div className="px-2 py-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 font-mono text-[10.5px] truncate">
              No target agent
            </div>
          ) : (
            <select
              value={validTarget?.id}
              onChange={(e) => setTargetAgentId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#121318] border border-white/[0.08] hover:border-white/20 text-[#EDEDED] font-mono text-[11.5px] focus:outline-none focus:border-white/40 transition-colors cursor-pointer"
            >
              {targetAgents.map(a => (
                <option key={a.id} value={a.id} className="bg-[#101114] text-[#EDEDED]">
                  {a.name} ({a.provider.toUpperCase()})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Single Line Directive Input */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-[#7A7E8F] font-bold">
            Directive / Note (Optional)
          </label>
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
            placeholder="e.g. Focus on testing and build verification..."
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-[#060709] border border-white/[0.08] hover:border-white/15 text-[#EDEDED] font-sans text-xs placeholder:text-[#4E5262] focus:outline-none focus:border-white/30 transition-all"
          />
        </div>

        {/* Minimal Safe Checkpoint Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.06] text-[#7A7E8F] text-[10.5px] font-mono">
          <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
          <span className="truncate">
            Safe Mode: {validTarget?.name || 'Agent'} will recap & wait for your confirmation.
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] mt-0.5">
          <span className="text-[10px] font-mono text-[#4E5262]">
            Press <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-[#B4B7C4] text-[9px]">Enter</kbd> to relay
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShareContextOpen(false)}
              className="px-2.5 py-1.5 rounded-md text-xs font-mono text-[#7A7E8F] hover:text-[#EDEDED] hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteHandoff}
              disabled={!validTarget || isTransferring || targetAgents.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#EDEDED] hover:bg-white text-[#0B0C0E] font-mono font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-40"
            >
              <span>{isTransferring ? 'Relaying...' : 'Handoff'}</span>
              <ArrowRight size={11} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
