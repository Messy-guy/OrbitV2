export type AgentProvider =
  | 'claude'
  | 'codex'
  | 'opencode'
  | 'agy'
  | 'gemini'
  | 'aider'
  | 'kilo'
  | 'custom';

export type SessionStatus = 'working' | 'idle' | 'stopped';

export interface OrbitSession {
  id: string;
  name: string;
  provider: AgentProvider;
  executable: string;
  args: string[];
  cwd: string;
  pid?: number;
  status: SessionStatus;
  createdAt: string;
  lastActiveAt: string;
  logPath?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: 'architecture' | 'frontend' | 'backend' | 'security' | 'testing' | 'database';
  enabled: boolean;
  content: string;
  rules?: string[];
}

export interface HandoffPayload {
  fromSessionId: string;
  fromProvider: AgentProvider;
  toSessionId: string;
  toProvider: AgentProvider;
  taskSummary: string;
  decisions: string[];
  modifiedFiles: string[];
  gitBranch: string;
  gitDiffSummary: string;
  blockers: string[];
  timestamp: string;
}
