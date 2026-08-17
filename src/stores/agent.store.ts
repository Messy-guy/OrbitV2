import { create } from 'zustand';
import { Agent, AgentProvider, AgentStatus, Message, Session, AgentGridTileLayout, TerminalLine } from '../types/orbit';
import { agentService, sessionService } from '../services';
import { INITIAL_TERMINAL_LOGS } from '../mock/terminals';

interface AgentState {
  agents: Agent[];
  sessions: Record<string, Session[]>; // agentId -> Session[]
  activeSessionIdByAgent: Record<string, string>; // agentId -> sessionId
  messages: Record<string, Message[]>; // sessionId -> Message[]
  terminalLogs: Record<string, TerminalLine[]>; // agentId -> TerminalLine[]
  gridLayouts: AgentGridTileLayout[];
  isLoading: boolean;

  // Actions
  loadAgentsForWorkspace: (workspaceId: string) => Promise<void>;
  addAgent: (workspaceId: string, provider: AgentProvider, customName?: string, customModel?: string) => Promise<Agent>;
  removeAgent: (agentId: string) => Promise<void>;
  setAgentStatus: (agentId: string, status: AgentStatus) => Promise<void>;
  toggleAgentViewMode: (agentId: string) => void;
  setActiveSession: (agentId: string, sessionId: string) => void;
  createNewSession: (agentId: string, workspaceId: string, title?: string) => Promise<Session>;
  loadMessagesForSession: (sessionId: string) => Promise<void>;
  sendMessage: (agentId: string, sessionId: string, content: string) => Promise<void>;
  sendTerminalCommand: (agentId: string, command: string) => Promise<void>;
  clearTerminal: (agentId: string) => void;
  interruptAgent: (agentId: string) => void;
  addDirectMessage: (sessionId: string, message: Message) => void;
  updateGridLayouts: (layouts: AgentGridTileLayout[]) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  sessions: {},
  activeSessionIdByAgent: {},
  messages: {},
  terminalLogs: INITIAL_TERMINAL_LOGS,
  gridLayouts: [],
  isLoading: false,

