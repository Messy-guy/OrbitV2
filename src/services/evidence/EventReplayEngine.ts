import { OrbitEvent } from '../../types/events';
import {
  ProjectDecision,
  ProjectInvariant,
  VerificationLevel,
  VerificationEvidence,
  EngineeringProgress,
} from '../../types/provenance';
import { EventStore } from './EventStore';
import { isTauriAvailable, tauriService } from '../tauri.service';
import * as fs from 'fs';
import * as path from 'path';

export interface ProjectedProjectState {
  project: {
    name: string;
    slug: string;
    path: string;
    repository?: string;
    techStack: Array<{
      name: string;
      category: string;
      verificationLevel: VerificationLevel;
      source: string;
    }>;
    architecture: string;
    lastScanned?: number;
    rootFingerprint?: string;
  };
  mission: {
    primaryGoal: string;
    currentTask: string;
    progress: EngineeringProgress;
  };
  decisions: ProjectDecision[];
  invariants: ProjectInvariant[];
  issues: Array<{
    id: string;
    createdByEventId: string;
    updatedByEventIds: string[];
    issue: string;
    status: 'open' | 'investigating' | 'resolved' | 'contradicted';
    verificationLevel: VerificationLevel;
    verificationRecords: VerificationEvidence[];
  }>;
  changes: Array<{
    path: string;
    status: string;
    verificationLevel: VerificationLevel;
    additions?: number;
    deletions?: number;
    diffSnippet?: string;
    createdByEventId: string;
    updatedByEventIds: string[];
  }>;
}

export class EventReplayEngine {
  /**
   * Evaluates the highest applicable VerificationLevel from an array of verification records
   */
  static calculateEffectiveLevel(records: VerificationEvidence[]): VerificationLevel {
    if (!records || records.length === 0) return 'claimed';

    const levels = new Set(records.map((r) => r.level));
    if (levels.has('behavior_verified')) return 'behavior_verified';
    if (levels.has('git_verified')) return 'git_verified';
    if (levels.has('file_verified')) return 'file_verified';
    if (levels.has('observed')) return 'observed';
    return 'claimed';
  }

