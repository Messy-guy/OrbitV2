import React, { useEffect, useState } from 'react';
import {
  X,
  FileCode,
  Save,
  Check,
  Copy,
  Eye,
  Edit3,
  ExternalLink,
  Maximize2,
  Minimize2,
  AlertCircle,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { useFileEditorStore } from '../../stores/fileEditor.store';
import { MarkdownViewer } from './MarkdownViewer';
import { CodeEditorView } from './CodeEditorView';
import { clsx } from 'clsx';

export const FileEditorModal: React.FC = () => {
  const {
    isOpen,
    isMaximized,
    activeFilePath,
    openFiles,
    isSaving,
    error,
    setIsOpen,
    toggleMaximize,
    closeFile,
    setActiveFile,
    saveFile,
    toggleMode,
    openInExternalEditor,
  } = useFileEditorStore();

  const [copied, setCopied] = useState(false);

  const fileList = Object.values(openFiles);
  const activeFile = activeFilePath ? openFiles[activeFilePath] : null;

  // Global ESC key listener to close editor
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, setIsOpen]);

  if (!isOpen || fileList.length === 0 || !activeFile) {
    return null;
  }

  const isMarkdown =
    activeFile.path.toLowerCase().endsWith('.md') ||
    activeFile.path.toLowerCase().endsWith('.markdown');

  const handleCopy = async () => {
    if (!activeFile) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const getFileIcon = (lang: string) => {
    switch (lang) {
      case 'markdown':
        return <FileText size={13} className="text-blue-400" />;
      case 'json':
      case 'yaml':
      case 'toml':
        return <FileSpreadsheet size={13} className="text-amber-400" />;
      default:
        return <FileCode size={13} className="text-emerald-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-3 md:p-6 select-none font-mono">
      {/* Luminous Frosted Glass Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
      />

      {/* Editor Modal Window */}
      <div
        className={clsx(
          'relative w-full bg-panel-elevated border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-120 transition-all',
          isMaximized
            ? 'h-[96vh] max-w-[98vw]'
            : 'h-[82vh] max-w-5xl'
        )}
      >
        {/* Top Header: Multi-File Tabs & Actions Bar */}
        <div className="h-11 bg-panel border-b border-border flex items-center justify-between px-3 gap-2 shrink-0">
          {/* File Tabs Carousel */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-1 py-1">
            {fileList.map((file) => {
              const isActive = file.path === activeFilePath;
              return (
                <div
                  key={file.path}
                  onClick={() => setActiveFile(file.path)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer group shrink-0',
                    isActive
                      ? 'bg-well border-border text-text-primary shadow-sm'
                      : 'bg-transparent border-transparent hover:bg-well/60 text-text-muted hover:text-text-secondary'
                  )}
                  title={file.resolvedPath || file.path}
                >
                  {getFileIcon(file.language)}
                  <span className="truncate max-w-[140px] font-medium">{file.name}</span>

                  {/* Dirty Unsaved Dot */}
                  {file.isDirty && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Unsaved changes" />
                  )}

                  {/* Close Tab Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(file.path);
                    }}
                    className="p-0.5 rounded hover:bg-panel text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    title="Close Tab"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-border">
            {/* Markdown Preview / Edit Mode Toggle */}
            {isMarkdown && (
              <button
                onClick={() => toggleMode(activeFile.path)}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors cursor-pointer',
                  activeFile.mode === 'preview'
                    ? 'bg-well text-amber-500 border-border hover:border-border-hover'
                    : 'bg-well text-text-muted hover:text-text-primary border-border'
                )}
                title={activeFile.mode === 'preview' ? 'Switch to Edit Code' : 'Switch to Markdown Preview'}
              >
                {activeFile.mode === 'preview' ? <Edit3 size={12} /> : <Eye size={12} />}
                <span className="hidden sm:inline">
                  {activeFile.mode === 'preview' ? 'Edit Code' : 'Preview'}
                </span>
              </button>
            )}

            {/* Save File Button */}
            <button
              onClick={() => saveFile(activeFile.path)}
              disabled={isSaving || !activeFile.isDirty}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer',
                activeFile.isDirty
                  ? 'bg-text-primary text-background border-text-primary font-bold hover:opacity-90 shadow-sm'
                  : 'bg-well text-text-muted border-border hover:text-text-secondary opacity-70'
              )}
              title="Save Changes (Ctrl+S)"
            >
              {isSaving ? (
                <span className="w-3 h-3 rounded-full border-2 border-background border-t-transparent animate-spin" />
              ) : (
                <Save size={12} />
              )}
              <span className="hidden sm:inline">Save</span>
            </button>

            {/* Copy Content Button */}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer"
              title="Copy File Content"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>

            {/* Open in VS Code / External Editor */}
            <button
              onClick={() => openInExternalEditor(activeFile.path)}
              className="flex items-center gap-1 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer"
              title="Open in External Editor (VS Code)"
            >
              <ExternalLink size={13} />
            </button>

            {/* Maximize / Restore Toggle */}
            <button
              onClick={toggleMaximize}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-well transition-colors cursor-pointer"
              title={isMaximized ? 'Restore Window' : 'Maximize Window'}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            {/* Close Modal Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Close (ESC)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="px-4 py-1.5 bg-red-500/10 border-b border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={13} />
            <span className="truncate">{error}</span>
          </div>
        )}

        {/* Main Editor / Viewer Viewport */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-canvas">
          {activeFile.isLoading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-text-muted text-xs">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-text-primary border-t-transparent animate-spin" />
              <span>Loading file contents...</span>
            </div>
          ) : isMarkdown && activeFile.mode === 'preview' ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <MarkdownViewer content={activeFile.content} />
            </div>
          ) : (
            <CodeEditorView file={activeFile} />
          )}
        </div>

        {/* Status Bar Footer */}
        <div className="h-7 px-3 bg-panel border-t border-border flex items-center justify-between text-[11px] text-text-muted select-none">
          <div className="flex items-center gap-2.5 truncate">
            <span
              className="text-text-secondary truncate font-mono"
              title={activeFile.resolvedPath || (activeFile.projectPath ? `${activeFile.projectPath}/${activeFile.path}` : activeFile.path)}
            >
              {activeFile.resolvedPath ||
                (activeFile.projectPath && !activeFile.path.startsWith('/') && !activeFile.path.startsWith('~')
                  ? `${activeFile.projectPath}/${activeFile.path}`
                  : activeFile.path)}
            </span>
            {activeFile.isExternal && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-wider font-semibold shrink-0">
                Agent Artifact
              </span>
            )}
            <span className="uppercase text-[10px] px-1 rounded bg-well text-text-dim border border-border shrink-0">
              {activeFile.language}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span>{activeFile.content.split('\n').length} lines</span>
            <span>{activeFile.content.length} chars</span>
            <span
              className={clsx(
                'font-bold text-[10px]',
                activeFile.isDirty ? 'text-amber-500' : 'text-emerald-500'
              )}
            >
              {activeFile.isDirty ? '● Unsaved' : '✓ Saved'}
            </span>
            <span className="hidden md:inline text-text-dim text-[10px]">
              Ctrl+S to save · ESC to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
