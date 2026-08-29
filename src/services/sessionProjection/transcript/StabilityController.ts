import { ScreenSnapshot } from '../terminal/ScreenSnapshot';
import { HeuristicClassifier } from '../classification/HeuristicClassifier';
import { sessionEventStore } from '../events/SessionEventStore';
import { pendingInputEchoQueue } from '../input/PendingInputEchoQueue';

export class StabilityController {
  private sessionId: string;
  private flushTimer: NodeJS.Timeout | null = null;
  private commitTimer: NodeJS.Timeout | null = null;
  private lastCleanText: string = '';
  private lastThought?: string;
  private lastWorkspacePath?: string;
  private lastActiveMode?: string;
  private latestUserPrompt?: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  setLatestUserPrompt(prompt: string) {
    this.latestUserPrompt = prompt;
    if (prompt && prompt.trim()) {
      pendingInputEchoQueue.registerPendingEcho(this.sessionId, prompt.trim());
    }
    this.lastCleanText = '';
    this.lastThought = undefined;
    this.lastWorkspacePath = undefined;
    this.lastActiveMode = undefined;
    sessionEventStore.clearStreamingDraft(this.sessionId);
  }

  handleScreenUpdate(
    snapshot: ScreenSnapshot,
    onDraftFlush?: (draft: string) => void,
    onEventCommit?: () => void
  ) {
    // Extract current turn text (isolated from previous turns via turn-boundary slicing and echo suppression)
    const { text, isThinking, thought, workspacePath, activeMode } = snapshot.getCleanConversationalText(this.latestUserPrompt, this.sessionId);

    if (thought) this.lastThought = thought;
    if (workspacePath) this.lastWorkspacePath = workspacePath;
    if (activeMode) this.lastActiveMode = activeMode;

    const hasSubstantiveContent = text && text.trim().length > 2 && !/^(Plan|Build|Chat|Explore):/i.test(text.trim());

    // If agent is thinking and hasn't produced substantive text yet, show live Thinking... draft
    if (isThinking && !hasSubstantiveContent) {
      sessionEventStore.setStreamingDraft({
        id: `draft-${this.sessionId}`,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        type: 'agent_message',
        content: 'Thinking...',
        thought: this.lastThought || 'Thinking...',
        confidence: 0.9,
        source: {
          kind: 'terminal_interpreter',
          interpreterVersion: 'v1.0.0',
        },
        metadata: {
          filePath: this.lastWorkspacePath,
          toolName: this.lastActiveMode,
        },
      });
      if (onDraftFlush) onDraftFlush('Thinking...');
      return;
    }

    if (!hasSubstantiveContent || text === this.lastCleanText) return;

    this.lastCleanText = text;

    // 1. Flush Window (150ms): update live streaming draft in-place
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        if (this.lastCleanText && this.lastCleanText.length > 2 && this.lastCleanText !== 'Thinking...') {
          const classified = HeuristicClassifier.classify(this.lastCleanText);
          if (classified.type !== 'terminal_chrome') {
            sessionEventStore.setStreamingDraft({
              id: `draft-${this.sessionId}`,
              sessionId: this.sessionId,
              timestamp: Date.now(),
              type: classified.type,
              content: this.lastCleanText,
              thought: this.lastThought || classified.thought,
              confidence: classified.confidence,
              source: {
                kind: 'terminal_interpreter',
                interpreterVersion: 'v1.0.0',
              },
              metadata: {
                ...classified.metadata,
                filePath: this.lastWorkspacePath,
                toolName: this.lastActiveMode,
              },
            });
            if (onDraftFlush) onDraftFlush(this.lastCleanText);
          }
        }
      }, 150);
    }

    // 2. Commit Window (800ms idle): commit single permanent turn event
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(() => {
      this.commitTimer = null;
      this.commit(onEventCommit);
    }, 800);
  }

  commit(onEventCommit?: () => void) {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }

    const finalText = this.lastCleanText.trim();
    const isSubstantive = finalText && finalText.length > 2 && finalText !== 'Thinking...' && !/^(Plan|Build|Chat|Explore):/i.test(finalText);

    if (!isSubstantive) {
      this.lastCleanText = '';
      this.lastThought = undefined;
      this.lastWorkspacePath = undefined;
      this.lastActiveMode = undefined;
      sessionEventStore.clearStreamingDraft(this.sessionId);
      return;
    }

    const classified = HeuristicClassifier.classify(finalText);

    // Atomically commit single event for this turn
    sessionEventStore.appendEvent({
      id: `evt-${this.sessionId}-${Date.now()}`,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      type: classified.type,
      content: finalText,
      thought: this.lastThought || classified.thought,
      confidence: classified.confidence,
      source: {
        kind: 'terminal_interpreter',
        interpreterVersion: 'v1.0.0',
      },
      metadata: {
        ...classified.metadata,
        filePath: this.lastWorkspacePath,
        toolName: this.lastActiveMode,
      },
      status: 'committed',
    });

    this.lastCleanText = '';
    this.lastThought = undefined;
    this.lastWorkspacePath = undefined;
    this.lastActiveMode = undefined;
    sessionEventStore.clearStreamingDraft(this.sessionId);

    if (onEventCommit) onEventCommit();
  }

  reset() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.lastCleanText = '';
    this.lastThought = undefined;
    this.lastWorkspacePath = undefined;
    this.lastActiveMode = undefined;
    this.latestUserPrompt = undefined;
  }
}
