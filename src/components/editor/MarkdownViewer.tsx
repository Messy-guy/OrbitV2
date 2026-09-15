import React from 'react';
import { FileCode, ExternalLink, CheckSquare, Square } from 'lucide-react';
import { useFileEditorStore } from '../../stores/fileEditor.store';
import { clsx } from 'clsx';

interface MarkdownViewerProps {
  content: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  const { openFile } = useFileEditorStore();

  const handlePathClick = (path: string) => {
    openFile(path);
  };

  const renderFormattedLine = (line: string, idx: number) => {
    // 1. Headers (# H1, ## H2, ### H3, #### H4)
    if (line.startsWith('# ')) {
      return (
        <h1 key={idx} className="text-xl font-bold text-text-primary mt-4 mb-2 pb-1 border-b border-border flex items-center gap-2">
          <span>{line.slice(2)}</span>
        </h1>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h2 key={idx} className="text-lg font-bold text-text-primary mt-3 mb-1.5 pb-0.5 border-b border-border/60">
          {line.slice(3)}
        </h2>
      );
    }
    if (line.startsWith('### ')) {
      return (
        <h3 key={idx} className="text-sm font-bold text-text-primary mt-2.5 mb-1">
          {line.slice(4)}
        </h3>
      );
    }
    if (line.startsWith('#### ')) {
      return (
        <h4 key={idx} className="text-xs font-bold text-text-secondary uppercase tracking-wider mt-2 mb-1">
          {line.slice(5)}
        </h4>
      );
    }

    // 2. Horizontal Rule (---, ***, ___)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      return <hr key={idx} className="border-t border-border my-3" />;
    }

    // 3. Blockquotes (> quote)
    if (line.startsWith('> ')) {
      return (
        <div key={idx} className="border-l-2 border-amber-500/70 pl-3 py-1 my-1.5 bg-amber-500/5 rounded-r text-xs text-text-secondary italic">
          {line.slice(2)}
        </div>
      );
    }

    // 4. Task Lists (- [x] or - [ ])
    if (/^[-*]\s*\[[ xX]\]\s*/.test(line)) {
      const isChecked = /^[-*]\s*\[[xX]\]/.test(line);
      const taskText = line.replace(/^[-*]\s*\[[ xX]\]\s*/, '');
      return (
        <div key={idx} className="flex items-start gap-2 text-xs py-0.5 my-0.5 text-text-secondary">
          {isChecked ? (
            <CheckSquare size={13} className="text-emerald-500 mt-0.5 shrink-0" />
          ) : (
            <Square size={13} className="text-text-muted mt-0.5 shrink-0" />
          )}
          <span className={clsx(isChecked && 'line-through text-text-dim')}>{taskText}</span>
        </div>
      );
    }

    // 5. Bullet Lists (- item or * item)
    if (/^[-*]\s+/.test(line)) {
      const itemText = line.replace(/^[-*]\s+/, '');
      return (
        <div key={idx} className="flex items-start gap-2 text-xs py-0.5 my-0.5 pl-2 text-text-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-text-muted mt-1.5 shrink-0" />
          <span>{renderInlineFormatting(itemText)}</span>
        </div>
      );
    }

    // 6. Numbered Lists (1. item)
    if (/^\d+\.\s+/.test(line)) {
      const numMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div key={idx} className="flex items-start gap-2 text-xs py-0.5 my-0.5 pl-2 text-text-secondary">
            <span className="text-[10px] font-mono text-text-muted mt-0.5 font-bold">{numMatch[1]}.</span>
            <span>{renderInlineFormatting(numMatch[2])}</span>
          </div>
        );
      }
    }

    // 7. Empty line
    if (!line.trim()) {
      return <div key={idx} className="h-2" />;
    }

    // 8. Standard paragraph
    return (
      <p key={idx} className="text-xs leading-relaxed text-text-secondary my-1">
        {renderInlineFormatting(line)}
      </p>
    );
  };

  const renderInlineFormatting = (text: string): React.ReactNode => {
    // Recognize file paths (e.g. `src/App.tsx`, `implement.md`) and backticked code
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        const codeContent = part.slice(1, -1);
        const isFilePath = /\.[a-zA-Z0-9]+$/.test(codeContent) || codeContent.includes('/');

        if (isFilePath) {
          return (
            <button
              key={i}
              onClick={() => handlePathClick(codeContent)}
              className="inline-flex items-center gap-1 px-1.5 py-0.2 mx-0.5 rounded bg-well hover:bg-panel-hover text-text-primary border border-border text-[11px] font-mono transition-colors cursor-pointer group"
              title="Click to open file in Orbit Editor"
            >
              <FileCode size={10} className="text-amber-500 group-hover:text-amber-400" />
              <span>{codeContent}</span>
            </button>
          );
        }

        return (
          <code key={i} className="px-1 py-0.2 mx-0.5 rounded bg-well text-amber-600 dark:text-amber-400 font-mono text-[11px] border border-border/50">
            {codeContent}
          </code>
        );
      }

      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-text-primary">{part.slice(2, -2)}</strong>;
      }

      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="italic text-text-secondary">{part.slice(1, -1)}</em>;
      }

      return part;
    });
  };

  // Parse code blocks (```lang ... ```)
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];
  let codeBlockIdx = 0;

  lines.forEach((line, idx) => {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        renderedElements.push(
          <div key={`codeblock-${codeBlockIdx}`} className="my-3 rounded-xl border border-border overflow-hidden bg-black/60 font-mono text-xs">
            <div className="flex items-center justify-between px-3 py-1.5 bg-panel border-b border-border text-[10px] text-text-muted uppercase">
              <span>{codeBlockLang || 'code'}</span>
              <span className="text-[9px]">{codeBlockLines.length} lines</span>
            </div>
            <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed text-zinc-200 custom-scrollbar">
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockLines = [];
      } else {
        // Start of code block
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeBlockLines = [];
        codeBlockIdx = idx;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
    } else {
      renderedElements.push(renderFormattedLine(line, idx));
    }
  });

  if (inCodeBlock && codeBlockLines.length > 0) {
    renderedElements.push(
      <div key={`codeblock-${codeBlockIdx}`} className="my-3 rounded-xl border border-border overflow-hidden bg-black/60 font-mono text-xs">
        <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed text-zinc-200 custom-scrollbar">
          <code>{codeBlockLines.join('\n')}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-4xl mx-auto font-sans leading-relaxed select-text custom-scrollbar">
      {renderedElements}
    </div>
  );
};
