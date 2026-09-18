export type ProvenanceSourceType =
  | 'repository'         // Detected directly from project files (package.json, Cargo.toml)
  | 'git'                // Verified from Git index/status/log
  | 'native_transcript'  // Extracted from structured CLI transcript (Antigravity JSONL, Claude JSON)
  | 'canonical_session'  // Sourced from Orbit Canonical Conversation Store
  | 'agent_observation'  // Extracted from agent tool execution or message
  | 'user_statement'     // Directly stated by the user
  | 'test_runner';       // Sourced from test execution exit code/output

export type VerificationLevel =
  | 'claimed'            // Asserted without corroborating proof
  | 'observed'           // Directly captured in session events or tool invocations
  | 'file_verified'      // Verified file existence on disk at expected path
  | 'git_verified'       // Verified modifications in Git working tree / commit
  | 'behavior_verified'; // Corroborated by successful test run, clean build, or runtime execution

export interface VerificationEvidence {
  level: VerificationLevel;
  verifiedAt: number;
  sourceEventId: string;
  evidence: string[];    // file paths, diff commands/snippets, or test names
}

export interface Provenance {
  sourceType: ProvenanceSourceType;
  sourceId: string;       // e.g. "package.json", "sess_agy_1726...", "git:HEAD"
  timestamp: number;
  confidence: 'verified' | 'observed' | 'inferred';
  verificationLevel: VerificationLevel;
  evidence?: string[];
}

/**
 * Base contract establishing the stable identity relationship between
 * projected memory entities and the underlying immutable event ledger.
 */
export interface MemoryEntity {
  id: string;
  createdByEventId: string;
  updatedByEventIds: string[];
}

export interface ProjectInvariant extends MemoryEntity {
  statement: string;
  status: 'active' | 'superseded' | 'contradicted';
  rationale?: string;
  provenance: Provenance[];
  verificationRecords: VerificationEvidence[];
  effectiveLevel: VerificationLevel;
}

export interface ProjectDecision extends MemoryEntity {
  decision: string;
  rationale?: string;
  status: 'active' | 'superseded' | 'contradicted';
  provenance: Provenance[];
  verificationRecords: VerificationEvidence[];
  effectiveLevel: VerificationLevel;
}

export interface EngineeringProgress {
  completed: string[];
  active: string[];
  blocked: string[];
  next: string;
}

export type ConversationSnippetCategory =
  | 'user_requirement'        // Feature specifications or constraints from user
  | 'architectural_decision'  // Pattern or architecture choices
  | 'implementation_detail'   // Key code modifications or tool execution
  | 'error_investigation'     // Diagnosis of bugs, failed attempts, stack traces
  | 'unresolved_question'     // Pending decisions waiting for user feedback
  | 'recent_execution';       // Latest runtime context

export interface ClassifiedConversationSnippet {
  id: string;
  category: ConversationSnippetCategory;
  turnId: string;
  speaker: 'user' | 'agent';
  summary: string;
  detail?: string;
  source: 'native_transcript' | 'canonical_session' | 'terminal_fallback';
  timestamp: number;
}
