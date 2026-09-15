import React, { useRef, useEffect } from 'react';
import { useFileEditorStore, OpenFileItem } from '../../stores/fileEditor.store';
import { clsx } from 'clsx';

interface CodeEditorViewProps {
  file: OpenFileItem;
}

export const CodeEditorView: React.FC<CodeEditorViewProps> = ({ file }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const { updateContent, saveFile } = useFileEditorStore();

  const lines = file.content.split('\n');
  const lineCount = Math.max(1, lines.length);

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. Ctrl+S or Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveFile(file.path);
      return;
    }

    // 2. Tab key handling (2 spaces)
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const updated = val.substring(0, start) + '  ' + val.substring(end);
      updateContent(file.path, updated);

      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateContent(file.path, e.target.value);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [file.path]);

  return (
    <div className="flex-1 flex overflow-hidden font-mono text-xs relative bg-[#090a0f]">
      {/* Line Numbers Sidebar */}
      <div
        ref={lineNumbersRef}
        className="w-12 py-3 px-2 text-right text-text-muted/40 select-none bg-well/40 border-r border-border flex flex-col font-mono text-[11.5px] leading-relaxed overflow-hidden shrink-0"
      >
        {Array.from({ length: lineCount }).map((_, i) => (
          <div key={i} className="h-[21px] flex items-center justify-end">
            {i + 1}
          </div>
        ))}
      </div>

      {/* Editor Textarea */}
      <div className="flex-1 relative overflow-hidden h-full">
        <textarea
          ref={textareaRef}
          value={file.content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="w-full h-full p-3 bg-transparent text-text-primary resize-none outline-none font-mono text-[11.5px] leading-relaxed custom-scrollbar whitespace-pre tab-2 select-text"
          style={{ tabSize: 2 }}
        />
      </div>
    </div>
  );
};
