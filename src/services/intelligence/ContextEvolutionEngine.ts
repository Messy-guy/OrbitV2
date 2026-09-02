import { OrbitEngineEvent } from '../../types/conversation';
import { KnowledgeItem, KnowledgeType } from '../../types/intelligence';
import { projectKnowledgeStore } from './ProjectKnowledgeStore';
import { OrbitKnowledgeGraph } from '../graph.service';

export interface EventContext {
  projectId: string;
  agentId: string;
  sessionId: string;
  provider?: string;
  agentRole?: string;
}

/**
 * Incremental Context Evolution & Provenance Engine
 *
 * Requirements:
 * - Consumes canonical OrbitEngineEvents only (§4)
 * - Incremental processing only; never reprocess the entire project (§6, §31)
 * - Evidence-backed lifecycle: candidate -> confirmed -> conflicting (§7, §8)
 * - Full provenance attribution (§9)
 * - Zero cross-project leakage (§2)
 */
export class ContextEvolutionEngine {
  private static processedEventIds = new Set<string>();

  /**
   * Incrementally project canonical Orbit events into project intelligence
   */
  public static processEvent(
    event: OrbitEngineEvent,
    context: EventContext,
    graph?: OrbitKnowledgeGraph
  ): KnowledgeItem[] {
    const { projectId, agentId, sessionId } = context;
    if (!projectId) return [];

    const eventId = `evt_${event.timestamp}_${event.type}`;
    const dedupeKey = `${projectId}:${sessionId}:${eventId}`;
    if (this.processedEventIds.has(dedupeKey)) {
      return []; // Idempotent skip (§19)
    }
    this.processedEventIds.add(dedupeKey);

    const generatedItems: KnowledgeItem[] = [];

    // 1. Process Architectural Decisions & Implementation Directives
    if (event.type === 'activity_completed' || event.type === 'activity_started') {
      const summary = event.summary || '';
      const detail = event.detail;

      // Identify candidate decisions from activity streams
      if (
        summary.toLowerCase().includes('decision') ||
        summary.toLowerCase().includes('configured') ||
        summary.toLowerCase().includes('standardized') ||
        summary.toLowerCase().includes('migrated')
      ) {
        const item = this.createKnowledgeCandidate({
          projectId,
          agentId,
          sessionId,
          eventId,
          type: 'decision',
          title: summary.slice(0, 60),
          content: detail?.description || summary,
          evidence: [summary],
          relatedFiles: detail?.path ? [detail.path] : [],
          confidence: 0.8,
        });
        generatedItems.push(projectKnowledgeStore.upsertKnowledgeItem(item));

        if (graph) {
          graph.addNode({
            id: `dec-${item.id}`,
            type: 'decision',
            label: item.title,
            details: item.content,
            weight: 120,
            estimatedTokens: 30,
            timestamp: event.timestamp || Date.now(),
          });
        }
      }

      // Identify candidate blockers / issues
      if (event.category === 'tests' && summary.toLowerCase().includes('fail')) {
        const item = this.createKnowledgeCandidate({
          projectId,
          agentId,
          sessionId,
          eventId,
          type: 'issue',
          title: `Failing Test: ${summary.slice(0, 50)}`,
          content: detail?.description || summary,
          evidence: [summary],
          relatedFiles: detail?.path ? [detail.path] : [],
          confidence: 0.85,
        });
        generatedItems.push(projectKnowledgeStore.upsertKnowledgeItem(item));
      }
    }

    // 2. Process Approval Requests into pending operational constraints
    if (event.type === 'approval_requested') {
      const item = this.createKnowledgeCandidate({
        projectId,
        agentId,
        sessionId,
        eventId,
        type: 'constraint',
        title: `Gated Operation: ${event.title}`,
        content: `Requires human approval: ${event.action}`,
        evidence: [event.title, event.action],
        relatedFiles: [],
        confidence: 0.95,
      });
      generatedItems.push(projectKnowledgeStore.upsertKnowledgeItem(item));
    }

    // 3. Process Fatal Errors
    if (event.type === 'error') {
      const item = this.createKnowledgeCandidate({
        projectId,
        agentId,
        sessionId,
        eventId,
        type: 'blocker',
        title: `Runtime Error in ${sessionId}`,
        content: event.message,
        evidence: [event.message],
        relatedFiles: [],
        confidence: 0.9,
      });
      generatedItems.push(projectKnowledgeStore.upsertKnowledgeItem(item));
    }

    // Check for logical conflicts among existing project decisions
    for (const newItem of generatedItems) {
      this.detectConflictsWithExisting(projectId, newItem);
    }

    return generatedItems;
  }

  private static createKnowledgeCandidate(params: {
    projectId: string;
    agentId: string;
    sessionId: string;
    eventId: string;
    type: KnowledgeType;
    title: string;
    content: string;
    evidence: string[];
    relatedFiles: string[];
    confidence: number;
  }): KnowledgeItem {
    const id = `kn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return {
      id,
      projectId: params.projectId,
      type: params.type,
      title: params.title,
      content: params.content,
      status: 'candidate',
      confidence: params.confidence,
      provenance: {
        type: 'conversation_event',
        agentId: params.agentId,
        sessionId: params.sessionId,
        eventId: params.eventId,
        timestamp: Date.now(),
      },
      evidence: params.evidence,
      relatedFiles: params.relatedFiles,
      relatedSessions: [params.sessionId],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private static detectConflictsWithExisting(projectId: string, newItem: KnowledgeItem) {
    if (newItem.type !== 'decision' && newItem.type !== 'convention') return;

    const existingDecisions = projectKnowledgeStore.getProjectKnowledge(projectId, 'confirmed');
    for (const existing of existingDecisions) {
      if (existing.id === newItem.id) continue;

      // Heuristic conflict detection on mutually exclusive architectural terms
      const textA = `${existing.title} ${existing.content}`.toLowerCase();
      const textB = `${newItem.title} ${newItem.content}`.toLowerCase();

      const hasConflict =
        (textA.includes('jwt') && (textB.includes('session cookie') || textB.includes('cookie'))) ||
        ((textA.includes('session cookie') || textA.includes('cookie')) && textB.includes('jwt')) ||
        (textA.includes('postgresql') && textB.includes('mongodb')) ||
        (textA.includes('tailwind') && textB.includes('styled-components'));

      if (hasConflict) {
        console.warn(
          `[ContextEvolutionEngine] Conflict detected in project ${projectId} between '${existing.title}' and '${newItem.title}'`
        );
        projectKnowledgeStore.registerConflict(projectId, existing.id, newItem.id);
      }
    }
  }
}
