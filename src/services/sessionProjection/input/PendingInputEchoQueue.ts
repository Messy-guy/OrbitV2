export interface PendingInputEcho {
  id: string;
  sessionId: string;
  turnId?: string;

  // Original user content
  content: string;

  // Normalized form used for echo comparison
  normalizedContent: string;

  // Normalized individual lines for multiline prompt matching
  normalizedLines: string[];

  // Sequence boundary before input was dispatched
  submittedAtRawSequence: number;

  // Time correlation
  submittedAt: number;

  // Echo has been observed and consumed
  consumed: boolean;
}

export class PendingInputEchoQueue {
  private queues: Map<string, PendingInputEcho[]> = new Map();
  private sequenceCounter = 0;

  /**
   * Normalizes arbitrary prompt/line text for robust echo matching
   */
  normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/^[›>❯$#%|│┃║_┌└├╔╚╠─═—\-_•*~\s]+/g, '')
      .replace(/[|│┃║_┐┘┤╗╝╣─═—\-_•*~\s]+$/g, '')
      .replace(/^(user|you|human|input|prompt|command|plan):\s*/i, '')
      .replace(/^\/plan\s+/i, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Registers an authoritative user input as a pending terminal echo for the given session
   */
  registerPendingEcho(sessionId: string, content: string, turnId?: string, sequence?: number): PendingInputEcho {
    const clean = content.trim();
    const rawLines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
    const normalizedContent = this.normalizeText(clean);
    const normalizedLines = rawLines.map((l) => this.normalizeText(l)).filter(Boolean);

    this.sequenceCounter++;
    const entry: PendingInputEcho = {
      id: `echo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId,
      turnId,
      content: clean,
      normalizedContent,
      normalizedLines,
      submittedAtRawSequence: sequence ?? this.sequenceCounter,
      submittedAt: Date.now(),
      consumed: false,
    };

    if (!this.queues.has(sessionId)) {
      this.queues.set(sessionId, []);
    }

    const queue = this.queues.get(sessionId)!;
    // Clean up stale entries (> 2 minutes old)
    const now = Date.now();
    const valid = queue.filter((item) => now - item.submittedAt < 120_000);
    valid.push(entry);
    this.queues.set(sessionId, valid);

    return entry;
  }

  /**
   * Returns active, unconsumed pending echoes for a session
   */
  getPendingEchoes(sessionId: string, activeTurnId?: string): PendingInputEcho[] {
    const queue = this.queues.get(sessionId);
    if (!queue) return [];
    const now = Date.now();
    return queue.filter((item) => {
      if (item.consumed || now - item.submittedAt >= 120_000) return false;
      if (activeTurnId && item.turnId && item.turnId !== activeTurnId) return false;
      return true;
    });
  }

  /**
   * Marks a specific pending echo as consumed
   */
  consumeEcho(sessionId: string, echoId: string): void {
    const queue = this.queues.get(sessionId);
    if (!queue) return;
    for (const item of queue) {
      if (item.id === echoId) {
        item.consumed = true;
      }
    }
  }

  /**
   * Clears or consumes all echoes for a completed turn
   */
  consumeTurnEchoes(sessionId: string, turnId: string): void {
    const queue = this.queues.get(sessionId);
    if (!queue) return;
    for (const item of queue) {
      if (item.turnId === turnId) {
        item.consumed = true;
      }
    }
  }

  /**
   * Matches a candidate terminal line against pending echoes for this session
   */
  findMatchingEcho(sessionId: string, candidateLine: string, activeTurnId?: string): PendingInputEcho | null {
    const cleanCandidate = this.normalizeText(candidateLine);
    if (!cleanCandidate) return null;

    const pending = this.getPendingEchoes(sessionId, activeTurnId);
    for (const echo of pending) {
      // 1. Exact normalized match (e.g. "› hello" -> "hello" === "hello")
      if (cleanCandidate === echo.normalizedContent) {
        return echo;
      }

      // 2. Multiline match (candidate matches one of the prompt lines)
      if (echo.normalizedLines.some((nl) => nl === cleanCandidate)) {
        return echo;
      }

      // 3. Substring / wrapping match for wrapped long prompts (only when candidate is part of echo prompt)
      if (
        echo.normalizedContent.length > 20 &&
        cleanCandidate.length > 8 &&
        echo.normalizedContent.includes(cleanCandidate)
      ) {
        return echo;
      }

      // 4. Substring match for boxed/decorated prompt lines
      if (
        cleanCandidate.length > 3 &&
        (echo.normalizedContent === cleanCandidate || echo.normalizedLines.includes(cleanCandidate))
      ) {
        return echo;
      }
    }

    return null;
  }

  /**
   * Clears all pending echoes for a session
   */
  clearSession(sessionId: string): void {
    this.queues.delete(sessionId);
  }
}

export const pendingInputEchoQueue = new PendingInputEchoQueue();
