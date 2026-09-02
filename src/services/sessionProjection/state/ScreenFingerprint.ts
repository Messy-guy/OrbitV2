/**
 * ScreenFingerprint provides normalized hashing, comparison,
 * and content cleaning for terminal screen lines.
 */
export class ScreenFingerprint {
  /**
   * Cleans a raw terminal line for canonical assistant message rendering.
   * Strips ANSI escape sequences and decorative TUI box borders, while
   * strictly preserving code indentation, markdown lists, quotes, and syntax.
   */
  static cleanLineContent(rawLine: string): string {
    if (!rawLine) return '';

    let clean = rawLine
      // Strip ANSI escape sequences
      .replace(/\x1b\[[0-9;]*[a-zA-Z~]/g, '')
      .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
      .trimEnd();

    // If line is enclosed in symmetric TUI box borders (e.g. "│  content  │") but is NOT a markdown table
    if (
      /^[│║┃]\s*(.*)\s*[│║┃]$/.test(clean) &&
      (clean.match(/[│║┃|]/g) || []).length <= 2
    ) {
      const match = clean.match(/^[│║┃]\s*(.*?)\s*[│║┃]$/);
      if (match && match[1]) {
        clean = match[1];
      }
    }

    // Trailing TUI artifacts: cursor bars / box remnants painted at the line end
    // by full-screen redraws ("…need. |"), and right-aligned frame timestamps
    // ("hello    19:05 d"). Leading whitespace/indentation is strictly preserved.
    clean = clean.replace(/\s*[|│┃║┐┘┤╗╝╣─]+\s*$/, '');
    const tsStrip = clean.match(/^(.+?)\s{2,}\d{1,2}:\d{2}(?::\d{2})?\s*[a-z]?$/);
    if (tsStrip && tsStrip[1] && tsStrip[1].trim().length > 0) {
      clean = tsStrip[1].trimEnd();
    }

    return clean;
  }

  /**
   * Computes a canonical comparison key for terminal state diffing.
   */
  static fingerprintLine(rawLine: string): string {
    const cleaned = this.cleanLineContent(rawLine);
    if (!cleaned.trim()) return '';
    // Canonical comparison key (case-insensitive, whitespace-collapsed)
    return cleaned
      .toLowerCase()
      .replace(/^[›>❯$#%|│┃║_┌└├╔╚╠─═—\-_•*~\s]+/g, '')
      .replace(/[|│┃║_┐┘┤╗╝╣─═—\-_•*~\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * INV — single comparison path for TERMINAL ECHO identity.
   *
   * Agents re-render prompts with TUI decoration: `❯ hello`, `│ hello │`,
   * `hello    19:05 d` (right-aligned frame timestamp + cursor artifact),
   * `> hello`. All of these must fingerprint IDENTICALLY to the canonical
   * prompt so the session prompt ledger and echo suppressor recognize them.
   * This is identity normalization for comparison only — it does not remove
   * anything from the canonical conversation.
   */
  static terminalEchoFingerprint(line: string): string {
    return this.fingerprintLine(this.cleanLineContent(line || ''));
  }

  /**
   * Computes an occurrence map (multiset) of fingerprint counts from an array of lines.
   */
  static computeOccurrenceMap(lines: string[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const line of lines) {
      const fp = this.fingerprintLine(line);
      if (fp && fp.length > 0) {
        map.set(fp, (map.get(fp) || 0) + 1);
      }
    }
    return map;
  }
}
