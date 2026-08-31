import { EngineCapabilities, OrbitEngineEvent } from '../../../types/conversation';

export interface StartSessionOptions {
  sessionId: string;
  projectId: string;
  workspaceId: string;
  projectPath: string;
  provider: string;
  model?: string;
  taskDirective?: string;
}

export type Unsubscribe = () => void;

export type EngineEvent = OrbitEngineEvent;

export interface EngineAdapter {
  readonly id: string;
  readonly name: string;
  
  capabilities(): EngineCapabilities;
  
  startSession(options: StartSessionOptions): Promise<void>;
  
  sendMessage(sessionId: string, message: string): Promise<void>;
  
  startTurn?(sessionId: string, userPrompt: string, turnId?: string, userMessageId?: string): void;

  commitTurn?(sessionId: string, turnId?: string): void;

  interrupt(sessionId: string): Promise<void>;
  
  dispose(sessionId: string): Promise<void>;
  
  subscribe(sessionId: string, callback: (event: OrbitEngineEvent) => void): Unsubscribe;
}
