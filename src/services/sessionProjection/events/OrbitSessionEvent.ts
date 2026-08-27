export type SessionEventType =
  | 'user_message'
  | 'agent_message'
  | 'tool_activity'
  | 'git_diff'
  | 'unknown'
  | 'terminal_chrome';

export interface OrbitSessionEvent {
  id: string;
  sessionId: string;
  sequence: number;
  timestamp: number;
  type: SessionEventType;
  content: string;
  thought?: string;
  confidence: number;
  source: {
    kind: 'input_router' | 'terminal_interpreter';
    interpreterVersion: string;
  };
  status: 'streaming' | 'committed';
  metadata?: {
    rawRange?: {
      startSequence: number;
      endSequence: number;
    };
    toolName?: string;
    filePath?: string;
    diffSummary?: string;
  };
}

export interface SessionCapabilities {
  universalPtyProjection: true;
  structuredHistory: boolean;
  nativeResume: boolean;
  nativeToolEvents: boolean;
  nativeSessionId: boolean;
}
