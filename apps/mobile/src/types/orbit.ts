export type AgentProvider = 'antigravity' | 'claude' | 'codex' | 'opencode' | 'kilocode' | 'freebuff' | 'cline' | 'copilot' | 'goose' | 'kiro' | 'qwen' | 'mimo' | 'muse' | 'continue' | 'aider' | 'vibe' | 'qoder' | 'gemini' | 'terminal' | 'custom';
export type AgentStatus = 'working' | 'ready' | 'waiting' | 'starting' | 'paused' | 'error' | 'stopped' | 'offline' | 'completed';
export type SessionTransportType = 'native' | 'protocol' | 'pty';

export interface AuthoritativeRuntimeSession {
  sessionId: string;
  runtimeStatus: AgentStatus;
  isLive: boolean;
  processExists: boolean;
  pid?: number;
  lastUpdatedAt: number;
}

export interface AuthoritativeRuntimeSnapshot {
  generatedAt: number;
  desktopOnline: boolean;
  sessions: AuthoritativeRuntimeSession[];
}

export interface MobileUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  plan: 'FREE' | 'PRO' | 'TEAM';
}

export interface MobileSpaceSummary {
  id: string;
  name: string;
  agentCount?: number;
}

export interface MobileDiffChunk {
  oldPath?: string;
  newPath?: string;
  diffSummary?: string;
  addedLines?: number;
  deletedLines?: number;
}

export interface MobileProjectSummary {
  id: string;
  name: string;
  projectPath: string;
  gitBranch: string;
  spacesCount: number;
  spaces?: MobileSpaceSummary[];
  activeAgentsCount: number;
  totalAgentsCount: number;
  filesModifiedCount: number;
  failingTestsCount: number;
  contextFreshnessPercentage: number;
  lastActivitySummary: string;
  updatedAt: number;
}

export type ConversationFidelityLevel =
  | 'STRUCTURED'
  | 'SEMI_STRUCTURED'
  | 'TERMINAL_FALLBACK'
  | 'UNSUPPORTED';

export interface EngineFidelity {
  conversation: ConversationFidelityLevel;
  activities: 'STRUCTURED' | 'BEST_EFFORT' | 'UNSUPPORTED';
  approvals: 'STRUCTURED' | 'TERMINAL_PROMPT' | 'UNSUPPORTED';
}

export interface OrbitSessionCapabilities {
  sendMessage: boolean;
  resume: boolean;
  history: boolean;
  approvals: boolean;
  fileChanges: boolean;
  structuredEvents: boolean;
}

export interface ActivitySummary {
  id: string;
  category: 'files' | 'commands' | 'search' | 'tests' | 'build' | 'git' | 'approvals' | 'thinking' | 'other';
  summary: string;
  startedAt: number;
  completedAt?: number;
}

export interface MobileAgentChatMessage {
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
  activities?: ActivitySummary[];
  diffs?: MobileDiffChunk[];
  streaming?: boolean;
  timestamp: number;
}

export interface MobileAgentDetail {
  id: string;
  name: string;
  title?: string;
  preview?: string;
  provider: AgentProvider | string;
  profileId?: string;
  role?: string;
  workspaceId: string;
  projectId?: string;
  status: AgentStatus;
  isLive?: boolean;
  runtime?: {
    isAlive: boolean;
    pid?: number;
    lastHeartbeat?: number;
  };
  currentTaskDescription?: string;
  terminalLogs?: string[];
  chatHistory?: MobileAgentChatMessage[];
  transport?: SessionTransportType;
  fidelity?: EngineFidelity;
  capabilities?: OrbitSessionCapabilities;
  tokensUsed?: number;
  filesTouchedCount?: number;
  runtimeSeconds?: number;
  requiresAttention?: boolean;
  updatedAt: number;
}

export interface ApprovalActionPayload {
  id: string;
  agentId: string;
  action: 'approve' | 'reject';
}

export interface MobileWhatsHappeningBrief {
  projectId?: string;
  headline?: string;
  executiveSummary?: string;
  accomplished: string[];
  blockersAndErrors: string[];
  keyDecisions?: string[];
  recommendedNextStep?: string;
  summary?: string;
  activeAgentsCount?: number;
  failingTestsCount?: number;
  filesModifiedCount?: number;
  generatedAt?: number;
  timestamp?: number;
}
