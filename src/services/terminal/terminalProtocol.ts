import { TerminalEvent, TerminalPatch, TerminalSnapshot } from './terminalTypes';

export function sequenceOf(event: TerminalEvent): number {
  switch (event.type) {
    case 'snapshot':
      return event.snapshot.sequence;
    case 'patch':
      return event.patch.sequence;
    case 'lifecycle':
      return -1;
  }
}
export function applyPatch(snapshot: TerminalSnapshot, patch: TerminalPatch): TerminalSnapshot | null {
  if (snapshot.sessionId !== patch.sessionId || snapshot.rows !== patch.rows || snapshot.columns !== patch.columns) return null;
  const cells = snapshot.cells.slice();
  for (const row of patch.dirtyRows) {
    if (row.row < 0 || row.row >= snapshot.rows || row.cells.length !== snapshot.columns) return null;
    cells[row.row] = row;
  }
  return { ...snapshot, sequence: patch.sequence, cells, title: patch.titleChanged ? patch.title : snapshot.title, cursor: patch.cursor, modes: patch.modes };
}
export function isSequenceGap(lastSequence: number, event: TerminalEvent): boolean {
  if (event.type !== 'patch') return false;
  const sequence = event.patch.sequence;
  return lastSequence >= 0 && sequence > lastSequence && sequence !== lastSequence + 1;
}