  /**
   * Replays an event stream deterministically into a ProjectedProjectState
   */
  static replay(projectSlug: string, events: OrbitEvent[]): ProjectedProjectState {
    const state: ProjectedProjectState = {
      project: {
        name: projectSlug,
        slug: projectSlug,
        path: '',
        techStack: [],
        architecture: '',
      },
      mission: {
        primaryGoal: 'Active workspace implementation and verification',
        currentTask: 'Active workspace implementation',
        progress: {
          completed: [],
          active: [],
          blocked: [],
          next: 'Inspect active touched files and continue implementation.',
        },
      },
      decisions: [],
      invariants: [],
      issues: [],
      changes: [],
    };

    for (const evt of events) {
      switch (evt.type) {
        case 'repository.scanned': {
          const payload = evt.payload as any;
          if (payload) {
            if (payload.name) state.project.name = payload.name;
            if (payload.path) state.project.path = payload.path;
            if (payload.repository) state.project.repository = payload.repository;
            if (payload.architecture) state.project.architecture = payload.architecture;
            if (payload.rootFingerprint) state.project.rootFingerprint = payload.rootFingerprint;
            if (payload.lastScanned) state.project.lastScanned = payload.lastScanned;
            if (Array.isArray(payload.techStack)) {
              state.project.techStack = payload.techStack;
            }
          }
          break;
        }

        case 'user.directive': {
          const text = String((evt.payload as any)?.directive || (evt.payload as any)?.text || '').trim();
          if (text) {
            if (
              state.mission.primaryGoal === 'Active workspace implementation and verification' ||
              !state.mission.primaryGoal
            ) {
              state.mission.primaryGoal = text;
            }
            state.mission.currentTask = text;
            if (!state.mission.progress.active.includes(text)) {
              state.mission.progress.active.push(text);
            }
          }
          break;
        }

        case 'agent.claimed_decision': {
          const payload = evt.payload as any;
          const decisionText = payload?.decision || payload?.statement || '';
          if (decisionText) {
            const existing = state.decisions.find((d) => d.decision === decisionText);
            if (existing) {
              if (!existing.updatedByEventIds.includes(evt.eventId)) {
                existing.updatedByEventIds.push(evt.eventId);
              }
            } else {
              const initialRecord: VerificationEvidence = {
                level: evt.provenance?.verificationLevel || 'claimed',
                verifiedAt: evt.timestamp,
                sourceEventId: evt.eventId,
                evidence: evt.provenance?.evidence || [],
              };
              state.decisions.push({
                id: payload.id || `dec_${state.decisions.length + 1}`,
                decision: decisionText,
                rationale: payload.rationale,
                status: 'active',
                provenance: evt.provenance ? [evt.provenance] : [],
                verificationRecords: [initialRecord],
                effectiveLevel: this.calculateEffectiveLevel([initialRecord]),
                createdByEventId: evt.eventId,
                updatedByEventIds: [],
              });
            }
          }
          break;
        }

        case 'agent.claimed_invariant':
        case 'memory.invariant_added': {
          const payload = evt.payload as any;
          const stmt = payload?.statement || '';
          if (stmt) {
            const existing = state.invariants.find((inv) => inv.statement === stmt);
            if (existing) {
              if (!existing.updatedByEventIds.includes(evt.eventId)) {
                existing.updatedByEventIds.push(evt.eventId);
              }
            } else {
              const initialRecord: VerificationEvidence = {
                level: evt.provenance?.verificationLevel || 'claimed',
                verifiedAt: evt.timestamp,
                sourceEventId: evt.eventId,
                evidence: evt.provenance?.evidence || [],
              };
              state.invariants.push({
                id: payload.id || `inv_${state.invariants.length + 1}`,
                statement: stmt,
                rationale: payload.rationale,
                status: 'active',
                provenance: evt.provenance ? [evt.provenance] : [],
                verificationRecords: [initialRecord],
                effectiveLevel: this.calculateEffectiveLevel([initialRecord]),
                createdByEventId: evt.eventId,
                updatedByEventIds: [],
              });
            }
          }
          break;
        }

        case 'agent.claimed_issue': {
          const payload = evt.payload as any;
          const issueText = payload?.issue || '';
          if (issueText) {
            const existing = state.issues.find((i) => i.issue === issueText);
            if (existing) {
              if (!existing.updatedByEventIds.includes(evt.eventId)) {
                existing.updatedByEventIds.push(evt.eventId);
              }
            } else {
              const initialRecord: VerificationEvidence = {
                level: evt.provenance?.verificationLevel || 'claimed',
                verifiedAt: evt.timestamp,
                sourceEventId: evt.eventId,
                evidence: evt.provenance?.evidence || [],
              };
              state.issues.push({
                id: payload.id || `iss_${state.issues.length + 1}`,
                issue: issueText,
                status: payload.status || 'open',
                verificationLevel: this.calculateEffectiveLevel([initialRecord]),
                verificationRecords: [initialRecord],
                createdByEventId: evt.eventId,
                updatedByEventIds: [],
              });
            }
          }
          break;
        }

        case 'claim.contradicted': {
          const payload = evt.payload as any;
          const claimStatement = payload?.statement || payload?.claim || '';
          const reason = payload?.reason || 'Claim contradicts active invariant without verified evidence';
          state.issues.push({
            id: `rej_${evt.eventId}`,
            createdByEventId: evt.eventId,
            updatedByEventIds: [],
            issue: `[REJECTED CLAIM] ${claimStatement} (${reason})`,
            status: 'resolved',
            verificationLevel: 'observed',
            verificationRecords: [{
              level: 'observed',
              verifiedAt: evt.timestamp,
              sourceEventId: evt.eventId,
              evidence: [reason],
            }],
          });
          break;
        }

        case 'evidence.contradictory': {
          const payload = evt.payload as any;
          const evidenceA = payload?.evidenceA || '';
          const evidenceB = payload?.evidenceB || '';
          state.issues.push({
            id: `conflict_${evt.eventId}`,
            createdByEventId: evt.eventId,
            updatedByEventIds: [],
            issue: `[CONTRADICTORY EVIDENCE] Conflict between "${evidenceA}" and "${evidenceB}"`,
            status: 'open',
            verificationLevel: 'observed',
            verificationRecords: [{
              level: 'observed',
              verifiedAt: evt.timestamp,
              sourceEventId: evt.eventId,
              evidence: [evidenceA, evidenceB],
            }],
          });
          break;
        }

        case 'invariant.contradicted': {
          const payload = evt.payload as any;
          const targetId = payload?.invariantId || payload?.id;
          const stmt = payload?.statement;
          const inv = state.invariants.find((i) => (targetId && i.id === targetId) || (stmt && i.statement === stmt));
          if (inv) {
            inv.status = 'contradicted';
            if (!inv.updatedByEventIds.includes(evt.eventId)) {
              inv.updatedByEventIds.push(evt.eventId);
            }
          }
          break;
        }

        case 'decision.superseded': {
          const payload = evt.payload as any;
          const oldTargetId = payload?.supersededId || payload?.decisionId;
          const oldDec = state.decisions.find((d) => (oldTargetId && d.id === oldTargetId) || (payload?.supersededDecision && d.decision === payload.supersededDecision));
          if (oldDec) {
            oldDec.status = 'superseded';
            (oldDec as any).supersededByEventId = evt.eventId;
            if (!oldDec.updatedByEventIds.includes(evt.eventId)) {
              oldDec.updatedByEventIds.push(evt.eventId);
            }
          } else if (payload?.id && !payload?.supersededId) {
            const dec = state.decisions.find((d) => d.id === payload.id);
            if (dec) dec.status = 'superseded';
          }

          // If event introduces a new superseding decision, register it with lineage
          const newId = payload?.id;
          const newDecision = payload?.decision;
          if (newId && newDecision && newId !== oldTargetId) {
            const existingNew = state.decisions.find((d) => d.id === newId || d.decision === newDecision);
            const initialRecord: VerificationEvidence = {
              level: (payload.effectiveLevel as VerificationLevel) || evt.provenance?.verificationLevel || 'observed',
              verifiedAt: evt.timestamp,
              sourceEventId: evt.eventId,
              evidence: evt.provenance?.evidence || [],
            };
            if (existingNew) {
              existingNew.status = 'active';
              (existingNew as any).supersedesId = oldTargetId;
              existingNew.verificationRecords.push(initialRecord);
              existingNew.effectiveLevel = this.calculateEffectiveLevel(existingNew.verificationRecords);
            } else {
              state.decisions.push({
                id: newId,
                decision: newDecision,
                rationale: payload.rationale,
                status: 'active',
                provenance: evt.provenance ? [evt.provenance] : [],
                verificationRecords: [initialRecord],
                effectiveLevel: initialRecord.level,
                createdByEventId: evt.eventId,
                updatedByEventIds: [],
                supersedesId: oldTargetId,
              } as any);
            }
          }
          break;
        }

        case 'agent.claimed_file_change': {
          const payload = evt.payload as any;
          const filePath = payload?.path || '';
          if (filePath) {
            const existing = state.changes.find((c) => c.path === filePath);
            if (existing) {
              if (!existing.updatedByEventIds.includes(evt.eventId)) {
                existing.updatedByEventIds.push(evt.eventId);
              }
              if (payload.status) existing.status = payload.status;
              if (payload.diffSnippet) existing.diffSnippet = payload.diffSnippet;
            } else {
              state.changes.push({
                path: filePath,
                status: payload.status || 'modified',
                verificationLevel: 'claimed',
                additions: payload.additions,
                deletions: payload.deletions,
                diffSnippet: payload.diffSnippet,
                createdByEventId: evt.eventId,
                updatedByEventIds: [],
              });
            }
          }
          break;
        }

        case 'verification.completed': {
          const payload = evt.payload as any;
          if (payload) {
            const claimId = payload.claimId;
            const level = payload.level as VerificationLevel;
            const evidenceItems = payload.evidence || [];
            const record: VerificationEvidence = {
              level,
              verifiedAt: evt.timestamp,
              sourceEventId: evt.eventId,
              evidence: evidenceItems,
            };

            // Check if claim applies to a decision
            const dec = state.decisions.find((d) => d.id === claimId || d.decision === payload.target);
            if (dec) {
              dec.verificationRecords.push(record);
              dec.effectiveLevel = this.calculateEffectiveLevel(dec.verificationRecords);
              if (!dec.updatedByEventIds.includes(evt.eventId)) {
                dec.updatedByEventIds.push(evt.eventId);
              }
            }

            // Check if claim applies to an invariant
            const inv = state.invariants.find((i) => i.id === claimId || i.statement === payload.target);
            if (inv) {
              inv.verificationRecords.push(record);
              inv.effectiveLevel = this.calculateEffectiveLevel(inv.verificationRecords);
              if (!inv.updatedByEventIds.includes(evt.eventId)) {
                inv.updatedByEventIds.push(evt.eventId);
              }
            }

            // Check if claim applies to a changed file
            const change = state.changes.find((c) => c.path === payload.path || c.path === payload.target);
            if (change) {
              change.verificationLevel = level;
              if (payload.diffSnippet) change.diffSnippet = payload.diffSnippet;
              if (!change.updatedByEventIds.includes(evt.eventId)) {
                change.updatedByEventIds.push(evt.eventId);
              }
            } else if (payload.path || payload.target) {
              state.changes.push({
                path: payload.path || payload.target,
                status: 'modified',
                verificationLevel: level,
                createdByEventId: evt.eventId,
                updatedByEventIds: [evt.eventId],
              });
            }

            // Check if claim applies to an issue
            const iss = state.issues.find((i) => i.id === claimId || i.issue === payload.target);
            if (iss) {
              iss.verificationRecords.push(record);
              iss.verificationLevel = this.calculateEffectiveLevel(iss.verificationRecords);
              if (payload.status) iss.status = payload.status;
              if (!iss.updatedByEventIds.includes(evt.eventId)) {
                iss.updatedByEventIds.push(evt.eventId);
              }
            }
          }
          break;
        }

        default:
          break;
      }
    }

    return state;
  }

