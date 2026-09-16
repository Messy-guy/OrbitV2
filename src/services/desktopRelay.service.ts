import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';
import { useAgentStore } from '../stores/agent.store';
import { useWorkspaceStore } from '../stores/workspace.store';
import { useSkillStore } from '../stores/skill.store';
import { isTauriAvailable, tauriService } from './tauri.service';
import { conversationStore } from './conversation/ConversationStore';
import { conversationCaptureService } from './conversation/ConversationCaptureService';
import { universalRemoteController } from './remoteControl';

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

  private statusListeners = new Set<(connected: boolean) => void>();

  isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  subscribeStatus(listener: (connected: boolean) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.isConnected());
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus(connected: boolean) {
    this.statusListeners.forEach((fn) => fn(connected));
  }

  connect(relayUrl?: string) {
    if (this.socket?.connected) return;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = true;

    const targetUrl = relayUrl || (import.meta as any).env?.VITE_API_URL || 'https://orbit-cloud-backend.onrender.com';

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
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        this.isConnecting = false;
        console.log('✅ [Desktop Relay] Connected to Live Relay! Socket ID:', this.socket?.id);
        this.notifyStatus(true);
        this.broadcastLiveTelemetry();
      });

      this.socket.on('disconnect', () => {
        this.isConnecting = false;
        this.notifyStatus(false);
      });

      this.socket.on('connect_error', (err) => {
        this.isConnecting = false;
        this.notifyStatus(false);
      });

      this.socket.on('desktop:request_telemetry', () => {
        this.broadcastLiveTelemetry();
      });

      // Track Mobile Attention State (§9, §39) for Foreground Suppression
      this.socket.on('mobile:attention_update', (attentionState: any) => {
        if (attentionState && attentionState.deviceId) {
          import('./notifications/PushGateway').then(({ pushGateway }) => {
            pushGateway.updateMobileAttention(attentionState);
          }).catch(() => {});
        }
      });

      // Secure Server-side Device Push Token Registration (§12, §13, §14)
      this.socket.on('mobile:register_push_token', (payload: any) => {
        if (payload && payload.token && payload.userId) {
          import('./notifications/DeviceRegistry').then(({ deviceRegistry }) => {
            deviceRegistry.registerDevice({
              userId: payload.userId,
              token: payload.token,
              platform: payload.platform || 'ios',
              appVersion: payload.appVersion,
              environment: payload.environment || 'development',
            });
          }).catch(() => {});
        }
      });

      // Handle mobile remote commands and conversation messages
      this.socket.on('desktop:execute_action', async (action: any) => {
        const actionType = String(action.type || action.action || '');
        const agentId = String(action.agentId || '');
        const payload = action.payload || action.data;

        if (actionType === 'SEND_INPUT' || actionType === 'SEND_MESSAGE') {
          const input = payload?.input || payload?.text;
          const requestId = String(action.requestId || action.id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
          const sessionId = String(action.sessionId || payload?.sessionId || agentId);

          if (input !== undefined && agentId) {
            const result = await universalRemoteController.deliverRemoteMessage({
              requestId,
              agentId,
              sessionId,
              message: String(input),
              projectId: action.projectId || payload?.projectId,
              timestamp: Date.now(),
            }).catch((e) => {
              console.warn('[Desktop Relay] Failed to deliver remote message via universalRemoteController:', e);
              return { success: false, sessionId, error: String(e) } as any;
            });
            if (result && result.success === false) {
              // Surface the failure: reconcile the streaming turn and mark the
              // session so mobile shows a failed state instead of an eternal
              // "thinking & working..." with no reply.
              console.error(
                `[SESSION] remote delivery failed session=${result.sessionId || sessionId}: ${result.error || 'unknown'}`
              );
              try {
                const { conversationStore: cs } = await import('./conversation/ConversationStore');
                cs.reconcileStreamingTurns(result.sessionId || sessionId);
                cs.setSessionStatus(result.sessionId || sessionId, 'error');
              } catch {}
            }
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
        } else if (actionType === 'APPROVE') {
          const decision = payload?.decision || 'APPROVE';
          const keystroke = decision === 'APPROVE' ? 'y\r' : 'n\r';
          const agent = useAgentStore.getState().agents.find((a) => a.id === agentId);
          const targetSessionId = agent?.currentSessionId || agentId;

          if (isTauriAvailable()) {
            const bytes = new TextEncoder().encode(keystroke);
            await tauriService.sendNativeTerminalInput(targetSessionId, bytes).catch(() => {
              return tauriService.sendAgentInput(agentId, targetSessionId, keystroke);
            });
          }

          conversationStore.setSessionStatus(targetSessionId, decision === 'APPROVE' ? 'working' : 'waiting');
          useAgentStore.getState().setAgentStatus(agentId, decision === 'APPROVE' ? 'working' : 'ready');
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

    const bindCurrentAgents = () => {
      const { agents, activeSessionIdByAgent } = useAgentStore.getState();
      const activeWs = useWorkspaceStore.getState().getActiveWorkspace();
      for (const a of agents) {
        const sessId = activeSessionIdByAgent[a.id] || a.currentSessionId || a.id;
        conversationCaptureService.bindSession(
          sessId,
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
    };

    // Bind current desktop agents immediately
    bindCurrentAgents();

    this.unsubscribeAgentStore = useAgentStore.subscribe(() => {
      bindCurrentAgents();
      this.scheduleSync();
    });

    // Authoritative conversation store sync: broadcasts streaming deltas and final completions to mobile
    this.unsubscribeConversationStore = conversationStore.subscribe(() => {
      this.scheduleSync();
    });

    if (isTauriAvailable()) {
      tauriService.onAgentOutput((payload) => {
        try {
          // Passive observer: route to session ID matching the agent
          const sessId = payload.sessionId || useAgentStore.getState().activeSessionIdByAgent[payload.agentId] || payload.agentId;
          conversationCaptureService.handlePtyOutput(sessId, payload.text);
          this.scheduleSync();
        } catch (err) {
          console.warn('[DesktopRelay] Passive conversation observer error (terminal unaffected):', err);
        }
      }).then((unlisten) => {
        this.unlistenTauriOutput = unlisten;
      });

      tauriService.onAgentStatus((payload) => {
        try {
          const sessId = payload.sessionId || useAgentStore.getState().activeSessionIdByAgent[payload.agentId] || payload.agentId;
          conversationCaptureService.handleProcessStatus(sessId, payload.status, payload.pid);
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

  private lastReconcileTime = 0;

  async reconcileLiveProcesses(force = false) {
    const now = Date.now();
    if (!force && now - this.lastReconcileTime < 5000) return;
    this.lastReconcileTime = now;

    if (isTauriAvailable()) {
      const canonicalSessions = conversationStore.getAllSessions();
      for (const session of canonicalSessions) {
        try {
          const isRunning = await tauriService.isAgentProcessRunning(session.engine?.id || session.id);
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
        const liveAgent = agents.find((a) => a.id === session.id || a.id === session.engine?.id || a.currentSessionId === session.id);
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
              // INV-9/10 — every mobile message carries its Orbit session and
              // turn identity so the mobile projection can reject foreign events.
              sessionId: session.id,
              turnId: turn.id,
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

        const equippedSkills = liveAgent ? useSkillStore.getState().getEquippedSkills(liveAgent.id) : [];

        return {
          id: session.id,
          name: session.engine.name || session.title,
          provider: session.engine.provider,
          role: liveAgent?.role || 'raw',
          operationalMode: liveAgent?.operationalMode || (liveAgent?.role === 'architect' ? 'plan' : liveAgent?.role === 'reviewer' ? 'audit' : 'code'),
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
          equippedSkills: equippedSkills.map((s) => ({
            id: s.id,
            name: s.name,
            shortLabel: s.shortLabel,
            category: s.category,
          })),
          runtime: {
            isAlive: isRuntimeLive,
            pid: session.runtime?.pid,
            lastHeartbeat: session.runtime?.lastHeartbeat,
          },
          terminalLogs: ['● Conversation mode active.'],
          updatedAt: session.updatedAt,
        };
      });

      // Also ensure all workspace agents from useAgentStore are represented in mappedAgents
      for (const agent of agents) {
        const alreadyMapped = mappedAgents.some(
          (m) => m.id === agent.id || m.id === agent.currentSessionId
        );
        if (!alreadyMapped) {
          const isAlive = agent.status === 'working' || agent.status === 'ready';
          mappedAgents.push({
            id: agent.id,
            name: agent.name,
            provider: agent.provider,
            role: agent.role || 'raw',
            operationalMode: (agent as any).operationalMode || (agent.role === 'architect' ? 'plan' : agent.role === 'reviewer' ? 'audit' : 'code'),
            workspaceId: agent.workspaceId || activeWorkspaceId || 'default_project',
            projectId: agent.workspaceId || activeWorkspaceId || 'default_project',
            status: (agent.status === 'ready' || !agent.status ? 'waiting' : agent.status === 'working' ? 'working' : 'offline') as any,
            isLive: isAlive,
            title: agent.name,
            preview: 'Ready for prompt',
            currentTaskDescription: 'Ready for prompt',
            chatHistory: [],
            conversation: { turns: [] },
            capabilities: { cancel: true, input: true } as any,
            equippedSkills: [],
            runtime: { isAlive, pid: undefined, lastHeartbeat: Date.now() },
            terminalLogs: ['● Agent ready.'],
            updatedAt: Date.now(),
          });
        }
      }

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

      const pendingApprovals: any[] = [];
      for (const session of canonicalSessions) {
        if (session.status === 'input_required') {
          for (const turn of session.conversation.turns) {
            const approvalActivity = turn.activities?.find((a) => a.category === 'approvals');
            if (approvalActivity) {
              const detail = approvalActivity.details?.[0];
              pendingApprovals.push({
                id: detail?.id || `app-${session.id}`,
                agentId: session.id,
                agentName: session.engine.name || session.title,
                provider: session.engine.provider || 'agent',
                question: approvalActivity.summary || 'Confirmation needed to proceed',
                commandSnippet: detail?.description || '',
                createdAt: approvalActivity.startedAt,
              });
            }
          }
        }
      }

      const packet = {
        projects,
        agents: mappedAgents,
        approvals: pendingApprovals,
        runtimeSnapshot,
        activeWorkspaceId,
        device: deviceMeta,
      };

      this.socket.emit('desktop:telemetry', packet);
    } catch (err) {
      console.warn('Failed to broadcast telemetry packet:', err);
    }
  }

  broadcastNotification(intent: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('desktop:notification', intent);
    }
  }
}

export const desktopRelayService = new DesktopRelayService();
