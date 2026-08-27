import { AgentProvider } from '../../types/orbit';
import { ISessionAdapter, OrbitSession, OrbitSessionCapabilities, OrbitSessionMessage } from './types';
import { AntigravityAdapter } from './adapters/AntigravityAdapter';
import { ClaudeAdapter } from './adapters/ClaudeAdapter';
import { PtyFallbackAdapter } from './adapters/PtyFallbackAdapter';

class SessionGateway {
  private adapters: Map<AgentProvider, ISessionAdapter> = new Map();
  private fallbackAdapter: ISessionAdapter = new PtyFallbackAdapter();

  constructor() {
    this.registerAdapter(new AntigravityAdapter());
    this.registerAdapter(new ClaudeAdapter());
  }

  registerAdapter(adapter: ISessionAdapter) {
    this.adapters.set(adapter.provider, adapter);
  }

  getAdapter(provider: AgentProvider): ISessionAdapter {
    return this.adapters.get(provider) || this.fallbackAdapter;
  }

  getCapabilities(provider: AgentProvider): OrbitSessionCapabilities {
    return this.getAdapter(provider).getCapabilities();
  }

  async getSessionHistory(
    agentId: string,
    provider: AgentProvider,
    workspacePath?: string,
    nativeSessionId?: string
  ): Promise<OrbitSessionMessage[]> {
    const adapter = this.getAdapter(provider);
    return adapter.getHistory(agentId, workspacePath, nativeSessionId);
  }

  async sendMessage(
    agentId: string,
    provider: AgentProvider,
    message: string,
    workspacePath?: string,
    nativeSessionId?: string
  ): Promise<void> {
    const adapter = this.getAdapter(provider);
    return adapter.sendMessage(agentId, message, workspacePath, nativeSessionId);
  }

  async resumeSession(
    agentId: string,
    provider: AgentProvider,
    nativeSessionId: string,
    workspacePath?: string
  ): Promise<void> {
    const adapter = this.getAdapter(provider);
    if (adapter.resumeSession) {
      return adapter.resumeSession(agentId, nativeSessionId, workspacePath);
    }
  }
}

export const sessionGateway = new SessionGateway();
