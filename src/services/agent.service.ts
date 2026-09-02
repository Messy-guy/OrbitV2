import { Agent, AgentProvider, AgentStatus, Message } from '../types/orbit';
import { INITIAL_AGENTS, AVAILABLE_AGENT_PRESETS } from '../mock/agents';
import { isTauriAvailable, tauriService, DetectedAgentDto } from './tauri.service';

export interface IAgentService {
  getAgents(workspaceId: string): Promise<Agent[]>;
  addAgent(workspaceId: string, provider: AgentProvider, customName?: string, customModel?: string, profileId?: string): Promise<Agent>;
  removeAgent(agentId: string): Promise<void>;
  saveAgent(agent: Agent): Promise<void>;
  updateAgentStatus(agentId: string, status: AgentStatus): Promise<Agent>;
  detectInstalledAgents(): Promise<DetectedAgentDto[]>;
  startAgentProcess(
    workspacePath: string,
    agentId: string,
    sessionId: string,
    provider: AgentProvider,
    prompt?: string,
    workspaceId?: string,
    rows?: number,
    cols?: number,
    profileId?: string,
    role?: string
  ): Promise<number>;
  sendAgentInput(agentId: string, sessionId: string, input: string): Promise<void>;
  resizeAgentTerminal(agentId: string, rows: number, cols: number): Promise<void>;
  interruptAgentProcess(agentId: string): Promise<void>;
  stopAgentProcess(agentId: string): Promise<void>;
  sendMessage(sessionId: string, agentId: string, content: string): Promise<Message>;
}

export class HybridAgentService implements IAgentService {
  private fallbackAgents: Agent[] = [];

  async detectInstalledAgents(): Promise<DetectedAgentDto[]> {
    if (isTauriAvailable()) {
      try {
        const detected = await tauriService.detectAgents();
        if (detected && detected.length > 0) return detected;
      } catch (e) {
        console.warn('Tauri detectAgents failed', e);
      }
    }
    return AVAILABLE_AGENT_PRESETS.map(p => ({
      provider: p.provider,
      name: p.name,
      path: `/usr/local/bin/${p.provider}`,
      version: p.model,
      isAvailable: true,
      description: p.description,
    }));
  }

  async getAgents(workspaceId: string): Promise<Agent[]> {
    if (isTauriAvailable()) {
      try {
        const list = await tauriService.getWorkspaceAgents(workspaceId);
        if (list && list.length > 0) return list;
      } catch (e) {
        console.warn('Tauri getWorkspaceAgents failed, falling back', e);
      }
    }
    return this.fallbackAgents.filter(a => a.workspaceId === workspaceId);
  }

  async addAgent(workspaceId: string, provider: AgentProvider, customName?: string, customModel?: string, profileId?: string): Promise<Agent> {
    const preset = AVAILABLE_AGENT_PRESETS.find(p => p.provider === provider);
    const newAgent: Agent = {
      id: `agent-${provider}-${Date.now().toString().slice(-4)}`,
      workspaceId,
      provider,
      name: customName || preset?.name || provider.toUpperCase(),
      model: customModel || preset?.model || 'Default Model',
      profileId: profileId || 'default',
      status: 'ready',
      viewMode: 'terminal',
      pid: 3200 + Math.floor(Math.random() * 5000),
      createdAt: Date.now(),
    };

    if (isTauriAvailable()) {
      try {
        await tauriService.saveAgent(newAgent);
      } catch (e) {
        console.warn('Tauri saveAgent failed', e);
      }
    }

    this.fallbackAgents.push(newAgent);
    return newAgent;
  }

  async removeAgent(agentId: string): Promise<void> {
    if (isTauriAvailable()) {
      try {
        await tauriService.deleteAgent(agentId);
      } catch (e) {
        console.warn('Tauri deleteAgent failed', e);
      }
    }
    this.fallbackAgents = this.fallbackAgents.filter(a => a.id !== agentId);
  }

