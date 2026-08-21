import React, { useState } from 'react';
import { X, FileCode, Check, Copy, ArrowLeft, GitCommit } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { useContextStore } from '../../stores/context.store';
import { clsx } from 'clsx';

export const DiffViewerModal: React.FC = () => {
  const { activeDiffFile, setActiveDiffFile } = useUIStore();
  const { gitState } = useContextStore();
  const [copied, setCopied] = useState(false);

  if (!activeDiffFile) return null;

  // Mock / Synthesized Diff lines for modified file
  const mockDiff = [
    { type: 'header', text: `--- a/${activeDiffFile}` },
    { type: 'header', text: `+++ b/${activeDiffFile}` },
    { type: 'hunk', text: '@@ -12,8 +12,12 @@ export const Component = () => {' },
    { type: 'context', text: '   const [isLoading, setIsLoading] = useState(false);' },
    { type: 'removed', text: '-  const oldHandler = () => { doSomething(); };' },
    { type: 'added', text: '+  const updatedHandler = async () => {' },
    { type: 'added', text: '+    await syncAgentContext();' },
    { type: 'added', text: '+    notifyUserCompleted();' },
    { type: 'added', text: '+  };' },
    { type: 'context', text: '   return <div className="panel">{renderContent()}</div>;' },
  ];

  const handleCopy = async () => {
    const text = mockDiff.map(l => l.text).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={() => setActiveDiffFile(null)}
        className="absolute inset-0 bg-black/80 backdrop-blur-[4px] animate-in fade-in-50 duration-100"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-panel-elevated border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 font-mono text-xs animate-in zoom-in-95 duration-120">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-panel">
          <div className="flex items-center gap-2 truncate">
            <FileCode size={14} className="text-amber-500 shrink-0" />
            <span className="font-bold text-text-primary tracking-tight truncate">{activeDiffFile}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-well text-text-muted">DIFF</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono bg-well hover:bg-panel-hover text-text-muted hover:text-text-primary border border-border transition-colors cursor-pointer"
            >
              {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
              <span>{copied ? 'Copied' : 'Copy Diff'}</span>
            </button>
            <button
              onClick={() => setActiveDiffFile(null)}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Diff Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4 bg-well text-[11.5px] leading-relaxed flex flex-col font-mono custom-scrollbar">
          {mockDiff.map((line, idx) => {
            let lineClass = 'text-text-muted';
            let bgClass = '';
            if (line.type === 'added') {
              lineClass = 'text-emerald-600 dark:text-emerald-400 font-semibold';
              bgClass = 'bg-emerald-500/10 px-2 rounded';
            } else if (line.type === 'removed') {
              lineClass = 'text-red-600 dark:text-red-400 font-semibold';
              bgClass = 'bg-red-500/10 px-2 rounded';
            } else if (line.type === 'hunk') {
              lineClass = 'text-cyan-600 dark:text-cyan-400';
            }

            return (
              <div key={idx} className={clsx('whitespace-pre select-text font-mono py-0.5', lineClass, bgClass)}>
                {line.text}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-panel text-[10.5px] text-text-muted">
          <span>Branch: {gitState?.currentBranch || 'main'}</span>
          <span>Press <kbd className="text-text-primary font-bold">ESC</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
