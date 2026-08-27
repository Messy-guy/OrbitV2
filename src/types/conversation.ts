export type SessionStatus =
  | 'working'
  | 'waiting'
  | 'input_required'
  | 'completed'
  | 'error'
  | 'offline';

export type TurnRole = 'user' | 'agent';

export type MessageRole = 'user' | 'assistant';

export type MessageContent =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'markdown';
      markdown: string;
    }
  | {
      type: 'code';
      language?: string;
      code: string;
    }
  | {
      type: 'file';
      path: string;
      action: 'created' | 'modified' | 'deleted';
    };

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: MessageContent[];
  createdAt: number;
  streaming?: boolean;
}

export interface ActivityDetail {
  id: string;
  type: 'file_read' | 'file_write' | 'command' | 'test' | 'search' | 'diff' | 'custom';
  description: string;
  path?: string;
  metadata?: Record<string, any>;
}

export interface ActivitySummary {
  id: string;
  category: 'files' | 'commands' | 'search' | 'tests' | 'build' | 'git' | 'approvals' | 'thinking' | 'other';
  summary: string;
  details?: ActivityDetail[];
  startedAt: number;
  completedAt?: number;
}

export interface ConversationTurn {
  id: string;
  role: TurnRole;
  messages: ConversationMessage[];
  activities?: ActivitySummary[];
  startedAt: number;
  completedAt?: number;
  status: 'streaming' | 'complete' | 'interrupted' | 'error';
}

export interface Conversation {
  turns: ConversationTurn[];
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

export interface EngineReference {
  id: string;
  name: string;
  version?: string;
  provider: string;
  transport?: TransportType;
  fidelity?: EngineFidelity;
}

export interface RuntimeReference {
  pid?: number;
  ptySessionId?: string;
  cwd?: string;
  isAlive: boolean;
  lastHeartbeat: number;
}

export interface EngineCapabilities {
  streaming: boolean;
  structuredEvents: boolean;
  structuredToolCalls: boolean;
  approvals: boolean;
  sessionResume: boolean;
  historyRecovery: boolean;
  fileEvents: boolean;
  commandEvents: boolean;
  thinkingEvents: boolean;
  nativeConversationHistory: boolean;
}

export type TransportType = 'acp' | 'jsonrpc' | 'jsonl' | 'pty';

export interface EngineManifest {
  id: string;
  name: string;
  executable: string;
  transport: TransportType;
  fidelity?: EngineFidelity;
  capabilities: EngineCapabilities;
  version?: string;
  launchArgs?: string[];
  env?: Record<string, string>;
  promptPrefix?: string;
  promptSuffix?: string;
  historyPathResolver?: (sessionId: string, projectPath: string) => string;
  parseStructuredLine?: (line: string) => OrbitEngineEvent | null;
}

export type OrbitEngineEvent =
  | { type: 'user_message'; text: string; messageId?: string; timestamp: number }
  | { type: 'assistant_delta'; text: string; thought?: string; timestamp: number }
  | { type: 'assistant_completed'; text: string; thought?: string; timestamp: number }
  | { type: 'activity_started'; category: ActivitySummary['category']; summary: string; detail?: ActivityDetail; timestamp: number }
  | { type: 'activity_updated'; category: ActivitySummary['category']; summary: string; detail?: ActivityDetail; timestamp: number }
  | { type: 'activity_completed'; category: ActivitySummary['category']; summary: string; detail?: ActivityDetail; timestamp: number }
  | { type: 'approval_requested'; id: string; title: string; action: string; metadata?: Record<string, any>; timestamp: number }
  | { type: 'error'; message: string; timestamp: number }
  | { type: 'session_status_changed'; status: SessionStatus; timestamp: number }
  | { type: 'session_completed'; timestamp: number }
  | { type: 'session_interrupted'; timestamp: number };

export interface OrbitSession {
  id: string;
  projectId: string;
  workspaceId: string;
  engine: EngineReference;
  title: string;
  status: SessionStatus;
  conversation: Conversation;
  capabilities: EngineCapabilities;
  runtime: RuntimeReference;
  createdAt: number;
  updatedAt: number;
}
