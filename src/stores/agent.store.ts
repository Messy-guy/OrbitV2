import { create } from 'zustand';
import { Agent, AgentProvider, AgentStatus, Message, Session, AgentGridTileLayout, TerminalLine } from '../types/orbit';
import { agentService, sessionService, tauriService, isTauriAvailable } from '../services';
import { useSettingsStore } from './settings.store';
import { useSkillStore } from './skill.store';

interface AgentState {
  agents: Agent[];
  sessions: Record<string, Session[]>; // agentId -> Session[]
  activeSessionIdByAgent: Record<string, string>; // agentId -> sessionId
  messages: Record<string, Message[]>; // sessionId -> Message[]
  terminalLogs: Record<string, TerminalLine[]>; // agentId -> TerminalLine[]
  gridLayouts: AgentGridTileLayout[];
  isLoading: boolean;
  isEventListenerInitialized: boolean;

  // Actions
  initializeEventListeners: () => void;
  loadAgentsForWorkspace: (workspaceId: string, projectPath?: string) => Promise<void>;
  addAgent: (
    workspaceId: string,
    provider: AgentProvider,
    customName?: string,
    customModel?: string,
    projectPath?: string,
    spaceId?: string,
    profileId?: string,
    initialRole?: import('../types/orbit').AgentRoleType,
    parentId?: string,
    workerType?: 'test' | 'code' | 'audit' | 'shell' | 'custom',
    taskDirective?: string
  ) => Promise<Agent>;
  forkWorker: (
    parentAgentId: string,
    workerType: 'test' | 'code' | 'audit' | 'shell',
    taskDirective?: string
  ) => Promise<Agent | null>;
  removeAgent: (agentId: string) => Promise<void>;
  setAgentStatus: (agentId: string, status: AgentStatus) => Promise<void>;
  setAgentRole: (agentId: string, role: import('../types/orbit').AgentRoleType) => void;
  toggleAgentViewMode: (agentId: string) => void;
  setActiveSession: (agentId: string, sessionId: string) => void;
  createNewSession: (agentId: string, workspaceId: string, title?: string) => Promise<Session>;
  loadMessagesForSession: (sessionId: string) => Promise<void>;
  sendMessage: (agentId: string, sessionId: string, content: string, projectPath?: string, workspaceId?: string) => Promise<void>;
  sendTerminalCommand: (agentId: string, command: string, projectPath?: string, workspaceId?: string) => Promise<void>;
  broadcastCommand: (command: string, targetAgentIds?: string[], projectPath?: string, workspaceId?: string) => Promise<void>;
  resizeTerminal: (agentId: string, rows: number, cols: number) => Promise<void>;
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
  terminalLogs: {},
  gridLayouts: [],
  isLoading: false,
  isEventListenerInitialized: false,

