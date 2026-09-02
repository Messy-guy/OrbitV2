/**
 * INV-20 — canonical assistant content normalization (commit boundary).
 *
 * Removes PROVEN terminal artifacts while strictly preserving conversational
 * semantics (markdown, code indentation, lists, blockquotes, tables, code
 * fences, legitimate repeated text):
 *
 *   - ANSI escape sequences (CSI / OSC / charset)
 *   - carriage returns, bells, NULs, zero-width / bidi control characters
 *   - lines that consist ONLY of TUI framing artifacts (box borders, cursor
 *     bars, horizontal rules drawn by the TUI)
 *   - isolated redraw-symbol lines (progressive bar/braille fragments with no
 *     prose attached)
 *
 * It NEVER globally removes characters like | - > * because they are valid
 * Markdown — only whole lines made exclusively of framing glyphs are dropped.
 */

// Box-drawing / framing glyphs a TUI paints as line furniture.
const FRAMING_ONLY_LINE =
  /^[│║┃┏┓┗┛┣┫┳┻╋╔╗╚╝╠╣╦╩╬─═━┄┅┈┉|\-—–_*~+=▔▕^\s]{3,}$/;

// Isolated cursor/redraw symbol lines (no prose attached).
const REDRAW_ONLY_LINE =
  /^[▘▝▖▗▚▞█▓▒░▏▎▍▌▋▊▉⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⣀⣄⣆⣇⣧⣷⣿|│─═━\s]{1,6}$/;

export function normalizeAssistantContent(text: string): string {
  if (!text) return '';

  const cleaned = text
    // ANSI CSI sequences (cursor movement, colors, erase, modes)
    .replace(/\x1b\[[0-9;?<>=]*[a-zA-Z@~]/g, '')
    // OSC sequences (titles, hyperlinks) terminated by BEL or ST
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
    // Other escape sequences (charset selection, keypad, DCS fragments)
    .replace(/\x1b[()][0-9A-B0-1]/g, '')
    .replace(/\x1b[=>7809cMDENHF]/g, '')
    // Control characters
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    // Zero-width and bidi controls
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, '')
    // Braille spinner frames attached mid-line by redraws
    .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⣀⣄⣆⣇⣧⣷⣿]/g, '');

  const lines = cleaned.split('\n');
  const kept: string[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const bare = line.replace(/[\s│║┃┏┓┗┛┣┫┳┻╋╔╗╚╝╠╣╦╩╬─═━|_▔▕]/g, '');

    // Pure framing line (borders, rules, box edges) — never prose.
    if (!bare) {
      continue;
    }

    // Composite framing-only line (e.g. "│ ─────────── │") — still proven artifact.
    if (FRAMING_ONLY_LINE.test(line.trim()) || REDRAW_ONLY_LINE.test(line.trim())) {
      continue;
    }

    kept.push(line);
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
