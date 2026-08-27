import { OrbitSessionEvent } from './OrbitSessionEvent';

class SessionEventStore {
  // agentId -> committed events
  private eventsBySession: Map<string, OrbitSessionEvent[]> = new Map();
  // agentId -> current live streaming draft
  private streamingDrafts: Map<string, OrbitSessionEvent> = new Map();
  private sequenceCounters: Map<string, number> = new Map();

  getNextSequence(sessionId: string): number {
    const current = this.sequenceCounters.get(sessionId) || 0;
    const next = current + 1;
    this.sequenceCounters.set(sessionId, next);
    return next;
  }

  appendEvent(event: Omit<OrbitSessionEvent, 'sequence'>): OrbitSessionEvent {
    const list = this.eventsBySession.get(event.sessionId) || [];
    const fullEvent: OrbitSessionEvent = {
      ...event,
      sequence: this.getNextSequence(event.sessionId),
      status: 'committed',
    };

    list.push(fullEvent);
    this.eventsBySession.set(event.sessionId, list);
    // Crucial: Atomically delete streaming draft upon committing permanent event
    this.streamingDrafts.delete(event.sessionId);
    return fullEvent;
  }

  setStreamingDraft(event: Omit<OrbitSessionEvent, 'sequence' | 'status'>) {
    this.streamingDrafts.set(event.sessionId, {
      ...event,
      sequence: (this.sequenceCounters.get(event.sessionId) || 0) + 1,
      status: 'streaming',
    });
  }

  getStreamingDraft(sessionId: string): OrbitSessionEvent | undefined {
    return this.streamingDrafts.get(sessionId);
  }

  clearStreamingDraft(sessionId: string) {
    this.streamingDrafts.delete(sessionId);
  }

  getEvents(sessionId: string): OrbitSessionEvent[] {
    return this.eventsBySession.get(sessionId) || [];
  }

  getProjectedEvents(sessionId: string): OrbitSessionEvent[] {
    const committed = (this.eventsBySession.get(sessionId) || []).filter(
      (e) => e.type !== 'terminal_chrome'
    );
    const streaming = this.streamingDrafts.get(sessionId);

    // If streaming draft exists and is unique from the last committed event, include it
    if (streaming && streaming.type !== 'terminal_chrome' && streaming.content.trim().length > 0) {
      const lastCommitted = committed[committed.length - 1];
      if (!lastCommitted || lastCommitted.content !== streaming.content) {
        return [...committed, streaming];
      }
    }
    return committed;
  }

  clearSession(sessionId: string) {
    this.eventsBySession.delete(sessionId);
    this.streamingDrafts.delete(sessionId);
    this.sequenceCounters.delete(sessionId);
  }
}

export const sessionEventStore = new SessionEventStore();
