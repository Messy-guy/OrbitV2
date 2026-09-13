export type MouseAction = 'press' | 'release' | 'motion';
export function encodeKey(key: string, options: { appCursor?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean } = {}): Uint8Array | null {
  if (options.ctrl && key.length === 1) return new Uint8Array([key.toUpperCase().charCodeAt(0) - 64]);
  if (options.alt && key.length === 1) return bytes(`\x1b${key}`);
  if (key === 'Enter') return bytes('\r');
  if (key === 'Backspace') return new Uint8Array([127]);
  if (key === 'Tab' && options.shift) return bytes('\x1b[Z');
  if (key === 'Tab') return new Uint8Array([9]);
  if (key === 'Escape') return new Uint8Array([27]);
  const arrows: Record<string, string> = {
    ArrowUp: options.appCursor ? '\x1bOA' : '\x1b[A',
    ArrowDown: options.appCursor ? '\x1bOB' : '\x1b[B',
    ArrowRight: options.appCursor ? '\x1bOC' : '\x1b[C',
    ArrowLeft: options.appCursor ? '\x1bOD' : '\x1b[D',
  };
  const navigation: Record<string, string> = {
    Home: '\x1b[H', End: '\x1b[F', Insert: '\x1b[2~', Delete: '\x1b[3~',
    PageUp: '\x1b[5~', PageDown: '\x1b[6~',
    F1: '\x1bOP', F2: '\x1bOQ', F3: '\x1bOR', F4: '\x1bOS',
    F5: '\x1b[15~', F6: '\x1b[17~', F7: '\x1b[18~', F8: '\x1b[19~',
    F9: '\x1b[20~', F10: '\x1b[21~', F11: '\x1b[23~', F12: '\x1b[24~',
  };
  if (options.shift && arrows[key]) return bytes(arrows[key].replace('[', '[1;2'));
  if (arrows[key]) return bytes(arrows[key]);
  if (navigation[key]) return bytes(navigation[key]);
  return key.length === 1 ? new TextEncoder().encode(key) : null;
}
export function encodePaste(text: string, bracketed: boolean): Uint8Array { return new TextEncoder().encode(bracketed ? `\x1b[200~${text}\x1b[201~` : text); }
export function encodeMouse(action: MouseAction, column: number, row: number, options: { sgr?: boolean; drag?: boolean; wheel?: 'up' | 'down' } = {}): Uint8Array {
  const button = options.wheel ? (options.wheel === 'up' ? 64 : 65) : action === 'motion' ? 32 : action === 'release' ? 3 : options.drag ? 32 : 0;
  const x = Math.max(1, column + 1); const y = Math.max(1, row + 1);
  return options.sgr ? bytes(`\x1b[<${button};${x};${y}${action === 'release' ? 'm' : 'M'}`) : new Uint8Array([27, 91, 77, 32 + button, 32 + x, 32 + y]);
}
function bytes(value: string): Uint8Array { return new TextEncoder().encode(value); }
