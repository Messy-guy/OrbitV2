import { ScreenSnapshot } from './ScreenSnapshot';

export class HeadlessTerminalInterpreter {
  private rows: number;
  private cols: number;
  private grid: string[][];
  private cursorRow: number = 0;
  private cursorCol: number = 0;
  private generation: number = 0;

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
    let i = 0;
    while (i < bytes.length) {
      const char = bytes[i];

      // Handle ESC sequences
      if (char === '\x1b') {
        const next = bytes[i + 1];

        // OSC sequence: \x1b]0;Title\x07 or \x1b]0;Title\x1b\
        if (next === ']') {
          const endIdx = bytes.indexOf('\x07', i);
          const endEsc = bytes.indexOf('\x1b\\', i);
          const term = endIdx !== -1 ? (endEsc !== -1 ? Math.min(endIdx, endEsc) : endIdx) : endEsc;
          if (term !== -1) {
            i = term + (bytes[term] === '\x07' ? 1 : 2);
            continue;
          } else {
            break;
          }
        }

        // CSI sequence: \x1b[ ...
        if (next === '[') {
          let j = i + 2;
          while (j < bytes.length && !/[a-zA-Z~]/.test(bytes[j])) {
            j++;
          }
          if (j < bytes.length) {
            const command = bytes[j];
            const params = bytes.substring(i + 2, j);
            this.handleCsi(command, params);
            i = j + 1;
            continue;
          }
        }

        i++;
        continue;
      }

      // Handle control characters
      if (char === '\r') {
        this.cursorCol = 0;
      } else if (char === '\n') {
        this.cursorRow++;
        this.cursorCol = 0; // Standard TUI auto-CR on LF to prevent staggered diagonal stair-stepping
        if (this.cursorRow >= this.rows) {
          this.scrollUp();
          this.cursorRow = this.rows - 1;
        }
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
            this.cursorRow++;
            if (this.cursorRow >= this.rows) {
              this.scrollUp();
              this.cursorRow = this.rows - 1;
            }
          }
        }
      }

      i++;
    }

    return this.captureSnapshot();
  }

  private handleCsi(command: string, params: string) {
    const parts = params.split(';').map((p) => parseInt(p, 10) || 0);

    switch (command) {
      case 'H':
      case 'f': {
        // Cursor Position: row;col
        const r = Math.max(1, parts[0] || 1) - 1;
        const c = Math.max(1, parts[1] || 1) - 1;
        this.cursorRow = Math.min(this.rows - 1, Math.max(0, r));
        this.cursorCol = Math.min(this.cols - 1, Math.max(0, c));
        break;
      }
      case 'A': // Up
        this.cursorRow = Math.max(0, this.cursorRow - (parts[0] || 1));
        break;
      case 'B': // Down
        this.cursorRow = Math.min(this.rows - 1, this.cursorRow + (parts[0] || 1));
        break;
      case 'C': // Forward
        this.cursorCol = Math.min(this.cols - 1, this.cursorCol + (parts[0] || 1));
        break;
      case 'D': // Back
        this.cursorCol = Math.max(0, this.cursorCol - (parts[0] || 1));
        break;
      case 'G': // Cursor Horizontal Absolute
        this.cursorCol = Math.max(0, Math.min(this.cols - 1, (parts[0] || 1) - 1));
        break;
      case 'K': {
        // Erase in Line
        const mode = parts[0] || 0;
        if (mode === 0) {
          // Erase from cursor to end
          for (let c = this.cursorCol; c < this.cols; c++) this.grid[this.cursorRow][c] = ' ';
        } else if (mode === 1) {
          // Erase from start to cursor
          for (let c = 0; c <= this.cursorCol; c++) this.grid[this.cursorRow][c] = ' ';
        } else if (mode === 2) {
          // Erase whole line
          for (let c = 0; c < this.cols; c++) this.grid[this.cursorRow][c] = ' ';
        }
        break;
      }
      case 'J': {
        // Erase in Display
        const mode = parts[0] || 0;
        if (mode === 2 || mode === 3) {
          this.grid = this.createEmptyGrid(this.rows, this.cols);
          this.cursorRow = 0;
          this.cursorCol = 0;
          this.generation++;
        }
        break;
      }
    }
  }

  private scrollUp() {
    this.grid.shift();
    this.grid.push(Array.from({ length: this.cols }, () => ' '));
  }

  captureSnapshot(): ScreenSnapshot {
    return new ScreenSnapshot(this.grid, this.rows, this.cols, this.generation);
  }

  getGeneration(): number {
    return this.generation;
  }

  reset() {
    this.grid = this.createEmptyGrid(this.rows, this.cols);
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.generation++;
  }
}
