import React, { useState } from 'react';
import { Share2, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useAgentStore } from '../../stores/agent.store';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { HandoffSelection } from '../../types/orbit';
import { HandoffPreviewModal } from './HandoffPreviewModal';
import { clsx } from 'clsx';

export const ShareContextModal: React.FC = () => {
  const { isShareContextOpen, setShareContextOpen, selectedAgentForModal } = useUIStore();
  const { agents, sessions, activeSessionIdByAgent } = useAgentStore();
  const { currentContext, generateHandoffPreview } = useContextStore();
  const { activeWorkspaceId } = useWorkspaceStore();

  const sourceAgent = agents.find(a => a.id === selectedAgentForModal) || agents[0];
  const targetAgents = agents.filter(a => a.id !== sourceAgent?.id);

  const [targetAgentId, setTargetAgentId] = useState<string>(targetAgents[0]?.id || '');
  const [selection, setSelection] = useState<HandoffSelection>({
    includeCurrentTask: true,
    includeProgress: true,
    includeDecisions: true,
    includeKnownIssues: true,
    includeChangedFiles: true,
    includeRelevantConversation: true,
    includeFullConversation: false,
  });

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const validTarget = targetAgents.find(a => a.id === targetAgentId) || targetAgents[0];

  const sourceSessionId = sourceAgent ? activeSessionIdByAgent[sourceAgent.id] : undefined;
  const sourceSession = sourceAgent && sourceSessionId
    ? sessions[sourceAgent.id]?.find(s => s.id === sourceSessionId)
    : undefined;

  const targetSessionId = validTarget ? activeSessionIdByAgent[validTarget.id] : undefined;
  const targetSession = validTarget && targetSessionId
    ? sessions[validTarget.id]?.find(s => s.id === targetSessionId)
    : undefined;

  let estimatedTokens = 450;
  if (selection.includeCurrentTask) estimatedTokens += 200;
  if (selection.includeProgress) estimatedTokens += 150;
  if (selection.includeDecisions) estimatedTokens += (currentContext?.decisions.length || 3) * 280;
  if (selection.includeKnownIssues) estimatedTokens += (currentContext?.issues.length || 1) * 320;
  if (selection.includeChangedFiles) estimatedTokens += (currentContext?.relevantFiles.length || 4) * 210;
  if (selection.includeRelevantConversation) estimatedTokens += 950;
  if (selection.includeFullConversation) estimatedTokens += 2400;

  const handleOpenPreview = () => {
    if (!sourceAgent || !validTarget || !currentContext) return;
    const preview = generateHandoffPreview(
      sourceAgent.name,
      sourceSession?.title || 'Session 01',
      validTarget.name,
      selection
    );
    setPreviewData(preview);
    setIsPreviewOpen(true);
  };

  const toggleCheck = (key: keyof HandoffSelection) => {
    setSelection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <Modal
        isOpen={isShareContextOpen && !isPreviewOpen}
        onClose={() => setShareContextOpen(false)}
        title="Share Project Context"
        subtitle="Transfer structured task memory from one agent session to another"
        maxWidth="lg"
      >
        <div className="flex flex-col gap-3.5 text-xs font-sans">
          {/* FROM -> TO Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* Source */}
            <div className="p-3 bg-panel-elevated rounded border border-border">
              <span className="text-[9.5px] font-mono uppercase tracking-widest text-text-muted font-bold block mb-1.5">
                SOURCE AGENT
              </span>
              <div className="flex items-center gap-2 text-text-primary font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="font-bold text-[12px]">{sourceAgent?.name || 'Agent'}</span>
                <span className="text-text-muted text-[10px]">
                  · {sourceSession?.title.split('—')[0].trim() || 'Session 01'}
                </span>
              </div>
              <div className="text-[10px] text-text-muted font-mono mt-0.5">
                {sourceAgent?.model}
              </div>
            </div>

            {/* Target Selection */}
            <div className="p-3 bg-panel-elevated rounded border border-border">
              <span className="text-[9.5px] font-mono uppercase tracking-widest text-text-muted font-bold block mb-1.5">
                TARGET AGENT
              </span>
              {targetAgents.length === 0 ? (
                <div className="text-status-warning flex items-center gap-1 text-[11px] font-mono">
                  <AlertCircle size={12} />
                  <span>Add another agent to workspace first</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {targetAgents.map(t => {
                    const isSelected = validTarget?.id === t.id;
                    const tSession = sessions[t.id]?.find(s => s.id === activeSessionIdByAgent[t.id]);
                    return (
                      <div
                        key={t.id}
                        onClick={() => setTargetAgentId(t.id)}
                        className={clsx(
                          'px-2 py-1 rounded border cursor-pointer flex items-center justify-between transition-colors font-mono',
                          isSelected
                            ? 'bg-accent/10 border-accent/40 text-text-primary'
                            : 'bg-background border-border-subtle hover:border-border text-text-secondary'
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={clsx(
                            'w-1.5 h-1.5 rounded-full',
                            isSelected ? 'bg-accent' : 'bg-text-dim'
                          )} />
                          <span className="font-bold text-[11px]">{t.name}</span>
                          <span className="text-[9px] text-text-muted">
                            · {tSession?.title.split('—')[0].trim() || 'Session 01'}
                          </span>
                        </div>
                        <span className="text-[9.5px] text-text-muted">{t.model}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Context Components Checklist */}
          <div>
            <span className="text-[9.5px] font-mono uppercase tracking-widest text-text-muted font-bold block mb-1.5">
              Context Modules
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
              <label className="flex items-center gap-2 p-2 rounded bg-background border border-border-subtle hover:bg-panel cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selection.includeCurrentTask}
                  onChange={() => toggleCheck('includeCurrentTask')}
                  className="rounded text-accent focus:ring-accent/40 bg-background"
                />
                <span>Current objective & task</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded bg-background border border-border-subtle hover:bg-panel cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selection.includeProgress}
                  onChange={() => toggleCheck('includeProgress')}
                  className="rounded text-accent focus:ring-accent/40 bg-background"
                />
                <span>Progress metrics ({currentContext?.progress}%)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded bg-background border border-border-subtle hover:bg-panel cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selection.includeDecisions}
                  onChange={() => toggleCheck('includeDecisions')}
                  className="rounded text-accent focus:ring-accent/40 bg-background"
                />
                <span>Decisions ({currentContext?.decisions.length || 0})</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded bg-background border border-border-subtle hover:bg-panel cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selection.includeKnownIssues}
                  onChange={() => toggleCheck('includeKnownIssues')}
                  className="rounded text-accent focus:ring-accent/40 bg-background"
                />
                <span>Known issues & blockers</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded bg-background border border-border-subtle hover:bg-panel cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selection.includeChangedFiles}
                  onChange={() => toggleCheck('includeChangedFiles')}
                  className="rounded text-accent focus:ring-accent/40 bg-background"
                />
                <span>Changed & relevant files</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded bg-background border border-border-subtle hover:bg-panel cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selection.includeRelevantConversation}
                  onChange={() => toggleCheck('includeRelevantConversation')}
                  className="rounded text-accent focus:ring-accent/40 bg-background"
                />
                <span>Recent conversation summary</span>
              </label>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Footer with token calculation */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] font-mono text-text-muted">
              Payload size: <span className="text-accent font-bold">~{(estimatedTokens / 1000).toFixed(1)}k tokens</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShareContextOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={handleOpenPreview}
                disabled={!validTarget}
                className="gap-1 font-mono"
              >
                <span>Preview Handoff</span>
                <ArrowRight size={13} />
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      {isPreviewOpen && previewData && sourceAgent && validTarget && sourceSessionId && targetSessionId && (
        <HandoffPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          onBack={() => setIsPreviewOpen(false)}
          previewData={previewData}
          sourceAgent={sourceAgent}
          targetAgent={validTarget}
          sourceSessionId={sourceSessionId}
          targetSessionId={targetSessionId}
          selection={selection}
          onCompleted={() => {
            setIsPreviewOpen(false);
            setShareContextOpen(false);
          }}
        />
      )}
    </>
  );
};
