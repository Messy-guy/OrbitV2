import { Provenance } from './provenance';

export type OrbitEventType =
  // Observed session events
  | 'session.started'
  | 'session.ended'
  | 'user.directive'
  | 'agent.message'
  | 'agent.activity'
  | 'agent.tool_executed'
  | 'agent.claimed_decision'
  | 'agent.claimed_invariant'
  | 'agent.claimed_file_change'
  | 'agent.claimed_issue'
  // Evidence & verification events
  | 'evidence.file_checked'
  | 'evidence.git_checked'
  | 'evidence.test_checked'
  | 'verification.completed'
  | 'memory.invariant_added'
  | 'claim.contradicted'
  | 'evidence.contradictory'
  | 'invariant.contradicted'
  | 'decision.superseded'
  // Repository scan events
  | 'repository.scanned'
  // Handoff generation
  | 'handoff.generated';

export interface OrbitEvent<T = unknown> {
  eventId: string;
  type: OrbitEventType;
  projectId: string;
  sessionId: string;
  timestamp: number;
  payload: T;
  provenance: Provenance;
}
