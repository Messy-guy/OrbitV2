import { AgentProvider } from '../../types/orbit';

export type RemoteDeliveryTier = 
  | 'structured_acp' 
  | 'structured_jsonl' 
  | 'pty_interactive' 
  | 'direct_stdin' 
  | 'unsupported';

export interface RemoteControlCapabilities {
  canSendMessage: boolean;
  canInterrupt: boolean;
  canResume: boolean;
  canDetectReadyState: boolean;
  canDetectBusyState: boolean;
  canUseStructuredInput: boolean;
  canUsePTYInput: boolean;
  requiresSubmitAction: boolean;
  supportsInteractivePrompt: boolean;
  supportsSlashCommands: boolean;
  supportsApprovalInput: boolean;
}

export interface FormattedSubmission {
  payload: string;
  submitKey: string;
  preSubmitDelayMs?: number;
  postSubmitFlush?: boolean;
}

export interface AgentInteractionProfile {
  readonly provider: AgentProvider | string;
  readonly name: string;
  readonly deliveryTier: RemoteDeliveryTier;
  readonly submitKey: string;
  readonly multilineStrategy?: 'bracketed_paste' | 'chunked' | 'single_stream';
  readonly interKeyDelayMs?: number;
  readonly preSubmitDelayMs?: number;
  readonly postSubmitFlush?: boolean;
  readonly requiresFocus?: boolean;
  readonly promptPrefix?: string;
  readonly interruptSequence?: string;
  readonly capabilities: RemoteControlCapabilities;

  formatSubmission(message: string): FormattedSubmission;
  isReady?(outputBuffer: string): boolean;
  isBusy?(outputBuffer: string): boolean;
}

export interface RemoteControlRequest {
  requestId: string;
  sessionId: string;
  agentId: string;
  message: string;
  projectId?: string;
  timestamp: number;
}

export interface RemoteControlResult {
  success: boolean;
  requestId: string;
  sessionId: string;
  agentId: string;
  deliveryTier: RemoteDeliveryTier;
  submittedAt: number;
  error?: string;
  diagnosticCode?: string;
}

export type RemoteDiagnosticEvent = 
  | 'REMOTE_CONTROL_REQUEST'
  | 'SESSION_LOOKUP'
  | 'ADAPTER_SELECTED'
  | 'INPUT_DELIVERY_STARTED'
  | 'INPUT_SUBMITTED'
  | 'AGENT_STATE_CHANGED'
  | 'REMOTE_RESPONSE_STARTED'
  | 'REMOTE_RESPONSE_COMPLETED'
  | 'REMOTE_CONTROL_FAILED';

export interface RemoteDiagnosticLog {
  timestamp: number;
  event: RemoteDiagnosticEvent;
  agentId: string;
  sessionId: string;
  provider?: string;
  details?: Record<string, any>;
}