  /**
   * Materializes the projected state into ~/.orbit/projects/<slug>/ projections & views
   */
  static async persistProjections(projectSlug: string, state: ProjectedProjectState): Promise<void> {
    const projectDir = EventStore.getProjectDir(projectSlug);
    const viewsDir = path.join(projectDir, 'views');

    const writeJson = async (filename: string, data: any) => {
      const content = JSON.stringify(data, null, 2);
      const p = path.join(projectDir, filename);
      if (typeof fs !== 'undefined' && fs.promises) {
        try {
          await fs.promises.mkdir(projectDir, { recursive: true });
          await fs.promises.writeFile(p, content, 'utf8');
          return;
        } catch {}
      }
      if (isTauriAvailable()) {
        try {
          await tauriService.writeWorkspaceFile(projectDir, filename, content);
        } catch (e) {
          console.error(`[EventReplayEngine] Failed to write ${filename} via Tauri:`, e);
        }
      }
    };

    const writeMd = async (filename: string, content: string) => {
      const p = path.join(viewsDir, filename);
      const header = `<!-- Generated view maintained by Orbit. Direct edits should be made via Orbit or will be overwritten during view projection. -->\n\n`;
      const full = header + content;
      if (typeof fs !== 'undefined' && fs.promises) {
        try {
          await fs.promises.mkdir(viewsDir, { recursive: true });
          await fs.promises.writeFile(p, full, 'utf8');
          return;
        } catch {}
      }
      if (isTauriAvailable()) {
        try {
          await tauriService.writeWorkspaceFile(viewsDir, filename, full);
        } catch (e) {
          console.error(`[EventReplayEngine] Failed to write view ${filename} via Tauri:`, e);
        }
      }
    };

    if (typeof fs !== 'undefined' && fs.mkdirSync) {
      try {
        fs.mkdirSync(viewsDir, { recursive: true });
      } catch {}
    }

    // 1. Write projections
    await Promise.all([
      writeJson('project.json', state.project),
      writeJson('decisions.json', state.decisions),
      writeJson('invariants.json', state.invariants),
      writeJson('issues.json', state.issues),
      writeJson('changes.json', state.changes),
    ]);

    // 2. Materialize markdown views
    await Promise.all([
      writeMd(
        'DECISIONS.md',
        `# ${state.project.name} — Architectural Decisions Record\n\n` +
          state.decisions
            .map(
              (d) =>
                `### ${d.id}: ${d.decision} [${d.effectiveLevel.toUpperCase()}]\n` +
                (d.rationale ? `**Rationale**: ${d.rationale}\n` : '') +
                `*Created by Event: \`${d.createdByEventId}\`*\n`
            )
            .join('\n')
      ),
      writeMd(
        'INVARIANTS.md',
        `# ${state.project.name} — Architectural Invariants & Guardrails\n\n` +
          state.invariants
            .map(
              (i) =>
                `### ${i.id}: ${i.statement} [${i.effectiveLevel.toUpperCase()}]\n` +
                (i.rationale ? `**Rationale**: ${i.rationale}\n` : '') +
                `*Created by Event: \`${i.createdByEventId}\`*\n`
            )
            .join('\n')
      ),
      writeMd(
        'BUGS.md',
        `# ${state.project.name} — Tracked Blockers & Issues\n\n` +
          state.issues
            .map((i) => `• **[${i.status.toUpperCase()}]** ${i.issue} (Level: ${i.verificationLevel})`)
            .join('\n')
      ),
      writeMd(
        'SESSION.md',
        `# ${state.project.name} — Cumulative Session Continuity\n\n` +
          `## Current Mission\n**Goal**: ${state.mission.primaryGoal}\n**Active Task**: ${state.mission.currentTask}\n\n` +
          `## Progress\n` +
          `- **Completed**: ${state.mission.progress.completed.join(', ') || 'None'}\n` +
          `- **Active**: ${state.mission.progress.active.join(', ') || state.mission.currentTask}\n` +
          `- **Blocked**: ${state.mission.progress.blocked.join(', ') || 'None'}\n` +
          `- **Next Action**: ${state.mission.progress.next}\n`
      ),
      writeMd(
        'ROADMAP.md',
        `# ${state.project.name} — Project Roadmap & Milestone Phases\n\n` +
          `## Current Phase: Active Implementation & Continuity Verification\n` +
          `• **Active Goal**: ${state.mission.primaryGoal}\n` +
          `• **Active Task**: ${state.mission.currentTask}\n` +
          `• **Immediate Next**: ${state.mission.progress.next}\n`
      ),
      writeMd(
        'MASTER.md',
        `# ${state.project.name} — System & Continuity Master Protocol\n\n` +
          `- **Canonical Project Slug**: \`${state.project.slug}\`\n` +
          `- **Tech Stack**: ${state.project.techStack?.map((t) => t.name).join(', ') || 'TypeScript / Rust'}\n` +
          `- **Architecture**: ${state.project.architecture || 'Event-sourced persistent memory mesh'}\n` +
          `- **Active Mission**: ${state.mission.primaryGoal}\n`
      ),
    ]);
  }

  /**
   * Alias for persistProjections
   */
  static async materializeProjections(projectSlug: string, state: ProjectedProjectState): Promise<void> {
    return this.persistProjections(projectSlug, state);
  }

  /**
   * Loads all events from EventStore, replays them, and updates projections
   */
  static async replayAndProject(projectSlug: string): Promise<ProjectedProjectState> {
    const events = await EventStore.getEvents(projectSlug);
    const state = this.replay(projectSlug, events);
    await this.persistProjections(projectSlug, state);
    return state;
  }
}
