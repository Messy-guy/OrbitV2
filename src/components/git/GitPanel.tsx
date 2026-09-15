import React, { useEffect, useState } from 'react';
import {
  GitBranch,
  FileCode,
  X,
  GitCommit,
  Plus,
  Minus,
  RotateCcw,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Edit3,
  Trash2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { useContextStore } from '../../stores/context.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { useFileEditorStore } from '../../stores/fileEditor.store';
import { ChangedFileItem } from '../../types/orbit';
import { clsx } from 'clsx';

export const GitPanel: React.FC = () => {
  const { activeWorkspaceId, getActiveWorkspace } = useWorkspaceStore();
  const {
    gitState,
    loadGitState,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    discardFile,
    discardAll,
    commitChanges,
  } = useContextStore();
  const { setActiveBottomPanel, setActiveDiffFile } = useUIStore();
  const { openFile } = useFileEditorStore();

  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);

  // Section collapse states
  const [stagedCollapsed, setStagedCollapsed] = useState(false);
  const [changesCollapsed, setChangesCollapsed] = useState(false);
  const [untrackedCollapsed, setUntrackedCollapsed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);

  const activeWorkspace = getActiveWorkspace();
  const projectPath = activeWorkspace?.projectPath;

  const refreshGit = async () => {
    if (!projectPath) return;
    setIsActionLoading(true);
    try {
      await loadGitState(projectPath);
    } finally {
      setIsActionLoading(false);
    }
  };

  useEffect(() => {
    if (projectPath) {
      refreshGit().catch(() => {});
    }
  }, [projectPath]);

  const stagedFiles = gitState?.stagedFiles || [];
  const unstagedFiles = gitState?.unstagedFiles || [];
  const untrackedFiles = gitState?.untrackedFiles || [];

  const handleCommit = async () => {
    if (!projectPath || !commitMessage.trim() || isCommitting) return;
    setCommitError(null);
    setCommitSuccess(null);
    setIsCommitting(true);
    try {
      // If nothing is staged, offer auto-stage all or prompt
      if (stagedFiles.length === 0 && (unstagedFiles.length > 0 || untrackedFiles.length > 0)) {
        await stageAll(projectPath);
      }
      const res = await commitChanges(projectPath, commitMessage.trim());
      setCommitMessage('');
      setCommitSuccess('Committed successfully');
      setTimeout(() => setCommitSuccess(null), 3000);
    } catch (e) {
      setCommitError(String(e));
    } finally {
      setIsCommitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'added':
      case 'a':
        return <span className="text-emerald-400 font-bold text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 uppercase">A</span>;
      case 'deleted':
      case 'd':
        return <span className="text-red-400 font-bold text-[9px] px-1 py-0.2 rounded bg-red-500/10 border border-red-500/20 uppercase">D</span>;
      case 'untracked':
      case 'u':
        return <span className="text-emerald-400 font-bold text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 uppercase">U</span>;
      case 'renamed':
      case 'r':
        return <span className="text-cyan-400 font-bold text-[9px] px-1 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20 uppercase">R</span>;
      case 'modified':
      default:
        return <span className="text-amber-400 font-bold text-[9px] px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 uppercase">M</span>;
    }
  };

  return (
    <div className="h-80 bg-canvas-chrome border-t border-border flex flex-col overflow-hidden text-xs select-none font-mono shadow-dock">
      {/* VS Code-style Header Toolbar */}
      <div className="h-8 px-3 bg-panel border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-text-primary font-bold text-[10.5px] flex items-center gap-1.5">
            <GitBranch size={13} className="text-amber-500" />
            <span>SOURCE CONTROL</span>
          </span>
          {gitState && (
            <span className="text-[10px] text-text-secondary px-2 py-0.5 rounded-full bg-well border border-border font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{gitState.currentBranch}</span>
              <span className="text-text-dim">({gitState.headCommit})</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh */}
          <button
            onClick={refreshGit}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer"
            title="Refresh Git Status"
          >
            <RefreshCw size={12} className={clsx(isActionLoading && 'animate-spin')} />
          </button>

          {/* Stage All Changes */}
          {(unstagedFiles.length > 0 || untrackedFiles.length > 0) && (
            <button
              onClick={() => projectPath && stageAll(projectPath)}
              className="p-1 rounded text-text-muted hover:text-emerald-400 hover:bg-well transition-colors cursor-pointer"
              title="Stage All Changes (+)"
            >
              <Plus size={13} />
            </button>
          )}

          {/* Unstage All Changes */}
          {stagedFiles.length > 0 && (
            <button
              onClick={() => projectPath && unstageAll(projectPath)}
              className="p-1 rounded text-text-muted hover:text-amber-400 hover:bg-well transition-colors cursor-pointer"
              title="Unstage All Changes (-)"
            >
              <Minus size={13} />
            </button>
          )}

          {/* Close Panel */}
          <button
            onClick={() => setActiveBottomPanel(null)}
            className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-panel-hover transition-colors ml-1 cursor-pointer"
            title="Close Panel"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Main Content Area: Commit Box (Left) + File Groups (Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Commit Box & Actions */}
        <div className="w-72 border-r border-border p-3 bg-panel/50 flex flex-col gap-2 shrink-0">
          <div className="flex flex-col gap-1.5 flex-1">
            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
              Commit Changes
            </span>
            <div className="relative flex-1 flex flex-col">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message (Ctrl+Enter to commit)"
                rows={4}
                className="w-full flex-1 bg-well border border-border focus:border-amber-500/50 rounded-lg p-2.5 text-text-primary text-[11px] font-mono outline-none resize-none placeholder:text-text-dim transition-colors"
              />
            </div>

            {commitError && (
              <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] flex items-start gap-1.5 font-mono">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span className="truncate">{commitError}</span>
              </div>
            )}

            {commitSuccess && (
              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] flex items-center gap-1.5 font-mono">
                <Check size={12} />
                <span>{commitSuccess}</span>
              </div>
            )}

            <button
              onClick={handleCommit}
              disabled={!commitMessage.trim() || isCommitting}
              className={clsx(
                'w-full py-1.5 px-3 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                commitMessage.trim() && !isCommitting
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-sm'
                  : 'bg-well text-text-dim border border-border/50 cursor-not-allowed'
              )}
            >
              {isCommitting ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  <span>Committing...</span>
                </>
              ) : (
                <>
                  <Check size={13} />
                  <span>
                    Commit {stagedFiles.length > 0 ? `(${stagedFiles.length})` : ''}
                  </span>
                </>
              )}
            </button>
          </div>

          <div className="text-[9.5px] text-text-dim flex items-center justify-between pt-1 border-t border-border/50 font-mono">
            <span>Shortcut: <kbd className="text-text-muted font-bold">^Enter</kbd></span>
            <span>{stagedFiles.length} staged / {unstagedFiles.length + untrackedFiles.length} changes</span>
          </div>
        </div>

        {/* Right Column: File Accordions (Staged, Changes, Untracked, Recent Commits) */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar font-mono">
          {/* 1. STAGED CHANGES */}
          <div className="border border-border rounded-lg bg-well/40 overflow-hidden">
            <div
              onClick={() => setStagedCollapsed(!stagedCollapsed)}
              className="px-2.5 py-1.5 bg-panel/70 flex items-center justify-between cursor-pointer hover:bg-panel transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {stagedCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span className="text-[10px] uppercase font-bold text-text-primary tracking-wide">
                  Staged Changes
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  {stagedFiles.length}
                </span>
              </div>

              {stagedFiles.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (projectPath) unstageAll(projectPath);
                  }}
                  className="p-1 rounded text-text-muted hover:text-amber-400 hover:bg-well transition-colors cursor-pointer"
                  title="Unstage All Changes"
                >
                  <Minus size={11} />
                </button>
              )}
            </div>

            {!stagedCollapsed && (
              <div className="p-1 space-y-0.5">
                {stagedFiles.length === 0 ? (
                  <div className="text-[10px] text-text-dim px-3 py-1.5 italic">
                    No staged changes. Use '+' to stage files.
                  </div>
                ) : (
                  stagedFiles.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => setActiveDiffFile(file.path, true)}
                      className="px-2 py-1 rounded hover:bg-panel flex items-center justify-between text-[11px] group cursor-pointer transition-colors border border-transparent hover:border-border"
                      title="Click to view staged diff"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {getStatusBadge(file.status)}
                        <span className="text-text-primary group-hover:text-amber-400 truncate">
                          {file.path}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Open in File Editor */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openFile(file.path);
                          }}
                          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer"
                          title="Open & Edit in Orbit Editor"
                        >
                          <Edit3 size={11} />
                        </button>
                        {/* Unstage button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (projectPath) unstageFile(projectPath, file.path);
                          }}
                          className="p-1 rounded text-text-muted hover:text-amber-400 hover:bg-well transition-colors cursor-pointer"
                          title="Unstage this file (-)"
                        >
                          <Minus size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 2. CHANGES / WORKING TREE */}
          <div className="border border-border rounded-lg bg-well/40 overflow-hidden">
            <div
              onClick={() => setChangesCollapsed(!changesCollapsed)}
              className="px-2.5 py-1.5 bg-panel/70 flex items-center justify-between cursor-pointer hover:bg-panel transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {changesCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span className="text-[10px] uppercase font-bold text-text-primary tracking-wide">
                  Changes
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                  {unstagedFiles.length}
                </span>
              </div>

              {unstagedFiles.length > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (projectPath && window.confirm('Discard all unstaged working tree changes?')) {
                        discardAll(projectPath);
                      }
                    }}
                    className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-well transition-colors cursor-pointer"
                    title="Discard All Unstaged Changes (↺)"
                  >
                    <RotateCcw size={11} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (projectPath) stageAll(projectPath);
                    }}
                    className="p-1 rounded text-text-muted hover:text-emerald-400 hover:bg-well transition-colors cursor-pointer"
                    title="Stage All Changes (+)"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              )}
            </div>

            {!changesCollapsed && (
              <div className="p-1 space-y-0.5">
                {unstagedFiles.length === 0 ? (
                  <div className="text-[10px] text-text-dim px-3 py-1.5 italic">
                    Working tree is clean.
                  </div>
                ) : (
                  unstagedFiles.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => setActiveDiffFile(file.path, false)}
                      className="px-2 py-1 rounded hover:bg-panel flex items-center justify-between text-[11px] group cursor-pointer transition-colors border border-transparent hover:border-border"
                      title="Click to view file diff"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {getStatusBadge(file.status)}
                        <span className="text-text-primary group-hover:text-amber-400 truncate">
                          {file.path}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Open in File Editor */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openFile(file.path);
                          }}
                          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer"
                          title="Open & Edit in Orbit Editor"
                        >
                          <Edit3 size={11} />
                        </button>
                        {/* Discard file changes */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (projectPath && window.confirm(`Discard changes to ${file.path}?`)) {
                              discardFile(projectPath, file.path);
                            }
                          }}
                          className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-well transition-colors cursor-pointer"
                          title="Discard changes (↺)"
                        >
                          <RotateCcw size={11} />
                        </button>
                        {/* Stage file */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (projectPath) stageFile(projectPath, file.path);
                          }}
                          className="p-1 rounded text-text-muted hover:text-emerald-400 hover:bg-well transition-colors cursor-pointer"
                          title="Stage file (+)"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 3. UNTRACKED FILES */}
          {untrackedFiles.length > 0 && (
            <div className="border border-border rounded-lg bg-well/40 overflow-hidden">
              <div
                onClick={() => setUntrackedCollapsed(!untrackedCollapsed)}
                className="px-2.5 py-1.5 bg-panel/70 flex items-center justify-between cursor-pointer hover:bg-panel transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  {untrackedCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <span className="text-[10px] uppercase font-bold text-text-primary tracking-wide">
                    Untracked Files
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                    {untrackedFiles.length}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (projectPath) stageAll(projectPath);
                  }}
                  className="p-1 rounded text-text-muted hover:text-emerald-400 hover:bg-well transition-colors cursor-pointer"
                  title="Stage All Untracked Files (+)"
                >
                  <Plus size={11} />
                </button>
              </div>

              {!untrackedCollapsed && (
                <div className="p-1 space-y-0.5">
                  {untrackedFiles.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => setActiveDiffFile(file.path, false)}
                      className="px-2 py-1 rounded hover:bg-panel flex items-center justify-between text-[11px] group cursor-pointer transition-colors border border-transparent hover:border-border"
                      title="Click to view file content diff"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {getStatusBadge(file.status)}
                        <span className="text-text-primary group-hover:text-emerald-400 truncate">
                          {file.path}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Open in File Editor */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openFile(file.path);
                          }}
                          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer"
                          title="Open & Edit in Orbit Editor"
                        >
                          <Edit3 size={11} />
                        </button>
                        {/* Delete Untracked file */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (projectPath && window.confirm(`Delete untracked file ${file.path}?`)) {
                              discardFile(projectPath, file.path);
                            }
                          }}
                          className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-well transition-colors cursor-pointer"
                          title="Delete file"
                        >
                          <Trash2 size={11} />
                        </button>
                        {/* Stage file */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (projectPath) stageFile(projectPath, file.path);
                          }}
                          className="p-1 rounded text-text-muted hover:text-emerald-400 hover:bg-well transition-colors cursor-pointer"
                          title="Stage file (+)"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. RECENT COMMITS HISTORY */}
          <div className="border border-border rounded-lg bg-well/40 overflow-hidden">
            <div
              onClick={() => setHistoryCollapsed(!historyCollapsed)}
              className="px-2.5 py-1.5 bg-panel/70 flex items-center justify-between cursor-pointer hover:bg-panel transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {historyCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <GitCommit size={12} className="text-text-muted" />
                <span className="text-[10px] uppercase font-bold text-text-primary tracking-wide">
                  Recent Commits ({gitState?.recentCommits.length || 0})
                </span>
              </div>
            </div>

            {!historyCollapsed && (
              <div className="p-1 space-y-0.5">
                {gitState?.recentCommits && gitState.recentCommits.length > 0 ? (
                  gitState.recentCommits.map((c, i) => (
                    <div
                      key={i}
                      className="px-2 py-1 rounded bg-panel/50 border border-border/50 text-text-secondary hover:text-text-primary text-[11px] flex items-center gap-2 transition-colors"
                    >
                      <GitCommit size={11} className="text-text-dim shrink-0" />
                      <span className="truncate">{c}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-text-dim px-3 py-1.5 italic">
                    No commit history found.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