  async saveAgent(agent: Agent): Promise<void> {
    const idx = this.fallbackAgents.findIndex(a => a.id === agent.id);
    if (idx >= 0) {
      this.fallbackAgents[idx] = { ...agent };
    } else {
      this.fallbackAgents.push({ ...agent });
    }

    if (isTauriAvailable()) {
      try {
        await tauriService.saveAgent(agent);
      } catch (e) {
        console.warn('Tauri saveAgent failed', e);
      }
    }
  }

  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<Agent> {
    const agent = this.fallbackAgents.find(a => a.id === agentId);
    if (agent) {
      agent.status = status;
      if (isTauriAvailable()) {
        try {
          await tauriService.saveAgent(agent);
        } catch (e) {
          console.warn('Tauri updateAgentStatus failed', e);
        }
      }
      return { ...agent };
    }
    throw new Error('Agent not found');
  }

  async startAgentProcess(
    workspacePath: string,
    agentId: string,
    sessionId: string,
    provider: AgentProvider,
    prompt?: string,
    workspaceId?: string,
    rows?: number,
    cols?: number,
    profileId?: string,
    role?: string
  ): Promise<number> {
    if (isTauriAvailable()) {
      return await tauriService.startAgentSession(
        workspacePath,
        agentId,
        sessionId,
        provider,
        prompt,
        workspaceId,
        rows,
        cols,
        profileId,
        role
      );
    }
    return 4800 + Math.floor(Math.random() * 1000);
  }

  async sendAgentInput(agentId: string, sessionId: string, input: string): Promise<void> {
    if (isTauriAvailable()) {
      await tauriService.sendAgentInput(agentId, sessionId, input);
    }
  }

  async resizeAgentTerminal(agentId: string, rows: number, cols: number): Promise<void> {
    if (isTauriAvailable()) {
      await tauriService.resizeAgentTerminal(agentId, rows, cols);
    }
  }

  async interruptAgentProcess(agentId: string): Promise<void> {
    if (isTauriAvailable()) {
      await tauriService.interruptAgentSession(agentId);
    }
  }

  async stopAgentProcess(agentId: string): Promise<void> {
    if (isTauriAvailable()) {
      await tauriService.stopAgentSession(agentId);
    }
  }

  async sendMessage(sessionId: string, agentId: string, content: string): Promise<Message> {
    const lower = content.toLowerCase();
    let reply = "I've analyzed the request and inspected the workspace files.";
    const tools: any[] = [];

    if (lower.includes('reconnect') || lower.includes('socket') || lower.includes('playlist')) {
      reply = "I'll inspect the socket reconnection state flow and apply the missing handshake negotiation.";
      tools.push(
        { id: 't-' + Date.now() + '-1', toolName: 'read_file', file: 'src/socket/playlist.socket.ts', status: 'completed' },
        { id: 't-' + Date.now() + '-2', toolName: 'edit_file', file: 'src/store/playlist.store.ts', status: 'completed' },
        { id: 't-' + Date.now() + '-3', toolName: 'run_tests', file: 'tests/reconnect.spec.ts', status: 'completed', output: '✓ Reconnect suite: 4 tests passing' }
      );
    } else if (lower.includes('test') || lower.includes('check') || lower.includes('run')) {
      reply = "Running test suite against current codebase changes...";
      tools.push(
        { id: 't-' + Date.now() + '-1', toolName: 'run_tests', file: 'tests/socket.test.ts', status: 'completed', output: '✓ 14/14 tests passed in 0.85s' }
      );
    } else if (lower.includes('diff') || lower.includes('git') || lower.includes('status')) {
      reply = "Scanning git worktree for uncommitted changes in active modules.";
      tools.push(
        { id: 't-' + Date.now() + '-1', toolName: 'grep', file: 'src/server/websocket.server.ts', status: 'completed' }
      );
    } else {
      reply = `Processing task: "${content}". Reviewing project context and architecture definitions.`;
      tools.push(
        { id: 't-' + Date.now() + '-1', toolName: 'read_file', file: 'src/store/playlist.store.ts', status: 'completed' },
        { id: 't-' + Date.now() + '-2', toolName: 'edit_file', file: 'src/components/PlaylistView.tsx', status: 'completed' }
      );
    }

    return {
      id: `msg-${Date.now()}`,
      sessionId,
      role: 'agent',
      content: reply,
      toolInvocations: tools,
      timestamp: Date.now(),
    };
  }
}
