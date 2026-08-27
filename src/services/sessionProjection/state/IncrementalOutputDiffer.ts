import { ScreenFingerprint } from './ScreenFingerprint';
import { TurnBaseline } from './TurnBaseline';

export interface IncrementalDiffResult {
  candidateLines: string[];
}

export class IncrementalOutputDiffer {
  /**
   * Computes candidate new output lines by performing multiset occurrence diffing
   * against the turn baseline. This guarantees that:
   * 1. Screen redraws of earlier turns (even with \x1b[2J clear-and-repaints) are suppressed
   *    because their counts match the baseline.
   * 2. Legitimate repeated outputs (e.g. "All tests passed." or repeated code/status) are
   *    captured whenever their current occurrence count exceeds the baseline count.
   * 3. Original line indentation and markdown syntax are strictly preserved.
   */
  static computeNewCandidates(
    currentScreenLines: string[],
    baseline: TurnBaseline | null
  ): IncrementalDiffResult {
    const candidateLines: string[] = [];
    const baselineOccurrences = baseline ? baseline.baselineOccurrences : new Map<string, number>();
    const consumedBaseline = new Map<string, number>();
    const userPromptFp = baseline?.userPrompt
      ? ScreenFingerprint.fingerprintLine(baseline.userPrompt)
      : null;

    for (const rawLine of currentScreenLines) {
      if (!rawLine.trim()) continue;

      const fp = ScreenFingerprint.fingerprintLine(rawLine);
      if (!fp || fp.length < 1) continue;

      // 1. Exclude exact user prompt echo line
      if (userPromptFp && fp === userPromptFp) {
        continue;
      }

      // 2. Multiset occurrence check against turn baseline
      const baseCount = baselineOccurrences.get(fp) || 0;
      const consumedCount = consumedBaseline.get(fp) || 0;

      if (consumedCount < baseCount) {
        // This occurrence was already present on screen when turn started
        consumedBaseline.set(fp, consumedCount + 1);
        continue;
      }

      // 3. New occurrence produced in the current turn!
      candidateLines.push(rawLine);
    }

    return {
      candidateLines,
    };
  }
}
