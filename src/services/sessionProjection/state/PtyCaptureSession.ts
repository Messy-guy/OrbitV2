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
  lifecycle: CaptureLifecycle;
}

/**
 * INV-6 — explicit capture lifecycle:
 *
 *   BOOTSTRAPPING → READY → TURN_ACTIVE → DISPOSED
 *
 * BOOTSTRAPPING: consuming existing PTY state (bind-time history prime, cold-start
 *   intake). Output here is TERMINAL STATE ONLY — zero conversation events.
 * READY: baseline established, no active turn. Output is terminal/activity state
 *   only — INV-8 forbids assistant messages without turn ownership.
 * TURN_ACTIVE: a user turn owns the capture. Only here may genuinely new
 *   semantic output become assistant_delta/assistant_completed.
 * DISPOSED: session torn down; nothing is captured.
 */
export type CaptureLifecycle = 'BOOTSTRAPPING' | 'READY' | 'TURN_ACTIVE' | 'DISPOSED';

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

  // Per-turn accumulation state. Agent TUIs (Copilot, Mimo, …) repaint every
  // frame; each snapshot's diff re-surfaces the same lines, and streaming text
  // often arrives as progressive in-place rewrites ("Hi! 👋 What c" → "Hi! 👋
  // What can I help?"). The accumulator keeps the turn monotonic: identical
  // lines are captured once, progressive rewrites replace their shorter
  // predecessor, and the final committed reply is the FULL turn text instead of
  // only the last snapshot's fragment.
  private turnAccumulatedLines: string[] = [];
  private turnAccumulatedFps: string[] = [];
  private turnEmittedActivityKeys: Set<string> = new Set();
  private lifecycle: CaptureLifecycle = 'BOOTSTRAPPING';

  // Session-wide ledger of user prompt fingerprints. TUI agents re-render PAST
  // prompts on resume/repaint (often twice: the old prompt row still visible +
  // a freshly rendered echo), which beats the per-turn baseline count. Any line
  // whose fingerprint equals a prompt ever sent in this session is never prose.
  private sessionPromptFps: Set<string> = new Set();

  private primed = false;

  constructor(sessionId: string, rows = 30, cols = 100) {
    this.sessionId = sessionId;
    this.interpreter = new HeadlessTerminalInterpreter(rows, cols);
  }

  /**
   * Prime the virtual terminal with the agent's authoritative PTY history so the
   * capture mirrors the REAL terminal screen from the moment it attaches.
   *
   * A capture session bound to an agent that already has conversation history
   * (desktop restart, adapter re-bind, first message to a long-running TUI)
   * starts with an empty grid — the agent's next full-screen repaint then dumps
   * the entire prior conversation, and every stale row diffs as "new" content.
   * Priming replays the history into the interpreter and freezes it as the
   * baseline, so repaints of that history are suppressed by normal multiset
   * accounting while genuinely new reply rows are still captured.
   *
   * Safe to call any time: with an active turn it MERGES into the current
   * baseline (only adds suppression coverage, never removes candidates).
   */
  primeFromHistory(history: string) {
    if (this.primed || !history || !history.trim()) return;
    this.primed = true;

    this.interpreter.processBytes(history);
    this.screenVersion++;

    const snapshot = this.interpreter.captureSnapshot();
    const mergedOccurrences = ScreenFingerprint.computeOccurrenceMap([
      ...snapshot.lines,
      ...this.interpreter.getScrollbackLines(),
    ]);

    if (this.currentBaseline) {
      for (const [fp, count] of mergedOccurrences) {
        this.currentBaseline.baselineOccurrences.set(
          fp,
          (this.currentBaseline.baselineOccurrences.get(fp) || 0) + count
        );
      }
    } else {
      this.lastCommittedBaseline = {
        turnId: `primed-${Date.now()}`,
        userPrompt: '',
        createdAt: Date.now(),
        screenVersion: this.screenVersion,
        screenGeneration: snapshot.generation,
        baselineOccurrences: mergedOccurrences,
        baselineLines: [...snapshot.lines],
      };
      this.currentBaseline = this.lastCommittedBaseline;
    }

    // Bootstrap intake complete → baseline established (INV-6 transition).
    if (this.lifecycle === 'BOOTSTRAPPING') {
      this.lifecycle = this.currentTurnId ? 'TURN_ACTIVE' : 'READY';
    }
  }

  isPrimed(): boolean {
    return this.primed;
  }

  getLifecycle(): CaptureLifecycle {
    return this.lifecycle;
  }

  /** Mark primed without replaying history (nothing to prime, e.g. fresh spawn). */
  markPrimed() {
    this.primed = true;
    // Bootstrap intake complete → baseline established. If a turn is already
    // active the capture stays turn-owned; otherwise it becomes READY.
    if (this.lifecycle === 'BOOTSTRAPPING') {
      this.lifecycle = this.currentTurnId ? 'TURN_ACTIVE' : 'READY';
    }
  }

  /**
   * Seed the session prompt ledger from rehydrated canonical conversation turns
   * (desktop restart / re-bind). Past user prompts re-render on TUI resume and
   * must never surface as assistant prose.
   */
  seedPromptFingerprints(prompts: string[]) {
    for (const p of prompts) {
      const fp = ScreenFingerprint.terminalEchoFingerprint(p);
      if (fp) this.sessionPromptFps.add(fp);
    }
  }

  /**
   * Baseline occurrence map over the visible screen PLUS scrollback. Old
   * conversation rows that scroll back into the viewport during a reply are
   * then recognized as pre-existing instead of being captured as new prose.
   */
  private computeExtendedBaselineOccurrences(): Map<string, number> {
    const snapshot = this.interpreter.captureSnapshot();
    return ScreenFingerprint.computeOccurrenceMap([
      ...snapshot.lines,
      ...this.interpreter.getScrollbackLines(),
    ]);
  }

  /**
   * Records a turn baseline immediately when a user message is submitted.
   * All screen state present prior to this moment is frozen into the baseline.
   */
  startTurn(turnId: string, userPrompt: string, userMessageId?: string) {
    if (this.lifecycle === 'DISPOSED') {
      console.warn(`[SESSION] ${this.sessionId} startTurn rejected — capture DISPOSED`);
      return;
    }
    this.lifecycle = 'TURN_ACTIVE';
    const cleanPrompt = (userPrompt || '').trim();
    if (cleanPrompt) {
      pendingInputEchoQueue.registerPendingEcho(this.sessionId, cleanPrompt);
    }

    const snapshot = this.interpreter.captureSnapshot();
    const baselineOccurrences = this.computeExtendedBaselineOccurrences();

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
    this.turnAccumulatedLines = [];
    this.turnAccumulatedFps = [];
    this.turnEmittedActivityKeys = new Set();
    if (cleanPrompt) {
      const promptFp = ScreenFingerprint.terminalEchoFingerprint(cleanPrompt);
      if (promptFp) this.sessionPromptFps.add(promptFp);
    }
  }

  /**
   * Processes incoming raw PTY bytes and computes incremental new candidate output.
   */
  processPtyBytes(bytes: string): ProcessedPtyTurnOutput {
    this.screenVersion++;

    // Cold-start freeze: a freshly-bound capture session (adapter re-bind, desktop
    // restart, mid-conversation attach) receives the agent's CURRENT screen —
    // welcome banner, full conversation history repaint — as its very first bytes.
    // With no baseline yet, every row would diff as "new" and the entire stale
    // conversation would leak into a bubble. Freeze this first snapshot as the
    // committed baseline instead of surfacing it as content.
    if (!this.currentBaseline && !this.lastCommittedBaseline) {
      this.interpreter.processBytes(bytes);
      this.commitTurn(`cold-start-${Date.now()}`);
      this.lifecycle = 'READY'; // bootstrap intake complete → baseline established
      return {
        userFacingText: '',
        activities: [],
        thought: undefined,
        isThinking: false,
        hasNewContent: false,
        turnId: null,
        screenVersion: this.screenVersion,
        lifecycle: this.lifecycle,
      };
    }

    const snapshot = this.interpreter.processBytes(bytes);

    // Use current baseline or fall back to last committed baseline to prevent historical leakage
    const effectiveBaseline = this.currentBaseline || this.lastCommittedBaseline;

    // INV-16 — the lifecycle boundary IS the temporal boundary. Everything the
    // observer sees outside an active turn is terminal state; bootstrap intake is
    // handled by the cold-start freeze and bind-time history priming, never by
    // content inspection. No fingerprint blacklists, no content matching.

    // Compute candidate new lines using multiset occurrence diffing against turn baseline
    const diff = IncrementalOutputDiffer.computeNewCandidates(
      snapshot.lines,
      effectiveBaseline
    );

    // Drop re-rendered echoes of ANY prompt ever sent in this session (resume
    // repaints re-render old prompts, often alongside the still-visible original).
    const promptEchoFree = diff.candidateLines.filter((line) => {
      const fp = ScreenFingerprint.terminalEchoFingerprint(line);
      return !fp || !this.sessionPromptFps.has(fp);
    });

    // Classify candidate new lines with authoritative session echo suppression
    const prompt = this.currentPrompt || effectiveBaseline?.userPrompt;
    const classified: ClassifiedScreenOutput = PtyConversationClassifier.classifyLines(
      promptEchoFree,
      prompt,
      this.sessionId,
      this.currentTurnId || undefined
    );

    // INV — redraw-fragment pruning. Full-screen TUIs overwrite reply rows in
    // place while streaming; a row captured mid-write ("Hi! 👋 What c") or a
    // spinner-remnant row ("ought for 1s …") is transient: the agent ERASES it
    // in the very next frame. Any accumulated line whose fingerprint is no
    // longer present ANYWHERE on the terminal (screen + scrollback) was such a
    // transient — drop it. The completed line arrives in the next full repaint
    // and is re-accumulated by fingerprint (self-healing, no blacklisting).
    if (this.turnAccumulatedFps.length > 0) {
      const present = ScreenFingerprint.computeOccurrenceMap([
        ...snapshot.lines,
        ...this.interpreter.getScrollbackLines(),
      ]);
      const keptLines: string[] = [];
      const keptFps: string[] = [];
      for (let i = 0; i < this.turnAccumulatedFps.length; i++) {
        if (present.has(this.turnAccumulatedFps[i])) {
          keptLines.push(this.turnAccumulatedLines[i]);
          keptFps.push(this.turnAccumulatedFps[i]);
        }
      }
      this.turnAccumulatedLines = keptLines;
      this.turnAccumulatedFps = keptFps;
    }

    // INV-8 / INV-6 — the lifecycle gate. Assistant conversation events are ONLY
    // legal while a turn owns the capture (TURN_ACTIVE). BOOTSTRAPPING output is
    // terminal state only; READY (no active turn) output is terminal/activity
    // state only. This is what makes restart/reconnect/restore screens inert.
    const turnOwned = this.lifecycle === 'TURN_ACTIVE' && this.currentTurnId !== null;
    if (!turnOwned) {
      return {
        userFacingText: '',
        activities: [],
        thought: undefined,
        isThinking: false,
        hasNewContent: false,
        turnId: null,
        screenVersion: this.screenVersion,
        lifecycle: this.lifecycle,
      };
    }

    // Accumulate the turn monotonically: dedupe redraw dupes, replace progressive
    // in-place rewrites, and only surface genuinely new assistant lines.
    for (const decision of classified.decisions) {
      if (decision.type === 'assistant_text') {
        this.accumulateTurnLine(decision.text);
      }
    }

    // Dedupe activities across snapshots — TUI spinner frames re-emit the same
    // activity every repaint ("Thought for 1s" spam). Only NEW distinct
    // activities are surfaced per snapshot.
    const newActivities = classified.activities.filter((act) => {
      const key = act.summary.trim().toLowerCase();
      if (this.turnEmittedActivityKeys.has(key)) return false;
      this.turnEmittedActivityKeys.add(key);
      return true;
    });

    const userFacingText = this.turnAccumulatedLines.join('\n');
    const hasNewContent = userFacingText.trim().length > 0 && userFacingText !== this.lastStreamedText;

    if (hasNewContent) {
      this.lastStreamedText = userFacingText;
    }

    return {
      userFacingText,
      activities: newActivities,
      thought: classified.thought,
      isThinking: classified.isThinking,
      hasNewContent,
      turnId: this.currentTurnId,
      screenVersion: this.screenVersion,
      lifecycle: this.lifecycle,
    };
  }

  /**
   * Adds one assistant line to the current turn's accumulated reply.
   * - Lines already captured this turn are skipped (TUI repaint dupes).
   * - A line that extends a previously captured line (progressive in-place
   *   rewrite) REPLACES it instead of duplicating a partial fragment.
   */
  private accumulateTurnLine(text: string) {
    const fp = ScreenFingerprint.fingerprintLine(text);
    if (!fp) return;

    const existingIdx = this.turnAccumulatedFps.indexOf(fp);
    if (existingIdx !== -1) return; // already captured this turn

    // Progressive rewrite: a longer line that starts with an earlier (shorter)
    // captured line replaces it in place.
    const extendIdx = this.turnAccumulatedFps.findIndex(
      (prev) => prev.length >= 3 && fp.startsWith(prev) && fp.length > prev.length
    );
    if (extendIdx !== -1) {
      this.turnAccumulatedLines[extendIdx] = text;
      this.turnAccumulatedFps[extendIdx] = fp;
      return;
    }

    this.turnAccumulatedLines.push(text);
    this.turnAccumulatedFps.push(fp);
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
    const baselineOccurrences = this.computeExtendedBaselineOccurrences();

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
    if (this.lifecycle === 'TURN_ACTIVE') this.lifecycle = 'READY';
    this.turnAccumulatedLines = [];
    this.turnAccumulatedFps = [];
    this.turnEmittedActivityKeys = new Set();
  }

  /**
   * Disposes session state and clears virtual terminal interpreter.
   */
  dispose() {
    this.lifecycle = 'DISPOSED';
    this.currentBaseline = null;
    this.lastCommittedBaseline = null;
    this.currentTurnId = null;
    this.currentMsgId = null;
    this.currentPrompt = null;
    this.lastStreamedText = '';
    this.turnAccumulatedLines = [];
    this.turnAccumulatedFps = [];
    this.turnEmittedActivityKeys = new Set();
    this.sessionPromptFps = new Set();
    this.interpreter.reset();
  }
}
