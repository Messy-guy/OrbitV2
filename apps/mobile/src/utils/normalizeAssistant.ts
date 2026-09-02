/**
 * INV-19/20 (mobile render boundary) — defensive normalization for canonical
 * assistant content before it is rendered. The DATA boundary (Orbit Desktop's
 * capture pipeline) already strips proven terminal artifacts before committing
 * a message; this is the second, rendering-side defense so that any legacy or
 * upstream TUI garbage can never surface as visible glyphs.
 *
 * Mirrors the desktop `normalizeAssistantContent` (kept standalone — the mobile
 * app is a separate React Native bundle and must not import desktop sources):
 *
 *   - ANSI CSI/OSC/charset escape sequences
 *   - control characters, bells, NULs, zero-width and bidi controls
 *   - lines composed ONLY of TUI framing glyphs (borders, rules, cursor bars)
 *   - isolated redraw-symbol fragments
 *
 * Markdown semantics (headings, lists, blockquotes, tables, code fences) and
 * code indentation are strictly preserved — characters like | - > * are never
 * removed from prose.
 */

const FRAMING_ONLY_LINE =
  /^[│║┃┏┓┗┛┣┫┳┻╋╔╗╚╝╠╣╦╩╬─═━┄┅┈┉|\-—–_*~+=▔▕^\s]{3,}$/;

const REDRAW_ONLY_LINE =
  /^[▘▝▖▗▚▞█▓▒░▏▎▍▌▋▊▉⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⣀⣄⣆⣇⣧⣷⣿|│─═━\s]{1,6}$/;

export function normalizeMobileAssistantContent(text: string): string {
  if (!text) return '';

  const cleaned = text
    .replace(/\x1b\[[0-9;?<>=]*[a-zA-Z@~]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
    .replace(/\x1b[()][0-9A-B0-1]/g, '')
    .replace(/\x1b[=>7809cMDENHF]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, '')
    .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⣀⣄⣆⣇⣧⣷⣿]/g, '');

  const kept: string[] = [];
  for (const raw of cleaned.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const bare = line.replace(/[\s│║┃┏┓┗┛┣┫┳┻╋╔╗╚╝╠╣╦╩╬─═━|_▔▕]/g, '');
    if (!bare) continue;
    if (FRAMING_ONLY_LINE.test(line.trim()) || REDRAW_ONLY_LINE.test(line.trim())) continue;
    kept.push(line);
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
