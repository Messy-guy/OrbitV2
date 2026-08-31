import { HeadlessTerminalInterpreter } from '../terminal/HeadlessTerminalInterpreter';
import { ScreenFingerprint } from './ScreenFingerprint';
import { TurnBaseline } from './TurnBaseline';
import { IncrementalOutputDiffer } from './IncrementalOutputDiffer';
import { PtyConversationClassifier, ClassifiedScreenOutput } from '../classification/PtyConversationClassifier';
import { ActivitySummary } from '../../../types/conversation';
import { pendingInputEchoQueue } from '../input/PendingInputEchoQueue';

export interface ProcessedPtyTurnOutput {
  userFacingText: string;
  activities: ActivitySummary[];
  thought?: string;
  isThinking: boolean;
  hasNewContent: boolean;
  turnId: string | null;
  screenVersion: number;
}

export class PtyCaptureSession {
  readonly sessionId: string;
  private interpreter: HeadlessTerminalInterpreter;
  private currentBaseline: TurnBaseline | null = null;
  private lastCommittedBaseline: TurnBaseline | null = null;
  private currentTurnId: string | null = null;
  private currentMsgId: string | null = null;
  private currentPrompt: string | null = null;
  private lastStreamedText = '';
  private screenVersion = 0;

  constructor(sessionId: string, rows = 30, cols = 100) {
    this.sessionId = sessionId;
    this.interpreter = new HeadlessTerminalInterpreter(rows, cols);
  }

  /**
   * Records a turn baseline immediately when a user message is submitted.
   * All screen state present prior to this moment is frozen into the baseline.
   */
  startTurn(turnId: string, userPrompt: string, userMessageId?: string) {
    const cleanPrompt = (userPrompt || '').trim();
    if (cleanPrompt) {
      pendingInputEchoQueue.registerPendingEcho(this.sessionId, cleanPrompt);
    }

    const snapshot = this.interpreter.captureSnapshot();
    const baselineOccurrences = ScreenFingerprint.computeOccurrenceMap(snapshot.lines);

    this.currentBaseline = {
      turnId,
      userMessageId,
      userPrompt: cleanPrompt,
      createdAt: Date.now(),
      screenVersion: this.screenVersion,
      screenGeneration: snapshot.generation,
      baselineOccurrences,
      baselineLines: [...snapshot.lines],
    };

    this.currentTurnId = turnId;
    this.currentMsgId = userMessageId || null;
    this.currentPrompt = cleanPrompt;
    this.lastStreamedText = '';
  }

  /**
   * Processes incoming raw PTY bytes and computes incremental new candidate output.
   */
  processPtyBytes(bytes: string): ProcessedPtyTurnOutput {
    this.screenVersion++;
    const snapshot = this.interpreter.processBytes(bytes);

    // Use current baseline or fall back to last committed baseline to prevent historical leakage
    const effectiveBaseline = this.currentBaseline || this.lastCommittedBaseline;

    // Compute candidate new lines using multiset occurrence diffing against turn baseline
    const diff = IncrementalOutputDiffer.computeNewCandidates(
      snapshot.lines,
      effectiveBaseline
    );

    // Classify candidate new lines with authoritative session echo suppression
    const prompt = this.currentPrompt || effectiveBaseline?.userPrompt;
    const classified: ClassifiedScreenOutput = PtyConversationClassifier.classifyLines(
      diff.candidateLines,
      prompt,
      this.sessionId,
      this.currentTurnId || undefined
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
      turnId: this.currentTurnId,
      screenVersion: this.screenVersion,
    };
  }

  /**
   * Finalizes turn commit and archives terminal state into lastCommittedBaseline.
   * Late redraws from this turn will be diffed against this state, preventing resurrected turns.
   */
  commitTurn(turnId?: string) {
    const committingTurnId = turnId || this.currentTurnId || `committed_${Date.now()}`;
    if (committingTurnId) {
      pendingInputEchoQueue.consumeTurnEchoes(this.sessionId, committingTurnId);
    }

    const snapshot = this.interpreter.captureSnapshot();
    const baselineOccurrences = ScreenFingerprint.computeOccurrenceMap(snapshot.lines);

    this.lastCommittedBaseline = {
      turnId: committingTurnId,
      userPrompt: this.currentPrompt || '',
      createdAt: Date.now(),
      screenVersion: this.screenVersion,
      screenGeneration: snapshot.generation,
      baselineOccurrences,
      baselineLines: [...snapshot.lines],
    };

    this.currentBaseline = this.lastCommittedBaseline;
    this.currentTurnId = null;
    this.currentMsgId = null;
    this.currentPrompt = null;
    this.lastStreamedText = '';
  }

  /**
   * Disposes session state and clears virtual terminal interpreter.
   */
  dispose() {
    this.currentBaseline = null;
    this.lastCommittedBaseline = null;
    this.currentTurnId = null;
    this.currentMsgId = null;
    this.currentPrompt = null;
    this.lastStreamedText = '';
  }
}
