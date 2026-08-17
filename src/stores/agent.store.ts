import { create } from 'zustand';
import { Agent, AgentProvider, AgentStatus, Message, Session, AgentGridTileLayout } from '../types/orbit';
import { agentService, sessionService } from '../services';

interface AgentState {
  agents: Agent[];
  sessions: Record<string, Session[]>; // agentId -> Session[]
  activeSessionIdByAgent: Record<string, string>; // agentId -> sessionId
  messages: Record<string, Message[]>; // sessionId -> Message[]
  gridLayouts: AgentGridTileLayout[];
  isLoading: boolean;

  // Actions
  loadAgentsForWorkspace: (workspaceId: string) => Promise<void>;
  addAgent: (workspaceId: string, provider: AgentProvider, customName?: string, customModel?: string) => Promise<Agent>;
  removeAgent: (agentId: string) => Promise<void>;
  setAgentStatus: (agentId: string, status: AgentStatus) => Promise<void>;
  setActiveSession: (agentId: string, sessionId: string) => void;
  createNewSession: (agentId: string, workspaceId: string, title?: string) => Promise<Session>;
  loadMessagesForSession: (sessionId: string) => Promise<void>;
  sendMessage: (agentId: string, sessionId: string, content: string) => Promise<void>;
  addDirectMessage: (sessionId: string, message: Message) => void;
  updateGridLayouts: (layouts: AgentGridTileLayout[]) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  sessions: {},
  activeSessionIdByAgent: {},
  messages: {},
  gridLayouts: [],
  isLoading: false,

  loadAgentsForWorkspace: async (workspaceId: string) => {
    set({ isLoading: true });
    try {
      const agents = await agentService.getAgents(workspaceId);
      const sessionsMap: Record<string, Session[]> = {};
      const activeSessionMap: Record<string, string> = {};
      const messagesMap: Record<string, Message[]> = {};

      for (const agent of agents) {
        const agentSessions = await sessionService.getAgentSessions(agent.id);
        sessionsMap[agent.id] = agentSessions;
        
        const activeSess = agent.currentSessionId || agentSessions[0]?.id;
        if (activeSess) {
          activeSessionMap[agent.id] = activeSess;
          messagesMap[activeSess] = await sessionService.getMessages(activeSess);
        }
      }

      // Compute initial grid layout
      const gridLayouts: AgentGridTileLayout[] = agents.map((agent, index) => {
        const cols = 2;
        const col = index % cols;
        const row = Math.floor(index / cols);
        return {
          i: agent.id,
          x: col * 6,
          y: row * 6,
          w: 6,
          h: 6,
          minW: 3,
          minH: 4,
        };
      });

      set({
        agents,
        sessions: sessionsMap,
        activeSessionIdByAgent: activeSessionMap,
        messages: messagesMap,
        gridLayouts,
        isLoading: false,
      });
    } catch (e) {
      console.error('Failed to load agents for workspace', e);
      set({ isLoading: false });
    }
  },

  addAgent: async (workspaceId: string, provider: AgentProvider, customName?: string, customModel?: string) => {
    const newAgent = await agentService.addAgent(workspaceId, provider, customName, customModel);
    const newSession = await sessionService.createSession(newAgent.id, workspaceId, `Session 01 — Initialization`);
    
    newAgent.currentSessionId = newSession.id;

    set(state => {
      const existingCount = state.agents.length;
      const col = existingCount % 2;
      const row = Math.floor(existingCount / 2);
      
      const newLayout: AgentGridTileLayout = {
        i: newAgent.id,
        x: col * 6,
        y: row * 6,
        w: 6,
        h: 6,
        minW: 3,
        minH: 4,
      };

      return {
        agents: [...state.agents, newAgent],
        sessions: {
          ...state.sessions,
          [newAgent.id]: [newSession],
        },
        activeSessionIdByAgent: {
          ...state.activeSessionIdByAgent,
          [newAgent.id]: newSession.id,
        },
        messages: {
          ...state.messages,
          [newSession.id]: [
            {
              id: `msg-welcome-${Date.now()}`,
              sessionId: newSession.id,
              role: 'agent',
              content: `Ready. I'm connected to the workspace with ${newAgent.model}.`,
              timestamp: Date.now(),
            }
          ],
        },
        gridLayouts: [...state.gridLayouts, newLayout],
      };
    });

    return newAgent;
  },

  removeAgent: async (agentId: string) => {
    await agentService.removeAgent(agentId);
    set(state => ({
      agents: state.agents.filter(a => a.id !== agentId),
      gridLayouts: state.gridLayouts.filter(l => l.i !== agentId),
    }));
  },

  setAgentStatus: async (agentId: string, status: AgentStatus) => {
    await agentService.updateAgentStatus(agentId, status);
    set(state => ({
      agents: state.agents.map(a => (a.id === agentId ? { ...a, status } : a)),
    }));
  },

  setActiveSession: (agentId: string, sessionId: string) => {
    set(state => ({
      activeSessionIdByAgent: {
        ...state.activeSessionIdByAgent,
        [agentId]: sessionId,
      },
    }));
    get().loadMessagesForSession(sessionId);
  },

  createNewSession: async (agentId: string, workspaceId: string, title?: string) => {
    const newSession = await sessionService.createSession(agentId, workspaceId, title);
    set(state => ({
      sessions: {
        ...state.sessions,
        [agentId]: [newSession, ...(state.sessions[agentId] || [])],
      },
      activeSessionIdByAgent: {
        ...state.activeSessionIdByAgent,
        [agentId]: newSession.id,
      },
      messages: {
        ...state.messages,
        [newSession.id]: [],
      },
    }));
    return newSession;
  },

  loadMessagesForSession: async (sessionId: string) => {
    const msgs = await sessionService.getMessages(sessionId);
    set(state => ({
      messages: {
        ...state.messages,
        [sessionId]: msgs,
      },
    }));
  },

  sendMessage: async (agentId: string, sessionId: string, content: string) => {
    // 1. Add User Message
    const userMsg = await sessionService.addMessage({
      sessionId,
      role: 'user',
      content,
    });

    set(state => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), userMsg],
      },
      agents: state.agents.map(a => (a.id === agentId ? { ...a, status: 'working' } : a)),
    }));

    // 2. Simulate Agent Working -> Responding with mock tool actions
    setTimeout(async () => {
      const agentReply = await agentService.sendMessage(sessionId, agentId, content);
      await sessionService.addMessage(agentReply);

      set(state => ({
        messages: {
          ...state.messages,
          [sessionId]: [...(state.messages[sessionId] || []), agentReply],
        },
        agents: state.agents.map(a => (a.id === agentId ? { ...a, status: 'ready' } : a)),
      }));
    }, 900);
  },

  addDirectMessage: (sessionId: string, message: Message) => {
    set(state => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), message],
      },
    }));
  },

  updateGridLayouts: (layouts: AgentGridTileLayout[]) => {
    set({ gridLayouts: layouts });
  },
}));
