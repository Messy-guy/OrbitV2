import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';
import { useAgentStore } from '../stores/agent.store';
import { useWorkspaceStore } from '../stores/workspace.store';

class DesktopRelayService {
  private socket: Socket | null = null;
  private isConnecting = false;

  connect() {
    const { tokens, isAuthenticated, user } = useAuthStore.getState();
    const token = tokens?.accessToken || (user ? `orbit_dev_${user.id}` : 'orbit_dev_master_token');
    if (!isAuthenticated || this.socket?.connected || this.isConnecting) return;

    this.isConnecting = true;
    const relayUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

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
      console.log('🔗 [Orbit Desktop Relay] Connected to Cloud Relay');
      this.syncFullTelemetry();
    });

    this.socket.on('desktop:request_telemetry', () => {
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
        agentStore.setAgentStatus(payload.agentId, 'paused').catch(() => {});
      } else if (payload.action === 'STOP' && payload.agentId) {
        agentStore.setAgentStatus(payload.agentId, 'ready').catch(() => {});
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

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
    }
  }

  syncFullTelemetry() {
    if (!this.socket?.connected) return;

    const { agents } = useAgentStore.getState();
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
        lastActivitySummary: `${agents.filter((a) => a.workspaceId === w.id).length} agents configured`,
        updatedAt: Date.now(),
      })),
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        provider: a.provider,
        profileId: a.profileId,
        role: a.role || 'raw',
        status: a.status,
        currentTaskDescription: a.status === 'working' ? 'Processing active instructions' : 'Idle and ready',
        tokensUsed: 1200,
        filesTouchedCount: 2,
        runtimeSeconds: 320,
        requiresAttention: false,
        updatedAt: Date.now(),
      })),
    };

    this.socket.emit('desktop:telemetry', telemetryPacket);
  }
}

export const desktopRelayService = new DesktopRelayService();
