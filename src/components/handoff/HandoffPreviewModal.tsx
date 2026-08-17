import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, FileCode, Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
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
        <div className="p-4 rounded-panel surface-well space-y-3 shadow-subtle select-text border-border">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="font-bold text-text-primary tracking-wider uppercase text-[10.5px] flex items-center gap-1.5">
              <Sparkles size={12} className="text-text-primary" />
              <span>ORBIT HANDOFF MANIFEST</span>
            </span>
            <span className="text-[10px] text-text-muted px-1.5 py-0.2 rounded-badge bg-panel border border-border font-mono">
              ~{((previewData.estimatedTokens || 2900) / 1000).toFixed(1)}k tokens
            </span>
          </div>

          <div>
            <span className="text-text-dim uppercase text-[9.5px] font-bold block mb-1">Objective</span>
            <p className="text-text-primary text-[12px] font-sans font-medium">{previewData.task}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-btn surface-well-subtle border border-border-subtle">
              <span className="text-text-dim uppercase text-[9.5px] font-bold block mb-0.5">Progress</span>
              <p className="text-text-secondary text-[11px] font-sans">{previewData.progress}</p>
            </div>

            <div className="p-2.5 rounded-btn surface-well-subtle border border-border-subtle">
              <span className="text-text-dim uppercase text-[9.5px] font-bold block mb-0.5">Current Issue</span>
              <p className="text-status-warning text-[11px] font-sans font-medium">{previewData.currentIssue}</p>
            </div>
          </div>

          <div>
            <span className="text-text-dim uppercase text-[9.5px] font-bold block mb-1">Attached Files</span>
            <div className="flex flex-wrap gap-1">
              {previewData.relevantFiles?.map((f: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-badge btn-base text-text-primary text-[10.5px] flex items-center gap-1.5">
                  <FileCode size={11} className="text-text-muted" />
                  <span>{f}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between text-[10.5px] text-text-muted font-mono">
            <span>Author: <strong className="text-text-primary font-bold">{previewData.previousAgent}</strong></span>
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
            <ArrowLeft size={13} strokeWidth={2.5} />
            <span>Back</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleExecute}
            isLoading={isTransferring}
            className="gap-1 font-mono tracking-wider font-bold"
          >
            <span>Execute Handoff</span>
            <ArrowRight size={13} strokeWidth={2.5} />
          </Button>
        </div>
      </div>
    </Modal>
  );
};
