import {
  OrbitSession,
  ConversationTurn,
  ConversationMessage,
  ActivitySummary,
  SessionStatus,
} from '../../types/conversation';

type StoreListener = () => void;

export class AuthoritativeConversationStore {
  private sessions: Map<string, OrbitSession> = new Map();
  private listeners: Set<StoreListener> = new Set();
  private isLoaded = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('orbit_canonical_sessions_v1');
      if (raw) {
        const list: OrbitSession[] = JSON.parse(raw);
        for (const s of list) {
          // Historical sessions start offline until actively connected or verified by desktop runtime
          s.runtime = {
            isAlive: false,
            pid: undefined,
            lastHeartbeat: s.runtime?.lastHeartbeat || Date.now(),
          };
          if (s.status === 'working' || s.status === 'waiting') {
            s.status = 'offline';
          }
          // INV — streaming turns persisted by a PREVIOUS app run can never
          // receive events anymore; reconcile so the UI never renders an
          // eternal "Generating response…" from stale state.
          for (const turn of s.conversation?.turns || []) {
            if (turn.status === 'streaming') {
              turn.status = 'error';
              turn.completedAt = Date.now();
              for (const msg of turn.messages) {
                if (msg.streaming) msg.streaming = false;
              }
            }
          }
          this.sessions.set(s.id, s);
        }
      }
    } catch (e) {
      console.warn('Failed to load canonical conversation sessions from storage:', e);
    }
    this.isLoaded = true;
  }

  private saveToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const list = Array.from(this.sessions.values());
      localStorage.setItem('orbit_canonical_sessions_v1', JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to persist canonical conversation sessions:', e);
    }
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.saveToStorage();
    for (const l of this.listeners) {
      try {
        l();
      } catch (err) {
        console.error('Conversation store listener error:', err);
      }
    }
  }

  getOrCreateSession(
    id: string,
    projectId: string,
    workspaceId: string,
    engine: { id: string; name: string; version?: string; provider: string; transport?: import('../../types/conversation').TransportType },
    initialTitle?: string
  ): OrbitSession {
    let session = this.sessions.get(id);
    if (!session) {
      session = {
        id,
        projectId,
        workspaceId,
        engine,
        title: initialTitle || `${engine.name} Session`,
        status: 'offline',
        conversation: { turns: [] },
        capabilities: {
          streaming: true,
          structuredEvents: true,
          structuredToolCalls: true,
          approvals: true,
          sessionResume: true,
          historyRecovery: true,
          fileEvents: true,
          commandEvents: true,
          thinkingEvents: true,
          nativeConversationHistory: true,
        },
        runtime: {
          isAlive: false,
          lastHeartbeat: Date.now(),
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.sessions.set(id, session);
      this.notify();
    }
    return session;
  }

  getSession(id: string): OrbitSession | undefined {
    return this.sessions.get(id);
  }

  getAllSessions(): OrbitSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getSessionsForProject(projectId: string): OrbitSession[] {
    return this.getAllSessions().filter((s) => s.projectId === projectId || s.workspaceId === projectId);
  }

  addUserMessage(sessionId: string, text: string): ConversationMessage {
    const cleanText = text.trim();
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const messageId = `msg_u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const userMessage: ConversationMessage = {
      id: messageId,
      role: 'user',
      content: [{ type: 'text', text: cleanText }],
      createdAt: Date.now(),
    };

    const turnId = `turn_u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const turn: ConversationTurn = {
      id: turnId,
      role: 'user',
      messages: [userMessage],
      startedAt: Date.now(),
      completedAt: Date.now(),
      status: 'complete',
    };

    session.conversation.turns.push(turn);
    session.status = 'working';
    session.updatedAt = Date.now();

    // Generate intelligent title from first prompt if default title
    if (session.conversation.turns.length === 1 || session.title.endsWith('Session')) {
      session.title = cleanText.length > 32 ? `${cleanText.slice(0, 32)}...` : cleanText;
    }

    this.notify();
    return userMessage;
  }

  /**
   * INV-7 — the canonical agent turn ADOPTS the capture turn's identity.
   * The PTY capture session starts a turn with ITS turnId (generated by the
   * remote controller / chat submission); the store must use THE SAME id for
   * the agent turn so turn-scoped writes align. Without adoption, every
   * assistant event is rejected as a "turnId mismatch" and replies never reach
   * the canonical conversation (the mobile regression).
   */
  startAgentTurn(sessionId: string, turnId?: string): ConversationTurn {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Check if the last turn is already an active streaming agent turn
    const lastTurn = session.conversation.turns[session.conversation.turns.length - 1];
    if (lastTurn && lastTurn.role === 'agent' && lastTurn.status === 'streaming') {
      // Adopt the requested identity if the turn has no assistant content yet
      // (activities-only turn created lazily before the first delta).
      if (turnId && lastTurn.id !== turnId && !this.turnHasAssistantContent(lastTurn)) {
        lastTurn.id = turnId;
      }
      return lastTurn;
    }

    const id = turnId || `turn_a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const assistantMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const assistantMessage: ConversationMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
      createdAt: Date.now(),
      streaming: true,
    };

    const newTurn: ConversationTurn = {
      id,
      role: 'agent',
      messages: [assistantMessage],
      activities: [],
      startedAt: Date.now(),
      status: 'streaming',
    };

    session.conversation.turns.push(newTurn);
    session.status = 'working';
    session.updatedAt = Date.now();
    this.notify();
    return newTurn;
  }

  private turnHasAssistantContent(turn: ConversationTurn): boolean {
    return turn.messages.some((m) =>
      m.role === 'assistant' &&
      m.content.some((c) => (c.type === 'markdown' && c.markdown?.trim()) || (c.type === 'text' && c.text?.trim()))
    );
  }

  /**
   * INV-11 / INV-22 — streaming is keyed by sessionId + turnId. A stale event
   * (from a DIFFERENT turn that is still streaming) is REJECTED, never merged:
   * assistant output may only be committed to the currently active turn.
   *
   * Identity ADOPTION policy: the canonical agent turn is created lazily, so the
   * FIRST event of a turn legitimately carries a turnId the store has never seen
   * (the capture session's turn identity). In that case the store creates the
   * agent turn WITH the event's identity instead of rejecting — otherwise every
   * PTY-captured reply would be discarded and remote/mobile would show nothing.
   * Rejection is reserved for a genuine mid-turn mismatch: the last agent turn
   * is STREAMING and already HAS assistant content under a different id.
   */
  private resolveAgentTurnForWrite(
    sessionId: string,
    op: 'assistant_delta' | 'assistant_completed' | 'activity',
    turnId?: string
  ): { session: OrbitSession; turn: ConversationTurn } | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[SESSION] ${op} rejected — session ${sessionId} not found`);
      return null;
    }
    const lastTurn = session.conversation.turns[session.conversation.turns.length - 1];

    // Already-committed turn: duplicate deltas/completions for the SAME turn id
    // are rejected (the turn is final — late repaints must not reopen it).
    if (
      lastTurn &&
      lastTurn.role === 'agent' &&
      lastTurn.status === 'complete' &&
      turnId === lastTurn.id
    ) {
      console.warn(
        `[SESSION] ${op} rejected — turn ${turnId} already complete for session ${sessionId}`
      );
      return null;
    }

    const canAdopt =
      !lastTurn ||
      lastTurn.role !== 'agent' ||
      lastTurn.status === 'complete' ||
      (turnId !== undefined && !this.turnHasAssistantContent(lastTurn));

    if (canAdopt) {
      // New turn (or activities-only turn) — create/align with the event identity.
      const turn = this.startAgentTurn(sessionId, turnId);
      return { session, turn };
    }

    // Last agent turn is STREAMING with assistant content under a different id:
    // a genuinely stale event — reject.
    if (turnId && lastTurn.id !== turnId) {
      console.warn(
        `[SESSION] ${op} rejected — turnId mismatch for session ${sessionId} (event turn ${turnId} ≠ active turn ${lastTurn.id})`
      );
      return null;
    }
    return { session, turn: lastTurn };
  }

  updateStreamingAssistant(sessionId: string, textDelta: string, thought?: string, turnId?: string) {
    const resolved = this.resolveAgentTurnForWrite(sessionId, 'assistant_delta', turnId);
    if (!resolved) return;
    const { session, turn: agentTurn } = resolved;

    const assistantMsg = agentTurn.messages.find((m) => m.role === 'assistant');
    if (!assistantMsg) return;

    assistantMsg.streaming = true;
    assistantMsg.content = [{ type: 'markdown', markdown: textDelta }];

    if (thought) {
      // Record thought if present — deduped across streaming frames. TUI agents
      // re-emit the same thought every repaint frame ("Thought for 1s"); without
      // matching both "Thinking…" and "Thought for …" summaries, every delta
      // unshifted a NEW activity chip and the UI flooded with duplicates.
      const existingActivity = agentTurn.activities?.find(
        (a) => a.category === 'other' && (a.summary.startsWith('Thinking') || a.summary.startsWith('Thought'))
      );
      if (existingActivity) {
        existingActivity.summary = thought;
      } else {
        if (!agentTurn.activities) agentTurn.activities = [];
        agentTurn.activities.unshift({
          id: `act_${Date.now()}`,
          category: 'other',
          summary: thought,
          startedAt: Date.now(),
          completedAt: Date.now(),
        });
      }
    }

    session.updatedAt = Date.now();
    this.notify();
  }

  completeAgentMessage(sessionId: string, finalText: string, thought?: string, turnId?: string) {
    const resolved = this.resolveAgentTurnForWrite(sessionId, 'assistant_completed', turnId);
    if (!resolved) return;
    const { session, turn: agentTurn } = resolved;

    const assistantMsg = agentTurn.messages.find((m) => m.role === 'assistant');
    if (assistantMsg) {
      assistantMsg.streaming = false;
      assistantMsg.content = [{ type: 'markdown', markdown: finalText }];
    }

    agentTurn.status = 'complete';
    agentTurn.completedAt = Date.now();
    session.status = 'waiting';
    session.updatedAt = Date.now();
    this.notify();
  }

  /**
   * INV — a streaming agent turn that can no longer receive events must never
   * pin the UI in "Generating response…" forever. Reconciles leftover streaming
   * turns (agent process gone, previous app run, delivery failure) to a final
   * state. Called when a NEW turn starts, on delivery failure, and on
   * rehydration of persisted state.
   */
  reconcileStreamingTurns(sessionId: string, finalStatus: 'interrupted' | 'error' = 'interrupted') {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    let changed = false;
    for (const turn of session.conversation.turns) {
      if (turn.role === 'agent' && turn.status === 'streaming') {
        turn.status = finalStatus;
        turn.completedAt = Date.now();
        for (const msg of turn.messages) {
          if (msg.streaming) msg.streaming = false;
        }
        changed = true;
      }
    }
    if (changed) {
      session.updatedAt = Date.now();
      this.notify();
    }
  }

  appendActivity(
    sessionId: string,
    category: ActivitySummary['category'],
    summary: string,
    detail?: import('../../types/conversation').ActivityDetail
  ) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    let agentTurn = session.conversation.turns[session.conversation.turns.length - 1];
    if (!agentTurn || agentTurn.role !== 'agent') {
      agentTurn = this.startAgentTurn(sessionId);
    }

    if (!agentTurn.activities) agentTurn.activities = [];

    // Find existing activity in same category to aggregate cleanly
    const existing = agentTurn.activities.find((a) => a.category === category);
    if (existing) {
      existing.summary = summary;
      if (detail) {
        if (!existing.details) existing.details = [];
        existing.details.push(detail);
      }
      existing.completedAt = Date.now();
    } else {
      agentTurn.activities.push({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        category,
        summary,
        details: detail ? [detail] : undefined,
        startedAt: Date.now(),
        completedAt: Date.now(),
      });
    }

    session.updatedAt = Date.now();
    this.notify();
  }

  getSessionsForAgent(agentId: string): OrbitSession[] {
    return this.getAllSessions().filter((s) => s.engine.id === agentId || s.id === agentId);
  }

  restoreSession(sessionId: string, runtimeMeta?: Partial<import('../../types/conversation').RuntimeReference>): OrbitSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    if (runtimeMeta) {
      session.runtime = { ...session.runtime, ...runtimeMeta };
    }
    session.updatedAt = Date.now();
    this.notify();
    return session;
  }

  rehydrateFromList(list: OrbitSession[]) {
    this.sessions.clear();
    for (const s of list) {
      s.runtime = {
        isAlive: false,
        pid: undefined,
        lastHeartbeat: s.runtime?.lastHeartbeat || Date.now(),
      };
      if (s.status === 'working' || s.status === 'waiting') {
        s.status = 'offline';
      }
      for (const turn of s.conversation?.turns || []) {
        if (turn.status === 'streaming') {
          turn.status = 'error';
          turn.completedAt = Date.now();
          for (const msg of turn.messages) {
            if (msg.streaming) msg.streaming = false;
          }
        }
      }
      this.sessions.set(s.id, s);
    }
    this.notify();
  }

  clearAll() {
    this.sessions.clear();
    this.notify();
  }

  setSessionStatus(sessionId: string, status: SessionStatus) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.status = status;
    session.updatedAt = Date.now();
    this.notify();
  }

  setRuntimeAlive(sessionId: string, isAlive: boolean, pid?: number, statusOverride?: SessionStatus) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.runtime.isAlive = isAlive;
    if (pid !== undefined) session.runtime.pid = pid;
    session.runtime.lastHeartbeat = Date.now();
    if (!isAlive) {
      session.status = statusOverride || 'offline';
      // Reconcile any in-flight streaming message so UI does not hang indefinitely
      for (const turn of session.conversation.turns) {
        if (turn.status === 'streaming') {
          turn.status = 'error';
          turn.completedAt = Date.now();
          for (const msg of turn.messages) {
            if (msg.streaming) {
              msg.streaming = false;
            }
          }
        }
      }
    } else {
      if (statusOverride) {
        session.status = statusOverride;
      } else if (session.status === 'offline') {
        session.status = 'waiting';
      }
    }
    session.updatedAt = Date.now();
    this.notify();
  }
}

export const conversationStore = new AuthoritativeConversationStore();
