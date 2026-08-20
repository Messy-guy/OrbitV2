import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Terminal, Cpu, Code2, ShieldCheck, Check } from 'lucide-react';
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
        return <span className="font-mono font-bold text-[11px] text-white">▲</span>;
      case 'claude':
        return <Cpu size={12} className="text-amber-300" />;
      case 'opencode':
        return <Code2 size={12} className="text-cyan-300" />;
      default:
        return <Terminal size={12} className="text-zinc-300" />;
    }
  };

  if (!isShareContextOpen || !sourceAgent) return null;

  const goalSummary = distilledBrief?.goal || effectiveContext.currentTask || effectiveContext.goal;
  const filesCount = distilledBrief?.filesTouched?.length || gitState?.modifiedFiles.length || effectiveContext.relevantFiles.length || 0;
  const decisionsCount = distilledBrief?.decisions?.length || effectiveContext.decisions.length || 0;

  return (
    <Modal
      isOpen={isShareContextOpen}
      onClose={() => setShareContextOpen(false)}
      title="Handoff Context"
      subtitle={`Relay conversation memory & project state to another agent`}
      maxWidth="md"
    >
      <div className="flex flex-col gap-4 font-sans text-xs">
        {/* Source -> Target Relay Header */}
        <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {/* Source Agent */}
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#71717a] font-bold">
              From
            </span>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] truncate">
              <div className="w-5 h-5 rounded bg-white/[0.08] flex items-center justify-center shrink-0">
                {getProviderIcon(sourceAgent.provider)}
              </div>
              <span className="font-mono font-bold text-white text-xs truncate">
                {sourceAgent.name}
              </span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center pt-3 text-[#71717a]">
            <ArrowRight size={16} strokeWidth={2} />
          </div>

          {/* Target Agent Selector */}
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#71717a] font-bold">
              To (Target)
            </span>
            {targetAgents.length === 0 ? (
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 font-mono text-[11px]">
                No other agents active
              </div>
            ) : (
              <select
                value={validTarget?.id}
                onChange={(e) => setTargetAgentId(e.target.value)}
                className="w-full p-2 rounded-lg bg-[#14151a] border border-white/[0.12] hover:border-white/30 text-white font-mono text-xs focus:outline-none focus:border-white transition-colors cursor-pointer"
              >
                {targetAgents.map(a => (
                  <option key={a.id} value={a.id} className="bg-[#121318] text-white">
                    {a.name} ({a.provider.toUpperCase()})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Auto-Distilled Memory Summary */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#71717a] font-bold flex items-center gap-1.5">
              <Sparkles size={11} className="text-emerald-400" />
              <span>Extracted Memory Summary</span>
            </span>
            <div className="flex items-center gap-2 text-[10.5px] font-mono text-[#a1a1aa]">
              <span>{filesCount} files</span>
              <span>•</span>
              <span>{decisionsCount} decisions</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#090a0f] border border-white/[0.08] text-[#d4d4d8] font-sans leading-relaxed text-[12px]">
            <p className="font-medium text-white mb-1.5">
              {goalSummary}
            </p>
            {distilledBrief?.summaryNarrative ? (
              <p className="text-[11.5px] text-[#a1a1aa] line-clamp-3">
                {distilledBrief.summaryNarrative}
              </p>
            ) : (
              <p className="text-[11px] text-[#71717a] italic">
                Active session context prepared. Ready for handoff delivery.
              </p>
            )}
          </div>
        </div>

        {/* Optional Directive / Note */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-[#71717a] font-bold">
            Note for {validTarget?.name || 'Target Agent'} (Optional)
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
            placeholder="e.g. Focus on testing the build and verifying responsive layouts..."
            className="w-full px-3 py-2 rounded-lg bg-[#090a0f] border border-white/[0.1] text-white font-sans text-xs placeholder:text-[#52525b] focus:outline-none focus:border-white/40 transition-colors"
          />
        </div>

        {/* Safe Checkpoint Protocol Badge */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 text-emerald-300 text-[11px] font-mono">
          <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
          <span className="truncate">
            Safe Mode: {validTarget?.name || 'Agent'} will recap ingested memory & wait for your confirmation.
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] mt-1">
          <span className="text-[10.5px] font-mono text-[#71717a]">
            Press <kbd className="px-1 py-0.5 rounded bg-white/[0.08] text-white text-[9.5px]">Enter</kbd> to relay
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShareContextOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-[#a1a1aa] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteHandoff}
              disabled={!validTarget || isTransferring || targetAgents.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white hover:bg-white/90 text-black font-mono font-bold text-xs transition-all shadow cursor-pointer disabled:opacity-40"
            >
              <span>{isTransferring ? 'Relaying...' : 'Handoff Context'}</span>
              <ArrowRight size={12} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
