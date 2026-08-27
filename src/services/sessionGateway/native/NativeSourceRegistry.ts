import { AgentProvider } from '../../../types/orbit';
import { OrbitSessionMessage } from '../types';
import { AntigravityNativeSource } from './AntigravityNativeSource';

export class NativeSourceRegistry {
  static isTier1(provider: AgentProvider | string): boolean {
    const p = provider.toLowerCase();
    return p === 'antigravity' || p === 'claude' || p === 'opencode';
  }

  static async getNativeHistory(
    provider: AgentProvider | string,
    agentId: string,
    workspacePath?: string,
    _sessionId?: string
  ): Promise<OrbitSessionMessage[] | null> {
    const p = provider.toLowerCase();

    if (p === 'antigravity') {
      const msgs = await AntigravityNativeSource.loadHistory(agentId, workspacePath);
      if (msgs.length > 0) return msgs;
    }

    return null;
  }
}
