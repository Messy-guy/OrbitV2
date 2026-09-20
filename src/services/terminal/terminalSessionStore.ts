import { useSyncExternalStore } from 'react';
import { applyPatch, isSequenceGap } from './terminalProtocol';
import { TerminalEvent, TerminalSnapshot } from './terminalTypes';

export class TerminalSessionStore {
  private snapshot: TerminalSnapshot | null = null;
  private listeners = new Set<() => void>();
  private lastSequence = -1;
  private gapHandler?: () => void;
  constructor(onGap?: () => void) { this.gapHandler = onGap; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  apply(event: TerminalEvent): void {
    if (event.type === 'lifecycle') return;
    if (isSequenceGap(this.lastSequence, event)) {
      this.gapHandler?.();
      return;
    }

    if (event.type === 'snapshot') {
      if (this.snapshot && event.snapshot.sequence < this.lastSequence) return;
      this.snapshot = event.snapshot;
      this.lastSequence = event.snapshot.sequence;
      for (const listener of this.listeners) listener();
      return;
    }

    if (event.type === 'patch') {
      if (event.patch.sequence <= this.lastSequence) return;
      if (!this.snapshot) {
        this.gapHandler?.();
        return;
      }
      const next = applyPatch(this.snapshot, event.patch);
      if (!next) {
        this.gapHandler?.();
        return;
      }
      this.snapshot = next;
      this.lastSequence = event.patch.sequence;
      for (const listener of this.listeners) listener();
    }
  }
  reset(snapshot?: TerminalSnapshot): void {
    this.snapshot = snapshot ?? null; this.lastSequence = snapshot?.sequence ?? -1;
    for (const listener of this.listeners) listener();
  }
}

export function useTerminalSnapshot(store: TerminalSessionStore): TerminalSnapshot | null {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function createBlankSnapshot(sessionId: string, rows: number, columns: number): TerminalSnapshot {
  const blankCell = () => ({ text: ' ', foreground: { r: 228, g: 228, b: 231, a: 255 }, background: { r: 9, g: 10, b: 15, a: 255 }, attributes: 0, width: 1 });
  return { sessionId, sequence: 0, rows, columns, cells: Array.from({ length: rows }, (_, row) => ({ row, cells: Array.from({ length: columns }, blankCell) })), scrollback: [], title: null, cursor: { row: 0, column: 0, visible: true }, modes: { bracketedPaste: false, alternateScreen: false, appCursor: false, mouseClick: false, mouseDrag: false, mouseMotion: false, sgrMouse: false } };
}
