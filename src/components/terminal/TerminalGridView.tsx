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

  // 1. Clean file:// protocol
  if (cleaned.startsWith('file://')) {
    cleaned = cleaned.slice(7);
  }

  // 2. Web URLs: http:// or https:// (e.g. login links, web docs, localhost dev servers)
  if (/^https?:\/\//i.test(cleaned)) {
    cleaned = cleaned
      .replace(/^[*_`'"<([{\\]+/, '')
      .replace(/[*_`'">)\]},;!?]+$/, '');
    if (/^https?:\/\/[^\s]+$/i.test(cleaned)) {
      return cleaned;
    }
  }

  // 3. File paths / Markdown files: strip markdown formatting (*, _, `), quotes, brackets
  cleaned = cleaned
    .replace(/^[*_`'"<([{\\]+/, '')
    .replace(/[*_`'">)\]},;!?]+$/, '')
    .replace(/[.,:;!?]+$/, '');

  // Strip trailing line/column indicators (e.g. file.md:12:4 or file.md:12)
  const lineMatch = cleaned.match(/^(.+?)(?::\d+){1,2}$/);
  if (lineMatch) {
    cleaned = lineMatch[1];
  }

  cleaned = cleaned.trim();
  if (cleaned.length < 2) return null;

  // Check if token looks like a file path or code/markdown file
  if (cleaned.includes('.') || cleaned.includes('/') || cleaned.startsWith('~')) {
    return cleaned;
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

  // 2. Check for explicit http:// or https:// URLs on the line
  const httpRegex = /https?:\/\/[^\s"'`<>)]+/gi;
  let httpMatch: RegExpExecArray | null;
  while ((httpMatch = httpRegex.exec(lineStr)) !== null) {
    const start = httpMatch.index;
    const end = httpMatch.index + httpMatch[0].length;
    if (colIdx >= start && colIdx <= end) {
      const cleaned = cleanToken(httpMatch[0]);
      if (cleaned) return cleaned;
    }
  }

  // 3. Check for explicit file:// URIs on the line
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

  // 4. Check for bold markdown: **some_file.md**
  const mdBoldRegex = /\*\*([^*]+)\*\*/g;
  let boldMatch: RegExpExecArray | null;
  while ((boldMatch = mdBoldRegex.exec(lineStr)) !== null) {
    const start = boldMatch.index;
    const end = boldMatch.index + boldMatch[0].length;
    if (colIdx >= start && colIdx <= end) {
      const cleaned = cleanToken(boldMatch[1]);
      if (cleaned) return cleaned;
    }
  }

  // 5. Check for backticked path: `some_file.md` or `src/file.ts`
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

  // 6. Token boundary expansion around colIdx (without breaking on ':' or '/')
  let start = Math.min(colIdx, lineStr.length - 1);
  while (start > 0 && !/[\s"'`()<>{}\[\]*]/.test(lineStr[start - 1])) {
    start--;
  }
  let end = Math.min(colIdx, lineStr.length);
  while (end < lineStr.length && !/[\s"'`()<>{}\[\]*]/.test(lineStr[end])) {
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
  const rafIdRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (canvasRef.current) rendererRef.current = new TerminalCanvasRenderer(canvasRef.current);
    return () => {
      rendererRef.current = null;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const renderCurrent = React.useCallback(() => {
    if (!snapshot || !canvasRef.current || !rendererRef.current) return;
    const host = hostRef.current;
    const viewport = host && host.clientHeight > 0
      ? { scrollTop: host.scrollTop, clientHeight: host.clientHeight }
      : null;
    rendererRef.current.render(snapshot, selection, viewport);
  }, [snapshot, selection]);

  useLayoutEffect(() => {
    renderCurrent();
  }, [renderCurrent]);

  useEffect(() => {
    let active = true;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!active) return;
        rendererRef.current?.invalidateMetrics();
        renderCurrent();
      });
    }
    return () => { active = false; };
  }, [renderCurrent]);

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
    event.stopPropagation();

    // 1. Alternate-screen applications with mouse reporting (vim, htop, less) get mouse wheel escapes
    const isAltScreenMouse = snapshot.modes.alternateScreen && (snapshot.modes.mouseMotion || snapshot.modes.mouseClick);
    if (isAltScreenMouse) {
      event.preventDefault();
      const point = pointFromEvent(event);
      onInput(encodeMouse('motion', point.column, point.row, {
        sgr: snapshot.modes.sgrMouse,
        wheel: event.deltaY < 0 ? 'up' : 'down',
      }));
      return;
    }

    const host = hostRef.current;
    const canScrollContainer = host && host.scrollHeight > host.clientHeight + 4;

    // 2. Standard CLI scrollback when scrollable content exists
    if (canScrollContainer && !snapshot.modes.alternateScreen) {
      event.preventDefault();
      if (event.deltaY < 0) {
        // User scrolling up: immediately unstick from bottom so updates don't snap down
        stickToBottomRef.current = false;
      }
      host.scrollTop += event.deltaY;
      const atBottom = host.scrollTop + host.clientHeight >= host.scrollHeight - 34;
      stickToBottomRef.current = atBottom;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        renderCurrent();
      });
      return;
    }

    // 3. Interactive CLI mode (alternate screen or fixed-height interactive TUI like Antigravity, Claude Code, etc.):
    // Translate wheel deltas into standard Up/Down arrows so the interactive prompt / pager / list scrolls smoothly!
    event.preventDefault();
    const isUp = event.deltaY < 0;
    const arrowKey = isUp
      ? (snapshot.modes.appCursor ? '\x1bOA' : '\x1b[A')
      : (snapshot.modes.appCursor ? '\x1bOB' : '\x1b[B');

    const steps = Math.max(1, Math.min(3, Math.round(Math.abs(event.deltaY) / 35)));
    const encoder = new TextEncoder();
    onInput(encoder.encode(arrowKey.repeat(steps)));
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
    if (draggingRef.current) {
      const point = pointFromEvent(event);
      if (snapshot?.modes.mouseMotion || snapshot?.modes.mouseDrag) {
        onInput(encodeMouse('motion', point.column, point.row, { sgr: snapshot.modes.sgrMouse, drag: snapshot.modes.mouseDrag }));
      }
      setSelection(previous => previous ? { ...previous, end: point } : previous);
      return;
    }

    if (snapshot && hostRef.current) {
      const point = pointFromEvent(event);
      const link = extractPathAtPoint(snapshot, point.row, point.column);
      const isModifier = event.ctrlKey || event.metaKey;
      if (link && (isModifier || /^https?:\/\//i.test(link) || link.endsWith('.md') || link.endsWith('.markdown'))) {
        hostRef.current.style.cursor = 'pointer';
        hostRef.current.title = isModifier
          ? `Click to open ${link}`
          : /^https?:\/\//i.test(link)
            ? `Click to open link in browser (or Ctrl+Click)`
            : `Click to open ${link} (or Ctrl+Click)`;
      } else {
        hostRef.current.style.cursor = 'text';
        hostRef.current.removeAttribute('title');
      }
    }
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    const point = pointFromEvent(event);
    if (snapshot?.modes.mouseClick) onInput(encodeMouse('release', point.column, point.row, { sgr: snapshot.modes.sgrMouse }));
    draggingRef.current = false;
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    (event.currentTarget as HTMLDivElement).focus();
    if (!snapshot) return;

    // Ignore clicks if user just finished dragging a text selection
    if (selection && (selection.start.row !== selection.end.row || selection.start.column !== selection.end.column)) {
      return;
    }

    const point = pointFromEvent(event);
    const clickedPath = extractPathAtPoint(snapshot, point.row, point.column);
    if (!clickedPath) return;

    const isWebUrl = /^https?:\/\//i.test(clickedPath);
    const isModifier = event.ctrlKey || event.metaKey;
    const isFormattedTarget =
      clickedPath.endsWith('.md') ||
      clickedPath.endsWith('.markdown') ||
      clickedPath.startsWith('file://') ||
      clickedPath.startsWith('~') ||
      clickedPath.includes('/');

    if (isModifier || isWebUrl || (!snapshot.modes.mouseClick && isFormattedTarget)) {
      event.preventDefault();
      event.stopPropagation();
      if (isWebUrl) {
        void tauriService.openExternalUrl(clickedPath);
      } else {
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
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          renderCurrent();
        });
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
