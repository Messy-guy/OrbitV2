import { VerificationEvidence, VerificationLevel, Provenance } from '../../types/provenance';
import { OrbitEvent } from '../../types/events';
import { EventStore } from './EventStore';
import { isTauriAvailable, tauriService } from '../tauri.service';
import { isAbsolutePath, pathJoin, pathDirname, getNodeFs } from '../../utils/pathUtils';

export class EvidenceGate {
  /**
   * Verifies an agent's claim of a file change against real filesystem and Git state
   */
  static async verifyFileChange(
    projectSlug: string,
    projectPath: string,
    filePath: string,
    claimedByEventId: string
  ): Promise<VerificationEvidence> {
    const evidenceItems: string[] = [];
    let effectiveLevel: VerificationLevel = 'claimed';

    // 1. File existence check
    let fileExists = false;
    const absPath = isAbsolutePath(filePath) ? filePath : pathJoin(projectPath, filePath);

    const nodeFs = await getNodeFs();
    if (nodeFs && nodeFs.existsSync) {
      fileExists = nodeFs.existsSync(absPath);
    } else if (isTauriAvailable()) {
      try {
        const res = await tauriService.readWorkspaceFile(projectPath || pathDirname(absPath), filePath);
        fileExists = !!res && typeof res.content === 'string';
      } catch {}
    }

    if (fileExists) {
      effectiveLevel = 'file_verified';
      evidenceItems.push(`File exists on filesystem at ${filePath}`);
    }

    // 2. Git status / diff check
    if (projectPath) {
      try {
        if (isTauriAvailable()) {
          const gitStatus = await tauriService.getGitState(projectPath);
          const isModified = gitStatus.modifiedFiles?.some((f: { path: string }) => f.path === filePath || f.path.endsWith(filePath));
          const isUntracked = gitStatus.untrackedFiles?.some((f: { path: string }) => f.path === filePath || f.path.endsWith(filePath));

          if (isModified || isUntracked) {
            effectiveLevel = 'git_verified';
            evidenceItems.push(`Git status confirmed ${isModified ? 'modified' : 'untracked'} state for ${filePath}`);
            try {
              const diff = await tauriService.getWorkspaceFileDiff(projectPath, filePath);
              if (diff && !diff.includes('No changes detected')) {
                evidenceItems.push(`Git diff snippet captured (${diff.split('\n').length} lines)`);
              }
            } catch {}
          }
        }
      } catch {}
    }

    const verificationRecord: VerificationEvidence = {
      level: effectiveLevel,
      verifiedAt: Date.now(),
      sourceEventId: claimedByEventId,
      evidence: evidenceItems,
    };

    // Emit verification.completed event
    const verificationEvent: OrbitEvent = {
      eventId: `evt_verify_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'verification.completed',
      projectId: projectSlug,
      sessionId: 'gate_verification',
      timestamp: Date.now(),
      payload: {
        claimId: claimedByEventId,
        target: filePath,
        path: filePath,
        level: effectiveLevel,
        evidence: evidenceItems,
      },
      provenance: {
        sourceType: effectiveLevel === 'git_verified' ? 'git' : effectiveLevel === 'file_verified' ? 'repository' : 'agent_observation',
        sourceId: claimedByEventId,
        timestamp: Date.now(),
        confidence: effectiveLevel === 'claimed' ? 'inferred' : 'verified',
        verificationLevel: effectiveLevel,
        evidence: evidenceItems,
      },
    };

    await EventStore.appendEvent(projectSlug, verificationEvent);
    return verificationRecord;
  }

  /**
   * Evaluates a decision or invariant claim with optional behavioral/file corroboration
   */
  static async verifyDecisionOrInvariant(
    projectSlug: string,
    targetId: string,
    statement: string,
    claimedByEventId: string,
    supportingEvidence: string[] = []
  ): Promise<VerificationEvidence> {
    let level: VerificationLevel = 'observed';
    const evidenceItems = [...supportingEvidence];

    if (evidenceItems.some((e) => e.includes('test') || e.includes('assert') || e.includes('passed'))) {
      level = 'behavior_verified';
    } else if (evidenceItems.some((e) => e.endsWith('.ts') || e.endsWith('.rs') || e.endsWith('.json'))) {
      level = 'file_verified';
    }

    const verificationRecord: VerificationEvidence = {
      level,
      verifiedAt: Date.now(),
      sourceEventId: claimedByEventId,
      evidence: evidenceItems,
    };

    const verificationEvent: OrbitEvent = {
      eventId: `evt_verify_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'verification.completed',
      projectId: projectSlug,
      sessionId: 'gate_verification',
      timestamp: Date.now(),
      payload: {
        claimId: targetId,
        target: statement,
        level,
        evidence: evidenceItems,
      },
      provenance: {
        sourceType: level === 'behavior_verified' ? 'test_runner' : 'agent_observation',
        sourceId: claimedByEventId,
        timestamp: Date.now(),
        confidence: level === 'behavior_verified' ? 'verified' : 'observed',
        verificationLevel: level,
        evidence: evidenceItems,
      },
    };

    await EventStore.appendEvent(projectSlug, verificationEvent);
    return verificationRecord;
  }

  /**
   * Checks for direct factual contradiction (e.g. Postgres claimed vs SQLite repository evidence)
   */
  static checkContradiction(valA: string, valB: string): boolean {
    const a = valA.toLowerCase().trim();
    const b = valB.toLowerCase().trim();
    if (a === b) return false;

    // Direct database contradictions
    const dbs = ['postgres', 'sqlite', 'mysql', 'mongodb'];
    const aDb = dbs.find((d) => a.includes(d));
    const bDb = dbs.find((d) => b.includes(d));
    if (aDb && bDb && aDb !== bDb) return true;

    // Transport / architecture contradictions
    if ((a.includes('native transcript') && b.includes('pty is authoritative')) ||
        (b.includes('native transcript') && a.includes('pty is authoritative'))) {
      return true;
    }

    return false;
  }

  /**
   * Evaluates an agent claim against an active invariant.
   * If the claim conflicts with the invariant, the CLAIM is rejected/contradicted.
   * The invariant itself remains active because an unverified claim cannot break invariants.
   * Only verified repository or behavioral evidence can contradict an invariant.
   */
  static evaluateClaimAgainstInvariant(
    invariant: { id: string; statement: string },
    claim: { id: string; statement: string; sourceEventId: string }
  ): { claimContradicted: boolean; invariantContradicted: boolean; reason?: string } {
    const conflicts = this.checkContradiction(invariant.statement, claim.statement);
    if (conflicts) {
      return {
        claimContradicted: true,
        invariantContradicted: false, // Invariant remains intact; agent claim is rejected
        reason: `Agent claim "${claim.statement}" conflicts with active invariant "${invariant.statement}". Claim rejected; invariant preserved.`,
      };
    }
    return { claimContradicted: false, invariantContradicted: false };
  }
}
