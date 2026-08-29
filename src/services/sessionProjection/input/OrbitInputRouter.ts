import { sessionEventStore } from '../events/SessionEventStore';
import { sessionInputController } from './SessionInputController';
import { pendingInputEchoQueue } from './PendingInputEchoQueue';

export class OrbitInputRouter {
  static async submitUserMessage(agentId: string, sessionId: string, text: string): Promise<void> {
    const cleanText = text.trim();
    if (!cleanText) return;

    // 1. Authoritative registration of pending echo
    pendingInputEchoQueue.registerPendingEcho(sessionId || agentId, cleanText);
    if (agentId && agentId !== sessionId) {
      pendingInputEchoQueue.registerPendingEcho(agentId, cleanText);
    }

    // 2. Authoritative recording in Append-Only Log upon submission
    sessionEventStore.appendEvent({
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sessionId: agentId,
      timestamp: Date.now(),
      type: 'user_message',
      content: cleanText,
      confidence: 1.0,
      source: {
        kind: 'input_router',
        interpreterVersion: 'v1.0.0',
      },
      status: 'committed',
    });

    // 3. Dispatch serialized write to PTY via Input Controller
    await sessionInputController.enqueueInput(agentId, sessionId, cleanText);
  }
}
