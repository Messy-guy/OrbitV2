import {
  OrbitSession,
  ConversationTurn,
  ConversationMessage,
  ActivitySummary,
  SessionStatus,
} from '../../types/conversation';

type StoreListener = () => void;

class AuthoritativeConversationStore {
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

  startAgentTurn(sessionId: string): ConversationTurn {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Check if the last turn is already an active streaming agent turn
    const lastTurn = session.conversation.turns[session.conversation.turns.length - 1];
    if (lastTurn && lastTurn.role === 'agent' && lastTurn.status === 'streaming') {
      return lastTurn;
    }

    const turnId = `turn_a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const assistantMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const assistantMessage: ConversationMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
      createdAt: Date.now(),
      streaming: true,
    };

    const newTurn: ConversationTurn = {
      id: turnId,
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

  updateStreamingAssistant(sessionId: string, textDelta: string, thought?: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    let agentTurn = session.conversation.turns[session.conversation.turns.length - 1];
    if (!agentTurn || agentTurn.role !== 'agent') {
      agentTurn = this.startAgentTurn(sessionId);
    }

    const assistantMsg = agentTurn.messages.find((m) => m.role === 'assistant');
    if (!assistantMsg) return;

    assistantMsg.streaming = true;
    assistantMsg.content = [{ type: 'markdown', markdown: textDelta }];

    if (thought) {
      // Record thought if present
      const existingActivity = agentTurn.activities?.find((a) => a.category === 'other' && a.summary.startsWith('Thinking'));
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

  completeAgentMessage(sessionId: string, finalText: string, thought?: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    let agentTurn = session.conversation.turns[session.conversation.turns.length - 1];
    if (!agentTurn || agentTurn.role !== 'agent') {
      agentTurn = this.startAgentTurn(sessionId);
    }

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
