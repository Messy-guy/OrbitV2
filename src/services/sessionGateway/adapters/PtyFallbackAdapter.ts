import { ISessionAdapter, OrbitSessionCapabilities, OrbitSessionMessage } from '../types';
import { AgentProvider } from '../../../types/orbit';
import { isTauriAvailable, tauriService } from '../../tauri.service';

export class PtyFallbackAdapter implements ISessionAdapter {
  readonly provider: AgentProvider;
  readonly transport = 'pty';

  constructor(provider: AgentProvider = 'terminal') {
    this.provider = provider;
  }

  getCapabilities(): OrbitSessionCapabilities {
    return {
      sendMessage: true,
      resume: false,
      history: true,
      approvals: false,
      fileChanges: false,
      structuredEvents: false,
    };
  }

  async getHistory(agentId: string): Promise<OrbitSessionMessage[]> {
    if (isTauriAvailable()) {
      try {
        const raw = await tauriService.getAgentTerminalHistory(agentId);
        if (raw && raw.trim().length > 0) {
          const clean = raw.replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '').trim();
          return [{
            id: `pty-${agentId}-1`,
            agentId,
            sender: 'agent',
            content: clean,
            timestamp: Date.now(),
          }];
        }
      } catch {}
    }
    return [];
  }

  async sendMessage(agentId: string, message: string, _workspacePath?: string, nativeSessionId?: string): Promise<void> {
    if (isTauriAvailable()) {
      await tauriService.sendAgentInput(agentId, nativeSessionId || 'default', `${message}\r`);
    }
  }
}
