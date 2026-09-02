import { OperationalMode, OperationalModeViolation } from './types';

export interface TurnActionObservation {
  sessionId: string;
  agentId: string;
  turnId?: string;
  mode: OperationalMode;
  modifiedFiles?: string[];
  deletedFiles?: string[];
  executedCommands?: string[];
  gitMutationAttempted?: boolean;
}

export class ModeValidator {
  public static validateTurnCompliance(
    obs: TurnActionObservation
  ): OperationalModeViolation[] {
    const violations: OperationalModeViolation[] = [];
    const timestamp = Date.now();

    if (obs.mode === 'plan' || obs.mode === 'audit') {
      // 1. Filesystem write violations
      if (obs.modifiedFiles && obs.modifiedFiles.length > 0) {
        for (const file of obs.modifiedFiles) {
          violations.push({
            id: `viol-${Math.random().toString(36).substring(2, 9)}`,
            type: 'operational_mode_violation',
            sessionId: obs.sessionId,
            agentId: obs.agentId,
            turnId: obs.turnId,
            mode: obs.mode,
            operation: 'filesystem_write',
            path: file,
            reason: `Detected unauthorized file modification on '${file}' in ${obs.mode.toUpperCase()} mode.`,
            timestamp
          });
        }
      }

      // 2. Filesystem delete violations
      if (obs.deletedFiles && obs.deletedFiles.length > 0) {
        for (const file of obs.deletedFiles) {
          violations.push({
            id: `viol-${Math.random().toString(36).substring(2, 9)}`,
            type: 'operational_mode_violation',
            sessionId: obs.sessionId,
            agentId: obs.agentId,
            turnId: obs.turnId,
            mode: obs.mode,
            operation: 'filesystem_delete',
            path: file,
            reason: `Detected unauthorized file deletion on '${file}' in ${obs.mode.toUpperCase()} mode.`,
            timestamp
          });
        }
      }

      // 3. Git mutation violations
      if (obs.gitMutationAttempted) {
        violations.push({
          id: `viol-${Math.random().toString(36).substring(2, 9)}`,
          type: 'operational_mode_violation',
          sessionId: obs.sessionId,
          agentId: obs.agentId,
          turnId: obs.turnId,
          mode: obs.mode,
          operation: 'git_mutation',
          reason: `Detected unauthorized git mutation attempt in ${obs.mode.toUpperCase()} mode.`,
          timestamp
        });
      }
    }

    return violations;
  }
}
