import React, { useState, useEffect } from 'react';
import { ArrowRight, Terminal, Cpu, Code2, Check, ChevronDown } from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import { Modal } from '../ui/Modal';
import { useAgentStore } from '../../stores/agent.store';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useSettingsStore } from '../../stores/settings.store';
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
  const settings = useSettingsStore();

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
        
        let sessionData: any = null;
        if (rawHistory && rawHistory.length > 20) {
          sessionData = UniversalSessionExtractor.extractFromTerminalHistory(sourceAgent.id, sourceSessionId, rawHistory);
        } else {
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
          };
        }

        const brief = SessionDistillerService.distillSession(sessionData, settings.maxTokenBudget);
        setDistilledBrief(brief);
      } catch (err) {
        console.warn('Session memory extraction fallback:', err);
      }
    };
    fetchSessionMemory();
  }, [sourceAgent, isShareContextOpen, settings.maxTokenBudget]);

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
            ? `${distilledBrief.summaryNarrative}\n\n[USER DIRECTIVE]: ${customNote}`
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
        selection,
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
      title="Handoff Context"
      subtitle="Relay active session memory & workspace state"
      maxWidth="md"
    >
      <div className="flex flex-col gap-4 font-sans text-xs pt-0.5">
        
        {/* Source -> Target Relay Card */}
        <div className="p-3.5 rounded-xl bg-panel-elevated border border-border flex flex-col gap-2 shadow-sm">
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
                  <Select.Trigger className="w-full h-9 inline-flex items-center justify-between gap-2 px-3 rounded-lg bg-well hover:bg-panel-hover border border-border text-text-primary font-mono font-bold text-xs focus:outline-none focus:border-border-hover transition-all cursor-pointer shadow-sm">
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
                            className="relative flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-mono text-text-primary hover:bg-panel focus:bg-panel outline-none cursor-pointer select-none transition-colors data-[state=checked]:bg-panel data-[state=checked]:font-bold"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div className="w-4 h-4 rounded bg-well flex items-center justify-center shrink-0">
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

        {/* Directive / Note Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
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
            className="w-full h-10 px-3.5 rounded-lg bg-well border border-border text-text-primary font-sans text-xs placeholder:text-text-dim focus:outline-none focus:border-border-hover transition-all"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
          <span className="text-[10.5px] font-mono text-text-dim flex items-center gap-1.5">
            Press <kbd className="px-1.5 py-0.5 rounded bg-well border border-border text-text-muted text-[9.5px]">Enter ↵</kbd> to relay
          </span>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShareContextOpen(false)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-text-muted hover:text-text-primary hover:bg-panel transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteHandoff}
              disabled={!validTarget || isTransferring || targetAgents.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-text-primary text-background font-mono font-bold text-xs transition-all hover:opacity-90 cursor-pointer disabled:opacity-40 shadow-sm"
            >
              <span>{isTransferring ? 'Relaying...' : 'Handoff'}</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
};