  loadAgentsForWorkspace: async (workspaceId: string) => {
    set({ isLoading: true });
    try {
      const rawAgents = await agentService.getAgents(workspaceId);
      // Default viewMode to 'terminal' for AgentGrid style experience
      const agents: Agent[] = rawAgents.map((a, idx) => ({
        ...a,
        viewMode: a.viewMode || 'terminal',
        pid: 3200 + idx * 42,
      }));

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
    const rawAgent = await agentService.addAgent(workspaceId, provider, customName, customModel);
    const newSession = await sessionService.createSession(rawAgent.id, workspaceId, `Session 01 — Initialization`);
    
    const newAgent: Agent = {
      ...rawAgent,
      currentSessionId: newSession.id,
      viewMode: 'terminal',
      pid: 3200 + Math.floor(Math.random() * 5000),
    };

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

      const initialLogs: TerminalLine[] = [
        { id: `log-${Date.now()}-1`, type: 'system', text: `\x1b[1;37m[Orbit Harness]\x1b[0m Spawning ${newAgent.name} terminal runtime (PID ${newAgent.pid})...`, timestamp: Date.now() },
        { id: `log-${Date.now()}-2`, type: 'stdout', text: `Interactive CLI harness ready. Attached to ${workspaceId}.`, timestamp: Date.now() + 10 },
      ];

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
        terminalLogs: {
          ...state.terminalLogs,
          [newAgent.id]: initialLogs,
        },
        messages: {
          ...state.messages,
          [newSession.id]: [
            {
              id: `msg-welcome-${Date.now()}`,
              sessionId: newSession.id,
              role: 'agent',
              content: `Terminal harness connected with ${newAgent.model}.`,
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

  toggleAgentViewMode: (agentId: string) => {
    set(state => ({
      agents: state.agents.map(a => 
        a.id === agentId ? { ...a, viewMode: a.viewMode === 'chat' ? 'terminal' : 'chat' } : a
      ),
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

    // Also mirror to terminal log
    const userLog: TerminalLine = {
      id: `stdin-${Date.now()}`,
      type: 'stdin',
      text: `$ ${content}`,
      timestamp: Date.now(),
    };

    set(state => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), userMsg],
      },
      terminalLogs: {
        ...state.terminalLogs,
        [agentId]: [...(state.terminalLogs[agentId] || []), userLog],
      },
      agents: state.agents.map(a => (a.id === agentId ? { ...a, status: 'working' } : a)),
    }));

    // 2. Simulate Agent Working -> Responding with mock tool actions
    setTimeout(async () => {
      const agentReply = await agentService.sendMessage(sessionId, agentId, content);
      await sessionService.addMessage(agentReply);

      const agentLogs: TerminalLine[] = [
        { id: `out-${Date.now()}-1`, type: 'stdout', text: agentReply.content, timestamp: Date.now() },
      ];

      if (agentReply.toolInvocations) {
        agentReply.toolInvocations.forEach((t, i) => {
          agentLogs.push({
            id: `tool-${Date.now()}-${i}`,
            type: 'tool',
            text: `\x1b[36m[TOOL:${t.toolName}]\x1b[0m ${t.file || ''} ${t.output || '✓ Done'}`,
            timestamp: Date.now() + i * 5,
          });
        });
      }

      set(state => ({
        messages: {
          ...state.messages,
          [sessionId]: [...(state.messages[sessionId] || []), agentReply],
        },
        terminalLogs: {
          ...state.terminalLogs,
          [agentId]: [...(state.terminalLogs[agentId] || []), ...agentLogs],
        },
        agents: state.agents.map(a => (a.id === agentId ? { ...a, status: 'ready' } : a)),
      }));
    }, 900);
  },

  sendTerminalCommand: async (agentId: string, command: string) => {
    const sessionId = get().activeSessionIdByAgent[agentId] || get().sessions[agentId]?.[0]?.id;
    if (!sessionId) return;

    const trimmed = command.trim();
    if (trimmed === 'clear' || trimmed === '/clear') {
      get().clearTerminal(agentId);
      return;
    }

    // Append stdin line
    const stdinLine: TerminalLine = {
      id: `stdin-${Date.now()}`,
      type: 'stdin',
      text: `$ ${command}`,
      timestamp: Date.now(),
    };

    set(state => ({
      terminalLogs: {
        ...state.terminalLogs,
        [agentId]: [...(state.terminalLogs[agentId] || []), stdinLine],
      },
      agents: state.agents.map(a => (a.id === agentId ? { ...a, status: 'working' } : a)),
    }));

    setTimeout(async () => {
      const response = await agentService.sendMessage(sessionId, agentId, command);
      const outLines: TerminalLine[] = [
        { id: `out-${Date.now()}-1`, type: 'stdout', text: response.content, timestamp: Date.now() },
      ];

      if (response.toolInvocations) {
        response.toolInvocations.forEach((t, idx) => {
          outLines.push({
            id: `tool-${Date.now()}-${idx}`,
            type: 'tool',
            text: `\x1b[36m[TOOL:${t.toolName}]\x1b[0m ${t.file || ''} ${t.output || '✓ Done'}`,
            timestamp: Date.now() + idx * 5,
          });
        });
      }

      set(state => ({
        terminalLogs: {
          ...state.terminalLogs,
          [agentId]: [...(state.terminalLogs[agentId] || []), ...outLines],
        },
        agents: state.agents.map(a => (a.id === agentId ? { ...a, status: 'ready' } : a)),
      }));
    }, 700);
  },

  clearTerminal: (agentId: string) => {
    set(state => ({
      terminalLogs: {
        ...state.terminalLogs,
        [agentId]: [
          { id: `clr-${Date.now()}`, type: 'system', text: '\x1b[38;5;244mTerminal buffer cleared.\x1b[0m', timestamp: Date.now() }
        ],
      },
    }));
  },

  interruptAgent: (agentId: string) => {
    set(state => ({
      terminalLogs: {
        ...state.terminalLogs,
        [agentId]: [
          ...(state.terminalLogs[agentId] || []),
          { id: `sigint-${Date.now()}`, type: 'stderr', text: '^C\n[Process interrupted by SIGINT]', timestamp: Date.now() }
        ],
      },
      agents: state.agents.map(a => (a.id === agentId ? { ...a, status: 'ready' } : a)),
    }));
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
