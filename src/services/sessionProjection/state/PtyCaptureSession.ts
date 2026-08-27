import { HeadlessTerminalInterpreter } from '../terminal/HeadlessTerminalInterpreter';
import { ScreenFingerprint } from './ScreenFingerprint';
import { TurnBaseline } from './TurnBaseline';
import { IncrementalOutputDiffer } from './IncrementalOutputDiffer';
import { PtyConversationClassifier, ClassifiedScreenOutput } from '../classification/PtyConversationClassifier';
import { ActivitySummary } from '../../../types/conversation';

export interface ProcessedPtyTurnOutput {
  userFacingText: string;
  activities: ActivitySummary[];
  thought?: string;
  isThinking: boolean;
  hasNewContent: boolean;
}

export class PtyCaptureSession {
  readonly sessionId: string;
  private interpreter: HeadlessTerminalInterpreter;
  private currentBaseline: TurnBaseline | null = null;
  private currentTurnId: string | null = null;
  private lastStreamedText = '';

  constructor(sessionId: string, rows = 30, cols = 100) {
    this.sessionId = sessionId;
    this.interpreter = new HeadlessTerminalInterpreter(rows, cols);
  }

  /**
   * Records a turn baseline immediately when a user message is submitted.
   * All screen state present prior to this moment is frozen into the baseline.
   */
  startTurn(turnId: string, userPrompt: string) {
    const snapshot = this.interpreter.captureSnapshot();
    const baselineOccurrences = ScreenFingerprint.computeOccurrenceMap(snapshot.lines);

    this.currentBaseline = {
      turnId,
      userPrompt,
      createdAt: Date.now(),
      screenGeneration: snapshot.generation,
      baselineOccurrences,
      baselineLines: [...snapshot.lines],
    };
    this.currentTurnId = turnId;
    this.lastStreamedText = '';
  }

  /**
   * Processes incoming raw PTY bytes and computes incremental new candidate output.
   */
  processPtyBytes(bytes: string): ProcessedPtyTurnOutput {
    const snapshot = this.interpreter.processBytes(bytes);

    // Compute candidate new lines using multiset occurrence diffing against turn baseline
    const diff = IncrementalOutputDiffer.computeNewCandidates(
      snapshot.lines,
      this.currentBaseline
    );

    // Classify candidate new lines
    const prompt = this.currentBaseline?.userPrompt;
    const classified: ClassifiedScreenOutput = PtyConversationClassifier.classifyLines(
      diff.candidateLines,
      prompt
    );

    const userFacingText = classified.userFacingText;
    const hasNewContent = userFacingText.trim().length > 0 && userFacingText !== this.lastStreamedText;

    if (hasNewContent) {
      this.lastStreamedText = userFacingText;
    }

    return {
      userFacingText,
      activities: classified.activities,
      thought: classified.thought,
      isThinking: classified.isThinking,
      hasNewContent,
    };
  }

  /**
   * Finalizes turn commit.
   */
  commitTurn() {
    this.lastStreamedText = '';
  }

  /**
   * Disposes session state and clears virtual terminal interpreter.
   */
  dispose() {
    this.currentBaseline = null;
    this.currentTurnId = null;
    this.lastStreamedText = '';
  }
}
