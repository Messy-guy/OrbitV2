// Core Types for Orbit Desktop (Phase 3 Data Model)

export type AgentProvider = 'claude' | 'codex' | 'antigravity' | 'opencode' | 'kilocode' | 'freebuff' | 'cline' | 'copilot' | 'goose' | 'kiro' | 'qwen' | 'mimo' | 'muse' | 'continue' | 'aider' | 'vibe' | 'qoder' | 'gemini' | 'terminal' | 'custom';

export type AgentStatus = 'working' | 'ready' | 'waiting' | 'paused' | 'error';

export type AgentRoleType = 'raw' | 'architect' | 'implementer' | 'reviewer' | 'custom';

export interface AgentRoleConfig {
  id: AgentRoleType;
  name: string;
  shortLabel: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  systemDirective: string;
  invariants: string[];
}

export interface AgentUsageStats {
  provider: string;
  activeTokens: number;
  maxContextTokens: number;
  percentageUsed: number;
  transcriptTurns: number;
  estimatedCostUsd: number;
  lastUpdated: number;
}

export interface Space {
  id: string;
  projectId: string;
  name: string;
  agentCount?: number;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  projectPath: string;
  spaces?: Space[];
  activeSpaceId?: string;
  agentCount?: number;
  lastActive: string;
  createdAt: number;
  updatedAt: number;
}

export interface Workspace extends Project {}

export interface TerminalLine {
  id: string;
  type: 'stdout' | 'stderr' | 'stdin' | 'system' | 'diff-add' | 'diff-del' | 'tool';
  text: string;
  timestamp: number;
}

export interface Agent {
  id: string;
  workspaceId: string;
  spaceId?: string;
  parentId?: string; // Linked parent agent if this is a forked worker
  workerType?: 'test' | 'code' | 'audit' | 'shell' | 'custom'; // Sub-worker specialty
  provider: AgentProvider;
  name: string;
  model: string;
  profileId?: string; // Custom isolated config profile name e.g. "work-account", "default"
  role?: AgentRoleType;
  operationalMode?: 'plan' | 'code' | 'audit';
  taskDirective?: string; // Direct user task assigned on spawn
  sourceAgentId?: string; // If chained from previous worker
  status: AgentStatus;
  currentSessionId?: string;
  viewMode?: 'terminal' | 'chat';
  pid?: number;
  currentCommand?: string;
  createdAt: number;
}

export interface Session {
  id: string;
  agentId: string;
  workspaceId: string;
  title: string;
  operationalMode?: 'plan' | 'code' | 'audit';
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
    conversationSummary?: string;
    tokenCount: number;
  };
}

export interface ChangedFileItem {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' | string;
  staged?: boolean;
  unstaged?: boolean;
  isUntracked?: boolean;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  lastCommit: string;
}

export interface GitState {
  currentBranch: string;
  headCommit: string;
  modifiedFiles: ChangedFileItem[];
  stagedFiles?: ChangedFileItem[];
  unstagedFiles?: ChangedFileItem[];
  untrackedFiles?: ChangedFileItem[];
  recentCommits: string[];
}

export interface GitFileDiffData {
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  diff: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' | string;
  isStaged: boolean;
}

export interface Checkpoint {
  id: string;
  workspaceId: string;
  name: string;
  task: string;
  progress: string;
  decisions: string[];
  knownIssues: string[];
  notes?: string;
  changedFiles: ChangedFileItem[];
  agentId?: string;
  agentName?: string;
  createdAt: number;
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
  workspaceName?: string;
  currentTask: string;
  goal: string;
  progress: number; // 0 to 100
  activeWork: string;
  decisions: ProjectDecision[];
  issues: ProjectIssue[];
  notes: string[];
  architecture: string;
  relevantFiles: string[];
  lastCheckpointTime?: string;
  updatedAt: number;
}

export interface HandoffPreviewSummary {
  task: string;
  progress: string;
  currentIssue: string;
  relevantFiles: string[];
  fileSummaries?: FileEditSummary[];
  conversationSynthesis?: ConversationSynthesis;
  summaryNarrative?: string;
  previousAgent: string;
  nextStep: string;
  estimatedTokens: number;
  formattedInstruction?: string;
  handoffPackage?: HandoffPackage;
}

export interface HandoffSelection {
  includeCurrentTask: boolean;
  includeProgress: boolean;
  includeDecisions: boolean;
  includeKnownIssues: boolean;
  includeChangedFiles: boolean;
  includeGitState: boolean;
  includeRelevantConversation: boolean;
  includeFullConversation: boolean;
  requireConfirmation?: boolean; // When true, the target agent summarizes and waits for user confirmation before executing
}

export interface FileEditSummary {
  filePath: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | string;
  additions: number;
  deletions: number;
  summary: string;
  diffSnippet?: string;
}

export interface ConversationSynthesis {
  primaryGoal: string;
  userObjectives: string[];
  workAccomplished: Array<{ step: string; detail?: string; tool?: string }>;
  decisionsFormulated: string[];
  blockersAndErrors: Array<{ issue: string; resolution?: string; status: 'resolved' | 'pending' }>;
  patterns?: string[];
  currentExecutionState: string;
  nextStepDirective: string;
  narrativeSummary: string;
}

