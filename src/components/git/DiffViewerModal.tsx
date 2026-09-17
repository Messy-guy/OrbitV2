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
  ListTree,
  FileText,
  WrapText,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useFileEditorStore } from '../../stores/fileEditor.store';
import { tauriService } from '../../services/tauri.service';
import { GitFileDiffData } from '../../types/orbit';
import { clsx } from 'clsx';

interface UnifiedLine {
  type: 'header' | 'hunk' | 'added' | 'removed' | 'context';
  text: string;
  oldNum?: number;
  newNum?: number;
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
  const [isFileDrawerOpen, setIsFileDrawerOpen] = useState<boolean>(false);
  const [wrapLines, setWrapLines] = useState<boolean>(true);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

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

  const diffText = diffData?.diff || '';

  // Calculate live diff stats (+N, -N)
  const diffStats = useMemo(() => {
    if (!diffText) return { additions: 0, deletions: 0 };
    let additions = 0;
    let deletions = 0;
    const lines = diffText.split('\n');
    for (const line of lines) {
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git')) continue;
      if (line.startsWith('+')) additions++;
      else if (line.startsWith('-')) deletions++;
    }
    return { additions, deletions };
  }, [diffText]);

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

  const handleCopy = async () => {
    if (!diffText) return;
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

  // Keyboard Shortcuts: ESC (close), [ (prev), ] (next), S (stage), E (edit), B (drawer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeDiffFile) return;

      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveDiffFile(null);
        return;
      }
      if (e.key === '[') {
        e.preventDefault();
        handlePrevFile();
        return;
      }
      if (e.key === ']') {
        e.preventDefault();
        handleNextFile();
        return;
      }
      if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleToggleStage();
        return;
      }
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleOpenInEditor();
        return;
      }
      if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsFileDrawerOpen((prev) => !prev);
        return;
      }
      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setDiffViewMode(diffViewMode === 'side-by-side' ? 'unified' : 'side-by-side');
        return;
      }
      if (e.key.toLowerCase() === 'w' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setWrapLines((prev) => !prev);
        return;
      }
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsMaximized((prev) => !prev);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDiffFile, currentFileIndex, allChangedFiles, activeDiffStaged, projectPath, diffViewMode]);


  // Parse raw git diff into unified stream with old/new line numbers
  const parseUnifiedDiff = (raw: string): UnifiedLine[] => {
    if (!raw) return [];
    const lines = raw.split('\n');
    const result: UnifiedLine[] = [];
    let oldNo = 1;
    let newNo = 1;

    for (const line of lines) {
      if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
        result.push({ type: 'header', text: line });
        continue;
      }
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldNo = parseInt(match[1], 10);
          newNo = parseInt(match[2], 10);
        }
        result.push({ type: 'hunk', text: line });
        continue;
      }
      if (line.startsWith('-')) {
        result.push({
          type: 'removed',
          text: line.slice(1),
          oldNum: oldNo++,
        });
      } else if (line.startsWith('+')) {
        result.push({
          type: 'added',
          text: line.slice(1),
          newNum: newNo++,
        });
      } else {
        const text = line.startsWith(' ') ? line.slice(1) : line;
        result.push({
          type: 'context',
          text,
          oldNum: oldNo++,
          newNum: newNo++,
        });
      }
    }
    return result;
  };

  // Build aligned side-by-side rows from raw diff
  const buildSplitRows = (): SplitRow[] => {
    if (!diffText) {
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

  if (!activeDiffFile) return null;

  const diffLines = parseUnifiedDiff(diffText);
  const splitRows = buildSplitRows();

  // Extract path and filename for breadcrumbs
  const pathParts = activeDiffFile.split('/');
  const fileName = pathParts.pop() || activeDiffFile;
  const dirPath = pathParts.join('/') + (pathParts.length > 0 ? '/' : '');

  return (
    <div
      className={clsx(
        "fixed inset-0 z-[11500] select-none font-mono",
        isMaximized ? "p-0" : "flex items-center justify-center p-2 md:p-3"
      )}
    >
      {/* Luminous Frosted Glass Backdrop */}
      {!isMaximized && (
        <div
          onClick={() => setActiveDiffFile(null)}
          className="absolute inset-0 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
        />
      )}

      {/* Modal Container */}
      <div
        className={clsx(
          "relative bg-[#0e1017] flex flex-col z-10 overflow-hidden",
          isMaximized
            ? "w-full h-full rounded-none border-0 shadow-none"
            : "w-[98vw] max-w-[1850px] h-[93vh] border border-white/15 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-120"
        )}
      >
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#12151f] shrink-0">
          
          {/* File Name, Breadcrumb & Navigation */}
          <div className="flex items-center gap-2.5 truncate min-w-0">
            {/* Prev / Next file switcher */}
            <div className="flex items-center border border-white/10 rounded-lg overflow-hidden bg-[#161924] shrink-0">
              <button
                onClick={handlePrevFile}
                disabled={currentFileIndex <= 0}
                className="p-1 hover:bg-white/10 text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Previous changed file ( [ )"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={handleNextFile}
                disabled={currentFileIndex >= allChangedFiles.length - 1}
                className="p-1 hover:bg-white/10 text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors border-l border-white/10 cursor-pointer"
                title="Next changed file ( ] )"
              >
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Changed Files Drawer Toggle */}
            <button
              onClick={() => setIsFileDrawerOpen(!isFileDrawerOpen)}
              className={clsx(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-mono transition-colors cursor-pointer shrink-0",
                isFileDrawerOpen
                  ? "bg-white/15 border-white/30 text-text-primary font-bold shadow-xs"
                  : "bg-[#161924] border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20"
              )}
              title="Toggle Changed Files List ( B )"
            >
              <ListTree size={13} />
              <span>{currentFileIndex + 1}/{allChangedFiles.length}</span>
            </button>

            <FileCode size={15} className="text-text-secondary shrink-0" />

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 text-xs truncate min-w-0">
              {dirPath && (
                <span className="text-text-dim truncate max-w-[160px] sm:max-w-xs">{dirPath}</span>
              )}
              <span className="font-bold text-text-primary tracking-tight truncate">{fileName}</span>
            </div>

            {/* Diff Stats Badge */}
            {(diffStats.additions > 0 || diffStats.deletions > 0) && (
              <div className="flex items-center gap-1 shrink-0 text-[10px] font-mono font-bold">
                {diffStats.additions > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400">
                    +{diffStats.additions}
                  </span>
                )}
                {diffStats.deletions > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-400">
                    −{diffStats.deletions}
                  </span>
                )}
              </div>
            )}

            {/* Staged / Working Tree Badge */}
            <span
              className={clsx(
                'text-[9.5px] px-2 py-0.5 rounded-full font-bold uppercase border shrink-0',
                activeDiffStaged
                  ? 'bg-white/10 text-text-primary border-white/20'
                  : 'bg-well text-text-secondary border-border'
              )}
            >
              {activeDiffStaged ? 'Staged' : 'Working Tree'}
            </span>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Split / Unified View Segmented Toggle */}
            <div className="flex items-center bg-[#161924] border border-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setDiffViewMode('side-by-side')}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer',
                  diffViewMode === 'side-by-side'
                    ? 'bg-white/15 text-text-primary font-bold shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                )}
                title="Side-by-side Split Diff ( M )"
              >
                <Columns size={12} />
                <span className="hidden sm:inline">Split</span>
              </button>
              <button
                onClick={() => setDiffViewMode('unified')}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer',
                  diffViewMode === 'unified'
                    ? 'bg-white/15 text-text-primary font-bold shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                )}
                title="Unified Diff Stream ( M )"
              >
                <AlignJustify size={12} />
                <span className="hidden sm:inline">Unified</span>
              </button>
            </div>

            {/* Wrap Lines Toggle Button */}
            <button
              onClick={() => setWrapLines(!wrapLines)}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer shadow-xs',
                wrapLines
                  ? 'bg-white/15 border-white/30 text-text-primary font-bold shadow-xs'
                  : 'bg-[#161924] border-white/10 text-text-muted hover:text-text-primary'
              )}
              title="Toggle Word Wrap ( W )"
            >
              <WrapText size={12} className={wrapLines ? 'text-cyan-400' : 'text-text-muted'} />
              <span className="hidden sm:inline">Wrap</span>
            </button>

            {/* Quick Stage / Unstage Button */}
            <button
              onClick={handleToggleStage}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer shadow-xs',
                activeDiffStaged
                  ? 'bg-well hover:bg-panel text-text-secondary hover:text-text-primary border-border'
                  : 'bg-text-primary hover:opacity-90 text-background font-bold border-transparent'
              )}
              title={activeDiffStaged ? 'Unstage file ( S )' : 'Stage file ( S )'}
            >
              {activeDiffStaged ? <Minus size={12} /> : <Plus size={12} />}
              <span>{activeDiffStaged ? 'Unstage' : 'Stage'}</span>
            </button>

            {/* Open In Orbit File Editor */}
            <button
              onClick={handleOpenInEditor}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-[#161924] hover:bg-white/10 text-text-primary border border-white/10 transition-colors cursor-pointer"
              title="Open and edit in Orbit Editor ( E )"
            >
              <Edit3 size={12} className="text-text-secondary" />
              <span className="hidden sm:inline">Edit</span>
            </button>

            {/* Open in External Editor (VS Code) */}
            <button
              onClick={() => openInExternalEditor(activeDiffFile)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-[#161924] hover:bg-white/10 text-text-primary border border-white/10 transition-colors cursor-pointer"
              title="Open file in VS Code"
            >
              <ExternalLink size={12} className="text-text-secondary" />
              <span className="hidden md:inline">VS Code</span>
            </button>

            {/* Refresh Diff */}
            <button
              onClick={loadDiff}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
              title="Refresh diff"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            </button>

            {/* Copy Diff */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 p-1.5 px-2 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
              title="Copy diff to clipboard"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span className="text-[11px] hidden lg:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Maximize / Restore Toggle Button */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
              title={isMaximized ? "Restore Window ( F )" : "Maximize Fullscreen ( F )"}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            {/* Close Modal Button */}
            <button
              onClick={() => setActiveDiffFile(null)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/10 border border-white/10 transition-colors cursor-pointer ml-0.5"
              title="Close ( ESC )"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Main Body: Collapsible File Drawer + Diff Viewport */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Collapsible Changed Files Drawer */}
          {isFileDrawerOpen && (
            <div className="w-72 border-r border-white/10 bg-[#0c0e15] flex flex-col shrink-0 animate-in slide-in-from-left duration-150 z-20 select-none">
              <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-[#12151f]">
                <div className="flex items-center gap-2">
                  <ListTree size={13} className="text-text-muted" />
                  <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">Changed Files</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-text-muted font-bold">
                  {allChangedFiles.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto py-1 custom-scrollbar">
                {allChangedFiles.map((filePath) => {
                  const isCurrent = filePath === activeDiffFile;
                  const parts = filePath.split('/');
                  const itemFileName = parts.pop() || filePath;
                  const itemDirPath = parts.join('/') + (parts.length > 0 ? '/' : '');

                  const fileInfo = gitState?.modifiedFiles.find((f) => f.path === filePath);
                  const status = fileInfo?.status || 'modified';

                  return (
                    <button
                      key={filePath}
                      onClick={() => setActiveDiffFile(filePath, activeDiffStaged)}
                      className={clsx(
                        "w-full px-3 py-1.5 text-left flex items-center justify-between text-xs font-mono transition-colors cursor-pointer group",
                        isCurrent
                          ? "bg-white/15 text-text-primary font-bold border-l-2 border-text-primary"
                          : "text-text-secondary hover:bg-white/[0.04] hover:text-text-primary"
                      )}
                    >
                      <div className="flex flex-col truncate pr-2 min-w-0">
                        <span className="truncate text-[11px]">{itemFileName}</span>
                        {itemDirPath && (
                          <span className="truncate text-[9.5px] text-text-dim">{itemDirPath}</span>
                        )}
                      </div>

                      <span
                        className={clsx(
                          "text-[9px] font-bold uppercase px-1.5 py-0.2 rounded shrink-0",
                          status === 'added' && "text-emerald-400 bg-emerald-500/15",
                          status === 'deleted' && "text-rose-400 bg-rose-500/15",
                          status === 'modified' && "text-amber-400 bg-amber-500/15",
                          status === 'untracked' && "text-cyan-400 bg-cyan-500/15"
                        )}
                      >
                        {status.slice(0, 1).toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Diff Content Viewport */}
          <div className="flex-1 overflow-auto bg-[#090a0f] text-[12px] leading-5 flex flex-col font-mono custom-scrollbar select-text">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center gap-2 text-text-muted text-xs">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-text-primary border-t-transparent animate-spin" />
                <span>Calculating working tree diff...</span>
              </div>
            ) : diffViewMode === 'side-by-side' ? (
              /* ================= MODERN SIDE-BY-SIDE SPLIT VIEW ================= */
              <div className="min-w-full flex flex-col">
                {/* Header row for split panes */}
                <div className="grid grid-cols-2 bg-[#121520] border-b border-white/10 text-[10px] text-text-muted font-bold sticky top-0 z-20 select-none shadow-xs">
                  <div className="px-3 py-1.5 border-r border-white/10 flex items-center justify-between">
                    <span>{activeDiffStaged ? 'HEAD' : 'INDEX (HEAD)'}</span>
                    <span className="text-rose-400/80 font-mono font-bold uppercase tracking-wider">Original</span>
                  </div>
                  <div className="px-3 py-1.5 flex items-center justify-between">
                    <span>{activeDiffStaged ? 'STAGED' : 'WORKING TREE'}</span>
                    <span className="text-emerald-400/80 font-mono font-bold uppercase tracking-wider">Modified</span>
                  </div>
                </div>

                {splitRows.length === 0 ? (
                  <div className="text-text-dim text-xs p-10 text-center">No uncommitted changes for this file.</div>
                ) : (
                  splitRows.map((row, idx) => {
                    const isHunkHeader = row.origType === 'empty' && row.modType === 'empty' && row.origText?.startsWith('@@');

                    if (isHunkHeader) {
                      const parts = row.origText ? row.origText.match(/(@@ -?\d+(?:,\d+)? \+?\d+(?:,\d+)? @@)(.*)/) : null;
                      const hunkRange = parts ? parts[1] : row.origText;
                      const hunkContext = parts ? parts[2]?.trim() : '';

                      return (
                        <div
                          key={idx}
                          className="sticky top-[31px] z-10 bg-[#121522] border-y border-white/10 px-4 py-1 text-[11px] font-mono flex items-center justify-between select-none shadow-xs my-0.5"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-cyan-400 font-bold tracking-tight">{hunkRange}</span>
                            {hunkContext && (
                              <span className="text-text-muted truncate font-normal">{hunkContext}</span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="grid grid-cols-2 group hover:bg-white/[0.02]">
                        {/* Left Pane (Original) */}
                        <div
                          className={clsx(
                            'flex items-stretch border-r border-white/10 min-w-0',
                            row.origType === 'removed' && 'bg-rose-500/[0.10] text-[#fecdd3] border-l-2 border-rose-500/80',
                            row.origType === 'empty' && 'bg-[#090a0f] select-none',
                            row.origType === 'normal' && 'text-text-secondary'
                          )}
                        >
                          <span className="w-12 text-right pr-2.5 text-[11px] font-mono text-text-dim select-none shrink-0 py-0.5 border-r border-white/5 bg-[#0a0c12]">
                            {row.origNum ?? ''}
                          </span>
                          <span className="w-5 text-center select-none font-bold text-[11px] shrink-0 py-0.5 text-rose-400">
                            {row.origType === 'removed' ? '−' : ''}
                          </span>
                          <div
                            className={clsx(
                              'flex-1 px-2 py-0.5 min-w-0 font-mono text-[12px] leading-5',
                              wrapLines
                                ? 'whitespace-pre-wrap break-words [overflow-wrap:anywhere]'
                                : 'whitespace-pre overflow-x-auto custom-scrollbar-thin'
                            )}
                          >
                            {row.origText}
                          </div>
                        </div>

                        {/* Right Pane (Modified) */}
                        <div
                          className={clsx(
                            'flex items-stretch min-w-0',
                            row.modType === 'added' && 'bg-emerald-500/[0.10] text-[#bbf7d0] border-l-2 border-emerald-500/80',
                            row.modType === 'empty' && 'bg-[#090a0f] select-none',
                            row.modType === 'normal' && 'text-text-secondary'
                          )}
                        >
                          <span className="w-12 text-right pr-2.5 text-[11px] font-mono text-text-dim select-none shrink-0 py-0.5 border-r border-white/5 bg-[#0a0c12]">
                            {row.modNum ?? ''}
                          </span>
                          <span className="w-5 text-center select-none font-bold text-[11px] shrink-0 py-0.5 text-emerald-400">
                            {row.modType === 'added' ? '+' : ''}
                          </span>
                          <div
                            className={clsx(
                              'flex-1 px-2 py-0.5 min-w-0 font-mono text-[12px] leading-5',
                              wrapLines
                                ? 'whitespace-pre-wrap break-words [overflow-wrap:anywhere]'
                                : 'whitespace-pre overflow-x-auto custom-scrollbar-thin'
                            )}
                          >
                            {row.modText}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* ================= MODERN UNIFIED DIFF VIEW ================= */
              <div className="min-w-full font-mono text-[12px] leading-5">
                {diffLines.length === 0 ? (
                  <div className="text-text-dim text-xs p-10 text-center">No uncommitted changes for this file.</div>
                ) : (
                  diffLines.map((line, idx) => {
                    if (line.type === 'header') return null;

                    if (line.type === 'hunk') {
                      const parts = line.text.match(/(@@ -?\d+(?:,\d+)? \+?\d+(?:,\d+)? @@)(.*)/);
                      const hunkRange = parts ? parts[1] : line.text;
                      const hunkContext = parts ? parts[2]?.trim() : '';

                      return (
                        <div
                          key={idx}
                          className="sticky top-0 z-10 bg-[#121522] border-y border-white/10 px-4 py-1 text-[11px] font-mono flex items-center justify-between select-none shadow-xs my-0.5"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-cyan-400 font-bold tracking-tight">{hunkRange}</span>
                            {hunkContext && (
                              <span className="text-text-muted truncate font-normal">{hunkContext}</span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const isAdded = line.type === 'added';
                    const isRemoved = line.type === 'removed';

                    return (
                      <div
                        key={idx}
                        className={clsx(
                          'flex items-stretch group hover:bg-white/[0.02]',
                          isAdded && 'bg-emerald-500/[0.10] text-[#bbf7d0] border-l-2 border-emerald-500/80',
                          isRemoved && 'bg-rose-500/[0.10] text-[#fecdd3] border-l-2 border-rose-500/80',
                          !isAdded && !isRemoved && 'text-text-secondary'
                        )}
                      >
                        {/* Old Line Number */}
                        <span className="w-12 text-right pr-2 text-[11px] font-mono text-text-dim select-none shrink-0 py-0.5 border-r border-white/5 bg-[#0a0c12]">
                          {line.oldNum ?? ''}
                        </span>
                        {/* New Line Number */}
                        <span className="w-12 text-right pr-2 text-[11px] font-mono text-text-dim select-none shrink-0 py-0.5 border-r border-white/5 bg-[#0a0c12]">
                          {line.newNum ?? ''}
                        </span>
                        {/* Marker */}
                        <span
                          className={clsx(
                            'w-5 text-center select-none font-bold text-[11px] shrink-0 py-0.5',
                            isAdded && 'text-emerald-400',
                            isRemoved && 'text-rose-400',
                            !isAdded && !isRemoved && 'text-transparent'
                          )}
                        >
                          {isAdded ? '+' : isRemoved ? '−' : ' '}
                        </span>
                        {/* Code text */}
                        <div
                          className={clsx(
                            'flex-1 px-2 py-0.5 min-w-0 font-mono text-[12px] leading-5',
                            wrapLines
                              ? 'whitespace-pre-wrap break-words [overflow-wrap:anywhere]'
                              : 'whitespace-pre overflow-x-auto custom-scrollbar-thin'
                          )}
                        >
                          {line.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-[#12151f] text-[10.5px] text-text-muted shrink-0 font-mono select-none">
          <div className="flex items-center gap-4">
            <span>Branch: <strong className="text-text-primary">{gitState?.currentBranch || 'main'}</strong></span>
            <span className="text-white/20">•</span>
            <span>Mode: <strong className="text-text-primary uppercase">{diffViewMode}</strong></span>
            {(diffStats.additions > 0 || diffStats.deletions > 0) && (
              <>
                <span className="text-white/20">•</span>
                <span>
                  <span className="text-emerald-400 font-bold">+{diffStats.additions}</span>,{' '}
                  <span className="text-rose-400 font-bold">−{diffStats.deletions}</span> lines
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-text-dim">
            <span><kbd className="text-text-primary font-bold px-1 py-0.2 rounded bg-well border border-border text-[9.5px]">[</kbd> <kbd className="text-text-primary font-bold px-1 py-0.2 rounded bg-well border border-border text-[9.5px]">]</kbd> Switch</span>
            <span><kbd className="text-text-primary font-bold px-1 py-0.2 rounded bg-well border border-border text-[9.5px]">B</kbd> Drawer</span>
            <span><kbd className="text-text-primary font-bold px-1 py-0.2 rounded bg-well border border-border text-[9.5px]">M</kbd> Mode</span>
            <span><kbd className="text-text-primary font-bold px-1 py-0.2 rounded bg-well border border-border text-[9.5px]">W</kbd> Wrap</span>
            <span><kbd className="text-text-primary font-bold px-1 py-0.2 rounded bg-well border border-border text-[9.5px]">F</kbd> Maximize</span>
            <span><kbd className="text-text-primary font-bold px-1 py-0.2 rounded bg-well border border-border text-[9.5px]">S</kbd> Stage</span>
            <span><kbd className="text-text-primary font-bold px-1 py-0.2 rounded bg-well border border-border text-[9.5px]">ESC</kbd> Close</span>
          </div>
        </div>

      </div>
    </div>
  );
};
