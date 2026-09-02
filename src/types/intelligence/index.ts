/**
 * Orbit Project Intelligence, Context Evolution & Provenance Domain Model
 *
 * Core Invariant:
 * PROJECT KNOWLEDGE MUST NEVER CROSS PROJECT BOUNDARIES AUTOMATICALLY.
 * All project intelligence objects are strictly scoped to `projectId`.
 */

export const PROJECT_INTELLIGENCE_SCHEMA_VERSION = 1;

export type KnowledgeType =
  | 'decision'
  | 'convention'
  | 'constraint'
  | 'requirement'
  | 'blocker'
  | 'issue'
  | 'fact'
  | 'file_relationship';

export type KnowledgeStatus =
  | 'candidate'
  | 'confirmed'
  | 'conflicting'
  | 'deprecated'
  | 'rejected';

export interface ProvenanceSource {
  type: 'conversation_event' | 'turn' | 'tool_execution' | 'user_assertion' | 'verification' | 'handoff';
  agentId: string;
  sessionId: string;
  eventId?: string;
  turnId?: string;
  timestamp: number;
  gitCommit?: string;
  filePath?: string;
  rawSnippet?: string;
}

export interface KnowledgeItem {
  id: string;
  projectId: string;
  type: KnowledgeType;
  title: string;
  content: string;
  status: KnowledgeStatus;
  confidence: number; // 0.0 to 1.0 (evidence-backed)
  provenance: ProvenanceSource;
  evidence: string[];
  relatedFiles: string[];
  relatedSessions: string[];
  conflictsWith?: string[]; // IDs of conflicting knowledge items
  supersededBy?: string;   // ID of knowledge item that deprecated this
  confirmedBy?: string;    // User ID who explicitly confirmed
  confirmedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type VerificationVerdict = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN' | 'PARTIAL';

export interface VerificationCheck {
  id: string;
  name: string;
  type: 'typecheck' | 'lint' | 'test' | 'build' | 'git_status' | 'custom';
  status: 'passed' | 'failed' | 'skipped';
  exitCode?: number;
  outputSummary?: string;
  durationMs: number;
}

export interface VerificationJob {
  id: string;
  projectId: string;
  agentId: string;
  sessionId: string;
  trigger: 'session_completed' | 'user_requested' | 'pre_handoff';
  verdict: VerificationVerdict;
  checks: VerificationCheck[];
  checkpointId?: string;
  commitHash?: string;
  createdAt: number;
  completedAt?: number;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ApprovalGate {
  id: string;
  operationId: string;
  projectId: string;
  agentId: string;
  sessionId: string;
  operationType: 'destructive_file' | 'git_force_reset' | 'production_deploy' | 'env_secret_change' | 'custom';
  title: string;
  description: string;
  operationPayload: Record<string, any>;
  operationHash: string;
  status: ApprovalStatus;
  expiresAt: number;
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
}
