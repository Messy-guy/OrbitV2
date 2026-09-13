import { TerminalSnapshot } from '../../services/terminal/terminalTypes';
import { drawTerminalCursor } from './TerminalCursor';
import { SelectionRange, containsPoint } from './TerminalSelection';

const ATTR_INVERSE = 1;
const ATTR_BOLD = 2;
const ATTR_ITALIC = 4;
const ATTR_UNDERLINE = 8;
const ATTR_HIDDEN = 1 << 8;

export class TerminalCanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly fontFamily: string;
  private readonly fontSize: number;

  constructor(canvas: HTMLCanvasElement, fontFamily = 'JetBrains Mono, monospace', fontSize = 13) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    this.context = context;
    this.fontFamily = fontFamily;
    this.fontSize = fontSize;
  }

  cellSize(): { width: number; height: number } {
    this.context.font = `${this.fontSize}px ${this.fontFamily}`;
    return { width: Math.max(7, this.context.measureText('M').width), height: this.fontSize * 1.35 };
  }

  render(snapshot: TerminalSnapshot, selection?: SelectionRange | null): void {
    const dpr = window.devicePixelRatio || 1;
    const cell = this.cellSize();
    const rows = [...snapshot.scrollback, ...snapshot.cells];
    const width = Math.max(1, snapshot.columns * cell.width);
    const height = Math.max(1, rows.length * cell.height);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.ceil(width * dpr);
    this.canvas.height = Math.ceil(height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.context.textBaseline = 'top';
    this.context.clearRect(0, 0, width, height);

    rows.forEach((row, displayRow) => {
      for (let column = 0; column < row.cells.length; column += 1) {
        const item = row.cells[column];
        const inverse = (item.attributes & ATTR_INVERSE) !== 0;
        const foreground = inverse ? item.background : item.foreground;
        const background = inverse ? item.foreground : item.background;
        const x = column * cell.width;
        const y = displayRow * cell.height;
        this.context.fillStyle = rgba(background);
        const cellWidth = item.width === 2 ? cell.width * 2 : cell.width;
        this.context.fillRect(x, y, cellWidth + 0.5, cell.height + 0.5);
        if (selection && containsPoint(selection, displayRow, column)) {
          this.context.fillStyle = 'rgba(56, 189, 248, 0.35)';
          this.context.fillRect(x, y, cellWidth + 0.5, cell.height + 0.5);
        }
        if (item.width === 0 || (item.attributes & ATTR_HIDDEN) !== 0) continue;
        this.context.fillStyle = rgba(foreground);
        this.context.font = `${(item.attributes & ATTR_BOLD) ? '700' : '400'} ${(item.attributes & ATTR_ITALIC) ? 'italic ' : ''}${this.fontSize}px ${this.fontFamily}`;
        this.context.fillText(item.text || ' ', x, y);
        if ((item.attributes & ATTR_UNDERLINE) !== 0) {
          this.context.fillRect(x, y + cell.height - 1, cell.width * Math.max(1, item.width), 1);
        }
      }
    });

    if (snapshot.cursor.row < snapshot.rows && snapshot.cursor.column < snapshot.columns) {
      drawTerminalCursor(this.context, {
        ...snapshot.cursor,
        row: snapshot.scrollback.length + snapshot.cursor.row,
      }, cell);
    }
  }
}

function rgba(color: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
}
