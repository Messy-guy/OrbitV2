import { OrbitEngineEvent } from '../../types/conversation';
import { NotificationPolicyEngine } from './NotificationPolicyEngine';
import { pushGateway } from './PushGateway';
import { useAuthStore } from '../../stores/auth.store';
import { useSettingsStore } from '../../stores/settings.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAgentStore } from '../../stores/agent.store';
import { conversationStore } from '../conversation/ConversationStore';

/**
 * NotificationDispatcher binds to the canonical ConversationCaptureService and
 * dispatches notifications out-of-band when policy triggers.
 *
 * Invariant:
 * Pure out-of-band attention channel.
 * Does not mutate conversation turns or affect Socket.IO relay.
 */
export class NotificationDispatcher {
  static async handleCanonicalEvent(
    sessionId: string,
    agentId: string,
    event: OrbitEngineEvent
  ) {
    try {
      const authUser = useAuthStore.getState().user;
      const userId = authUser?.id || 'default-user';

      const agent = useAgentStore.getState().agents.find((a) => a.id === agentId);
      const activeWs = useWorkspaceStore.getState().getActiveWorkspace();
      const session = conversationStore.getSession(sessionId);

      const intent = NotificationPolicyEngine.evaluate(event, {
        projectId: activeWs?.id || session?.projectId || 'ws-default',
        agentId,
        sessionId,
        provider: agent?.provider || session?.engine.provider,
        agentName: agent?.name || session?.engine.name,
        session,
      });

      if (!intent) {
        return;
      }

      console.log(
        `[NotificationDispatcher] Policy matched: ${intent.type} for agent=${agentId} sessionId=${sessionId}. Dispatching push intent...`
      );

      // Dispatch asynchronously without awaiting or blocking caller
      pushGateway.dispatchNotification(userId, intent).catch((err) => {
        console.warn('[NotificationDispatcher] Dispatch error:', err);
      });
    } catch (e) {
      // Isolation: Catch all errors to prevent affecting engine adapters
      console.error('[NotificationDispatcher] handleCanonicalEvent error:', e);
    }
  }
}
