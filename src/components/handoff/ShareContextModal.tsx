import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Terminal, 
  Cpu, 
  Code2, 
  Check, 
  ChevronDown, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  Zap, 
  MessageSquareCode,
  Clock
} from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import { Modal } from '../ui/Modal';
import { useAgentStore } from '../../stores/agent.store';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useSettingsStore } from '../../stores/settings.store';
import { useUIStore } from '../../stores/ui.store';
import { handoffService } from '../../services';
import { UniversalSessionExtractor } from '../../services/extractor.service';
import { SessionDistillerService, ContinuityIntent, DistilledSessionBrief } from '../../services/distiller.service';
import { isTauriAvailable, tauriService } from '../../services/tauri.service';
import { clsx } from 'clsx';

export const ShareContextModal: React.FC = () => {
  const { isShareContextOpen, setShareContextOpen, selectedAgentForModal } = useUIStore();
  const { agents, activeSessionIdByAgent } = useAgentStore();
  const { currentContext, gitState, executeHandoff } = useContextStore();
  const { activeWorkspaceId, getActiveWorkspace } = useWorkspaceStore();
  const settings = useSettingsStore();

  const activeWorkspace = getActiveWorkspace();
  const sourceAgent = agents.find(a => a.id === selectedAgentForModal) || agents[0];
  const targetAgents = agents.filter(a => a.id !== sourceAgent?.id);

  const [targetAgentId, setTargetAgentId] = useState<string>(targetAgents[0]?.id || '');
  const [intent, setIntent] = useState<ContinuityIntent>('chat_continue');
  const [customNote, setCustomNote] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [distilledBrief, setDistilledBrief] = useState<DistilledSessionBrief | null>(null);

  const validTarget = targetAgents.find(a => a.id === targetAgentId) || targetAgents[0];
  const sourceSessionId = (sourceAgent && activeSessionIdByAgent[sourceAgent.id]) || `sess-${sourceAgent?.id || 'src'}-1`;
  const targetSessionId = (validTarget && activeSessionIdByAgent[validTarget.id]) || `sess-${validTarget?.id || 'tgt'}-1`;

  // Auto-align default intent based on source agent role
  useEffect(() => {
    if (sourceAgent?.role === 'architect') {
      setIntent('plan_to_code');
    } else if (sourceAgent?.role === 'implementer') {
      setIntent('security_audit');
    } else {
      setIntent('chat_continue');
    }
  }, [sourceAgent]);

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
          try {
            rawHistory = await tauriService.getAgentTerminalHistory(sourceAgent.id);
          } catch (e) {
            console.warn('Terminal history read fallback', e);
          }
        }

        let sessionData = UniversalSessionExtractor.extractFromTerminalHistory(
          sourceAgent.id,
          sourceSessionId,
          rawHistory
        );

        if (!sessionData.turns || sessionData.turns.length === 0) {
          sessionData = {
            agentId: sourceAgent.id,
            sessionId: sourceSessionId,
            turns: [
              {
                id: '1',
                role: 'user',
                content: 'Implement features and test workspace architecture.',
                timestamp: Date.now() - 300000,
              },
              {
                id: '2',
                role: 'agent',
                content: 'Analyzing codebase, verifying module bindings, and inspecting workspace state.',
                timestamp: Date.now() - 120000,
              },
            ],
            filesTouched: gitState?.modifiedFiles.map(f => f.path) || [],
            blockersFound: [],
            decisionsFormulated: [],
            recentUserInstructions: ['Continue workspace task'],
          };
        }

        const brief = SessionDistillerService.distillSession(
          sessionData,
          intent,
          sourceAgent.name,
          validTarget?.name || 'Agent B',
          settings.maxTokenBudget
        );
        setDistilledBrief(brief);
      } catch (err) {
        console.warn('Session memory extraction fallback:', err);
      }
    };
    fetchSessionMemory();
  }, [sourceAgent, validTarget, intent, isShareContextOpen, settings.maxTokenBudget]);

  const selection = {
    includeCurrentTask: true,
    includeProgress: true,
    includeDecisions: true,
    includeKnownIssues: true,
    includeChangedFiles: true,
    includeGitState: true,
    includeRelevantConversation: true,
    includeFullConversation: false,
    requireConfirmation: settings.defaultHandoffMode !== 'autonomous',
  };

  const previewData = sourceAgent && validTarget
    ? handoffService.generateHandoffPreview(
        effectiveContext,
        sourceAgent.name,
        sourceSessionId,
        validTarget.name,
        selection,
        gitState || undefined,
        distilledBrief ? {
          task: distilledBrief.goal || effectiveContext.currentTask,
          progress: `${effectiveContext.progress}%`,
          nextStep: distilledBrief.nextSteps || effectiveContext.activeWork,
          decisions: distilledBrief.decisions,
          issues: distilledBrief.blockers,
          notes: customNote 
            ? `${distilledBrief.formattedEnvelope}\n\n[USER DIRECTIVE]: ${customNote}`
            : distilledBrief.formattedEnvelope
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
        selection,
        previewSummary: previewData,
      });
      setCustomNote('');
      setShareContextOpen(false);
    } catch (e) {
      console.error('Continuity transfer error:', e);
    } finally {
      setIsTransferring(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'antigravity':
        return <span className="font-mono font-bold text-[10px] text-text-primary">▲</span>;
      case 'claude':
        return <Cpu size={12} className="text-amber-500" />;
      case 'opencode':
        return <Code2 size={12} className="text-cyan-500" />;
      default:
        return <Terminal size={12} className="text-text-muted" />;
    }
  };

  if (!isShareContextOpen || !sourceAgent) return null;

  return (
    <Modal
      isOpen={isShareContextOpen}
      onClose={() => setShareContextOpen(false)}
      title="Continue with Agent"
      subtitle="Relay task state, active decisions, and repository context with zero token loss"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-4 font-sans text-xs pt-0.5">
        
        {/* Intent Workflow Selector Strip */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
            1. Continuity Workflow Intent
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setIntent('chat_continue')}
              className={clsx(
                "p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer select-none",
                intent === 'chat_continue'
                  ? "bg-well border-border-hover ring-1 ring-border-hover text-text-primary shadow-xs"
                  : "bg-panel-elevated hover:bg-well border-border text-text-muted"
              )}
            >
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-text-primary">
                <MessageSquareCode size={13} className="text-emerald-400" />
                <span>Resume Chat</span>
              </div>
              <span className="text-[9.5px] text-text-muted leading-tight">Master memory boot. Resumes chat seamlessly without repeating.</span>
            </button>

            <button
              type="button"
              onClick={() => setIntent('plan_to_code')}
              className={clsx(
                "p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer select-none",
                intent === 'plan_to_code'
                  ? "bg-well border-border-hover ring-1 ring-border-hover text-text-primary shadow-xs"
                  : "bg-panel-elevated hover:bg-well border-border text-text-muted"
              )}
            >
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-text-primary">
                <Zap size={13} className="text-amber-400" />
                <span>Plan ➔ Code</span>
              </div>
              <span className="text-[9.5px] text-text-muted leading-tight">Brahma to Mahesh relay. Turns spec into code with zero bloat.</span>
            </button>

            <button
              type="button"
              onClick={() => setIntent('security_audit')}
              className={clsx(
                "p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer select-none",
                intent === 'security_audit'
                  ? "bg-well border-border-hover ring-1 ring-border-hover text-text-primary shadow-xs"
                  : "bg-panel-elevated hover:bg-well border-border text-text-muted"
              )}
            >
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-text-primary">
                <ShieldCheck size={13} className="text-sky-400" />
                <span>Security Audit</span>
              </div>
              <span className="text-[9.5px] text-text-muted leading-tight">Vishnu 15-dim scan. Audits git diffs, race conditions & memory leaks.</span>
            </button>
          </div>
        </div>

        {/* Source ➔ Target Routing Box */}
        <div className="p-3.5 rounded-xl bg-panel-elevated border border-border">
          <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
            {/* Source Box */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                Source Agent
              </span>
              <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-well border border-border truncate">
                <div className="w-4 h-4 rounded bg-panel flex items-center justify-center shrink-0">
                  {getProviderIcon(sourceAgent.provider)}
                </div>
                <span className="font-mono font-bold text-text-primary text-xs truncate">
                  {sourceAgent.name}
                </span>
              </div>
            </div>

            {/* Transfer Arrow */}
            <div className="flex flex-col items-center justify-center pt-5 text-text-muted">
              <ArrowRight size={15} strokeWidth={2.5} />
            </div>

            {/* Target Box */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                Target Agent
              </span>
              {targetAgents.length === 0 ? (
                <div className="flex items-center h-9 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 font-mono text-[11px] truncate">
                  No other agents active
                </div>
              ) : (
                <Select.Root value={validTarget?.id} onValueChange={(val) => setTargetAgentId(val)}>
                  <Select.Trigger className="w-full h-9 inline-flex items-center justify-between gap-2 px-3 rounded-lg bg-well hover:bg-panel border border-border text-text-primary font-mono font-bold text-xs focus:outline-none focus:border-border-hover transition-all cursor-pointer shadow-sm">
                    <div className="flex items-center gap-2 truncate">
                      {validTarget && getProviderIcon(validTarget.provider)}
                      <Select.Value placeholder="Select Agent..." />
                    </div>
                    <Select.Icon className="text-text-muted">
                      <ChevronDown size={13} strokeWidth={2.5} />
                    </Select.Icon>
                  </Select.Trigger>

                  <Select.Portal>
                    <Select.Content 
                      position="popper" 
                      sideOffset={6}
                      className="z-[11000] min-w-[200px] overflow-hidden rounded-xl bg-panel-elevated border border-border shadow-2xl animate-in fade-in-80 duration-150 font-sans"
                    >
                      <Select.Viewport className="p-1">
                        {targetAgents.map((agent) => (
                          <Select.Item
                            key={agent.id}
                            value={agent.id}
                            className="relative flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-mono text-text-primary hover:bg-well focus:bg-well outline-none cursor-pointer select-none transition-colors data-[state=checked]:bg-well data-[state=checked]:font-bold"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div className="w-4 h-4 rounded bg-panel flex items-center justify-center shrink-0">
                                {getProviderIcon(agent.provider)}
                              </div>
                              <Select.ItemText>{agent.name}</Select.ItemText>
                            </div>
                            <Select.ItemIndicator className="text-text-primary">
                              <Check size={13} strokeWidth={3} />
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
        </div>

        {/* DSA Optimization & TimeLens Metrics Strip */}
        {distilledBrief && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-well border border-border font-mono text-[10.5px]">
            <div className="flex items-center gap-2 text-text-muted">
              <Sparkles size={12} className="text-emerald-400" />
              <span>DSA Knapsack: <strong className="text-text-primary">{distilledBrief.estimatedTokens} tokens</strong></span>
              <span className="text-text-dim">({distilledBrief.compressionRatioPercent}% compression)</span>
            </div>
            <div className="flex items-center gap-1.5 text-text-muted">
              <Clock size={11} className="text-amber-400" />
              <span>TIME-LENS: <strong className="text-text-primary">{distilledBrief.filesTouched.length} files classified</strong></span>
            </div>
          </div>
        )}

        {/* Directive / Note Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
            Additional User Instruction (Optional)
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
            placeholder="e.g. Focus on testing and verify TypeScript compile rules..."
            autoFocus
            className="w-full h-9 px-3 rounded-xl bg-well border border-border text-text-primary font-mono text-xs placeholder:text-text-dim focus:outline-none focus:border-border-hover transition-all"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-[10px] font-mono text-text-dim flex items-center gap-1">
            Press <kbd className="px-1.5 py-0.5 rounded bg-well border border-border text-text-muted text-[9px]">Enter ↵</kbd> to continue
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShareContextOpen(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-mono text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteHandoff}
              disabled={!validTarget || isTransferring || targetAgents.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-text-primary text-background font-mono font-bold text-xs transition-all hover:opacity-90 cursor-pointer disabled:opacity-40 shadow-sm active:scale-95"
            >
              <span>{isTransferring ? 'Transferring...' : `Continue with ${validTarget?.name || 'Agent'}`}</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
};
