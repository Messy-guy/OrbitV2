import React, { useLayoutEffect, useRef, useState } from 'react';
import { TerminalSnapshot } from '../../services/terminal/terminalTypes';
import { encodeKey, encodeMouse, encodePaste } from '../../services/terminal/terminalInput';
import { TerminalCanvasRenderer } from './TerminalCanvasRenderer';
import { SelectionRange, selectedText } from './TerminalSelection';

interface TerminalGridViewProps {
  snapshot: TerminalSnapshot | null;
  onInput: (bytes: Uint8Array) => void;
}

export const TerminalGridView: React.FC<TerminalGridViewProps> = ({ snapshot, onInput }) => {
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
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selection) {
      event.preventDefault();
      if (snapshot) void navigator.clipboard?.writeText(selectedText(snapshot, selection));
      return;
    }
    const encoded = encodeKey(event.key, {
      appCursor: snapshot?.modes.appCursor,
      ctrl: event.ctrlKey && !event.metaKey,
      alt: event.altKey,
      shift: event.shiftKey,
    });
    if (encoded) { event.preventDefault(); onInput(encoded); }
  };

  const handleWheel = (event: React.WheelEvent) => {
    if (!snapshot?.modes.mouseClick) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    onInput(encodeMouse('motion', point.column, point.row, {
      sgr: snapshot.modes.sgrMouse,
      wheel: event.deltaY < 0 ? 'up' : 'down',
    }));
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    (event.currentTarget as HTMLDivElement).focus();
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
      onPaste={(event) => { event.preventDefault(); const text = event.clipboardData.getData('text'); onInput(encodePaste(text, !!snapshot?.modes.bracketedPaste)); }}
      onClick={(event) => (event.currentTarget as HTMLDivElement).focus()}
      role="textbox"
      aria-label="Terminal"
      onContextMenu={(event) => { if (snapshot && selection) { event.preventDefault(); void navigator.clipboard?.writeText(selectedText(snapshot, selection)); } }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};
