import { pendingInputEchoQueue, PendingInputEcho } from '../input/PendingInputEchoQueue';

export interface SuppressionResult {
  isEcho: boolean;
  matchedEcho: PendingInputEcho | null;
  cleanedText: string;
}

export class InputEchoSuppressor {
  /**
   * Tests whether a raw or formatted line from the terminal output is an echo of an authoritative user prompt.
   */
  static checkLine(sessionId: string, line: string, latestUserPrompt?: string, turnId?: string): SuppressionResult {
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
