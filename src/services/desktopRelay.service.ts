import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';
import { useAgentStore } from '../stores/agent.store';
import { useWorkspaceStore } from '../stores/workspace.store';
import { isTauriAvailable, tauriService } from './tauri.service';
import { conversationStore } from './conversation/ConversationStore';
import { conversationCaptureService } from './conversation/ConversationCaptureService';

class DesktopRelayService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private unsubscribeWorkspaceStore: (() => void) | null = null;
  private unsubscribeAgentStore: (() => void) | null = null;
  private unsubscribeConversationStore: (() => void) | null = null;
  private unlistenTauriOutput: (() => void) | null = null;
  private unlistenTauriStatus: (() => void) | null = null;
  private syncThrottleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.unsubscribeConversationStore = conversationStore.subscribe(() => {
      this.scheduleSync();
    });
  }

  getRelayToken(): string {
    const { tokens, user } = useAuthStore.getState();
    return tokens?.accessToken || (user ? `orbit_dev_${user.id}` : 'orbit_dev_master_token');
  }

  getPairingCode(): string {
    const token = this.getRelayToken();
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash) + token.charCodeAt(i);
      hash |= 0;
    }
    const code = Math.abs(hash % 900000) + 100000;
    return code.toString();
  }

  getDeviceMetadata() {
    const isMac = navigator.userAgent.includes('Mac');
    const isWin = navigator.userAgent.includes('Win');
    const osType = isMac ? 'macos' : isWin ? 'windows' : 'linux';
    const osVersion = isMac ? 'macOS' : isWin ? 'Windows' : 'Linux';

    return {
      deviceName: `${osVersion} Studio`,
      platform: 'desktop' as const,
      os: osVersion,
      osType: osType as 'macos' | 'windows' | 'linux',
      osVersion,
      appVersion: '2.0.0',
      activeWorkspaceName: useWorkspaceStore.getState().getActiveWorkspace()?.name,
      activeWorkspacePath: useWorkspaceStore.getState().getActiveWorkspace()?.projectPath,
      connectedAt: Date.now(),
    };
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch {}
      this.socket = null;
    }
    this.isConnecting = false;
  }

  connect(relayUrl?: string) {
    if (this.socket?.connected || this.isConnecting) return;
    this.isConnecting = true;

    const targetUrl = relayUrl || (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

    try {
      this.socket = io(`${targetUrl}/relay`, {
        auth: {
          token: this.getRelayToken(),
          clientType: 'desktop',
          pairingCode: this.getPairingCode(),
          device: this.getDeviceMetadata(),
        },
        query: {
          clientType: 'desktop',
          pairingCode: this.getPairingCode(),
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        this.isConnecting = false;
        console.log('✅ [Desktop Relay] Connected to Live Relay! Socket ID:', this.socket?.id);
        this.broadcastLiveTelemetry();
      });

      this.socket.on('desktop:request_telemetry', () => {
        this.broadcastLiveTelemetry();
      });

      // Handle mobile remote commands and conversation messages
      this.socket.on('desktop:execute_action', async (action: any) => {
        const actionType = String(action.type || action.action || '');
        const agentId = String(action.agentId || '');
        const payload = action.payload || action.data;

        if (actionType === 'SEND_INPUT' || actionType === 'SEND_MESSAGE') {
          const input = payload?.input || payload?.text;
          if (input !== undefined && agentId) {
            await conversationCaptureService.submitUserMessage(agentId, String(input)).catch((e) => {
              console.warn('Failed to submit user message via conversation capture:', e);
            });
          }
        } else if (actionType === 'PAUSE' || actionType === 'KILL' || actionType === 'STOP') {
          if (isTauriAvailable()) {
            await tauriService.stopAgentSession(agentId).catch((e) => {
              console.warn('Failed to stop agent session:', e);
            });
          }
          conversationStore.setSessionStatus(agentId, actionType === 'PAUSE' ? 'waiting' : 'offline');
          useAgentStore.getState().setAgentStatus(agentId, actionType === 'PAUSE' ? 'paused' : 'ready');
        } else if (actionType === 'RESUME') {
          const agent = useAgentStore.getState().agents.find((a) => a.id === agentId);
          const activeWs = useWorkspaceStore.getState().getActiveWorkspace();
          if (agent && isTauriAvailable()) {
            const projPath = activeWs?.projectPath || '';
            const sessionId = agent.currentSessionId || agent.id;
            await tauriService.startAgentSession(
              projPath,
              agent.id,
              sessionId,
              agent.provider,
              agent.taskDirective,
              activeWs?.id,
              24,
              80,
              agent.profileId,
              agent.role
            ).catch((e) => {
              console.warn('Failed to resume agent session:', e);
            });
            conversationStore.setSessionStatus(agentId, 'working');
            useAgentStore.getState().setAgentStatus(agentId, 'working');
          }
        }
        this.scheduleSync();
      });

      this.socket.on('disconnect', () => {
        this.isConnecting = false;
      });

      this.setupStoreSubscribers();
    } catch (e) {
      this.isConnecting = false;
      console.error('Failed to connect to relay:', e);
    }
  }

  private setupStoreSubscribers() {
    this.unsubscribeWorkspaceStore = useWorkspaceStore.subscribe(() => {
      this.scheduleSync();
    });

    this.unsubscribeAgentStore = useAgentStore.subscribe(() => {
      // Ensure all current desktop agents are bound in the conversation capture service
      const { agents } = useAgentStore.getState();
      const activeWs = useWorkspaceStore.getState().getActiveWorkspace();
      for (const a of agents) {
        conversationCaptureService.bindSession(
          a.id,
          a.workspaceId || activeWs?.id || 'default_project',
          a.workspaceId || activeWs?.id || 'default_project',
          {
            id: a.id,
            name: a.name,
            provider: a.provider,
          },
          a.name
        );
      }
      this.scheduleSync();
    });

    // Authoritative conversation store sync: broadcasts streaming deltas and final completions to mobile
    this.unsubscribeConversationStore = conversationStore.subscribe(() => {
      this.scheduleSync();
    });

    if (isTauriAvailable()) {
      tauriService.onAgentOutput((payload) => {
        try {
          // Passive observer: never disrupts interactive terminal
          conversationCaptureService.handlePtyOutput(payload.agentId, payload.text);
          this.scheduleSync();
        } catch (err) {
          console.warn('[DesktopRelay] Passive conversation observer error (terminal unaffected):', err);
        }
      }).then((unlisten) => {
        this.unlistenTauriOutput = unlisten;
      });

      tauriService.onAgentStatus((payload) => {
        try {
          conversationCaptureService.handleProcessStatus(payload.agentId, payload.status, payload.pid);
          this.scheduleSync();
        } catch (err) {
          console.warn('[DesktopRelay] Process status observer error (terminal unaffected):', err);
        }
      }).then((unlisten) => {
        this.unlistenTauriStatus = unlisten;
      });
    }
  }

  private scheduleSync() {
    if (this.syncThrottleTimer) return;
    this.syncThrottleTimer = setTimeout(() => {
      this.syncThrottleTimer = null;
      this.broadcastLiveTelemetry();
    }, 200);
  }

  async reconcileLiveProcesses() {
    if (isTauriAvailable()) {
      const canonicalSessions = conversationStore.getAllSessions();
      for (const session of canonicalSessions) {
        try {
          const isRunning = await tauriService.isAgentProcessRunning(session.id);
          if (isRunning) {
            if (!session.runtime?.isAlive) {
              conversationStore.setRuntimeAlive(session.id, true);
            }
          } else {
            if (session.runtime?.isAlive || session.status === 'working') {
              conversationStore.setRuntimeAlive(session.id, false, undefined, 'offline');
            }
          }
        } catch {}
      }
    }
  }

  async broadcastLiveTelemetry() {
    if (!this.socket || !this.socket.connected) return;

    try {
      await this.reconcileLiveProcesses();
      const { workspaces, activeWorkspaceId } = useWorkspaceStore.getState();
      const { agents } = useAgentStore.getState();
      const canonicalSessions = conversationStore.getAllSessions();

      const projects = workspaces.map((w) => {
        const workspaceAgents = agents.filter((a) => a.workspaceId === w.id);
        const workspaceSessions = canonicalSessions.filter((s) => s.workspaceId === w.id || s.projectId === w.id);
        const activeCount = workspaceSessions.filter((s) => s.runtime?.isAlive && s.status === 'working').length;
        const liveCount = workspaceSessions.filter((s) => s.runtime?.isAlive && s.status !== 'offline').length;

        return {
          id: w.id,
          name: w.name,
          projectPath: w.projectPath,
          gitBranch: 'main',
          spacesCount: 1,
          spaces: [{ id: `space-${w.id}`, name: 'Primary Space', agentCount: workspaceAgents.length }],
          activeAgentsCount: activeCount,
          totalAgentsCount: workspaceSessions.length,
          filesModifiedCount: 0,
          failingTestsCount: 0,
          contextFreshnessPercentage: 98,
          lastActivitySummary:
            activeCount > 0
              ? `${activeCount} agents actively working`
              : liveCount > 0
              ? `${liveCount} agents ready`
              : 'Desktop idle · All agents offline',
          updatedAt: Date.now(),
        };
      });

      const deviceMeta = this.getDeviceMetadata();

      // Map sessions to canonical mobile representation
      const mappedAgents = canonicalSessions.map((session) => {
        // Find matching live agent store if present
        const liveAgent = agents.find((a) => a.id === session.id);
        const isRuntimeLive = !!session.runtime?.isAlive && session.status !== 'offline';
        const effectiveStatus = isRuntimeLive ? session.status : 'offline';

        // Map canonical turns into flat message stream for backwards compat and UI rendering
        const chatHistory: any[] = [];
        let previewText = '';

        for (const turn of session.conversation.turns) {
          for (const msg of turn.messages) {
            const rawContent = msg.content
              .map((c) => (c.type === 'text' ? c.text : c.type === 'markdown' ? c.markdown : c.type === 'code' ? c.code : c.path))
              .join('\n');

            if (rawContent.trim()) {
              previewText = rawContent.slice(0, 120);
            }

            const thoughtActivity = turn.activities?.find((a) => a.category === 'other');
            const toolActivity = turn.activities?.find((a) => a.category !== 'other');

            chatHistory.push({
              id: msg.id,
              agentId: session.id,
              sender: msg.role === 'user' ? 'user' : 'agent',
              content: rawContent,
              thought: thoughtActivity?.summary,
              toolCall: toolActivity
                ? {
                    toolName: toolActivity.summary,
                    summary: toolActivity.category,
                  }
                : undefined,
              activities: turn.activities,
              streaming: msg.streaming,
              timestamp: msg.createdAt,
            });
          }
        }

        return {
          id: session.id,
          name: session.engine.name || session.title,
          provider: session.engine.provider,
          role: liveAgent?.role || 'raw',
          workspaceId: session.workspaceId,
          projectId: session.projectId,
          status: effectiveStatus,
          isLive: isRuntimeLive,
          title: session.title,
          preview: previewText || 'Awaiting instructions...',
          currentTaskDescription:
            effectiveStatus === 'working'
              ? 'Processing instructions...'
              : effectiveStatus === 'waiting'
              ? 'Ready for prompt'
              : 'Offline · Previous conversation',
          chatHistory,
          conversation: session.conversation,
          capabilities: session.capabilities,
          runtime: {
            isAlive: isRuntimeLive,
            pid: session.runtime?.pid,
            lastHeartbeat: session.runtime?.lastHeartbeat,
          },
          terminalLogs: ['● Conversation mode active.'],
          updatedAt: session.updatedAt,
        };
      });

      const runtimeSnapshot = {
        generatedAt: Date.now(),
        desktopOnline: true,
        sessions: canonicalSessions.map((s) => ({
          sessionId: s.id,
          runtimeStatus: s.runtime?.isAlive && s.status !== 'offline' ? s.status : 'offline',
          isLive: !!s.runtime?.isAlive && s.status !== 'offline',
          processExists: !!s.runtime?.isAlive && s.status !== 'offline',
          pid: s.runtime?.pid,
          lastUpdatedAt: s.updatedAt,
        })),
      };

      const packet = {
        projects,
        agents: mappedAgents,
        runtimeSnapshot,
        activeWorkspaceId,
        device: deviceMeta,
      };

      this.socket.emit('desktop:telemetry', packet);
    } catch (err) {
      console.warn('Failed to broadcast telemetry packet:', err);
    }
  }
}

export const desktopRelayService = new DesktopRelayService();
