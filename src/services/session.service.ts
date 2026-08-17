import { Session, Message } from '../types/orbit';
import { INITIAL_SESSIONS } from '../mock/sessions';
import { INITIAL_MESSAGES } from '../mock/messages';

export interface ISessionService {
  getSessions(workspaceId: string): Promise<Session[]>;
  getSessionById(sessionId: string): Promise<Session | undefined>;
  getAgentSessions(agentId: string): Promise<Session[]>;
  createSession(agentId: string, workspaceId: string, title?: string): Promise<Session>;
  getMessages(sessionId: string): Promise<Message[]>;
  addMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message>;
}

export class MockSessionService implements ISessionService {
  private sessions: Session[] = [...INITIAL_SESSIONS];
  private messages: Record<string, Message[]> = { ...INITIAL_MESSAGES };

  async getSessions(workspaceId: string): Promise<Session[]> {
    return this.sessions.filter(s => s.workspaceId === workspaceId);
  }

  async getSessionById(sessionId: string): Promise<Session | undefined> {
    return this.sessions.find(s => s.id === sessionId);
  }

  async getAgentSessions(agentId: string): Promise<Session[]> {
    return this.sessions.filter(s => s.agentId === agentId);
  }

  async createSession(agentId: string, workspaceId: string, title?: string): Promise<Session> {
    const sessionCount = this.sessions.filter(s => s.agentId === agentId).length + 1;
    const pad = sessionCount < 10 ? `0${sessionCount}` : `${sessionCount}`;
    const newSession: Session = {
      id: `sess-${agentId}-${Date.now().toString().slice(-4)}`,
      agentId,
      workspaceId,
      title: title || `Session ${pad} — New Session`,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      lastActivityTime: 'Just now',
    };
    this.sessions.push(newSession);
    this.messages[newSession.id] = [];
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

    const session = this.sessions.find(s => s.id === message.sessionId);
    if (session) {
      session.messageCount = this.messages[message.sessionId].length;
      session.updatedAt = Date.now();
      session.lastActivityTime = 'Just now';
    }

    return newMessage;
  }
}
