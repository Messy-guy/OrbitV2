// Core Types for Orbit Desktop (Phase 1 Frontend Data Model)

export type AgentProvider = 'antigravity' | 'codex' | 'claude' | 'opencode' | 'gemini' | 'custom';

export type AgentStatus = 'working' | 'ready' | 'waiting' | 'paused' | 'error';

export interface Workspace {
  id: string;
  name: string;
  projectPath: string;
  agentCount?: number;
  lastActive: string;
  createdAt: number;
  updatedAt: number;
}

export interface Agent {
  id: string;
  workspaceId: string;
  provider: AgentProvider;
  name: string;
  model: string;
  status: AgentStatus;
  currentSessionId?: string;
  createdAt: number;
}

export interface Session {
  id: string;
  agentId: string;
  workspaceId: string;
  title: string;
  status: 'active' | 'paused' | 'completed';
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
  lastActivityTime?: string;
}

export interface ToolInvocation {
  id: string;
  toolName: 'read_file' | 'edit_file' | 'run_tests' | 'bash' | 'grep';
  file?: string;
  status: 'completed' | 'in_progress' | 'failed';
  output?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'agent' | 'system' | 'tool';
  content: string;
  toolInvocations?: ToolInvocation[];
  timestamp: number;
  isHandoffMessage?: boolean;
  handoffData?: {
    fromAgent: string;
    fromSession: string;
    task: string;
    progress: string;
    issues: string;
    files: string[];
    tokenCount: number;
  };
}

export interface ProjectDecision {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  authorAgent?: string;
}

export interface ProjectIssue {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'open' | 'investigating' | 'resolved';
}

export interface ProjectContext {
  id: string;
  workspaceId: string;
  goal: string;
  progress: number; // 0 to 100
  decisions: ProjectDecision[];
  issues: ProjectIssue[];
  architecture: string;
  relevantFiles: string[];
  lastCheckpointTime?: string;
  updatedAt: number;
}

export interface Checkpoint {
  id: string;
  workspaceId: string;
  name: string;
  summary: string;
  agentId?: string;
  createdAt: number;
}

export interface HandoffSelection {
  includeCurrentTask: boolean;
  includeProgress: boolean;
  includeDecisions: boolean;
  includeKnownIssues: boolean;
  includeChangedFiles: boolean;
  includeRelevantConversation: boolean;
  includeFullConversation: boolean;
}

export interface Handoff {
  id: string;
  workspaceId: string;
  sourceAgentId: string;
  sourceSessionId: string;
  targetAgentId: string;
  targetSessionId: string;
  selectedContext: HandoffSelection;
  generatedSummary: {
    task: string;
    progress: string;
    currentIssue: string;
    relevantFiles: string[];
    previousAgent: string;
    nextStep: string;
    estimatedTokens: number;
  };
  createdAt: number;
}

export type ActivityType = 
  | 'agent_started' 
  | 'agent_paused' 
  | 'file_changed' 
  | 'test_run' 
  | 'test_failed'
  | 'checkpoint' 
  | 'handoff';

export interface Activity {
  id: string;
  workspaceId: string;
  type: ActivityType;
  agentId?: string;
  agentName?: string;
  description: string;
  timestamp: number;
  timeString: string;
  details?: string;
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileItem[];
  status?: 'modified' | 'added' | 'unmodified';
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  lastCommit: string;
}

export interface GitState {
  currentBranch: string;
  branches: GitBranch[];
  modifiedFiles: Array<{
    path: string;
    status: 'M' | 'A' | 'D' | 'U';
  }>;
}

export type BottomPanelType = 'context' | 'activity' | 'files' | 'git' | 'sessions' | null;

export interface AgentGridTileLayout {
  i: string; // agentId
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}
