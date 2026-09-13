import { TerminalCursor as CursorState } from '../../services/terminal/terminalTypes';

export function drawTerminalCursor(
  context: CanvasRenderingContext2D,
  cursor: CursorState,
  cell: { width: number; height: number },
): void {
  if (!cursor.visible) return;
  context.fillStyle = 'rgba(255,255,255,0.78)';
  context.fillRect(cursor.column * cell.width, cursor.row * cell.height, 2, cell.height);
}
