import { Session, Message } from '../types/orbit';
import { isTauriAvailable, tauriService } from './tauri.service';
import { conversationStore } from './conversation/ConversationStore';

export interface ISessionService {
  getSessions(workspaceId: string): Promise<Session[]>;
  getSessionById(sessionId: string): Promise<Session | undefined>;
  getAgentSessions(agentId: string): Promise<Session[]>;
  createSession(agentId: string, workspaceId: string, title?: string): Promise<Session>;
  restoreSession(sessionId: string, agentId?: string, workspaceId?: string, title?: string): Promise<Session>;
  getMessages(sessionId: string): Promise<Message[]>;
  addMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message>;
}

export class HybridSessionService implements ISessionService {
  private fallbackSessions: Session[] = [];
  private messages: Record<string, Message[]> = {};

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('orbit_sessions_store_v1');
      if (raw) {
        this.fallbackSessions = JSON.parse(raw);
      }
      const rawMsgs = localStorage.getItem('orbit_messages_store_v1');
      if (rawMsgs) {
        this.messages = JSON.parse(rawMsgs);
      }
    } catch {}
  }

  private saveToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('orbit_sessions_store_v1', JSON.stringify(this.fallbackSessions));
      localStorage.setItem('orbit_messages_store_v1', JSON.stringify(this.messages));
    } catch {}
  }

  async getSessions(workspaceId: string): Promise<Session[]> {
    if (isTauriAvailable()) {
      try {
        const list = await tauriService.getSessions(workspaceId);
        if (list && list.length > 0) return list;
      } catch (e) {
        console.warn('Tauri getSessions failed, falling back', e);
      }
    }
    return this.fallbackSessions.filter(s => s.workspaceId === workspaceId);
  }

  async getSessionById(sessionId: string): Promise<Session | undefined> {
    const direct = this.fallbackSessions.find(s => s.id === sessionId);
    if (direct) return direct;

    const canonical = conversationStore.getSession(sessionId);
    if (canonical) {
      return {
        id: canonical.id,
        agentId: canonical.engine.id,
        workspaceId: canonical.workspaceId,
        title: canonical.title,
        status: canonical.status === 'offline' ? 'paused' : 'active',
        createdAt: canonical.createdAt,
        updatedAt: canonical.updatedAt,
        messageCount: canonical.conversation.turns.length,
        lastActivityTime: 'Just now',
      };
    }
    return undefined;
  }

  async getAgentSessions(agentId: string): Promise<Session[]> {
    const existing = this.fallbackSessions.filter(s => s.agentId === agentId);
    if (existing.length > 0) return existing;

    // Check canonical ConversationStore
    const canonicalList = conversationStore.getSessionsForAgent(agentId);
    if (canonicalList.length > 0) {
      const mapped: Session[] = canonicalList.map(c => ({
        id: c.id,
        agentId: c.engine.id,
        workspaceId: c.workspaceId,
        title: c.title,
        status: c.status === 'offline' ? 'paused' : 'active',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messageCount: c.conversation.turns.length,
        lastActivityTime: 'Just now',
      }));
      for (const s of mapped) {
        if (!this.fallbackSessions.some(e => e.id === s.id)) {
          this.fallbackSessions.push(s);
        }
      }
      this.saveToStorage();
      return mapped;
    }

    return [];
  }

  async restoreSession(sessionId: string, agentId?: string, workspaceId?: string, title?: string): Promise<Session> {
    let existing = this.fallbackSessions.find(s => s.id === sessionId);
    if (existing) {
      existing.status = 'active';
      existing.updatedAt = Date.now();
      this.saveToStorage();
      return existing;
    }

    const canonical = conversationStore.getSession(sessionId);
    const restored: Session = {
      id: sessionId,
      agentId: agentId || canonical?.engine?.id || sessionId,
      workspaceId: workspaceId || canonical?.workspaceId || 'default',
      title: title || canonical?.title || 'Interactive Session',
      status: 'active',
      createdAt: canonical?.createdAt || Date.now(),
      updatedAt: Date.now(),
      messageCount: canonical?.conversation.turns.length || 0,
      lastActivityTime: 'Just now',
    };

    this.fallbackSessions.push(restored);
    if (!this.messages[sessionId]) {
      this.messages[sessionId] = [];
    }
    this.saveToStorage();
    return restored;
  }

  async createSession(agentId: string, workspaceId: string, title?: string): Promise<Session> {
    const sessionCount = this.fallbackSessions.filter(s => s.agentId === agentId).length + 1;
    const pad = sessionCount < 10 ? `0${sessionCount}` : `${sessionCount}`;
    const newSession: Session = {
      id: `sess-${agentId}-${Date.now().toString().slice(-4)}`,
      agentId,
      workspaceId,
      title: title || `Session ${pad} — Interactive CLI`,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      lastActivityTime: 'Just now',
    };

    if (isTauriAvailable()) {
      try {
        await tauriService.createSession(newSession);
      } catch (e) {
        console.warn('Tauri createSession failed', e);
      }
    }

    this.fallbackSessions.push(newSession);
    this.messages[newSession.id] = [];
    this.saveToStorage();
    return newSession;
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    return this.messages[sessionId] || [];
  }

  async addMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const newMessage: Message = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };

    if (!this.messages[message.sessionId]) {
      this.messages[message.sessionId] = [];
    }
    this.messages[message.sessionId].push(newMessage);

    const session = this.fallbackSessions.find(s => s.id === message.sessionId);
    if (session) {
      session.messageCount = this.messages[message.sessionId].length;
      session.updatedAt = Date.now();
      session.lastActivityTime = 'Just now';
    }

    this.saveToStorage();
    return newMessage;
  }
}

export const sessionService = new HybridSessionService();
