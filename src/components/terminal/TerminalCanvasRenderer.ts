import { TerminalSnapshot } from '../../services/terminal/terminalTypes';
import { drawTerminalCursor } from './TerminalCursor';
import { SelectionRange, containsPoint } from './TerminalSelection';

const ATTR_INVERSE = 1;
const ATTR_BOLD = 2;
const ATTR_ITALIC = 4;
const ATTR_UNDERLINE = 8;
const ATTR_DIM = 128;
const ATTR_HIDDEN = 1 << 8;
const ATTR_STRIKEOUT = 1 << 9;

export const TERMINAL_FONT_FAMILY = 'JetBrains Mono, Menlo, Monaco, Consolas, monospace';
export const TERMINAL_FONT_SIZE = 13;
export const TERMINAL_LINE_HEIGHT = 18;

export class TerminalCanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly fontFamily: string;
  private readonly fontSize: number;
  private cachedCellSize: { width: number; height: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    fontFamily = TERMINAL_FONT_FAMILY,
    fontSize = TERMINAL_FONT_SIZE,
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    this.context = context;
    this.fontFamily = fontFamily;
    this.fontSize = fontSize;
  }

  cellSize(): { width: number; height: number } {
    if (this.cachedCellSize) return this.cachedCellSize;
    this.context.font = `${this.fontSize}px ${this.fontFamily}`;
    const measuredWidth = this.context.measureText('M').width;
    const width = measuredWidth > 0 ? measuredWidth : 7.8;
    this.cachedCellSize = {
      width: Math.max(6, width),
      height: TERMINAL_LINE_HEIGHT,
    };
    return this.cachedCellSize;
  }

  invalidateMetrics(): void {
    this.cachedCellSize = null;
  }

  render(
    snapshot: TerminalSnapshot,
    selection?: SelectionRange | null,
    viewport?: { scrollTop: number; clientHeight: number } | null
  ): void {
    const dpr = window.devicePixelRatio || 1;
    const cell = this.cellSize();
    const rows = [...snapshot.scrollback, ...snapshot.cells];
    const totalRows = rows.length;
    const width = Math.max(1, Math.ceil(snapshot.columns * cell.width));
    const height = Math.max(1, Math.ceil(totalRows * cell.height));

    const targetW = Math.ceil(width * dpr);
    const targetH = Math.ceil(height * dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.context.textBaseline = 'middle';

    const visibleStartRow = viewport
      ? Math.max(0, Math.floor(viewport.scrollTop / cell.height) - 4)
      : 0;
    const visibleEndRow = viewport
      ? Math.min(totalRows, Math.ceil((viewport.scrollTop + viewport.clientHeight) / cell.height) + 4)
      : totalRows;

    const clearY = Math.floor(visibleStartRow * cell.height);
    const clearH = Math.ceil((visibleEndRow - visibleStartRow) * cell.height);
    this.context.clearRect(0, clearY, width, clearH);

    const fontOffsetY = cell.height / 2;

    for (let displayRow = visibleStartRow; displayRow < visibleEndRow; displayRow += 1) {
      const row = rows[displayRow];
      if (!row) continue;

      const y = Math.floor(displayRow * cell.height);
      const nextY = Math.floor((displayRow + 1) * cell.height);
      const rowH = nextY - y;

      for (let column = 0; column < row.cells.length; column += 1) {
        const item = row.cells[column];

        // Width 0 indicates a spacer for a preceding wide character; skip it completely
        // so its background does not overwrite or slice into the wide glyph.
        if (item.width === 0) continue;

        const charWidthMultiplier = item.width === 2 ? 2 : 1;
        const x = Math.floor(column * cell.width);
        const nextX = Math.floor((column + charWidthMultiplier) * cell.width);
        const cellW = nextX - x;

        const inverse = (item.attributes & ATTR_INVERSE) !== 0;
        const rawForeground = inverse ? item.background : item.foreground;
        const background = inverse ? item.foreground : item.background;

        // Render cell background if not default dark transparent
        // Also ensure black background (0, 0, 0) and default dark (40, 44, 52) blend seamlessly
        // with the #090a0f container when inverse is NOT set, avoiding patchy black rectangles.
        const isDefaultBg = !inverse && (
          (background.r === 9 && background.g === 10 && background.b === 15) ||
          (background.r === 0 && background.g === 0 && background.b === 0 && background.a === 255) ||
          (background.r === 40 && background.g === 44 && background.b === 52 && background.a === 255)
        );

        if (!isDefaultBg || inverse) {
          this.context.fillStyle = rgba(background);
          this.context.fillRect(x, y, cellW, rowH);
        }

        // Selection highlight
        if (selection && (containsPoint(selection, displayRow, column) || (item.width === 2 && containsPoint(selection, displayRow, column + 1)))) {
          this.context.fillStyle = 'rgba(56, 189, 248, 0.35)';
          this.context.fillRect(x, y, cellW, rowH);
        }

        if ((item.attributes & ATTR_HIDDEN) !== 0) continue;

        // Ensure text glyphs have sufficient contrast against dark background.
        // If an application emitted dark text on default background (not inverse and not on a bright bg),
        // boost its luminance so it doesn't become an unreadable black shadow.
        let foreground = rawForeground;
        if (isDefaultBg && foreground.r < 60 && foreground.g < 60 && foreground.b < 60) {
          foreground = { r: 120, g: 124, b: 138, a: foreground.a };
        }

        // Apply dimming if ATTR_DIM is set
        const isDim = (item.attributes & ATTR_DIM) !== 0;
        const textForeground = isDim
          ? { ...foreground, a: Math.max(80, Math.round(foreground.a * 0.55)) }
          : foreground;

        // Render text glyph if present and non-empty
        if (item.text && item.text !== ' ' && item.text !== '') {
          this.context.fillStyle = rgba(textForeground);
          this.context.font = `${(item.attributes & ATTR_BOLD) ? '700' : '400'} ${(item.attributes & ATTR_ITALIC) ? 'italic ' : ''}${this.fontSize}px ${this.fontFamily}`;
          this.context.fillText(item.text, x, y + fontOffsetY);
        }

        // Underline
        if ((item.attributes & ATTR_UNDERLINE) !== 0) {
          this.context.fillStyle = rgba(textForeground);
          this.context.fillRect(x, y + rowH - 1, cellW, 1);
        }

        // Strikeout
        if ((item.attributes & ATTR_STRIKEOUT) !== 0) {
          this.context.fillStyle = rgba(textForeground);
          this.context.fillRect(x, y + fontOffsetY, cellW, 1);
        }
      }
    }

    const cursorGlobalRow = snapshot.scrollback.length + snapshot.cursor.row;
    if (
      snapshot.cursor.visible &&
      snapshot.cursor.row < snapshot.rows &&
      snapshot.cursor.column < snapshot.columns &&
      cursorGlobalRow >= visibleStartRow &&
      cursorGlobalRow <= visibleEndRow
    ) {
      drawTerminalCursor(this.context, {
        ...snapshot.cursor,
        row: cursorGlobalRow,
      }, cell);
    }
  }
}

function rgba(color: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
}
