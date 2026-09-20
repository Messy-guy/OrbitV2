export interface TerminalColor { r: number; g: number; b: number; a: number; }
export interface TerminalCell { text: string; foreground: TerminalColor; background: TerminalColor; attributes: number; width: number; }
export interface TerminalRow { row: number; cells: TerminalCell[]; }
export interface TerminalModes { bracketedPaste: boolean; alternateScreen: boolean; appCursor: boolean; mouseClick: boolean; mouseDrag: boolean; mouseMotion: boolean; sgrMouse: boolean; }
export interface TerminalCursor { row: number; column: number; visible: boolean; }
export interface TerminalSnapshot { sessionId: string; sequence: number; rows: number; columns: number; cells: TerminalRow[]; scrollback: TerminalRow[]; title?: string | null; cursor: TerminalCursor; modes: TerminalModes; }
export interface TerminalPatch { sessionId: string; sequence: number; rows: number; columns: number; dirtyRows: TerminalRow[]; title?: string | null; titleChanged: boolean; cursor: TerminalCursor; modes: TerminalModes; }
export type TerminalEvent =
  | { type: 'snapshot'; snapshot: TerminalSnapshot }
  | { type: 'patch'; patch: TerminalPatch }
  | { type: 'lifecycle'; sessionId: string; state: string; pid?: number; exitCode?: number; message?: string };
