import { TerminalSnapshot } from '../../services/terminal/terminalTypes';

export interface SelectionPoint { row: number; column: number; }
export interface SelectionRange { start: SelectionPoint; end: SelectionPoint; }

export function comparePoints(a: SelectionPoint, b: SelectionPoint): number {
  return a.row - b.row || a.column - b.column;
}

export function containsPoint(selection: SelectionRange, row: number, column: number): boolean {
  const startFirst = comparePoints(selection.start, selection.end) <= 0;
  const start = startFirst ? selection.start : selection.end;
  const end = startFirst ? selection.end : selection.start;
  const point = { row, column };
  return comparePoints(point, start) >= 0 && comparePoints(point, end) <= 0;
}

export function selectedText(snapshot: TerminalSnapshot, selection: SelectionRange | null): string {
  if (!selection) return '';
  const startFirst = comparePoints(selection.start, selection.end) <= 0;
  const start = startFirst ? selection.start : selection.end;
  const end = startFirst ? selection.end : selection.start;
  const rows = [...snapshot.scrollback, ...snapshot.cells];
  return rows.slice(start.row, end.row + 1).map((row, index) => {
    const first = index === 0 ? start.column : 0;
    const last = index === end.row - start.row ? end.column : row.cells.length - 1;
    return row.cells
      .slice(first, last + 1)
      .filter(cell => cell.width !== 0)
      .map(cell => cell.text)
      .join('')
      .replace(/\s+$/, '');
  }).join('\n');
}
