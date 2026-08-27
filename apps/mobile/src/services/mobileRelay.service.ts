import { io, Socket } from 'socket.io-client';
import { secureStorage } from './secureStorage';
import { MobileProjectSummary, MobileAgentDetail, MobileAgentChatMessage } from '../types/orbit';
import { useLiveRelayStore } from '../stores/liveRelay.store';

export interface ConnectedDeviceMetadata {
  deviceName: string;
  os: string;
  platform?: string;
  connectedAt?: number;
  ip?: string;
}

class MobileRelayService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private isExplicitlyDisconnected = false;

  async verifyAndConnect(inputCodeOrToken: string, relayUrlOverride?: string): Promise<{ success: boolean; error?: string; device?: ConnectedDeviceMetadata }> {
    const raw = inputCodeOrToken.trim();
    let token = '';
    let pairingCode = '';
    let relayUrl = relayUrlOverride || '';

    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        token = parsed.token || parsed.accessToken || '';
        relayUrl = parsed.relayUrl || relayUrl;
        pairingCode = parsed.code || '';
      } catch {
        return { success: false, error: 'Invalid QR code payload format.' };
      }
    } else if (/^\d{6}$/.test(raw)) {
      pairingCode = raw;
      token = `orbit_dev_${raw}`;
    } else {
      token = raw;
    }

    const targetRelay = relayUrl || (await secureStorage.getRelayUrl()) || process.env.EXPO_PUBLIC_API_URL || 'http://192.168.18.60:3000';

    return new Promise((resolve) => {
      let resolved = false;
      const testSocket = io(`${targetRelay}/relay`, {
        auth: { 
          token: token ? `Bearer ${token}` : undefined,
          pairingCode: pairingCode || undefined,
        },
        query: { 
          clientType: 'mobile',
          pairingCode: pairingCode || undefined,
        },
        transports: ['websocket', 'polling'],
        timeout: 5000,
      });

      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          testSocket.disconnect();
          resolve({ 
            success: false, 
            error: 'No response from workstation. Make sure Orbit Desktop is running and connected on the same network.' 
          });
        }
      }, 5000);

      testSocket.on('relay:pairing_result', (res: { success: boolean; error?: string; device?: ConnectedDeviceMetadata }) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          testSocket.disconnect();
          resolve(res);
        }
      });

      testSocket.on('connect_error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          testSocket.disconnect();
          resolve({ 
            success: false, 
            error: `Unable to reach ${targetRelay}: ${err.message}` 
          });
        }
      });
    });
  }

  async connect() {
    if (this.isExplicitlyDisconnected) {
      console.log('🛑 [Mobile Relay] Reconnect blocked: Device is explicitly unlinked');
      return;
    }

    const hasCreds = await secureStorage.hasCredentials();
    if (!hasCreds) {
      this.disconnect();
      return;
    }

    const token = await secureStorage.getAccessToken();
    const pairingCode = await secureStorage.getPairingCode();

    if (!token && !pairingCode) {
      this.disconnect();
      return;
    }
    if (this.socket?.connected || this.isConnecting) return;

    this.isConnecting = true;
    const customRelayUrl = await secureStorage.getRelayUrl();
    const relayUrl = customRelayUrl || process.env.EXPO_PUBLIC_API_URL || 'http://192.168.18.60:3000';

    try {
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      }

      this.socket = io(`${relayUrl}/relay`, {
        auth: { 
          token: token ? `Bearer ${token}` : undefined,
          pairingCode: pairingCode || undefined,
        },
        query: { 
          clientType: 'mobile',
          pairingCode: pairingCode || undefined,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        this.isConnecting = false;
        console.log('✅ [Mobile Relay] Connected to Live Relay! Socket ID:', this.socket?.id);
        useLiveRelayStore.getState().setConnectionStatus(true);
        this.socket?.emit('mobile:request_telemetry');
      });

      this.socket.on('relay:pairing_result', (res: { success: boolean; error?: string; device?: ConnectedDeviceMetadata }) => {
        if (!res.success) {
          useLiveRelayStore.getState().clearLiveState();
        } else if (res.device) {
          useLiveRelayStore.getState().setDevice(res.device);
        }
      });

      this.socket.on('connect_error', (err) => {
        this.isConnecting = false;
        console.warn('❌ [Mobile Relay] Socket connect_error:', err.message);
      });

      this.socket.on('disconnect', () => {
        this.isConnecting = false;
        console.log('🔌 [Mobile Relay] Disconnected from Live Relay');
        useLiveRelayStore.getState().clearLiveState();
      });

      this.socket.on('relay:desktop_status', (data: { online: boolean; device?: ConnectedDeviceMetadata }) => {
        if (data.online) {
          useLiveRelayStore.getState().setConnectionStatus(true);
          if (data.device) useLiveRelayStore.getState().setDevice(data.device);
        } else {
          useLiveRelayStore.getState().clearLiveState();
        }
      });

      // Pure real-time live telemetry stream
      this.socket.on('mobile:telemetry_update', (data: any) => {
        let resolvedDevice: ConnectedDeviceMetadata | undefined = data.device;
        if (!resolvedDevice && data.workstations && data.workstations[0]) {
          resolvedDevice = {
            deviceName: data.workstations[0].name,
            os: data.workstations[0].os || 'Desktop',
            platform: data.workstations[0].platform,
          };
        }

        useLiveRelayStore.getState().updateTelemetry({
          projects: data.projects || [],
          agents: data.agents || [],
          activeWorkspaceId: data.activeWorkspaceId,
          device: resolvedDevice,
        });
      });
    } catch (e) {
      this.isConnecting = false;
      console.error('[Mobile Relay] Connection setup failed:', e);
    }
  }

  async unpairAndDisconnect(): Promise<void> {
    this.isExplicitlyDisconnected = true;
    this.isConnecting = false;

    if (this.socket) {
      try {
        this.socket.emit('mobile:unpair');
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch {}
      this.socket = null;
    }

    await secureStorage.clearTokens();
    useLiveRelayStore.getState().clearLiveState();
  }

  resetExplicitDisconnect() {
    this.isExplicitlyDisconnected = false;
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    useLiveRelayStore.getState().clearLiveState();
  }

  sendAction(action: 'PAUSE' | 'STOP' | 'SEND_INPUT' | 'APPROVE' | 'EMERGENCY_STOP_ALL', agentId?: string, projectId?: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit('mobile:remote_action', { action, agentId, projectId, data });
    }
  }

  emergencyStopAll() {
    this.sendAction('EMERGENCY_STOP_ALL');
  }
}

export const mobileRelayService = new MobileRelayService();
