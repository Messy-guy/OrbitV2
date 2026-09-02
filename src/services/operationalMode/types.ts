export type OperationalMode = 'plan' | 'code' | 'audit';

export type OperationalRole = 'architect' | 'implementer' | 'reviewer';

export type EnforcementStrategy = 'native' | 'hybrid' | 'universal';

export interface NativeOperationalModeSupport {
  plan: boolean;
  code: boolean;
  audit: boolean;
  nativePlanFlag?: string[];
  nativeCodeFlag?: string[];
  nativeAuditFlag?: string[];
  description: string;
}

export interface OperationalCommandEvaluation {
  allowed: boolean;
  category: 'READ' | 'WRITE' | 'DELETE' | 'GIT_READ' | 'GIT_MUTATION' | 'BUILD' | 'TEST' | 'NETWORK' | 'UNKNOWN_MUTATING' | 'UNKNOWN';
  reason?: string;
  command: string;
}

export interface OperationalModeProfile {
  mode: OperationalMode;
  role: OperationalRole;
  badge: 'SPEC' | 'TDD' | 'AST';
  label: string;
  description: string;
  writePolicy: 'DENIED' | 'ALLOWED';
  deletePolicy: 'DENIED' | 'ALLOWED';
  commitPolicy: 'DENIED' | 'ALLOWED';
  expectedOutputFormat: string;
  bootstrapContract: string;
}

export interface OperationalModeSessionState {
  sessionId: string;
  agentId: string;
  provider: string;
  projectId: string;
  workspacePath: string;
  operationalMode: OperationalMode;
  enforcementStrategy: EnforcementStrategy;
  createdAt: number;
  updatedAt: number;
}

export interface OperationalModeViolation {
  id: string;
  type: 'operational_mode_violation';
  sessionId: string;
  agentId: string;
  turnId?: string;
  mode: OperationalMode;
  operation: 'filesystem_write' | 'filesystem_delete' | 'git_mutation' | 'command_execution' | 'unauthorized_patch';
  path?: string;
  command?: string;
  reason: string;
  timestamp: number;
}
