import React, { useState, useEffect } from 'react';
import { ArrowRight, AlertCircle, Sparkles, Plus, FileCode, Check, Shield, Network } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAgentStore } from '../../stores/agent.store';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { HandoffSelection } from '../../types/orbit';
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
  const [selection, setSelection] = useState<HandoffSelection>({
    includeCurrentTask: true,
    includeProgress: true,
    includeDecisions: true,
    includeKnownIssues: true,
    includeChangedFiles: true,
    includeGitState: true,
    includeRelevantConversation: true,
    includeFullConversation: false,
    requireConfirmation: true, // Default to Safe Briefing & Checkpoint protocol
  });

  const [isTransferring, setIsTransferring] = useState(false);

  const validTarget = targetAgents.find(a => a.id === targetAgentId) || targetAgents[0];
  const sourceSessionId = (sourceAgent && activeSessionIdByAgent[sourceAgent.id]) || `sess-${sourceAgent?.id || 'src'}-1`;
  const targetSessionId = (validTarget && activeSessionIdByAgent[validTarget.id]) || `sess-${validTarget?.id || 'tgt'}-1`;

  const effectiveContext = currentContext || {
    id: `ctx-${activeWorkspaceId || 'default'}`,
    workspaceId: activeWorkspaceId || '',
    currentTask: 'Develop modular multi-agent software application',
    goal: 'Build robust reactive architecture with automated context handoff',
    progress: 65,
    activeWork: 'Piping PTY streaming events into deterministic context engine',
    decisions: [
      { id: 'dec-1', title: 'PTY output parsed asynchronously without blocking terminal stream', timestamp: 'Recent' },
      { id: 'dec-2', title: 'Context Package formatted as self-contained markdown briefing', timestamp: 'Recent' }
    ],
    issues: [
      { id: 'iss-1', title: 'Ensure ANSI color codes are stripped before token counting', severity: 'info', status: 'open' }
    ],
    notes: ['Ready for multi-agent handoff'],
    architecture: 'Tauri v2 + React 18 + xterm.js + Portable-PTY',
    relevantFiles: gitState?.modifiedFiles.map(f => f.path) || ['src/stores/context.store.ts', 'src-tauri/src/main.rs'],
    updatedAt: Date.now(),
  };

  const [distilledBrief, setDistilledBrief] = useState<any>(null);

  useEffect(() => {
    if (!sourceAgent) return;
    const fetchTerminalOrChat = async () => {
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
    fetchTerminalOrChat();
  }, [sourceAgent?.id, sourceSessionId]);

  const previewData = sourceAgent && validTarget
    ? handoffService.generateHandoffPreview(
        effectiveContext,
        sourceAgent.name,
        'Active Session',
        validTarget.name,
        selection,
        gitState || undefined,
        distilledBrief || undefined
      )
    : null;

  let estimatedTokens = distilledBrief?.estimatedTokens || 350;
  if (selection.includeCurrentTask) estimatedTokens += 80;
  if (selection.includeProgress) estimatedTokens += 60;
  if (selection.includeDecisions) estimatedTokens += (effectiveContext.decisions.length || 2) * 50;
  if (selection.includeKnownIssues) estimatedTokens += (effectiveContext.issues.length || 1) * 60;
  if (selection.includeChangedFiles) estimatedTokens += (gitState?.modifiedFiles.length || effectiveContext.relevantFiles.length || 2) * 60;
  if (selection.includeGitState) estimatedTokens += 100;
  if (selection.includeRelevantConversation) estimatedTokens += 150;
  if (selection.includeFullConversation) estimatedTokens += 300;

  const toggleCheck = (key: keyof HandoffSelection) => {
    setSelection(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
        selection,
        previewSummary: previewData,
      });
      setShareContextOpen(false);
    } catch (e) {
      console.error('Handoff error:', e);
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Modal
      isOpen={isShareContextOpen}
      onClose={() => setShareContextOpen(false)}
      title="Agent Handoff & Memory Transfer"
      subtitle="Synthesize active workspace context and beam directly into target agent's live runtime"
      maxWidth="xl"
    >
      <div className="flex flex-col gap-4 text-xs font-sans text-[#f3f4f8]">
        {/* Source -> Arrow -> Target Section */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          {/* Source Agent Card */}
          <div className="md:col-span-2 p-3.5 bg-black/40 rounded-xl border border-white/[0.08] flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#8e93a0] font-bold mb-1.5 block">
              SOURCE AGENT
            </span>
            <div className="flex items-center gap-2 font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="font-extrabold text-sm text-white">{sourceAgent?.name || 'Source'}</span>
              <span className="text-[11px] text-[#8e93a0]">({sourceAgent?.provider})</span>
            </div>
            <p className="text-[11px] text-[#8e93a0] font-sans mt-1.5 line-clamp-1">
              Active terminal turns & working observations
            </p>
          </div>

          {/* Transfer Flow Icon */}
          <div className="hidden md:flex justify-center items-center">
            <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.12] flex items-center justify-center text-white shadow-sm">
              <ArrowRight size={14} strokeWidth={2.5} />
            </div>
          </div>

          {/* Target Agent Selection Card */}
          <div className="md:col-span-2 p-3.5 bg-black/40 rounded-xl border border-white/[0.08] flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#8e93a0] font-bold mb-1.5 block">
              TARGET AGENT
            </span>
            {targetAgents.length === 0 ? (
              <div className="space-y-1.5">
                <div className="text-amber-400 flex items-center gap-1 text-[11px] font-mono">
                  <AlertCircle size={12} />
                  <span>No other agent running</span>
                </div>
                <button
                  onClick={async () => {
                    if (activeWorkspace) {
                      await useAgentStore.getState().addAgent(activeWorkspace.id, 'claude', undefined, undefined, activeWorkspace.projectPath);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1 bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.12] rounded-md text-[11px] font-mono transition-all"
                >
                  <Plus size={12} />
                  <span>+ Spawn Claude Code</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {targetAgents.map(t => {
                  const isSelected = validTarget?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTargetAgentId(t.id)}
                      className={clsx(
                        'px-2.5 py-1 rounded-md border text-[11px] font-mono font-medium flex items-center gap-1.5 transition-all',
                        isSelected
                          ? 'bg-white text-black border-white font-bold shadow-sm'
                          : 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.18] text-[#8e93a0] hover:text-white'
                      )}
                    >
                      <span className={clsx('w-1.5 h-1.5 rounded-full', isSelected ? 'bg-black' : 'bg-white/30')} />
                      <span>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Live Context Manifest Preview Box (leo-agent style) */}
        {previewData && (
          <div className="p-4 bg-[#060709] rounded-xl border border-white/[0.08] space-y-3 font-mono shadow-inner">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
              <span className="font-extrabold text-white tracking-wider uppercase text-[10px] flex items-center gap-1.5">
                <Network size={12} className="text-white/80" />
                <span>STRUCTURED HANDOFF BRIEF (LEO PROTOCOL)</span>
              </span>
              <span className="text-[10px] text-white font-bold px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.15]">
                ~{(estimatedTokens / 1000).toFixed(1)}k tokens
              </span>
            </div>

            {/* Goal */}
            <div>
              <span className="text-[9.5px] uppercase tracking-wider text-emerald-400 font-bold block mb-0.5">🎯 Goal & Mission</span>
              <p className="text-white text-xs font-sans font-semibold bg-white/[0.03] p-2 rounded-lg border border-white/[0.05]">{previewData.task}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {/* Decisions */}
              <div className="p-2.5 bg-[#121318]/80 rounded-lg border border-white/[0.06]">
                <span className="text-[9.5px] text-[#8e93a0] uppercase tracking-wider font-bold block mb-0.5">⚡ Decisions & Constraints</span>
                <p className="text-[#c0c4d2] font-sans text-[11px] line-clamp-2">
                  {effectiveContext.decisions.length > 0 ? effectiveContext.decisions[0].title : 'Clean architecture preserved'}
                </p>
              </div>

              {/* Next Steps */}
              <div className="p-2.5 bg-[#121318]/80 rounded-lg border border-white/[0.06]">
                <span className="text-[9.5px] text-[#8e93a0] uppercase tracking-wider font-bold block mb-0.5">👉 Next Immediate Step</span>
                <p className="text-cyan-300 font-sans text-[11px] font-medium line-clamp-2">{previewData.nextStep}</p>
              </div>
            </div>

            {/* Files Touched */}
            {previewData.relevantFiles.length > 0 && (
              <div className="pt-1">
                <span className="text-[9.5px] text-[#8e93a0] uppercase tracking-wider font-bold block mb-1">📝 Active Touchpoints ({previewData.relevantFiles.length})</span>
                <div className="flex flex-wrap gap-1">
                  {previewData.relevantFiles.map((f: string) => (
                    <span key={f} className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[10px] text-[#d4d4d8]">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Handoff Execution Protocol Selector (Briefing & Checkpoint vs Direct) */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#8e93a0] font-bold block mb-2">
            Target Agent Ingestion Behavior
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setSelection(prev => ({ ...prev, requireConfirmation: true }))}
              className={clsx(
                "p-3 rounded-lg border text-left transition-all flex flex-col justify-between",
                selection.requireConfirmation !== false
                  ? "bg-white/[0.08] border-white text-white shadow-sm"
                  : "bg-[#121318]/50 border-white/[0.06] text-[#8e93a0] hover:border-white/20"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Briefing & Checkpoint (Recommended)</span>
                </span>
              </div>
              <p className="text-[10.5px] text-[#a1a1aa] font-sans">
                Agent ingests memory, summarizes state & proposed plan, and waits for your confirmation before writing code.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelection(prev => ({ ...prev, requireConfirmation: false }))}
              className={clsx(
                "p-3 rounded-lg border text-left transition-all flex flex-col justify-between",
                selection.requireConfirmation === false
                  ? "bg-white/[0.08] border-white text-white shadow-sm"
                  : "bg-[#121318]/50 border-white/[0.06] text-[#8e93a0] hover:border-white/20"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Autonomous Execution</span>
                </span>
              </div>
              <p className="text-[10.5px] text-[#a1a1aa] font-sans">
                Agent immediately starts implementing the next step without pausing for confirmation.
              </p>
            </button>
          </div>
        </div>

        {/* Inclusions Checklist */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#8e93a0] font-bold block mb-2">
            Context Package Inclusions
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#121318]/70 border border-white/[0.06] hover:border-white/20 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={selection.includeCurrentTask}
                onChange={() => toggleCheck('includeCurrentTask')}
                className="rounded accent-white"
              />
              <span className="text-white font-medium">Current Task & Goal</span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#121318]/70 border border-white/[0.06] hover:border-white/20 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={selection.includeProgress}
                onChange={() => toggleCheck('includeProgress')}
                className="rounded accent-white"
              />
              <span className="text-white font-medium">Progress Metrics ({effectiveContext.progress}%)</span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#121318]/70 border border-white/[0.06] hover:border-white/20 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={selection.includeDecisions}
                onChange={() => toggleCheck('includeDecisions')}
                className="rounded accent-white"
              />
              <span className="text-white font-medium">Architectural Decisions ({effectiveContext.decisions.length})</span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#121318]/70 border border-white/[0.06] hover:border-white/20 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={selection.includeKnownIssues}
                onChange={() => toggleCheck('includeKnownIssues')}
                className="rounded accent-white"
              />
              <span className="text-white font-medium">Known Issues & Blockers ({effectiveContext.issues.length})</span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#121318]/70 border border-white/[0.06] hover:border-white/20 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={selection.includeChangedFiles}
                onChange={() => toggleCheck('includeChangedFiles')}
                className="rounded accent-white"
              />
              <span className="text-white font-medium">Modified Files ({gitState?.modifiedFiles.length || 0})</span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#121318]/70 border border-white/[0.06] hover:border-white/20 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={selection.includeRelevantConversation}
                onChange={() => toggleCheck('includeRelevantConversation')}
                className="rounded accent-white"
              />
              <span className="text-white font-medium">Graph Session Synthesis</span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.08] mt-1">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8e93a0]">
            <Shield size={13} className="text-emerald-400" />
            <span>Deterministic Context Scrubber active</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShareContextOpen(false)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-[#8e93a0] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteHandoff}
              disabled={!validTarget || isTransferring}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-white/90 text-black font-mono font-extrabold text-xs transition-all shadow-md disabled:opacity-40 cursor-pointer"
            >
              <span>{isTransferring ? 'Transferring...' : 'Share Context →'}</span>
              <ArrowRight size={13} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
