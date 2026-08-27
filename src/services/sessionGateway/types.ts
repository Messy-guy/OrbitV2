import { AgentProvider } from '../../types/orbit';

export type SessionTransportType = 'native' | 'protocol' | 'pty';

export interface OrbitSessionCapabilities {
  sendMessage: boolean;
  resume: boolean;
  history: boolean;
  approvals: boolean;
  fileChanges: boolean;
  structuredEvents: boolean;
}

export interface OrbitSessionMessage {
  id: string;
  agentId: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  thought?: string;
  toolCall?: {
    toolName: string;
    args?: string;
    summary?: string;
  };
  diffs?: Array<{
    oldPath?: string;
    newPath?: string;
    diffSummary?: string;
    addedLines?: number;
    deletedLines?: number;
  }>;
  timestamp: number;
}

export interface OrbitSession {
  id: string;
  agentId: string;
  workspaceId: string;
  provider: AgentProvider;
  nativeSessionId?: string;
  transport: SessionTransportType;
  capabilities: OrbitSessionCapabilities;
  status: 'active' | 'idle' | 'working' | 'paused' | 'resumable' | 'closed';
  messages: OrbitSessionMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ISessionAdapter {
  readonly provider: AgentProvider;
  readonly transport: SessionTransportType;
  getCapabilities(): OrbitSessionCapabilities;
  getHistory(agentId: string, workspacePath?: string, nativeSessionId?: string): Promise<OrbitSessionMessage[]>;
  sendMessage(agentId: string, message: string, workspacePath?: string, nativeSessionId?: string): Promise<void>;
  resumeSession?(agentId: string, nativeSessionId: string, workspacePath?: string): Promise<void>;
  pauseSession?(agentId: string): Promise<void>;
}
