export type AgentProvider = 'antigravity' | 'claude' | 'opencode' | 'custom';
export type AgentStatus = 'working' | 'ready' | 'waiting' | 'paused' | 'error' | 'stopped';

export interface MobileUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  plan: 'FREE' | 'PRO' | 'TEAM';
}

export interface MobileProjectSummary {
  id: string;
  name: string;
  projectPath: string;
  gitBranch: string;
  activeAgentsCount: number;
  filesModifiedCount: number;
  failingTestsCount: number;
  contextFreshnessPercentage: number;
  lastActivitySummary: string;
  updatedAt: number;
}

export interface MobileAgentChatMessage {
  id: string;
  agentId: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  thought?: string;
  toolCall?: {
    toolName: string;
    summary?: string;
  };
  timestamp: number;
}

export interface MobileAgentDetail {
  id: string;
  name: string;
  provider: AgentProvider;
  profileId?: string;
  status: AgentStatus;
  currentTaskDescription?: string;
  terminalLogs?: string[];
  chatHistory?: MobileAgentChatMessage[];
  tokensUsed: number;
  filesTouchedCount: number;
  runtimeSeconds: number;
  requiresAttention: boolean;
  attentionPrompt?: string;
  updatedAt: number;
}

export interface MobileSwarmStats {
  totalActiveAgents: number;
  totalTokensBurned: number;
  burnRatePerMinute: number;
  activeWorkspacesCount: number;
  cpuPercent?: number;
  ramPercent?: number;
}

export interface MobileWhatsHappeningBrief {
  projectId: string;
  headline: string;
  executiveSummary: string;
  accomplished: string[];
  blockersAndErrors: string[];
  keyDecisions: string[];
  recommendedNextStep: string;
  generatedAt: number;
}

export interface MobilePendingApproval {
  id: string;
  agentId: string;
  agentName: string;
  provider: AgentProvider;
  actionTitle: string;
  commandSnippet?: string;
  question: string;
  options: string[];
  createdAt: number;
}
