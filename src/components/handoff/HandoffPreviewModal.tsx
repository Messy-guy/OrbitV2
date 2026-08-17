import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, FileCode, Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Agent, HandoffSelection } from '../../types/orbit';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';

interface HandoffPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  previewData: any;
  sourceAgent: Agent;
  targetAgent: Agent;
  sourceSessionId: string;
  targetSessionId: string;
  selection: HandoffSelection;
  onCompleted: () => void;
}

export const HandoffPreviewModal: React.FC<HandoffPreviewModalProps> = ({
  isOpen,
  onClose,
  onBack,
  previewData,
  sourceAgent,
  targetAgent,
  sourceSessionId,
  targetSessionId,
  selection,
  onCompleted,
}) => {
  const { executeHandoff } = useContextStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const [isTransferring, setIsTransferring] = useState(false);

  const handleExecute = async () => {
    if (!activeWorkspaceId) return;
    setIsTransferring(true);
    try {
      await executeHandoff(
        activeWorkspaceId,
        sourceAgent.id,
        sourceAgent.name,
        sourceSessionId,
        targetAgent.id,
        targetAgent.name,
        targetSessionId,
        selection,
        previewData
      );
      onCompleted();
    } catch (e) {
      console.error(e);
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Handoff Manifest"
      subtitle={`${sourceAgent.name} → ${targetAgent.name}`}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-3.5 text-xs font-mono">
        {/* Handoff Preview Box */}
        <div className="p-3.5 rounded bg-background border border-border space-y-2.5 shadow-subtle select-text">
          <div className="flex items-center justify-between border-b border-border pb-1.5">
            <span className="font-bold text-accent tracking-wider uppercase text-[10px] flex items-center gap-1.5">
              <Sparkles size={11} />
              <span>ORBIT HANDOFF MANIFEST</span>
            </span>
            <span className="text-[10px] text-text-muted">
              ~{((previewData.estimatedTokens || 2900) / 1000).toFixed(1)}k tokens
            </span>
          </div>

          <div>
            <span className="text-text-muted uppercase text-[9.5px] font-bold block mb-0.5">Objective</span>
            <p className="text-text-primary text-[12px] font-sans font-medium">{previewData.task}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div>
              <span className="text-text-muted uppercase text-[9.5px] font-bold block mb-0.5">Progress</span>
              <p className="text-text-secondary text-[11px] font-sans">{previewData.progress}</p>
            </div>

            <div>
              <span className="text-text-muted uppercase text-[9.5px] font-bold block mb-0.5">Current Issue</span>
              <p className="text-status-warning text-[11px] font-sans font-medium">{previewData.currentIssue}</p>
            </div>
          </div>

          <div>
            <span className="text-text-muted uppercase text-[9.5px] font-bold block mb-1">Attached Files</span>
            <div className="flex flex-wrap gap-1">
              {previewData.relevantFiles?.map((f: string, i: number) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-panel-elevated border border-border text-text-primary text-[10px] flex items-center gap-1">
                  <FileCode size={10} className="text-accent" />
                  <span>{f}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between text-[10px] text-text-muted">
            <span>Author: <strong className="text-text-primary">{previewData.previousAgent}</strong></span>
            <span>Action: <span className="text-text-secondary font-sans">{previewData.nextStep}</span></span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1 font-mono"
          >
            <ArrowLeft size={13} />
            <span>Back</span>
          </Button>

          <Button
            variant="accent"
            size="sm"
            onClick={handleExecute}
            isLoading={isTransferring}
            className="gap-1 font-mono"
          >
            <span>Execute Handoff</span>
            <ArrowRight size={13} />
          </Button>
        </div>
      </div>
    </Modal>
  );
};
