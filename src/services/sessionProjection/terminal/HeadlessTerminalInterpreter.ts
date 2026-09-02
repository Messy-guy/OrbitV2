import { ScreenSnapshot } from './ScreenSnapshot';

/**
 * Headless VT/ANSI terminal interpreter with a STATEFUL escape-sequence parser.
 *
 * Critical invariant: PTY bytes arrive in ARBITRARY chunk boundaries (the IPC
 * layer coalesces/batches them). An escape sequence split across two chunks
 * (e.g. "\x1b[38;5" | ";208mHi!") must never leak its parameter bytes into the
 * visible grid — the incomplete prefix is stashed and completed when the next
 * chunk arrives. The previous chunk-local parser dropped the ESC and printed
 * "[38;5" as text and SKIPPED the erase/cursor operations entirely, which is
 * the root cause of broken rows like "Hi! 👋 What c" and
 * "ought for 1s nI help you with today?" (two writes overlaid on one grid row
 * because the erase sequence was lost).
 */
export class HeadlessTerminalInterpreter {
  private rows: number;
  private cols: number;
  private grid: string[][];
  // Scrollback: rows pushed off the top of the visible grid by scrolling.
  private static readonly SCROLLBACK_CAP = 400;
  private scrollback: string[][] = [];
  private cursorRow: number = 0;
  private cursorCol: number = 0;
  private generation: number = 0;
  // Incomplete escape sequence carried over from the previous chunk.
  private pendingEscape: string = '';
  // Saved cursor (DECSC / CSI s)
  private savedCursor: { row: number; col: number } | null = null;

  constructor(rows = 30, cols = 100) {
    this.rows = rows;
    this.cols = cols;
    this.grid = this.createEmptyGrid(rows, cols);
  }

