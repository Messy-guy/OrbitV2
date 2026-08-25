import { io, Socket } from 'socket.io-client';
import { secureStorage } from './secureStorage';
import { MobileProjectSummary, MobileAgentDetail } from '../types/orbit';

type TelemetryListener = (data: { projects: MobileProjectSummary[]; agents: MobileAgentDetail[]; activeWorkspaceId?: string }) => void;

class MobileRelayService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private listeners: Set<TelemetryListener> = new Set();
  public latestState: { projects: MobileProjectSummary[]; agents: MobileAgentDetail[]; isDesktopOnline: boolean } = {
    projects: [],
    agents: [],
    isDesktopOnline: false,
  };

  async connect() {
    const token = await secureStorage.getAccessToken();
    if (!token) {
      console.log('⚠️ [Mobile Relay] No token found in SecureStore');
      return;
    }
    if (this.socket?.connected || this.isConnecting) return;

    this.isConnecting = true;
    const customRelayUrl = await secureStorage.getRelayUrl();
    const relayUrl = customRelayUrl || process.env.EXPO_PUBLIC_API_URL || 'http://192.168.18.60:3000';
    console.log(`🔗 [Mobile Relay] Connecting to ${relayUrl}/relay with token...`);

    try {
      if (this.socket) {
        this.socket.disconnect();
      }

      this.socket = io(`${relayUrl}/relay`, {
        auth: { token: `Bearer ${token}` },
        query: { clientType: 'mobile' },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        this.isConnecting = false;
        console.log('✅ [Mobile Relay] Connected to Cloud Tunnel! Socket ID:', this.socket?.id);
        this.socket?.emit('mobile:request_telemetry');
      });

      this.socket.on('connect_error', (err) => {
        this.isConnecting = false;
        console.warn('❌ [Mobile Relay] Socket connect_error:', err.message);
      });

      this.socket.on('disconnect', () => {
        this.isConnecting = false;
        this.latestState.isDesktopOnline = false;
        console.log('🔌 [Mobile Relay] Disconnected from Cloud Tunnel');
        this.notifyListeners(this.latestState);
      });

      this.socket.on('relay:desktop_status', (data: { online: boolean }) => {
        console.log('🖥️ [Mobile Relay] Desktop status received:', data);
        this.latestState.isDesktopOnline = data.online;
        this.notifyListeners(this.latestState);
      });

      // Real-time live telemetry piped directly from your laptop
      this.socket.on('mobile:telemetry_update', (data: any) => {
        console.log('📦 [Mobile Relay] Received live telemetry update from desktop:', {
          projectsCount: data?.projects?.length,
          agentsCount: data?.agents?.length,
        });
        if (data.projects) this.latestState.projects = data.projects;
        if (data.agents) this.latestState.agents = data.agents;
        this.latestState.isDesktopOnline = true;
        this.notifyListeners(data);
      });
    } catch (e) {
      this.isConnecting = false;
      console.error('[Mobile Relay] Connection setup failed:', e);
    }
  }

  sendAction(action: 'PAUSE' | 'STOP' | 'SEND_INPUT' | 'APPROVE' | 'EMERGENCY_STOP_ALL', agentId?: string, projectId?: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit('mobile:remote_action', { action, agentId, projectId, data });
    }
  }

  emergencyStopAll() {
    this.sendAction('EMERGENCY_STOP_ALL');
  }

  subscribe(listener: TelemetryListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(data: any) {
    this.listeners.forEach((fn) => fn(data));
  }
}

export const mobileRelayService = new MobileRelayService();
