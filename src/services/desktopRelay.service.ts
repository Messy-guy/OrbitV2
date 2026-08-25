import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';
import { useAgentStore } from '../stores/agent.store';
import { useWorkspaceStore } from '../stores/workspace.store';

class DesktopRelayService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private unsubscribeWorkspaceStore: (() => void) | null = null;
  private unsubscribeAgentStore: (() => void) | null = null;

  getRelayToken(): string {
    const { tokens, user } = useAuthStore.getState();
    return tokens?.accessToken || (user ? `orbit_dev_${user.id}` : 'orbit_dev_master_token');
  }

  connect() {
    const token = this.getRelayToken();
    if (this.socket?.connected || this.isConnecting) return;

    this.isConnecting = true;
    const relayUrl = (import.meta as any).env?.VITE_API_URL || 'http://192.168.18.60:3000';

    console.log(`🔗 [Orbit Desktop Relay] Connecting to ${relayUrl}/relay...`);

    this.socket = io(`${relayUrl}/relay`, {
      auth: { token: `Bearer ${token}` },
      query: { clientType: 'desktop' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnecting = false;
      console.log('✅ [Orbit Desktop Relay] Connected to Cloud Relay! Socket ID:', this.socket?.id);
      this.syncFullTelemetry();
      this.setupStoreSubscribers();
    });

    this.socket.on('desktop:request_telemetry', () => {
      console.log('📡 [Orbit Desktop Relay] Telemetry requested by mobile client');
      this.syncFullTelemetry();
    });

    this.socket.on('disconnect', () => {
      this.isConnecting = false;
      console.log('🔌 [Orbit Desktop Relay] Disconnected from Cloud Relay');
    });

    // Handle remote actions dispatched from mobile phone
    this.socket.on('desktop:execute_action', async (payload: { action: string; agentId?: string; projectId?: string; data?: any }) => {
      console.log('📱 [Orbit Desktop Relay] Received remote action from mobile:', payload);
      const agentStore = useAgentStore.getState();
      const workspaceStore = useWorkspaceStore.getState();

      const activeWs = workspaceStore.getActiveWorkspace();

      if (payload.action === 'PAUSE' && payload.agentId) {
        await agentStore.setAgentStatus(payload.agentId, 'paused').catch(() => {});
        this.syncFullTelemetry();
      } else if (payload.action === 'STOP' && payload.agentId) {
        await agentStore.setAgentStatus(payload.agentId, 'ready').catch(() => {});
        this.syncFullTelemetry();
      } else if (payload.action === 'EMERGENCY_STOP_ALL') {
        const { agents } = agentStore;
        for (const a of agents) {
          if (a.status === 'working') {
            await agentStore.setAgentStatus(a.id, 'paused').catch(() => {});
          }
        }
        this.syncFullTelemetry();
      } else if (payload.action === 'SEND_INPUT' && payload.agentId && payload.data?.input) {
        agentStore.sendTerminalCommand(
          payload.agentId,
          `${payload.data.input}\r`,
          activeWs?.projectPath,
          activeWs?.id
        );
      }
    });
  }

  setupStoreSubscribers() {
    if (this.unsubscribeWorkspaceStore) this.unsubscribeWorkspaceStore();
    if (this.unsubscribeAgentStore) this.unsubscribeAgentStore();

    this.unsubscribeWorkspaceStore = useWorkspaceStore.subscribe((state, prevState) => {
      if (state.workspaces !== prevState.workspaces || state.activeWorkspaceId !== prevState.activeWorkspaceId) {
        this.syncFullTelemetry();
      }
    });

    this.unsubscribeAgentStore = useAgentStore.subscribe((state, prevState) => {
      if (state.agents !== prevState.agents) {
        this.syncFullTelemetry();
      }
    });
  }

  disconnect() {
    if (this.unsubscribeWorkspaceStore) {
      this.unsubscribeWorkspaceStore();
      this.unsubscribeWorkspaceStore = null;
    }
    if (this.unsubscribeAgentStore) {
      this.unsubscribeAgentStore();
      this.unsubscribeAgentStore = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
    }
  }

  syncFullTelemetry() {
    if (!this.socket?.connected) return;

    const { agents, terminalLogs } = useAgentStore.getState();
    const { workspaces, activeWorkspaceId } = useWorkspaceStore.getState();

    const telemetryPacket = {
      workstations: [{ id: 'ws-main', name: 'Desktop Host' }],
      activeWorkspaceId,
      projects: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        projectPath: w.projectPath,
        gitBranch: 'main',
        activeAgentsCount: agents.filter((a) => a.workspaceId === w.id && (a.status === 'working' || a.status === 'ready')).length,
        filesModifiedCount: 0,
        failingTestsCount: 0,
        contextFreshnessPercentage: 95,
        lastActivitySummary: `${agents.filter((a) => a.workspaceId === w.id).length} agents active in workspace`,
        updatedAt: Date.now(),
      })),
      agents: agents.map((a) => {
        const logs = terminalLogs?.[a.id] || [];
        const recentLogs = logs.slice(-30).map((line) => line.text || '');

        return {
          id: a.id,
          name: a.name,
          provider: a.provider,
          profileId: a.profileId,
          role: a.role || 'raw',
          status: a.status,
          currentTaskDescription: a.status === 'working' ? 'Processing instructions' : 'Idle and ready',
          terminalLogs: recentLogs,
          tokensUsed: 1200,
          filesTouchedCount: 2,
          runtimeSeconds: 320,
          requiresAttention: false,
          updatedAt: Date.now(),
        };
      }),
    };

    console.log('📡 [Orbit Desktop Relay] Pushing live telemetry:', {
      projectsCount: telemetryPacket.projects.length,
      agentsCount: telemetryPacket.agents.length,
    });
    this.socket.emit('desktop:telemetry', telemetryPacket);
  }
}

export const desktopRelayService = new DesktopRelayService();
