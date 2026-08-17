import { Agent, AgentProvider, AgentStatus, Message } from '../types/orbit';
import { INITIAL_AGENTS, AVAILABLE_AGENT_PRESETS } from '../mock/agents';

export interface IAgentService {
  getAgents(workspaceId: string): Promise<Agent[]>;
  addAgent(workspaceId: string, provider: AgentProvider, customName?: string, customModel?: string): Promise<Agent>;
  removeAgent(agentId: string): Promise<void>;
  updateAgentStatus(agentId: string, status: AgentStatus): Promise<Agent>;
  sendMessage(sessionId: string, agentId: string, content: string): Promise<Message>;
}

export class MockAgentService implements IAgentService {
  private agents: Agent[] = [...INITIAL_AGENTS];

  async getAgents(workspaceId: string): Promise<Agent[]> {
    return this.agents.filter(a => a.workspaceId === workspaceId);
  }

  async addAgent(workspaceId: string, provider: AgentProvider, customName?: string, customModel?: string): Promise<Agent> {
    const preset = AVAILABLE_AGENT_PRESETS.find(p => p.provider === provider);
    const newAgent: Agent = {
      id: `agent-${provider}-${Date.now().toString().slice(-4)}`,
      workspaceId,
      provider,
      name: customName || preset?.name || provider.toUpperCase(),
      model: customModel || preset?.model || 'Default Model',
      status: 'ready',
      createdAt: Date.now(),
    };
    this.agents.push(newAgent);
    return newAgent;
  }

  async removeAgent(agentId: string): Promise<void> {
    this.agents = this.agents.filter(a => a.id !== agentId);
  }

  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<Agent> {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) throw new Error('Agent not found');
    agent.status = status;
    return { ...agent };
  }

  async sendMessage(sessionId: string, agentId: string, content: string): Promise<Message> {
    // Generate realistic simulated developer response based on input
    const lower = content.toLowerCase();
    let reply = "I've analyzed the request and inspected the relevant source files.";
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
      reply = `Processing task: "${content}". I am reviewing the project context and architecture definitions.`;
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
