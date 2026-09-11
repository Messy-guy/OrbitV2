import { Terminal } from '@xterm/xterm';
import { tauriService } from '../tauri.service';

type TerminalDisposable = { dispose: () => void };

const firstNumber = (params: (number | number[])[]): number => {
  const value = params[0];
  return Array.isArray(value) ? (value[0] ?? 0) : (value ?? 0);
};

const colorToRgbQuery = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1].toLowerCase();
  return `rgb:${hex.slice(0, 2)}/${hex.slice(2, 4)}/${hex.slice(4, 6)}`;
};

/**
 * Installs the small terminal capability bridge owned by the local xterm
 * emulator. It only answers queries whose state is available from xterm;
 * unknown requests are deliberately left to the CLI's normal fallback path.
 */
export function installTerminalCapabilityBridge(
  term: Terminal,
  agentId: string,
  sessionId: string,
): () => void {
  const disposables: TerminalDisposable[] = [];
  const send = (response: string) => {
    void tauriService.sendAgentInput(agentId, sessionId, response).catch(() => {});
  };

  disposables.push(term.parser.registerCsiHandler(
    { final: 'n', intermediates: '' },
    (params) => {
      const query = firstNumber(params);
      if (query === 5) {
        send('\x1b[0n');
        return true;
      }
      if (query === 6) {
        const buffer = term.buffer.active;
        send(`\x1b[${buffer.cursorY + 1};${buffer.cursorX + 1}R`);
        return true;
      }
      return false;
    },
  ));

  // Report a conservative xterm-compatible VT identity. This is a response
  // to the standard DA query, not a provider-specific terminal hack.
  disposables.push(term.parser.registerCsiHandler(
    { final: 'c', intermediates: '' },
    () => {
      send('\x1b[?62;1;2;6;7;8;9;15;18;22;29c');
      return true;
    },
  ));

  disposables.push(term.parser.registerOscHandler(10, (data) => {
    if (data !== '?') return false;
    const rgb = colorToRgbQuery(term.options.theme?.foreground);
    if (!rgb) return false;
    send(`\x1b]10;${rgb}\x07`);
    return true;
  }));

  disposables.push(term.parser.registerOscHandler(11, (data) => {
    if (data !== '?') return false;
    const rgb = colorToRgbQuery(term.options.theme?.background);
    if (!rgb) return false;
    send(`\x1b]11;${rgb}\x07`);
    return true;
  }));

  return () => {
    for (const disposable of disposables) disposable.dispose();
  };
}
