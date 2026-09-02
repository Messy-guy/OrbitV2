import { pendingInputEchoQueue, PendingInputEcho } from '../input/PendingInputEchoQueue';
import { ScreenFingerprint } from '../state/ScreenFingerprint';

export interface SuppressionResult {
  isEcho: boolean;
  matchedEcho: PendingInputEcho | null;
  cleanedText: string;
}

export class InputEchoSuppressor {
  /**
   * Tests whether a raw or formatted line from the terminal output is an echo of an authoritative user prompt.
   */
  static checkLine(sessionId: string, rawLine: string, latestUserPrompt?: string, turnId?: string): SuppressionResult {
    // INV — strip terminal decoration BEFORE comparison so a rendered echo
    // ("❯ hello", "hello    19:05 d", "│ hello │") resolves to the canonical
    // prompt ("hello") across every matching path below.
    const line = ScreenFingerprint.cleanLineContent(rawLine || '');
    const trimmed = line.trim();
    if (!trimmed) {
      return { isEcho: false, matchedEcho: null, cleanedText: '' };
    }

    // 1. Authoritative check against the PendingInputEchoQueue for this session and active turn
    if (sessionId) {
      const matchedEcho = pendingInputEchoQueue.findMatchingEcho(sessionId, trimmed, turnId);
      if (matchedEcho) {
        return {
          isEcho: true,
          matchedEcho,
          cleanedText: trimmed,
        };
      }
    }

    // 2. Correlation check against latestUserPrompt fallback if provided
    if (latestUserPrompt && latestUserPrompt.trim().length > 0) {
      const promptNorm = pendingInputEchoQueue.normalizeText(latestUserPrompt);
      const lineNorm = pendingInputEchoQueue.normalizeText(trimmed);

    if (
      lineNorm === promptNorm ||
      lineNorm.startsWith(`${promptNorm}─`) ||
      lineNorm.startsWith(`${promptNorm}-`) ||
      lineNorm.startsWith(`${promptNorm} │`) ||
      lineNorm.startsWith(`${promptNorm} |`) ||
      (promptNorm.length > 8 && lineNorm === promptNorm) ||
      (promptNorm.length > 15 && lineNorm.length > 6 && promptNorm.includes(lineNorm)) ||
      (lineNorm.length > 15 && promptNorm.length > 6 && lineNorm.includes(promptNorm))
    ) {
      return {
        isEcho: true,
        matchedEcho: null,
        cleanedText: trimmed,
      };
    }

    // 3. Prompt echo re-rendered with right-aligned TUI metadata on the same row
    //    (e.g. prompt "hello" rendered as "hello    19:05 d" in Copilot/Mimo).
    //    The suffix must be SHORT and digit-dominated (timestamps, counters,
    //    durations) — never ordinary words, so a legitimate reply line that
    //    merely starts with the prompt text ("Hello! How can I help…") is safe.
    if (lineNorm.startsWith(promptNorm) && promptNorm.length >= 2) {
      const suffix = lineNorm.slice(promptNorm.length);
      if (
        suffix.length > 0 &&
        suffix.length <= 12 &&
        /\d/.test(suffix) &&
        /^[\s\d:.,%\-]*[a-z]?[\s\d:.,%\-]*$/.test(suffix)
      ) {
        return {
          isEcho: true,
          matchedEcho: null,
          cleanedText: trimmed,
        };
      }
    }
    }

    return {
      isEcho: false,
      matchedEcho: null,
      cleanedText: trimmed,
    };
  }

  /**
   * Filters an array of candidate lines, suppressing lines that correspond to echoed user input.
   */
  static filterLines(sessionId: string, lines: string[], latestUserPrompt?: string): {
    filteredLines: string[];
    suppressedEchoes: string[];
  } {
    const filteredLines: string[] = [];
    const suppressedEchoes: string[] = [];

    for (const line of lines) {
      const result = this.checkLine(sessionId, line, latestUserPrompt);
      if (result.isEcho) {
        suppressedEchoes.push(line);
        if (result.matchedEcho && sessionId) {
          pendingInputEchoQueue.consumeEcho(sessionId, result.matchedEcho.id);
        }
      } else {
        filteredLines.push(line);
      }
    }

    return { filteredLines, suppressedEchoes };
  }
}
