import { TerminalCursor as CursorState } from '../../services/terminal/terminalTypes';

export function drawTerminalCursor(
  context: CanvasRenderingContext2D,
  cursor: CursorState,
  cell: { width: number; height: number },
): void {
  if (!cursor.visible) return;
  const x = Math.floor(cursor.column * cell.width);
  const nextX = Math.floor((cursor.column + 1) * cell.width);
  const w = Math.max(2, nextX - x);
  const y = Math.floor(cursor.row * cell.height);
  const nextY = Math.floor((cursor.row + 1) * cell.height);
  const h = Math.max(2, nextY - y);

  context.save();
  context.fillStyle = 'rgba(255, 255, 255, 0.28)';
  context.fillRect(x, y, w, h);
  context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  context.lineWidth = 1;
  context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  context.restore();
}
