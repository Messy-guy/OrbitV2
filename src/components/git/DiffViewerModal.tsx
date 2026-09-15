import React, { useEffect, useState } from 'react';
import { X, FileCode, Check, Copy, Edit3, ExternalLink, RefreshCw } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useFileEditorStore } from '../../stores/fileEditor.store';
import { tauriService } from '../../services/tauri.service';
import { clsx } from 'clsx';

interface DiffLine {
  type: 'header' | 'hunk' | 'added' | 'removed' | 'context';
  text: string;
}

export const DiffViewerModal: React.FC = () => {
  const { activeDiffFile, setActiveDiffFile } = useUIStore();
  const { gitState } = useContextStore();
  const { getActiveWorkspace } = useWorkspaceStore();
  const { openFile, openInExternalEditor } = useFileEditorStore();

  const [diffText, setDiffText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const activeWorkspace = getActiveWorkspace();

  const loadDiff = async () => {
    if (!activeDiffFile || !activeWorkspace?.projectPath) return;
    setIsLoading(true);
    try {
      const diff = await tauriService.getWorkspaceFileDiff(activeWorkspace.projectPath, activeDiffFile);
      setDiffText(diff);
    } catch (e) {
      setDiffText(`// Error loading diff for ${activeDiffFile}\n${String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeDiffFile) {
      loadDiff();
    } else {
      setDiffText('');
    }
  }, [activeDiffFile, activeWorkspace?.projectPath]);

  // ESC key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeDiffFile && e.key === 'Escape') {
        setActiveDiffFile(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDiffFile, setActiveDiffFile]);

  if (!activeDiffFile) return null;

  // Parse raw git diff string into structured lines
  const parseDiff = (raw: string): DiffLine[] => {
    if (!raw) return [];
    return raw.split('\n').map((line) => {
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git')) {
        return { type: 'header', text: line };
      }
      if (line.startsWith('@@')) {
        return { type: 'hunk', text: line };
      }
      if (line.startsWith('+')) {
        return { type: 'added', text: line };
      }
      if (line.startsWith('-')) {
        return { type: 'removed', text: line };
      }
      return { type: 'context', text: line };
    });
  };

  const diffLines = parseDiff(diffText);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(diffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleOpenInEditor = () => {
    if (activeDiffFile) {
      const fileToOpen = activeDiffFile;
      setActiveDiffFile(null);
      openFile(fileToOpen);
    }
  };

  return (
    <div className="fixed inset-0 z-[11500] flex items-center justify-center p-3 md:p-6 select-none font-mono">
      {/* Luminous Frosted Glass Backdrop */}
      <div
        onClick={() => setActiveDiffFile(null)}
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl bg-panel-elevated border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-120 h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-panel shrink-0">
          <div className="flex items-center gap-2.5 truncate">
            <FileCode size={15} className="text-amber-500 shrink-0" />
            <span className="font-bold text-text-primary tracking-tight truncate text-xs">{activeDiffFile}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
              Live Diff
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Open In Orbit File Editor */}
            <button
              onClick={handleOpenInEditor}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-well hover:bg-panel-hover text-text-primary border border-border transition-colors cursor-pointer"
              title="Open and edit this file in Orbit Editor"
            >
              <Edit3 size={12} className="text-amber-400" />
              <span>Edit File</span>
            </button>

            {/* Open in VS Code */}
            <button
              onClick={() => openInExternalEditor(activeDiffFile)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-well hover:bg-panel-hover text-text-muted hover:text-text-primary border border-border transition-colors cursor-pointer"
              title="Open in External Editor (VS Code)"
            >
              <ExternalLink size={12} />
              <span className="hidden sm:inline">VS Code</span>
            </button>

            {/* Refresh Diff */}
            <button
              onClick={loadDiff}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer"
              title="Refresh Diff"
            >
              <RefreshCw size={13} className={clsx(isLoading && 'animate-spin')} />
            </button>

            {/* Copy Diff */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-well hover:bg-panel-hover text-text-muted hover:text-text-primary border border-border transition-colors cursor-pointer"
              title="Copy Patch"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Close */}
            <button
              onClick={() => setActiveDiffFile(null)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer"
              title="Close (ESC)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Diff Content Viewport */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#090a0f] text-[11.5px] leading-relaxed flex flex-col font-mono custom-scrollbar select-text">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-text-muted text-xs">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-text-primary border-t-transparent animate-spin" />
              <span>Calculating working tree diff...</span>
            </div>
          ) : diffLines.length === 0 ? (
            <div className="text-text-dim text-xs p-4 text-center">No uncommitted changes for this file.</div>
          ) : (
            diffLines.map((line, idx) => {
              let lineClass = 'text-text-secondary';
              let bgClass = '';
              if (line.type === 'added') {
                lineClass = 'text-emerald-400 font-semibold';
                bgClass = 'bg-emerald-500/10 px-2 rounded-sm';
              } else if (line.type === 'removed') {
                lineClass = 'text-red-400 font-semibold';
                bgClass = 'bg-red-500/10 px-2 rounded-sm';
              } else if (line.type === 'hunk') {
                lineClass = 'text-cyan-400 bg-cyan-500/10 px-2 rounded-sm my-1';
              } else if (line.type === 'header') {
                lineClass = 'text-text-muted text-[10.5px] font-bold';
              }

              return (
                <div key={idx} className={clsx('whitespace-pre font-mono py-0.5', lineClass, bgClass)}>
                  {line.text}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-panel text-[10.5px] text-text-muted shrink-0">
          <span>Branch: {gitState?.currentBranch || 'main'}</span>
          <span>Press <kbd className="text-text-primary font-bold">ESC</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