export interface ContextPackage {
  schemaVersion: number;
  sourceAgent: string;
  sourceSessionId: string;
  targetAgent: string;
  workspaceId: string;
  workspaceName: string;
  projectPath: string;
  checkpointId?: string;
  currentTask: string;
  progress: string;
  decisions: string[];
  changedFiles: ChangedFileItem[];
  fileSummaries?: FileEditSummary[];
  knownIssues: string[];
  gitState?: GitState;
  relevantHistory?: string[];
  patterns?: string[];
  notes?: string[];
  generatedAt: number;
  estimatedTokens: number;
  formattedInstruction?: string;
  handoffPackage?: HandoffPackage;
}

export type HandoffStatus = 'created' | 'sent' | 'accepted' | 'failed';

export interface HandoffRecord {
  id: string;
  workspaceId: string;
  sourceAgentId: string;
  sourceAgentName: string;
  targetAgentId: string;
  targetAgentName: string;
  sourceSessionId: string;
  targetSessionId?: string;
  checkpointId?: string;
  task: string;
  contextPackage: ContextPackage;
  status: HandoffStatus;
  createdAt: number;
}

// Retain legacy Handoff interface for backward compatibility where needed
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

// Phase 4: Intelligent Context Engine Types
export interface CommandRecord {
  command: string;
  timestamp: number;
  exitCode?: number;
  durationMs?: number;
}

export interface IssueRecord {
  id: string;
  title: string;
  filePath?: string;
  lineNumber?: number;
  code?: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'open' | 'investigating' | 'resolved';
  firstSeenAt: number;
  lastSeenAt: number;
  occurrenceCount: number;
}

export interface BuildSummary {
  status: 'passed' | 'failed' | 'running';
  errorCount: number;
  warningCount: number;
  timestamp: number;
  message?: string;
}

export interface TestSummary {
  status: 'passed' | 'failed' | 'running';
  passedCount: number;
  failedCount: number;
  totalCount: number;
  timestamp: number;
  runner: string;
}

export interface ProjectActivityState {
  workspaceId: string;
  activeAgentId?: string;
  recentCommands: CommandRecord[];
  changedFiles: ChangedFileItem[];
  recentIssues: IssueRecord[];
  lastBuild?: BuildSummary;
  lastTest?: TestSummary;
  gitState: GitState;
  lastActivityAt: number;
  lastCheckpointTime?: number;
  contextFreshness: number; // 0 to 100%
}

export interface DraftItem {
  text: string;
  confidence: 'High' | 'Medium' | 'Low';
  source: string;
  confirmed: boolean;
}

export interface ContextDraft {
  workspaceId: string;
  taskProposal: DraftItem;
  progressProposals: DraftItem[];
  changedFiles: ChangedFileItem[];
  activeIssues: IssueRecord[];
  recentDecisions: DraftItem[];
  gitSummary: string;
  generatedAt: number;
}

export * from './provenance';
export * from './events';

export interface HandoffPackage {
  schemaVersion: 1;
  project: {
    name: string;
    slug: string;
    path: string;
    repository?: string;
    techStack: Array<{ name: string; category: string; verificationLevel: import('./provenance').VerificationLevel; source: string }>;
    architecture: string;
  };
  mission: {
    primaryGoal: string;
    currentTask: string;
    progress: import('./provenance').EngineeringProgress;
  };
  currentState: {
    gitBranch?: string;
    gitHead?: string;
    status: 'active' | 'blocked' | 'paused';
  };
  invariants: import('./provenance').ProjectInvariant[];
  decisions: import('./provenance').ProjectDecision[];
  issues: Array<import('./provenance').MemoryEntity & {
    issue: string;
    status: 'open' | 'investigating' | 'resolved' | 'contradicted';
    verificationLevel: import('./provenance').VerificationLevel;
    provenance: import('./provenance').Provenance[];
  }>;
  failedApproaches: Array<{
    attempt: string;
    result: string;
    reason: string;
    sourceSessionId: string;
  }>;
  changedFiles: Array<{
    path: string;
    status: string;
    verificationLevel: import('./provenance').VerificationLevel;
    additions: number;
    deletions: number;
    diffSnippet?: string;
  }>;
  relevantConversation: import('./provenance').ClassifiedConversationSnippet[];
  constraints: string[];
  immediateNextAction: {
    action: string;
    targetFiles: string[];
  };
  provenance: import('./provenance').Provenance[];
  generatedAt: number;
}

export interface ProjectHealthTechItem {
  name: string;
  category: string;
  verificationLevel: import('./provenance').VerificationLevel;
  source: string;
}

export interface ProjectHealthWorkingTreeStatus {
  isClean: boolean;
  modifiedFiles: string[];
  untrackedFiles: string[];
  diffSummary: string;
}

export interface ProjectHealthUnresolvedIssue {
  id: string;
  issue: string;
  status: 'open' | 'investigating';
  verificationLevel: import('./provenance').VerificationLevel;
}

export interface ProjectHealthArchitecturalDecision {
  id: string;
  decision: string;
  rationale?: string;
  status: string;
  effectiveLevel: import('./provenance').VerificationLevel;
}

export interface ProjectHealthSnapshot {
  schemaVersion: 1;
  projectName: string;
  projectPath: string;
  techStack: ProjectHealthTechItem[];
  gitBranch: string;
  gitHead: string;
  workingTreeStatus: ProjectHealthWorkingTreeStatus;
  relevantDirectories: string[];
  activeTask: string;
  unresolvedIssues: ProjectHealthUnresolvedIssue[];
  architecturalDecisions: ProjectHealthArchitecturalDecision[];
  generatedAt: number;
}

