import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  FileCode,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  RefreshCw,
  Columns,
  AlignJustify,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
} from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useFileEditorStore } from '../../stores/fileEditor.store';
import { tauriService } from '../../services/tauri.service';
import { GitFileDiffData } from '../../types/orbit';
import { clsx } from 'clsx';

interface DiffLine {
  type: 'header' | 'hunk' | 'added' | 'removed' | 'context';
  text: string;
}

interface SplitRow {
  origNum?: number;
  origText?: string;
  origType?: 'normal' | 'removed' | 'empty';
  modNum?: number;
  modText?: string;
  modType?: 'normal' | 'added' | 'empty';
}

export const DiffViewerModal: React.FC = () => {
  const {
    activeDiffFile,
    activeDiffStaged,
    diffViewMode,
    setActiveDiffFile,
    setDiffViewMode,
  } = useUIStore();
  const { gitState, stageFile, unstageFile, loadGitState } = useContextStore();
  const { getActiveWorkspace } = useWorkspaceStore();
  const { openFile, openInExternalEditor } = useFileEditorStore();

  const [diffData, setDiffData] = useState<GitFileDiffData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const activeWorkspace = getActiveWorkspace();
  const projectPath = activeWorkspace?.projectPath;

  const loadDiff = async () => {
    if (!activeDiffFile || !projectPath) return;
    setIsLoading(true);
    try {
      const data = await tauriService.getGitFileDiffData(projectPath, activeDiffFile, activeDiffStaged);
      setDiffData(data);
    } catch (e) {
      setDiffData({
        filePath: activeDiffFile,
        originalContent: '',
        modifiedContent: '',
        diff: `// Error loading diff for ${activeDiffFile}\n${String(e)}`,
        status: 'modified',
        isStaged: !!activeDiffStaged,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeDiffFile) {
      loadDiff();
    } else {
      setDiffData(null);
    }
  }, [activeDiffFile, activeDiffStaged, projectPath]);

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

  // All files for next/prev cycling
  const allChangedFiles = useMemo(() => {
    if (!gitState) return [];
    const files = [...gitState.modifiedFiles];
    return Array.from(new Set(files.map((f) => f.path)));
  }, [gitState]);

  const currentFileIndex = activeDiffFile ? allChangedFiles.indexOf(activeDiffFile) : -1;

  const handlePrevFile = () => {
    if (currentFileIndex > 0) {
      setActiveDiffFile(allChangedFiles[currentFileIndex - 1], activeDiffStaged);
    }
  };

  const handleNextFile = () => {
    if (currentFileIndex >= 0 && currentFileIndex < allChangedFiles.length - 1) {
      setActiveDiffFile(allChangedFiles[currentFileIndex + 1], activeDiffStaged);
    }
  };

  if (!activeDiffFile) return null;

  const diffText = diffData?.diff || '';

  // Parse raw git diff string into structured lines for Unified View
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

  // Build aligned side-by-side rows from raw diff + contents
  const buildSplitRows = (): SplitRow[] => {
    if (!diffText) {
      // If no diff or clean
      const origLines = (diffData?.originalContent || '').split('\n');
      const modLines = (diffData?.modifiedContent || '').split('\n');
      const maxL = Math.max(origLines.length, modLines.length);
      const rows: SplitRow[] = [];
      for (let i = 0; i < maxL; i++) {
        rows.push({
          origNum: i < origLines.length ? i + 1 : undefined,
          origText: origLines[i] ?? '',
          origType: 'normal',
          modNum: i < modLines.length ? i + 1 : undefined,
          modText: modLines[i] ?? '',
          modType: 'normal',
        });
      }
      return rows;
    }

    const lines = diffText.split('\n');
    const rows: SplitRow[] = [];
    let origLineNo = 1;
    let modLineNo = 1;
    let pendingRemoved: string[] = [];
    let pendingAdded: string[] = [];

    const flushPending = () => {
      const maxCount = Math.max(pendingRemoved.length, pendingAdded.length);
      for (let i = 0; i < maxCount; i++) {
        const hasRem = i < pendingRemoved.length;
        const hasAdd = i < pendingAdded.length;
        rows.push({
          origNum: hasRem ? origLineNo++ : undefined,
          origText: hasRem ? pendingRemoved[i] : '',
          origType: hasRem ? 'removed' : 'empty',
          modNum: hasAdd ? modLineNo++ : undefined,
          modText: hasAdd ? pendingAdded[i] : '',
          modType: hasAdd ? 'added' : 'empty',
        });
      }
      pendingRemoved = [];
      pendingAdded = [];
    };

    for (const rawLine of lines) {
      if (rawLine.startsWith('diff --git') || rawLine.startsWith('index ') || rawLine.startsWith('---') || rawLine.startsWith('+++')) {
        continue;
      }
      if (rawLine.startsWith('@@')) {
        flushPending();
        // Parse hunk line numbers: @@ -l,s +l,s @@
        const match = rawLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          origLineNo = parseInt(match[1], 10);
          modLineNo = parseInt(match[2], 10);
        }
        rows.push({
          origText: rawLine,
          origType: 'empty',
          modText: rawLine,
          modType: 'empty',
        });
        continue;
      }

      if (rawLine.startsWith('-')) {
        pendingRemoved.push(rawLine.slice(1));
      } else if (rawLine.startsWith('+')) {
        pendingAdded.push(rawLine.slice(1));
      } else {
        flushPending();
        const text = rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine;
        rows.push({
          origNum: origLineNo++,
          origText: text,
          origType: 'normal',
          modNum: modLineNo++,
          modText: text,
          modType: 'normal',
        });
      }
    }
    flushPending();

    return rows;
  };

  const diffLines = parseDiff(diffText);
  const splitRows = buildSplitRows();

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

  const handleToggleStage = async () => {
    if (!projectPath || !activeDiffFile) return;
    if (activeDiffStaged) {
      await unstageFile(projectPath, activeDiffFile);
      setActiveDiffFile(activeDiffFile, false);
    } else {
      await stageFile(projectPath, activeDiffFile);
      setActiveDiffFile(activeDiffFile, true);
    }
    if (projectPath) loadGitState(projectPath);
  };

  return (
    <div className="fixed inset-0 z-[11500] flex items-center justify-center p-2 md:p-6 select-none font-mono">
      {/* Luminous Frosted Glass Backdrop */}
      <div
        onClick={() => setActiveDiffFile(null)}
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-6xl bg-panel-elevated border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-120 h-[86vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-panel shrink-0">
          {/* File Name & Navigation */}
          <div className="flex items-center gap-2 truncate">
            {/* Prev / Next file switcher */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-well">
              <button
                onClick={handlePrevFile}
                disabled={currentFileIndex <= 0}
                className="p-1 hover:bg-panel text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous changed file"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={handleNextFile}
                disabled={currentFileIndex >= allChangedFiles.length - 1}
                className="p-1 hover:bg-panel text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-border"
                title="Next changed file"
              >
                <ChevronRight size={13} />
              </button>
            </div>

            <FileCode size={15} className="text-amber-500 shrink-0 ml-1" />
            <span className="font-bold text-text-primary tracking-tight truncate text-xs">{activeDiffFile}</span>

            {/* Staged / Working Tree Badge */}
            <span
              className={clsx(
                'text-[9.5px] px-2 py-0.5 rounded-full font-bold uppercase border',
                activeDiffStaged
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              )}
            >
              {activeDiffStaged ? 'Staged' : 'Working Tree'}
            </span>

            {allChangedFiles.length > 1 && (
              <span className="text-[10px] text-text-dim">
                ({currentFileIndex + 1}/{allChangedFiles.length})
              </span>
            )}
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Split / Unified View Toggle */}
            <div className="flex items-center bg-well border border-border rounded-lg p-0.5 mr-1">
              <button
                onClick={() => setDiffViewMode('side-by-side')}
                className={clsx(
                  'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer',
                  diffViewMode === 'side-by-side'
                    ? 'bg-panel-hover text-text-primary font-bold shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                )}
                title="Side-by-side Split Diff"
              >
                <Columns size={12} />
                <span className="hidden sm:inline">Split</span>
              </button>
              <button
                onClick={() => setDiffViewMode('unified')}
                className={clsx(
                  'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer',
                  diffViewMode === 'unified'
                    ? 'bg-panel-hover text-text-primary font-bold shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                )}
                title="Unified Diff Stream"
              >
                <AlignJustify size={12} />
                <span className="hidden sm:inline">Unified</span>
              </button>
            </div>

            {/* Quick Stage / Unstage */}
            <button
              onClick={handleToggleStage}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors cursor-pointer',
                activeDiffStaged
                  ? 'bg-well hover:bg-panel-hover text-amber-400 border-border'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-semibold'
              )}
              title={activeDiffStaged ? 'Unstage this file' : 'Stage this file'}
            >
              {activeDiffStaged ? <Minus size={12} /> : <Plus size={12} />}
              <span className="hidden sm:inline">{activeDiffStaged ? 'Unstage' : 'Stage'}</span>
            </button>

            {/* Open In Orbit File Editor */}
            <button
              onClick={handleOpenInEditor}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-well hover:bg-panel-hover text-text-primary border border-border transition-colors cursor-pointer"
              title="Open and edit this file in Orbit Editor"
            >
              <Edit3 size={12} className="text-amber-400" />
              <span className="hidden sm:inline">Edit</span>
            </button>

            {/* Open in VS Code */}
            <button
              onClick={() => openInExternalEditor(activeDiffFile)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-well hover:bg-panel-hover text-text-muted hover:text-text-primary border border-border transition-colors cursor-pointer"
              title="Open in External VS Code"
            >
              <ExternalLink size={12} />
              <span className="hidden md:inline">VS Code</span>
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
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer ml-1"
              title="Close (ESC)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Diff Content Viewport */}
        <div className="flex-1 overflow-auto bg-[#090a0f] text-[11px] leading-snug flex flex-col font-mono custom-scrollbar select-text">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-text-muted text-xs">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-text-primary border-t-transparent animate-spin" />
              <span>Calculating working tree diff...</span>
            </div>
          ) : diffViewMode === 'side-by-side' ? (
            /* ================= VS CODE SIDE-BY-SIDE DIFF ================= */
            <div className="min-w-full flex flex-col divide-y divide-border/20">
              {/* Header row for split panes */}
              <div className="grid grid-cols-2 bg-panel border-b border-border text-[10px] text-text-muted font-bold sticky top-0 z-10">
                <div className="px-3 py-1.5 border-r border-border flex items-center justify-between">
                  <span>{activeDiffStaged ? 'HEAD' : 'INDEX (HEAD)'}</span>
                  <span className="text-red-400 font-mono">Original</span>
                </div>
                <div className="px-3 py-1.5 flex items-center justify-between">
                  <span>{activeDiffStaged ? 'STAGED' : 'WORKING TREE'}</span>
                  <span className="text-emerald-400 font-mono">Modified</span>
                </div>
              </div>

              {splitRows.length === 0 ? (
                <div className="text-text-dim text-xs p-6 text-center">No uncommitted changes for this file.</div>
              ) : (
                splitRows.map((row, idx) => {
                  const isHunkHeader = row.origType === 'empty' && row.modType === 'empty' && row.origText?.startsWith('@@');

                  if (isHunkHeader) {
                    return (
                      <div key={idx} className="bg-cyan-500/10 text-cyan-400 px-4 py-0.5 text-[10.5px] font-bold border-y border-cyan-500/20">
                        {row.origText}
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className="grid grid-cols-2 hover:bg-white/[0.02]">
                      {/* Left Pane (Original) */}
                      <div
                        className={clsx(
                          'flex items-stretch border-r border-border/40 overflow-hidden',
                          row.origType === 'removed' && 'bg-red-500/15 text-red-300',
                          row.origType === 'empty' && 'bg-black/30'
                        )}
                      >
                        <span className="w-10 text-right pr-2 text-[10px] text-text-dim select-none shrink-0 py-0.5 border-r border-border/20 bg-panel/30">
                          {row.origNum ?? ''}
                        </span>
                        <div className="flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto truncate">
                          {row.origType === 'removed' && <span className="text-red-400 font-bold mr-1">-</span>}
                          {row.origText}
                        </div>
                      </div>

                      {/* Right Pane (Modified) */}
                      <div
                        className={clsx(
                          'flex items-stretch overflow-hidden',
                          row.modType === 'added' && 'bg-emerald-500/15 text-emerald-300',
                          row.modType === 'empty' && 'bg-black/30'
                        )}
                      >
                        <span className="w-10 text-right pr-2 text-[10px] text-text-dim select-none shrink-0 py-0.5 border-r border-border/20 bg-panel/30">
                          {row.modNum ?? ''}
                        </span>
                        <div className="flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto truncate">
                          {row.modType === 'added' && <span className="text-emerald-400 font-bold mr-1">+</span>}
                          {row.modText}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* ================= UNIFIED DIFF VIEW ================= */
            <div className="p-4 flex flex-col">
              {diffLines.length === 0 ? (
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
                    lineClass = 'text-cyan-400 bg-cyan-500/10 px-2 rounded-sm my-1 font-bold';
                  } else if (line.type === 'header') {
                    lineClass = 'text-text-muted text-[10px] font-bold';
                  }

                  return (
                    <div key={idx} className={clsx('whitespace-pre font-mono py-0.5', lineClass, bgClass)}>
                      {line.text}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-panel text-[10.5px] text-text-muted shrink-0 font-mono">
          <div className="flex items-center gap-3">
            <span>Branch: <strong className="text-text-primary">{gitState?.currentBranch || 'main'}</strong></span>
            <span>Mode: <strong className="text-text-primary uppercase">{diffViewMode}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span>Press <kbd className="text-text-primary font-bold px-1 py-0.5 rounded bg-well border border-border">ESC</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

