import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Terminal, 
  Cpu, 
  Code2, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Sparkles, 
  Layers, 
  ShieldCheck, 
  Zap, 
  MessageSquareCode,
  Clock,
  FileCode,
  FileText,
  ListFilter,
  FolderTree,
  Loader2,
  BookOpen,
  Compass
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
  const [transferStep, setTransferStep] = useState<string>('');
  const [distilledBrief, setDistilledBrief] = useState<DistilledSessionBrief | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'conversation' | 'files' | 'memory' | 'manifest'>('conversation');

  const projectSlug = (activeWorkspace?.name || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'default';
  const memoryDirPath = `~/.orbit/memory/projects/${projectSlug}/`;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const validTarget = targetAgents.find(a => a.id === targetAgentId) || targetAgents[0];
  const sourceSessionId = (sourceAgent && (activeSessionIdByAgent[sourceAgent.id] || sourceAgent.currentSessionId)) || `sess-${sourceAgent?.id || 'src'}`;
  const targetSessionId = (validTarget && (activeSessionIdByAgent[validTarget.id] || validTarget.currentSessionId)) || `sess-${validTarget?.id || 'tgt'}`;


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
    architecture: 'Tauri v2 + React 18 + native Rust terminal emulator + Canvas grid renderer',
    relevantFiles: gitState?.modifiedFiles.map(f => f.path) || [],
    updatedAt: Date.now(),
  };

  useEffect(() => {
    if (!sourceAgent) return;
    let isCancelled = false;

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

        const sessionData = await UniversalSessionExtractor.extractAuthoritativeSession(
          sourceAgent.id,
          sourceSessionId,
          activeWorkspace?.projectPath,
          rawHistory
        );

        if (isCancelled) return;

        // Merge any modified files from gitState if not already tracked
        if (gitState?.modifiedFiles) {
          const fileSet = new Set(sessionData.filesTouched);
          for (const f of gitState.modifiedFiles) {
            if (!fileSet.has(f.path)) {
              sessionData.filesTouched.push(f.path);
            }
          }
        }

        const brief = SessionDistillerService.distillSession(
          sessionData,
          intent,
          sourceAgent.name,
          validTarget?.name || 'Agent B',
          settings.maxTokenBudget
        );

        if (!isCancelled) {
          setDistilledBrief(brief);
        }
      } catch (err) {
        console.warn('Session memory extraction fallback:', err);
      }
    };

    fetchSessionMemory();

    return () => {
      isCancelled = true;
    };
  }, [sourceAgent, validTarget, intent, isShareContextOpen, settings.maxTokenBudget, activeWorkspace?.projectPath, gitState?.modifiedFiles]);

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
          intent: distilledBrief.intent,
          task: distilledBrief.goal || effectiveContext.currentTask,
          progress: `${effectiveContext.progress}%`,
          nextStep: distilledBrief.nextSteps || effectiveContext.activeWork,
          decisions: distilledBrief.decisions,
          issues: distilledBrief.blockers,
          fileSummaries: distilledBrief.fileSummaries,
          conversationSynthesis: distilledBrief.conversationSynthesis,
          verbatimTranscript: distilledBrief.verbatimTranscript,
          notes: customNote 
            ? `${distilledBrief.formattedEnvelope}\n\n[USER DIRECTIVE]: ${customNote}`
            : distilledBrief.formattedEnvelope
        } : undefined
      )
    : null;

  const handleExecuteHandoff = async () => {
    if (!activeWorkspaceId || !sourceAgent || !validTarget || !previewData || !activeWorkspace?.projectPath) return;
    setIsTransferring(true);
    try {
      setTransferStep('Synthesizing conversation trajectory & user directives...');
      await sleep(350);

      setTransferStep('Extracting file diffs, architectural decisions & patterns...');
      await sleep(350);

      setTransferStep(`Writing project memory files to ${memoryDirPath}...`);
      await executeHandoff({
        workspaceId: activeWorkspaceId,
        workspaceName: activeWorkspace?.name || 'Workspace',
        projectPath: activeWorkspace.projectPath,
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

      setTransferStep(`Relaying handoff brief to ${validTarget.name}...`);
      await sleep(300);

      setCustomNote('');
      setShareContextOpen(false, validTarget.id);
    } catch (e) {
      console.error('Continuity transfer error:', e);
    } finally {
      setIsTransferring(false);
      setTransferStep('');
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
      subtitle="Relay synthesized conversation trajectory, file edits, and decisions to the target agent"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-3.5 font-sans text-xs pt-0.5 max-h-[82vh] overflow-y-auto pr-1">
        
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
              <span className="text-[9.5px] text-text-muted leading-tight">Master memory boot. Resumes chat trajectory without repeating prior work.</span>
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

        {/* Intelligence Metrics & Live Extraction Banner */}
        {distilledBrief && (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-well border border-border font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-text-muted">
                <Sparkles size={13} className="text-emerald-400" />
                <span>Synthesized Memory: <strong className="text-text-primary">{distilledBrief.estimatedTokens} tokens</strong></span>
                <span className="text-text-dim">({distilledBrief.compressionRatioPercent}% compression)</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-muted">
                <Clock size={12} className="text-amber-400" />
                <span>Files: <strong className="text-text-primary">{distilledBrief.filesTouched.length} touched</strong></span>
                {distilledBrief.fileSummaries && distilledBrief.fileSummaries.length > 0 && (
                  <span className="text-emerald-400 font-bold">({distilledBrief.fileSummaries.length} diffs analyzed)</span>
                )}
              </div>
            </div>

            {/* Expand / Collapse Details Toggle */}
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-between pt-1 border-t border-border-subtle text-[10px] text-text-muted hover:text-text-primary cursor-pointer transition-colors"
            >
              <span className="font-sans font-medium flex items-center gap-1.5">
                <FileText size={11} className="text-sky-400" />
                <span>{showDetails ? 'Hide Handoff Briefing Inspector' : 'Inspect Synthesized Conversation & File Diffs'}</span>
              </span>
              <div className="flex items-center gap-1">
                <span className="text-text-dim">{showDetails ? 'Collapse' : 'Expand'}</span>
                {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </div>
            </button>

            {/* Expandable Tabbed Inspector */}
            {showDetails && (
              <div className="flex flex-col gap-2 pt-2 border-t border-border animate-in fade-in-50 duration-150">
                <div className="flex items-center gap-1 border-b border-border pb-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('conversation')}
                    className={clsx(
                      "px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer",
                      activeTab === 'conversation'
                        ? "bg-text-primary text-background font-bold"
                        : "text-text-muted hover:text-text-primary hover:bg-panel"
                    )}
                  >
                    💬 Conversation Trajectory
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('files')}
                    className={clsx(
                      "px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer",
                      activeTab === 'files'
                        ? "bg-text-primary text-background font-bold"
                        : "text-text-muted hover:text-text-primary hover:bg-panel"
                    )}
                  >
                    📝 Files & Diffs ({distilledBrief.fileSummaries?.length || distilledBrief.filesTouched.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('memory')}
                    className={clsx(
                      "px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer",
                      activeTab === 'memory'
                        ? "bg-text-primary text-background font-bold"
                        : "text-text-muted hover:text-text-primary hover:bg-panel"
                    )}
                  >
                    📁 Project Memory (7 MDs)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('manifest')}
                    className={clsx(
                      "px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer",
                      activeTab === 'manifest'
                        ? "bg-text-primary text-background font-bold"
                        : "text-text-muted hover:text-text-primary hover:bg-panel"
                    )}
                  >
                    📄 HANDOFF.md Preview
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto p-2 rounded-lg bg-panel border border-border text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
                  {activeTab === 'conversation' && (
                    <div className="space-y-2">
                      <div className="font-bold text-text-primary">
                        {distilledBrief.conversationSynthesis?.narrativeSummary || distilledBrief.summaryNarrative}
                      </div>
                    </div>
                  )}

                  {activeTab === 'files' && (
                    <div className="space-y-3">
                      {distilledBrief.fileSummaries && distilledBrief.fileSummaries.length > 0 ? (
                        distilledBrief.fileSummaries.map((f, i) => (
                          <div key={i} className="p-2 rounded-lg bg-well border border-border-subtle space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-text-primary flex items-center gap-1.5">
                                <FileCode size={12} className="text-emerald-400" />
                                <span>{f.filePath}</span>
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="text-emerald-400 font-bold">+{f.additions}</span>
                                <span className="text-red-400 font-bold">-{f.deletions}</span>
                              </div>
                            </div>
                            <p className="text-text-secondary text-[10.5px] font-sans">{f.summary}</p>
                            {f.diffSnippet && (
                              <pre className="p-1.5 rounded bg-panel border border-border text-[9.5px] text-text-dim overflow-x-auto">
                                {f.diffSnippet}
                              </pre>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-text-muted">
                          {distilledBrief.filesTouched.length > 0 ? (
                            distilledBrief.filesTouched.map((f, i) => <div key={i}>• {f}</div>)
                          ) : (
                            <div>No file modifications detected in active session.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'memory' && (
                    <div className="space-y-2.5 font-sans">
                      <div className="p-2 rounded-lg bg-well border border-border-subtle flex items-start gap-2">
                        <FolderTree size={14} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="font-bold text-text-primary text-[11px] font-mono truncate">
                            {memoryDirPath}
                          </div>
                          <p className="text-[10px] text-text-muted leading-tight">
                            Autonomous multi-document project memory in local machine storage (<code className="text-emerald-400">~/.orbit/</code>). All companion files are indexed inside <code className="text-emerald-400">HANDOFF.md</code>.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                        <div className="p-2 rounded-lg bg-well/60 border border-border-subtle space-y-0.5">
                          <div className="font-bold text-emerald-400 font-mono flex items-center gap-1.5 text-[10.5px]">
                            <FileText size={11} />
                            <span>HANDOFF.md</span>
                          </div>
                          <div className="text-text-muted text-[9.5px] leading-tight">Master brief, mission recap, next actions & memory index links.</div>
                        </div>

                        <div className="p-2 rounded-lg bg-well/60 border border-border-subtle space-y-0.5">
                          <div className="font-bold text-sky-400 font-mono flex items-center gap-1.5 text-[10.5px]">
                            <BookOpen size={11} />
                            <span>SESSION.md</span>
                          </div>
                          <div className="text-text-muted text-[9.5px] leading-tight">Full conversational trajectory, past turns & agent execution log.</div>
                        </div>

                        <div className="p-2 rounded-lg bg-well/60 border border-border-subtle space-y-0.5">
                          <div className="font-bold text-amber-400 font-mono flex items-center gap-1.5 text-[10.5px]">
                            <Zap size={11} />
                            <span>DECISIONS.md</span>
                          </div>
                          <div className="text-text-muted text-[9.5px] leading-tight">Architectural decisions record & immutable technical rules.</div>
                        </div>

                        <div className="p-2 rounded-lg bg-well/60 border border-border-subtle space-y-0.5">
                          <div className="font-bold text-indigo-400 font-mono flex items-center gap-1.5 text-[10.5px]">
                            <Compass size={11} />
                            <span>ROADMAP.md</span>
                          </div>
                          <div className="text-text-muted text-[9.5px] leading-tight">Multi-phase milestones, cross-session roadmap & checkpoints.</div>
                        </div>

                        <div className="p-2 rounded-lg bg-well/60 border border-border-subtle space-y-0.5">
                          <div className="font-bold text-red-400 font-mono flex items-center gap-1.5 text-[10.5px]">
                            <ShieldCheck size={11} />
                            <span>BUGS.md</span>
                          </div>
                          <div className="text-text-muted text-[9.5px] leading-tight">Tracked blockers, runtime exceptions & errors to avoid repeating.</div>
                        </div>

                        <div className="p-2 rounded-lg bg-well/60 border border-border-subtle space-y-0.5">
                          <div className="font-bold text-purple-400 font-mono flex items-center gap-1.5 text-[10.5px]">
                            <Layers size={11} />
                            <span>PATTERNS.md</span>
                          </div>
                          <div className="text-text-muted text-[9.5px] leading-tight">Repository conventions, coding idioms & discovered patterns.</div>
                        </div>

                        <div className="p-2 rounded-lg bg-well/60 border border-border-subtle space-y-0.5 col-span-2">
                          <div className="font-bold text-teal-400 font-mono flex items-center gap-1.5 text-[10.5px]">
                            <FileCode size={11} />
                            <span>CHANGES.md</span>
                          </div>
                          <div className="text-text-muted text-[9.5px] leading-tight">Granular file changes and unified diff blocks with +/- line diff snippets.</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'manifest' && (
                    <div className="text-text-secondary font-mono text-[10px]">
                      {previewData?.formattedInstruction || distilledBrief.formattedEnvelope}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Project-Scoped Memory Destination Banner */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-well border border-border font-mono text-[10.5px]">
          <div className="flex items-center gap-2 text-text-muted truncate">
            <FolderTree size={13} className="text-amber-400 shrink-0" />
            <span className="truncate">Memory Directory: <strong className="text-text-primary">{memoryDirPath}</strong></span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold shrink-0 ml-2">7 Connected Files</span>
        </div>

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
              <span>{isTransferring ? 'Synthesizing...' : `Continue with ${validTarget?.name || 'Agent'}`}</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Transferring / Synthesizing Progress Modal Overlay */}
        {isTransferring && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-50 rounded-2xl p-6 text-center animate-in fade-in-50 duration-150">
            <Loader2 size={28} className="text-text-primary animate-spin" />
            <div className="flex flex-col gap-1.5 max-w-sm">
              <span className="font-mono font-bold text-xs text-text-primary">
                Synthesizing & Generating Project Memory
              </span>
              <span className="font-mono text-[11px] text-text-muted animate-pulse">
                {transferStep || 'Preparing handoff package...'}
              </span>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
};
