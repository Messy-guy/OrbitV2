import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TerminalSnapshot } from '../../services/terminal/terminalTypes';
import { encodeKey, encodeMouse, encodePaste } from '../../services/terminal/terminalInput';
import { TerminalCanvasRenderer } from './TerminalCanvasRenderer';
import { SelectionRange, selectedText } from './TerminalSelection';
import { useFileEditorStore } from '../../stores/fileEditor.store';
import { tauriService } from '../../services/tauri.service';

function cleanToken(token: string): string | null {
  let cleaned = token.trim();
  if (!cleaned || cleaned.length < 2) return null;

  // Clean file:// protocol
  cleaned = cleaned.replace(/^file:\/\//, '');

  // Strip leading/trailing enclosing quotes, backticks, brackets
  cleaned = cleaned
    .replace(/^['"`<([{\\]+/, '')
    .replace(/['"`>)\]},;]+$/, '')
    .replace(/[.,:;!?]+$/, '');

  // Strip trailing line/column indicators (e.g. file.md:12:4 or file.md:12)
  const lineMatch = cleaned.match(/^(.+?)(?::\d+){1,2}$/);
  if (lineMatch) {
    cleaned = lineMatch[1];
  }

  // Check if token looks like a file path or code/markdown file
  if (cleaned.includes('.') || cleaned.includes('/') || cleaned.startsWith('~')) {
    if (!/^https?:\/\//.test(cleaned)) {
      return cleaned;
    }
  }
  return null;
}

function extractPathAtPoint(snapshot: TerminalSnapshot, rowIdx: number, colIdx: number): string | null {
  const rows = [...snapshot.scrollback, ...snapshot.cells];
  const targetRow = rows[rowIdx];
  if (!targetRow) return null;
  const lineStr = targetRow.cells.filter(c => c.width !== 0).map(c => c.text).join('');
  if (!lineStr || colIdx >= lineStr.length) return null;

  // 1. Check for Markdown link [label](target) on this line or wrapped with adjacent rows
  const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let mdMatch: RegExpExecArray | null;
  while ((mdMatch = mdLinkRegex.exec(lineStr)) !== null) {
    const start = mdMatch.index;
    const end = mdMatch.index + mdMatch[0].length;
    if (colIdx >= start && colIdx <= end) {
      const target = mdMatch[2].trim();
      const cleaned = cleanToken(target);
      if (cleaned) return cleaned;
    }
  }

  // Check wrapped markdown link with next row if current row has unclosed '[' or '('
  if ((lineStr.includes('[') && !lineStr.includes(']')) || (lineStr.includes('(') && !lineStr.includes(')'))) {
    const nextRow = rows[rowIdx + 1];
    if (nextRow) {
      const nextStr = nextRow.cells.filter(c => c.width !== 0).map(c => c.text).join('');
      const combined = lineStr + nextStr;
      let wrapMatch: RegExpExecArray | null;
      while ((wrapMatch = mdLinkRegex.exec(combined)) !== null) {
        const start = wrapMatch.index;
        const end = wrapMatch.index + wrapMatch[0].length;
        if (colIdx >= start && colIdx <= end) {
          const cleaned = cleanToken(wrapMatch[2].trim());
          if (cleaned) return cleaned;
        }
      }
    }
  }

  // 2. Check for explicit file:// URIs on the line
  const fileUriRegex = /file:\/\/[^\s"'`<>)]+/g;
  let uriMatch: RegExpExecArray | null;
  while ((uriMatch = fileUriRegex.exec(lineStr)) !== null) {
    const start = uriMatch.index;
    const end = uriMatch.index + uriMatch[0].length;
    if (colIdx >= start && colIdx <= end) {
      const cleaned = cleanToken(uriMatch[0]);
      if (cleaned) return cleaned;
    }
  }

  // 3. Check for backticked path: `some_file.md` or `src/file.ts`
  const backtickRegex = /`([^`\r\n]+)`/g;
  let btMatch: RegExpExecArray | null;
  while ((btMatch = backtickRegex.exec(lineStr)) !== null) {
    const start = btMatch.index;
    const end = btMatch.index + btMatch[0].length;
    if (colIdx >= start && colIdx <= end) {
      const cleaned = cleanToken(btMatch[1]);
      if (cleaned) return cleaned;
    }
  }

  // 4. Token boundary expansion around colIdx (without breaking on ':' or '/')
  let start = Math.min(colIdx, lineStr.length - 1);
  while (start > 0 && !/[\s"'`()<>{}\[\]]/.test(lineStr[start - 1])) {
    start--;
  }
  let end = Math.min(colIdx, lineStr.length);
  while (end < lineStr.length && !/[\s"'`()<>{}\[\]]/.test(lineStr[end])) {
    end++;
  }
  const token = lineStr.substring(start, end).trim();
  return cleanToken(token);
}

interface TerminalGridViewProps {
  snapshot: TerminalSnapshot | null;
  onInput: (bytes: Uint8Array) => void;
  projectPath?: string;
}

export const TerminalGridView: React.FC<TerminalGridViewProps> = ({ snapshot, onInput, projectPath }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TerminalCanvasRenderer | null>(null);
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const draggingRef = useRef(false);
  const stickToBottomRef = useRef(true);

  useLayoutEffect(() => {
    if (canvasRef.current) rendererRef.current = new TerminalCanvasRenderer(canvasRef.current);
    return () => { rendererRef.current = null; };
  }, []);

  useLayoutEffect(() => {
    if (snapshot && canvasRef.current) rendererRef.current?.render(snapshot, selection);
  }, [snapshot, selection]);

  useEffect(() => {
    let active = true;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!active) return;
        rendererRef.current?.invalidateMetrics();
        if (snapshot && canvasRef.current) rendererRef.current?.render(snapshot, selection);
      });
    }
    return () => { active = false; };
  }, [snapshot, selection]);

  useLayoutEffect(() => {
    if (stickToBottomRef.current && hostRef.current) {
      hostRef.current.scrollTop = hostRef.current.scrollHeight;
    }
  }, [snapshot]);

  const pointFromEvent = (event: Pick<React.MouseEvent, 'clientX' | 'clientY'>): { row: number; column: number } => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || !snapshot) return { row: 0, column: 0 };
    const rect = hostRef.current?.getBoundingClientRect() || canvas.getBoundingClientRect();
    const size = renderer.cellSize();
    const scrollTop = hostRef.current?.scrollTop || 0;
    const totalRows = snapshot.scrollback.length + snapshot.rows;
    return {
      row: Math.max(0, Math.min(totalRows - 1, Math.floor((event.clientY - rect.top + scrollTop) / size.height))),
      column: Math.max(0, Math.min(snapshot.columns - 1, Math.floor((event.clientX - rect.left) / size.width))),
    };
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const isModifier = event.ctrlKey || event.metaKey;
    const keyLower = event.key.toLowerCase();

    // 1. Paste: Ctrl+V, Ctrl+Shift+V, Cmd+V
    if (isModifier && keyLower === 'v') {
      event.preventDefault();
      event.stopPropagation();
      void (async () => {
        try {
          const nativeText = await tauriService.readClipboardText();
          if (nativeText) {
            onInput(encodePaste(nativeText, !!snapshot?.modes.bracketedPaste));
            return;
          }
        } catch {}

        try {
          const text = await navigator.clipboard?.readText();
          if (text) {
            onInput(encodePaste(text, !!snapshot?.modes.bracketedPaste));
          }
        } catch (err) {
          console.warn('Terminal clipboard paste error:', err);
        }
      })();
      return;
    }

    // 2. Copy: Ctrl+Shift+C (Linux terminal standard) or Ctrl+C / Cmd+C when text is selected
    if (isModifier && keyLower === 'c') {
      if (selection || event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (snapshot && selection) {
          const text = selectedText(snapshot, selection);
          void tauriService.writeClipboardText(text);
          void navigator.clipboard?.writeText(text);
        }
        return;
      }
      // If no selection and no shiftKey, let Ctrl+C pass through to encodeKey so it sends \x03 (SIGINT) to interrupt processes
    }

    // 3. Cut: Ctrl+X, Ctrl+Shift+X, Cmd+X when text is selected
    if (isModifier && keyLower === 'x') {
      if (selection) {
        event.preventDefault();
        event.stopPropagation();
        if (snapshot) {
          const text = selectedText(snapshot, selection);
          void tauriService.writeClipboardText(text);
          void navigator.clipboard?.writeText(text);
          setSelection(null);
        }
        return;
      }
      // If no selection, fall through to encodeKey (sends \x18)
    }

    // 4. Standard terminal key encoding
    const encoded = encodeKey(event.key, {
      appCursor: snapshot?.modes.appCursor,
      ctrl: event.ctrlKey && !event.metaKey,
      alt: event.altKey,
      shift: event.shiftKey,
    });
    if (encoded) {
      event.preventDefault();
      event.stopPropagation();
      onInput(encoded);
    }
  };

  const handleWheel = (event: React.WheelEvent) => {
    if (!snapshot) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    onInput(encodeMouse('motion', point.column, point.row, {
      sgr: snapshot.modes.sgrMouse,
      wheel: event.deltaY < 0 ? 'up' : 'down',
    }));
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    (event.currentTarget as HTMLDivElement).focus();
    // Middle click (button 1) for Linux primary selection/clipboard paste
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      void (async () => {
        try {
          const nativeText = await tauriService.readClipboardText();
          if (nativeText) {
            onInput(encodePaste(nativeText, !!snapshot?.modes.bracketedPaste));
            return;
          }
        } catch {}
        try {
          const text = await navigator.clipboard?.readText();
          if (text) {
            onInput(encodePaste(text, !!snapshot?.modes.bracketedPaste));
          }
        } catch {}
      })();
      return;
    }
    const point = pointFromEvent(event);
    if (snapshot?.modes.mouseClick) {
      onInput(encodeMouse('press', point.column, point.row, { sgr: snapshot.modes.sgrMouse }));
    }
    draggingRef.current = true;
    setSelection({ start: point, end: point });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!draggingRef.current) return;
    const point = pointFromEvent(event);
    if (snapshot?.modes.mouseMotion || snapshot?.modes.mouseDrag) {
      onInput(encodeMouse('motion', point.column, point.row, { sgr: snapshot.modes.sgrMouse, drag: snapshot.modes.mouseDrag }));
    }
    setSelection(previous => previous ? { ...previous, end: point } : previous);
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    const point = pointFromEvent(event);
    if (snapshot?.modes.mouseClick) onInput(encodeMouse('release', point.column, point.row, { sgr: snapshot.modes.sgrMouse }));
    draggingRef.current = false;
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    (event.currentTarget as HTMLDivElement).focus();
    if ((event.ctrlKey || event.metaKey) && snapshot) {
      const point = pointFromEvent(event);
      const clickedPath = extractPathAtPoint(snapshot, point.row, point.column);
      if (clickedPath) {
        event.preventDefault();
        event.stopPropagation();
        void useFileEditorStore.getState().openFile(clickedPath, projectPath);
      }
    }
  };

  return (
    <div
      ref={hostRef}
      className="w-full h-full overflow-auto bg-[#090a0f] outline-none select-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onScroll={(event) => {
        const host = event.currentTarget;
        stickToBottomRef.current = host.scrollTop + host.clientHeight >= host.scrollHeight - 34;
      }}
      onWheel={handleWheel}
      onMouseLeave={() => { draggingRef.current = false; }}
      onPaste={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const text = event.clipboardData?.getData('text');
        if (text) {
          onInput(encodePaste(text, !!snapshot?.modes.bracketedPaste));
        }
      }}
      onClick={handleClick}
      role="textbox"
      aria-label="Terminal"
      onContextMenu={(event) => {
        event.preventDefault();
        if (snapshot && selection) {
          const text = selectedText(snapshot, selection);
          void tauriService.writeClipboardText(text);
          void navigator.clipboard?.writeText(text);
          setSelection(null);
        } else {
          // Paste on right-click if no selection
          void (async () => {
            try {
              const nativeText = await tauriService.readClipboardText();
              if (nativeText) {
                onInput(encodePaste(nativeText, !!snapshot?.modes.bracketedPaste));
                return;
              }
            } catch {}
            try {
              const text = await navigator.clipboard?.readText();
              if (text) {
                onInput(encodePaste(text, !!snapshot?.modes.bracketedPaste));
              }
            } catch {}
          })();
        }
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};
