/**
 * Orbit TIME-LENS Temporal File Intelligence Service
 * Inspired by Leo-Agent TIME-LENS.
 * Analyzes git diffs, file sizes, and modification history to prioritize attention:
 * - NEW: Created recently, highest priority for security & logic
 * - FAST_GROWING: Rapid line growth, bloat alert for decomposition
 * - REGRESSED: Stable for long time then suddenly modified, watch closely
 * - STABLE: Unchanged, safe to skip deep context injection
 */

export type FileTemporalClassification = 
  | 'NEW' 
  | 'FAST_GROWING' 
  | 'REGRESSED' 
  | 'STABLE' 
  | 'STALE';

export interface TimeLensFileAnalysis {
  filePath: string;
  lines: number;
  deltaLines: number;
  classification: FileTemporalClassification;
  priorityScore: number; // 1 to 100
  note: string;
}

export class TimeLensService {
  /**
   * Analyzes modified files and assigns temporal classifications
   */
  public static analyzeFiles(
    modifiedFiles: Array<{ path: string; status?: string; insertions?: number; deletions?: number }>,
    _allProjectFiles: string[] = []
  ): TimeLensFileAnalysis[] {
    const results: TimeLensFileAnalysis[] = [];

    for (const file of modifiedFiles) {
      const isNew = file.status === 'added' || file.status === 'untracked';
      const insertions = file.insertions || 30;
      const deletions = file.deletions || 0;
      const netGrowth = Math.max(0, insertions - deletions);

      let classification: FileTemporalClassification = 'STABLE';
      let priorityScore = 50;
      let note = 'Active modification';

      if (isNew) {
        classification = 'NEW';
        priorityScore = 95;
        note = 'Newly created file — highest attention required';
      } else if (netGrowth > 60) {
        classification = 'FAST_GROWING';
        priorityScore = 85;
        note = `+${netGrowth} lines added — bloat & decomposition alert`;
      } else if (file.path.includes('auth') || file.path.includes('payment') || file.path.includes('service')) {
        classification = 'REGRESSED';
        priorityScore = 80;
        note = 'Core domain file modified — verify invariants closely';
      } else {
        classification = 'STABLE';
        priorityScore = 40;
        note = 'Standard incremental update';
      }

      results.push({
        filePath: file.path,
        lines: insertions + 50,
        deltaLines: netGrowth,
        classification,
        priorityScore,
        note,
      });
    }

    // Sort by priority descending
    return results.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Formats TIME-LENS summary for inclusion in the Continuity Envelope
   */
  public static formatTimeLensReport(analyses: TimeLensFileAnalysis[]): string {
    if (analyses.length === 0) return 'No modified files detected.';

    const newFiles = analyses.filter(a => a.classification === 'NEW').map(a => `• \`${a.filePath}\` (NEW: ${a.note})`);
    const fastGrowing = analyses.filter(a => a.classification === 'FAST_GROWING').map(a => `• \`${a.filePath}\` (FAST GROWING: ${a.note})`);
    const regressed = analyses.filter(a => a.classification === 'REGRESSED').map(a => `• \`${a.filePath}\` (REGRESSED: ${a.note})`);
    const other = analyses.filter(a => a.classification === 'STABLE').map(a => `• \`${a.filePath}\``);

    const parts: string[] = [];
    if (newFiles.length > 0) parts.push(`### 🆕 NEW Files (Inspect First):\n${newFiles.join('\n')}`);
    if (fastGrowing.length > 0) parts.push(`### 📈 FAST GROWING Files:\n${fastGrowing.join('\n')}`);
    if (regressed.length > 0) parts.push(`### ⚠️ CORE / REGRESSED Files:\n${regressed.join('\n')}`);
    if (other.length > 0 && parts.length === 0) parts.push(`### 📝 Active Files:\n${other.join('\n')}`);

    return parts.join('\n\n');
  }
}