  initializeEventListeners: () => {
    if (get().isEventListenerInitialized || !isTauriAvailable()) return;

    // Listen to real-time stdout/stderr from Tauri Rust PTY runtime
    tauriService.onAgentOutput((payload) => {
      const { agentId, stream, text } = payload;
      const newLine: TerminalLine = {
        id: `t-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: stream as any,
        text,
        timestamp: payload.timestamp || Date.now(),
      };

      set((state) => ({
        terminalLogs: {
          ...state.terminalLogs,
          [agentId]: [...(state.terminalLogs[agentId] || []), newLine],
        },
      }));
    });

    // Listen to PTY session status updates (started, stopped, ready, error)
    tauriService.onAgentStatus((payload) => {
      const { agentId, status, pid } = payload;
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId
            ? {
                ...a,
                status: (status as AgentStatus) || a.status,
                pid: pid !== undefined ? pid : a.pid,
              }
            : a
        ),
      }));
    });

    set({ isEventListenerInitialized: true });
  },

  loadAgentsForWorkspace: async (workspaceId: string, projectPath?: string) => {
    get().initializeEventListeners();
    set({ isLoading: true });
    try {
      const rawAgents = await agentService.getAgents(workspaceId);
      const agents: Agent[] = rawAgents.map((a, idx) => ({
        ...a,
        viewMode: a.viewMode || 'terminal',
        pid: a.pid || (3200 + idx * 42),
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

        // If in Tauri desktop mode and workspace path exists, spawn PTY session
        if (isTauriAvailable() && projectPath && activeSess) {
          agentService.startAgentProcess(
            projectPath,
            agent.id,
            activeSess,
            agent.provider,
            undefined,
            workspaceId,
            undefined,
            undefined,
            agent.profileId
          ).then((pid) => {
            set((state) => ({
              agents: state.agents.map((a) => (a.id === agent.id ? { ...a, pid } : a)),
            }));
          }).catch((err) => {
            console.warn(`PTY session attach note for ${agent.name}:`, err);
          });
        }
      }

      // Compute grid layout
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

  addAgent: async (
    workspaceId: string,
    provider: AgentProvider,
    customName?: string,
    customModel?: string,
    projectPath?: string,
    spaceId?: string,
    profileId?: string,
    initialRole?: import('../types/orbit').AgentRoleType,
    parentId?: string,
    workerType?: 'test' | 'code' | 'audit' | 'shell' | 'custom',
    taskDirective?: string
  ) => {
    get().initializeEventListeners();
    const rawAgent = await agentService.addAgent(workspaceId, provider, customName, customModel, profileId);
    const newSession = await sessionService.createSession(rawAgent.id, workspaceId, `Session 01`);

    const newAgent: Agent = {
      ...rawAgent,
      spaceId: spaceId || 'default',
      profileId: profileId || 'default',
      role: initialRole || 'raw',
      parentId,
      workerType,
      taskDirective,
      currentSessionId: newSession.id,
      viewMode: 'terminal',
      pid: undefined,
    };

    set((state) => {
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
        terminalLogs: {
          ...state.terminalLogs,
          [newAgent.id]: [],
        },
        messages: {
          ...state.messages,
          [newSession.id]: [],
        },
        gridLayouts: [...state.gridLayouts, newLayout],
      };
    });

    // Synchronize initial role state to Rust backend before spawning process
    if (isTauriAvailable() && initialRole) {
      try {
        await tauriService.setAgentRole(newAgent.id, initialRole);
      } catch (err) {
        console.warn('Failed to pre-set agent role in Tauri PTY manager:', err);
      }
    }

    // Start real PTY process for the agent with isolated profile and initial taskDirective
    if (isTauriAvailable() && projectPath) {
      try {
        // Inherit custom skills configured in Settings for this mode
        const settings = useSettingsStore.getState();
        const customModeSkills = (initialRole && settings.modeCustomSkills[initialRole]) || [];
        const customModeDirective = (initialRole && settings.modeCustomDirectives[initialRole]) || '';

        // Combine taskDirective with settings custom directive if present
        let combinedDirective = taskDirective?.trim() || '';
        if (customModeDirective.trim()) {
          combinedDirective = combinedDirective 
            ? `${combinedDirective}\n[MODE SETTINGS RULE]: ${customModeDirective.trim()}`
            : `[MODE SETTINGS RULE]: ${customModeDirective.trim()}`;
        }

        const realPid = await agentService.startAgentProcess(
          projectPath,
          newAgent.id,
          newSession.id,
          newAgent.provider,
          combinedDirective || undefined,
          workspaceId,
          undefined,
          undefined,
          profileId,
          initialRole
        );
        set((state) => ({
          agents: state.agents.map((a) => (a.id === newAgent.id ? { ...a, pid: realPid } : a)),
        }));

        // Mount native progressive-disclosure skills into .agents/skills or .claude/skills
        if (customModeSkills.length > 0) {
          try {
            const { ProviderSkillAdapterService } = await import('../services/providerSkillAdapter.service');
            await ProviderSkillAdapterService.mountSkillsForProvider(
              projectPath,
              newAgent.provider,
              customModeSkills
            );
          } catch (mountErr) {
            console.warn('Native progressive disclosure skill mounting notice:', mountErr);
          }

          const skillStore = useSkillStore.getState();
          for (const skill of customModeSkills) {
            await skillStore.equipSkillToAgent(newAgent.id, skill);
          }
        }
      } catch (e) {
        console.warn('Real PTY agent process launch error:', e);
      }
    }

    return newAgent;
  },

  forkWorker: async (
    parentAgentId: string,
    workerType: 'test' | 'code' | 'audit' | 'shell',
    taskDirective?: string
  ) => {
    const parent = get().agents.find((a) => a.id === parentAgentId);
    if (!parent) return null;

    const roleMap: Record<string, import('../types/orbit').AgentRoleType> = {
      test: 'raw',
      code: 'implementer',
      audit: 'reviewer',
      shell: 'raw',
    };

    const roleTitles: Record<string, string> = {
      test: `Test Worker (${parent.name.slice(0, 10)})`,
      code: `Coder (${parent.name.slice(0, 10)})`,
      audit: `Auditor (${parent.name.slice(0, 10)})`,
      shell: `Shell (${parent.name.slice(0, 10)})`,
    };

    return await get().addAgent(
      parent.workspaceId,
      parent.provider,
      taskDirective ? taskDirective.slice(0, 24) : roleTitles[workerType],
      undefined,
      undefined,
      parent.spaceId,
      parent.profileId,
      roleMap[workerType],
      parent.id,
      workerType,
      taskDirective
    );
  },

  removeAgent: async (agentId: string) => {
    await agentService.stopAgentProcess(agentId);
    await agentService.removeAgent(agentId);
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== agentId),
      gridLayouts: state.gridLayouts.filter((l) => l.i !== agentId),
    }));
  },

  setAgentStatus: async (agentId: string, status: AgentStatus) => {
    await agentService.updateAgentStatus(agentId, status);
    set((state) => ({
      agents: state.agents.map((a) => (a.id === agentId ? { ...a, status } : a)),
    }));
  },

  setAgentRole: (agentId: string, role: import('../types/orbit').AgentRoleType) => {
    set((state) => ({
      agents: state.agents.map((a) => (a.id === agentId ? { ...a, role } : a)),
    }));

    // Synchronize role state to Rust backend & stream live mode invariant transition into PTY
    if (isTauriAvailable()) {
      tauriService.setAgentRole(agentId, role).catch((err) => {
        console.warn('Failed to set agent role in Tauri PTY manager:', err);
      });

      const roleDirectives: Record<string, string> = {
        architect: 'PLAN ARCHITECT (STRICT PLAN ONLY: You must only produce specifications, plans, and test contracts. Writing source code is forbidden).',
        implementer: 'TDD IMPLEMENTER (STRICT BUILDER: Write minimal, type-safe code to make failing tests turn green).',
        reviewer: 'CODE AUDITOR (STRICT AUDITOR: Audit git diffs, security vulnerabilities, and memory leaks).',
        raw: 'SHELL TERMINAL (Raw unconstrained mode).',
      };

      const directive = roleDirectives[role] || role;
      const transitionText = `\n[ORBIT OPERATING MODE SWITCHED TO: ${directive}]\n`;
      const activeSess = get().activeSessionIdByAgent[agentId] || 'default';
      tauriService.sendAgentInput(agentId, activeSess, transitionText).catch(() => {});
    }
  },

  toggleAgentViewMode: (agentId: string) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, viewMode: a.viewMode === 'chat' ? 'terminal' : 'chat' } : a
      ),
    }));
  },

  setActiveSession: (agentId: string, sessionId: string) => {
    set((state) => ({
      activeSessionIdByAgent: {
        ...state.activeSessionIdByAgent,
        [agentId]: sessionId,
      },
    }));
    get().loadMessagesForSession(sessionId);
  },

  createNewSession: async (agentId: string, workspaceId: string, title?: string) => {
    const newSession = await sessionService.createSession(agentId, workspaceId, title);
    set((state) => ({
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
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: msgs,
      },
    }));
  },

  sendMessage: async (agentId: string, sessionId: string, content: string, projectPath?: string, workspaceId?: string) => {
    // 1. Add User Message to session
    const userMsg = await sessionService.addMessage({
      sessionId,
      role: 'user',
      content,
    });

    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), userMsg],
      },
      agents: state.agents.map((a) => (a.id === agentId ? { ...a, status: 'working' } : a)),
    }));

    // If Tauri is available, write to real PTY stdin directly
    const targetAgent = get().agents.find((a) => a.id === agentId);
    if (isTauriAvailable() && targetAgent) {
      try {
        await agentService.sendAgentInput(agentId, sessionId, content);
        return;
      } catch (e) {
        // sendAgentInput failed — session may be dead. Restart it cleanly (no prompt),
        // then deliver the message after the TUI has had time to initialize.
        // NEVER pass user message content as `prompt` to startAgentProcess — that
        // would kill any existing session and spawn a new one with a potentially
        // multiline string that breaks TUI readline buffers (ENAMETOOLONG etc.).
        if (projectPath) {
          try {
            await agentService.startAgentProcess(
              projectPath,
              agentId,
              sessionId,
              targetAgent.provider,
              undefined, // No prompt — restart clean, send input separately
              workspaceId
            );
            // Wait for TUI to mount, then send the message via normal input path
            setTimeout(async () => {
              try {
                await agentService.sendAgentInput(agentId, sessionId, content);
              } catch (err) {
                console.warn('Delayed sendAgentInput after restart failed:', err);
              }
            }, 1500);
            return;
          } catch (err) {
            console.warn('Real agent launch error:', err);
          }
        }
      }
    }

    // Web preview simulation fallback ONLY when Tauri is not available
    if (!isTauriAvailable()) {
      setTimeout(async () => {
        const agentReply = await agentService.sendMessage(sessionId, agentId, content);
        await sessionService.addMessage(agentReply);

        set((state) => ({
          messages: {
            ...state.messages,
            [sessionId]: [...(state.messages[sessionId] || []), agentReply],
          },
          agents: state.agents.map((a) => (a.id === agentId ? { ...a, status: 'ready' } : a)),
        }));
      }, 800);
    }
  },

  sendTerminalCommand: async (agentId: string, command: string, projectPath?: string, workspaceId?: string) => {
    const sessionId = get().activeSessionIdByAgent[agentId] || get().sessions[agentId]?.[0]?.id;
    if (!sessionId) return;

    const trimmed = command.trim();
    if (trimmed === 'clear' || trimmed === '/clear') {
      get().clearTerminal(agentId);
      return;
    }

    // In native Tauri mode, send directly to PTY master
    const targetAgent = get().agents.find((a) => a.id === agentId);
    if (isTauriAvailable() && targetAgent) {
      try {
        await agentService.sendAgentInput(agentId, sessionId, command);
        return;
      } catch (e) {
        // If no active process, restart cleanly (no command as prompt) then send
        if (projectPath) {
          try {
            await agentService.startAgentProcess(
              projectPath,
              agentId,
              sessionId,
              targetAgent.provider,
              undefined, // No prompt — never pass command text as startup arg
              workspaceId
            );
            setTimeout(async () => {
              try {
                await agentService.sendAgentInput(agentId, sessionId, command);
              } catch (err) {
                console.warn('Tauri PTY delayed sendAgentInput error:', err);
              }
            }, 1500);
            return;
          } catch (err) {
            console.warn('Tauri PTY startAgentProcess error:', err);
          }
        }
      }
    }

    // Web preview simulation fallback ONLY when Tauri is not available
    if (!isTauriAvailable()) {
      const stdinLine: TerminalLine = {
        id: `stdin-${Date.now()}`,
        type: 'stdin',
        text: `$ ${command}`,
        timestamp: Date.now(),
      };

      set((state) => ({
        terminalLogs: {
          ...state.terminalLogs,
          [agentId]: [...(state.terminalLogs[agentId] || []), stdinLine],
        },
        agents: state.agents.map((a) => (a.id === agentId ? { ...a, status: 'working' } : a)),
      }));

      setTimeout(async () => {
        const response = await agentService.sendMessage(sessionId, agentId, command);
        const outLines: TerminalLine[] = [
          { id: `out-${Date.now()}-1`, type: 'stdout', text: response.content, timestamp: Date.now() },
        ];

        set((state) => ({
          terminalLogs: {
            ...state.terminalLogs,
            [agentId]: [...(state.terminalLogs[agentId] || []), ...outLines],
          },
          agents: state.agents.map((a) => (a.id === agentId ? { ...a, status: 'ready' } : a)),
        }));
      }, 600);
    }
  },

  broadcastCommand: async (command: string, targetAgentIds?: string[], projectPath?: string, workspaceId?: string) => {
    const allAgents = get().agents;
    const targets = targetAgentIds && targetAgentIds.length > 0
      ? allAgents.filter((a) => targetAgentIds.includes(a.id))
      : allAgents;

    if (targets.length === 0) return;

    // Send formatted input with trailing carriage return (\r) to trigger execution in PTY
    const cleanCmd = command.trim();
    if (!cleanCmd) return;
    const inputWithEnter = `${cleanCmd}\r`;
    await Promise.all(
      targets.map((agent) => get().sendTerminalCommand(agent.id, inputWithEnter, projectPath, workspaceId))
    );
  },

  resizeTerminal: async (agentId: string, rows: number, cols: number) => {
    if (isTauriAvailable()) {
      await agentService.resizeAgentTerminal(agentId, rows, cols);
    }
  },

  clearTerminal: (agentId: string) => {
    set((state) => ({
      terminalLogs: {
        ...state.terminalLogs,
        [agentId]: [],
      },
    }));
  },

  interruptAgent: (agentId: string) => {
    if (isTauriAvailable()) {
      agentService.interruptAgentProcess(agentId).catch(() => {});
    }
  },

  addDirectMessage: (sessionId: string, message: Message) => {
    set((state) => ({
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