  private createEmptyGrid(rows: number, cols: number): string[][] {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' '));
  }

  resize(rows: number, cols: number) {
    if (rows === this.rows && cols === this.cols) return;
    const newGrid = this.createEmptyGrid(rows, cols);
    for (let r = 0; r < Math.min(this.rows, rows); r++) {
      for (let c = 0; c < Math.min(this.cols, cols); c++) {
        newGrid[r][c] = this.grid[r]?.[c] || ' ';
      }
    }
    this.rows = rows;
    this.cols = cols;
    this.grid = newGrid;
    this.cursorRow = Math.min(this.cursorRow, rows - 1);
    this.cursorCol = Math.min(this.cursorCol, cols - 1);
  }

  processBytes(bytes: string): ScreenSnapshot {
    // Prepend any incomplete escape sequence from the previous chunk, then parse
    // one continuous stream. An incomplete trailing sequence is re-stashed.
    const stream = this.pendingEscape + bytes;
    this.pendingEscape = '';

    let i = 0;
    const n = stream.length;
    while (i < n) {
      const char = stream[i];

      if (char === '\x1b') {
        i = this.consumeEscape(stream, i);
        continue;
      }

      // Control characters
      if (char === '\r') {
        this.cursorCol = 0;
      } else if (char === '\n') {
        this.index();
      } else if (char === '\b') {
        this.cursorCol = Math.max(0, this.cursorCol - 1);
      } else if (char === '\t') {
        this.cursorCol = Math.min(this.cols - 1, (Math.floor(this.cursorCol / 8) + 1) * 8);
      } else if (char.charCodeAt(0) >= 32) {
        if (this.cursorRow < this.rows && this.cursorCol < this.cols) {
          this.grid[this.cursorRow][this.cursorCol] = char;
          this.cursorCol++;
          if (this.cursorCol >= this.cols) {
            this.cursorCol = 0;
            this.index();
          }
        }
      }

      i++;
    }

    return this.captureSnapshot();
  }

  /**
   * Consumes one escape sequence starting at `i` (which is guaranteed to be an
   * ESC). Returns the index AFTER the sequence. If the sequence is incomplete,
   * stashes the remainder in `pendingEscape` and returns `stream.length`.
   */
  private consumeEscape(s: string, i: number): number {
    const n = s.length;
    if (i + 1 >= n) {
      // Dangling ESC at end of chunk — wait for more bytes.
      this.pendingEscape = s.slice(i);
      return n;
    }

    const next = s[i + 1];

    // ---- CSI: ESC [ params(0x30-0x3F) intermediates(0x20-0x2F) final(0x40-0x7E)
    if (next === '[') {
      let j = i + 2;
      while (j < n && s.charCodeAt(j) >= 0x20 && s.charCodeAt(j) <= 0x3f) j++;
      if (j >= n) {
        // Incomplete CSI — stash and wait for the final byte.
        this.pendingEscape = s.slice(i);
        return n;
      }
      const finalByte = s.charCodeAt(j);
      if (finalByte >= 0x40 && finalByte <= 0x7e) {
        this.handleCsi(s[j], s.substring(i + 2, j));
        return j + 1;
      }
      // Malformed CSI — discard just ESC [ and reparse the rest as text.
      return i + 2;
    }

    // ---- OSC: ESC ] ... BEL  |  ESC ] ... ESC \
    if (next === ']') {
      const bel = s.indexOf('\x07', i);
      const st = s.indexOf('\x1b\\', i);
      if (bel === -1 && st === -1) {
        this.pendingEscape = s.slice(i);
        return n;
      }
      if (bel !== -1 && (st === -1 || bel < st)) return bel + 1;
      return st + 2;
    }

    // ---- DCS / SOS / PM / APC: terminated by ST (ESC \)
    if (next === 'P' || next === '^' || next === '_' || next === 'X') {
      const st = s.indexOf('\x1b\\', i);
      if (st === -1) {
        this.pendingEscape = s.slice(i);
        return n;
      }
      return st + 2;
    }

    // ---- Two-or-three byte escape sequences
    switch (next) {
      case '7': // DECSC — save cursor
        this.savedCursor = { row: this.cursorRow, col: this.cursorCol };
        return i + 2;
      case '8': // DECRC — restore cursor
        if (this.savedCursor) {
          this.cursorRow = Math.min(this.rows - 1, this.savedCursor.row);
          this.cursorCol = Math.min(this.cols - 1, this.savedCursor.col);
        }
        return i + 2;
      case 'D': // IND — index (move down, scroll at bottom)
        this.index();
        return i + 2;
      case 'E': // NEL — next line
        this.cursorCol = 0;
        this.index();
        return i + 2;
      case 'M': // RI — reverse index (move up, scroll down at top)
        this.reverseIndex();
        return i + 2;
      case 'c': // RIS — full reset
        this.reset();
        return i + 2;
      case '(':
      case ')':
      case '*':
      case '+':
      case '#':
        // Charset / line-attribute escapes consume ONE more byte.
        if (i + 2 >= n) {
          this.pendingEscape = s.slice(i);
          return n;
        }
        return i + 3;
      case '=':
      case '>':
      case '<':
        // Keypad modes — no grid effect.
        return i + 2;
      default:
        // Unknown two-byte escape — skip both bytes.
        return i + 2;
    }
  }

  /** Move down one row, scrolling (with scrollback preservation) at the bottom. */
  private index() {
    this.cursorRow++;
    this.cursorCol = this.cursorCol; // IND keeps column; LF caller resets separately
    if (this.cursorRow >= this.rows) {
      this.cursorRow = this.rows - 1;
      this.scrollUp();
    }
  }

  /** Move up one row, scrolling down (blank line at top) when at the top. */
  private reverseIndex() {
    if (this.cursorRow <= 0) {
      this.scrollDown();
    } else {
      this.cursorRow--;
    }
  }

  private scrollUp() {
    // Preserve the evicted row so history that scrolls back into the viewport
    // later can be recognized as pre-existing (baseline multiset suppresses it).
    this.scrollback.push(this.grid[0]);
    if (this.scrollback.length > HeadlessTerminalInterpreter.SCROLLBACK_CAP) {
      this.scrollback.splice(0, this.scrollback.length - HeadlessTerminalInterpreter.SCROLLBACK_CAP);
    }
    this.grid.shift();
    this.grid.push(Array.from({ length: this.cols }, () => ' '));
  }

  private scrollDown(count = 1) {
    for (let k = 0; k < count; k++) {
      const bottom = this.grid.pop();
      if (bottom && bottom.join('').trim()) {
        this.scrollback.push(bottom);
        if (this.scrollback.length > HeadlessTerminalInterpreter.SCROLLBACK_CAP) {
          this.scrollback.splice(0, this.scrollback.length - HeadlessTerminalInterpreter.SCROLLBACK_CAP);
        }
      }
      this.grid.unshift(Array.from({ length: this.cols }, () => ' '));
    }
  }

  private handleCsi(command: string, params: string) {
    const rawParts = params.split(';');
    const parts = rawParts.map((p) => (p === '' ? NaN : parseInt(p, 10)));
    const num = (idx: number, def: number) => {
      const v = parts[idx];
      return Number.isFinite(v) ? v : def;
    };

    switch (command) {
      case 'H':
      case 'f': {
        // Cursor Position: row;col
        const r = Math.max(1, num(0, 1)) - 1;
        const c = Math.max(1, num(1, 1)) - 1;
        this.cursorRow = Math.min(this.rows - 1, Math.max(0, r));
        this.cursorCol = Math.min(this.cols - 1, Math.max(0, c));
        break;
      }
      case 'A': // Up
        this.cursorRow = Math.max(0, this.cursorRow - Math.max(1, num(0, 1)));
        break;
      case 'B': // Down
        this.cursorRow = Math.min(this.rows - 1, this.cursorRow + Math.max(1, num(0, 1)));
        break;
      case 'C': // Forward
        this.cursorCol = Math.min(this.cols - 1, this.cursorCol + Math.max(1, num(0, 1)));
        break;
      case 'D': // Back
        this.cursorCol = Math.max(0, this.cursorCol - Math.max(1, num(0, 1)));
        break;
      case 'G': // Cursor Horizontal Absolute
      case '`':
        this.cursorCol = Math.max(0, Math.min(this.cols - 1, num(0, 1) - 1));
        break;
      case 'd': // VPA — line position absolute
        this.cursorRow = Math.max(0, Math.min(this.rows - 1, num(0, 1) - 1));
        break;
      case 'E': // CNL — cursor next line
        this.cursorRow = Math.min(this.rows - 1, this.cursorRow + Math.max(1, num(0, 1)));
        this.cursorCol = 0;
        break;
      case 'F': // CPL — cursor previous line
        this.cursorRow = Math.max(0, this.cursorRow - Math.max(1, num(0, 1)));
        this.cursorCol = 0;
        break;
      case 'K': {
        // Erase in Line
        const mode = Number.isFinite(parts[0]) ? parts[0] : 0;
        if (mode === 0) {
          for (let c = this.cursorCol; c < this.cols; c++) this.grid[this.cursorRow][c] = ' ';
        } else if (mode === 1) {
          for (let c = 0; c <= this.cursorCol; c++) this.grid[this.cursorRow][c] = ' ';
        } else if (mode === 2) {
          for (let c = 0; c < this.cols; c++) this.grid[this.cursorRow][c] = ' ';
        }
        break;
      }
      case 'J': {
        // Erase in Display
        const mode = Number.isFinite(parts[0]) ? parts[0] : 0;
        if (mode === 2 || mode === 3) {
          this.grid = this.createEmptyGrid(this.rows, this.cols);
          this.cursorRow = 0;
          this.cursorCol = 0;
          this.generation++;
        } else if (mode === 0) {
          // From cursor to end of screen
          for (let c = this.cursorCol; c < this.cols; c++) this.grid[this.cursorRow][c] = ' ';
          for (let r = this.cursorRow + 1; r < this.rows; r++) {
            this.grid[r] = Array.from({ length: this.cols }, () => ' ');
          }
        } else if (mode === 1) {
          // From start of screen to cursor
          for (let r = 0; r < this.cursorRow; r++) {
            this.grid[r] = Array.from({ length: this.cols }, () => ' ');
          }
          for (let c = 0; c <= this.cursorCol; c++) this.grid[this.cursorRow][c] = ' ';
        }
        break;
      }
      case 'X': { // ECH — erase # characters from cursor
        const k = Math.max(1, num(0, 1));
        for (let c = this.cursorCol; c < Math.min(this.cols, this.cursorCol + k); c++) {
          this.grid[this.cursorRow][c] = ' ';
        }
        break;
      }
      case 'P': { // DCH — delete # characters at cursor (shift left)
        const k = Math.max(1, num(0, 1));
        const row = this.grid[this.cursorRow];
        for (let c = this.cursorCol; c < this.cols; c++) {
          row[c] = c + k < this.cols ? row[c + k] : ' ';
        }
        break;
      }
      case '@': { // ICH — insert # blanks at cursor (shift right)
        const k = Math.max(1, num(0, 1));
        const row = this.grid[this.cursorRow];
        for (let c = this.cols - 1; c >= this.cursorCol + k; c--) {
          row[c] = row[c - k];
        }
        for (let c = this.cursorCol; c < Math.min(this.cols, this.cursorCol + k); c++) {
          row[c] = ' ';
        }
        break;
      }
      case 'L': { // IL — insert # blank lines at cursor row
        const k = Math.min(this.rows - this.cursorRow, Math.max(1, num(0, 1)));
        for (let x = 0; x < k; x++) {
          this.grid.splice(this.cursorRow, 0, Array.from({ length: this.cols }, () => ' '));
          this.grid.pop();
        }
        break;
      }
      case 'M': { // DL — delete # lines at cursor row (evicted rows → scrollback)
        const k = Math.min(this.rows - this.cursorRow, Math.max(1, num(0, 1)));
        for (let x = 0; x < k; x++) {
          const removed = this.grid.splice(this.cursorRow, 1)[0];
          if (removed && removed.join('').trim()) {
            this.scrollback.push(removed);
            if (this.scrollback.length > HeadlessTerminalInterpreter.SCROLLBACK_CAP) {
              this.scrollback.splice(0, this.scrollback.length - HeadlessTerminalInterpreter.SCROLLBACK_CAP);
            }
          }
          this.grid.push(Array.from({ length: this.cols }, () => ' '));
        }
        break;
      }
      case 'S': // SU — scroll up
        this.scrollUp();
        break;
      case 'T': // SD — scroll down
        this.scrollDown(Math.max(1, num(0, 1)));
        break;
      case 's': // Save cursor position
        this.savedCursor = { row: this.cursorRow, col: this.cursorCol };
        break;
      case 'u': // Restore cursor position
        if (this.savedCursor) {
          this.cursorRow = Math.min(this.rows - 1, this.savedCursor.row);
          this.cursorCol = Math.min(this.cols - 1, this.savedCursor.col);
        }
        break;
      case 'h':
      case 'l': {
        // DEC private modes. NOTE (capture semantics): alternate-screen switches
        // (1049/47/1047) are deliberately treated as NO-OPS. Orbit's capture is
        // a conversation extractor, not a real terminal: modern agent TUIs run
        // their ENTIRE conversation on the alternate screen and never leave it,
        // so alt content must keep painting into the continuous grid to be
        // turn-capturable. History mixing is prevented by turn baselines
        // (frozen at startTurn) + scrollback, not by buffer separation. Cursor
        // visibility / mouse / bracketed-paste modes have no grid effect.
        break;
      }
      default:
        // Unsupported CSI (SGR colors/modes, DECSTBM regions, …) — no cell effect.
        break;
    }
  }

  captureSnapshot(): ScreenSnapshot {
    return new ScreenSnapshot(this.grid, this.rows, this.cols, this.generation);
  }

  /**
   * Scrollback rows (oldest first) as text lines — used to extend turn baselines
   * so re-scrolled history is suppressed instead of captured as new prose.
   */
  getScrollbackLines(): string[] {
    return this.scrollback.map((row) => row.join('').trimEnd());
  }

  getGeneration(): number {
    return this.generation;
  }

  reset() {
    this.grid = this.createEmptyGrid(this.rows, this.cols);
    this.scrollback = [];
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.pendingEscape = '';
    this.generation++;
  }
}
