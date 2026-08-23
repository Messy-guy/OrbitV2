import React, { useState, useEffect } from 'react';
import { Sparkles, Check, Edit3, AlertTriangle, FileCode, GitBranch, ArrowRight, X, Shield, Bookmark } from 'lucide-react';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';

export const ContextDraftModal: React.FC = () => {
  const { isDraftModalOpen, setDraftModalOpen, contextDraft, applyDraft, createCheckpoint } = useContextStore();
  const { getActiveWorkspace } = useWorkspaceStore();
  const { setCreateCheckpointOpen } = useUIStore();

  const [task, setTask] = useState('');
  const [progressNotes, setProgressNotes] = useState<string[]>([]);
  const [activeWork, setActiveWork] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const activeWorkspace = getActiveWorkspace();

  useEffect(() => {
    if (contextDraft) {
      setTask(contextDraft.taskProposal.text);
      setProgressNotes(contextDraft.progressProposals.map(p => p.text));
      setActiveWork(contextDraft.gitSummary);
    }
  }, [contextDraft]);

  if (!isDraftModalOpen || !contextDraft) return null;

  const handleApplyToContext = async () => {
    if (!activeWorkspace) return;
    setIsSaving(true);
    await applyDraft(activeWorkspace.id, task, 85, activeWork);
    setIsSaving(false);
    setDraftModalOpen(false);
  };

  const handleSaveAsCheckpoint = async () => {
    if (!activeWorkspace) return;
    setIsSaving(true);
    await createCheckpoint({
      workspaceId: activeWorkspace.id,
      name: `Checkpoint — ${task.slice(0, 32)}`,
      task,
      progress: progressNotes.join('\n• '),
      decisions: contextDraft.recentDecisions.map(d => d.text),
      knownIssues: contextDraft.activeIssues.map(i => i.title),
      changedFiles: contextDraft.changedFiles,
    });
    setIsSaving(false);
    setDraftModalOpen(false);
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'High':
        return (
          <span className="px-1.5 py-0.5 rounded bg-[#10b981]/15 border border-[#10b981]/30 text-[#34d399] text-[10px] font-mono font-medium">
            ● Detected (High)
          </span>
        );
      case 'Medium':
        return (
          <span className="px-1.5 py-0.5 rounded bg-[#f59e0b]/15 border border-[#f59e0b]/30 text-[#fbbf24] text-[10px] font-mono font-medium">
            ▲ Suggested (Med)
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded bg-[#71717a]/15 border border-[#71717a]/30 text-[#a1a1aa] text-[10px] font-mono font-medium">
            ○ Proposed
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#111217] border border-[#272935] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#16171e] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.12] flex items-center justify-center text-white">
              <FileCode size={14} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f3f4f8]">Proposed Context Draft</h3>
              <p className="text-[11px] text-[#8e93a0] font-mono">Orbit observes • Orbit proposes • You decide</p>
            </div>
          </div>
          <button
            onClick={() => setDraftModalOpen(false)}
            className="p-1.5 text-[#71717a] hover:text-[#f3f4f8] hover:bg-[#20222a] rounded-lg transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-mono">
          {/* Section 1: Inferred Current Task */}
          <div className="space-y-1.5 bg-[#15161d] border border-[#22242e] p-3.5 rounded-xl">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#c0c4d2] uppercase tracking-wider">
                Current Task Proposal
              </label>
              {getConfidenceBadge(contextDraft.taskProposal.confidence)}
            </div>
            <input
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className="w-full px-3 py-2 bg-[#060709] border border-white/[0.1] focus:border-white/40 rounded-lg text-xs font-mono text-[#f3f4f8] outline-none transition-colors"
              placeholder="e.g. Implement WebSocket reconnect handler"
            />
          </div>

          {/* Section 2: Recent Progress Proposals */}
          <div className="space-y-2 bg-[#121318] border border-white/[0.08] p-3.5 rounded-xl">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#c0c4d2] uppercase tracking-wider">
                Detected Progress ({progressNotes.length})
              </label>
              <span className="text-[10px] text-[#8e93a0]">Editable</span>
            </div>
            <div className="space-y-1.5">
              {progressNotes.map((note, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-white/60">▪</span>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => {
                      const next = [...progressNotes];
                      next[idx] = e.target.value;
                      setProgressNotes(next);
                    }}
                    className="flex-1 px-2.5 py-1.5 bg-[#060709] border border-white/[0.08] focus:border-white/30 rounded text-[11px] font-mono text-[#e4e4e7] outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Changed Files & Git State */}
          <div className="grid grid-cols-2 gap-3">
            {/* Changed Files */}
            <div className="bg-[#121318] border border-white/[0.08] p-3 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#c0c4d2] uppercase tracking-wider">
                <span>Changed Files ({contextDraft.changedFiles.length})</span>
                <FileCode size={12} className="text-[#8e93a0]" />
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] text-[#8e93a0]">
                {contextDraft.changedFiles.length === 0 ? (
                  <p className="text-[#5a5e6e] italic">No uncommitted files</p>
                ) : (
                  contextDraft.changedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 truncate">
                      <span className="text-amber-400 text-[10px]">M</span>
                      <span className="text-[#e4e4e7] truncate">{file.path}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Active Issues / Test Failures */}
            <div className="bg-[#121318] border border-white/[0.08] p-3 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#c0c4d2] uppercase tracking-wider">
                <span>Active Issues ({contextDraft.activeIssues.length})</span>
                <AlertTriangle size={12} className="text-amber-400" />
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1 text-[11px]">
                {contextDraft.activeIssues.length === 0 ? (
                  <p className="text-emerald-400 flex items-center gap-1">
                    <Check size={11} />
                    <span>0 unresolved errors</span>
                  </p>
                ) : (
                  contextDraft.activeIssues.map((issue, idx) => (
                    <div key={idx} className="text-red-400 truncate" title={issue.title}>
                      • {issue.title}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-white/[0.08] bg-[#101116] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-[#8e93a0] font-mono">
            <Shield size={12} className="text-emerald-400" />
            <span>Redacted secrets & credentials verified</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDraftModalOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-[#8e93a0] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyToContext}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/[0.15] text-xs font-mono font-medium transition-all"
            >
              Apply to Context
            </button>
            <button
              onClick={handleSaveAsCheckpoint}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white hover:bg-white/90 text-black text-xs font-mono font-bold transition-all shadow-md"
            >
              <Bookmark size={13} />
              <span>Save Checkpoint</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
