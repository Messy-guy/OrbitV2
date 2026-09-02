import { OrbitEngineEvent, OrbitSession } from '../../types/conversation';
import {
  NotificationIntent,
  OrbitNotificationType,
  NotificationPriority,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../types/notifications';

export interface EvaluationContext {
  projectId: string;
  agentId: string;
  sessionId: string;
  provider?: string;
  agentName?: string;
  session?: OrbitSession;
  preferences?: NotificationPreferences;
}

export class NotificationPolicyEngine {
  /**
   * Determine whether a canonical OrbitEngineEvent deserves human attention.
   *
   * Pure evaluation:
   * - No network calls
   * - No Expo APIs
   * - No transport knowledge
   * - No state mutations
   */
  static evaluate(
    event: OrbitEngineEvent,
    context: EvaluationContext
  ): NotificationIntent | null {
    const prefs = context.preferences || DEFAULT_NOTIFICATION_PREFERENCES;
    if (!prefs.enabled) {
      return null;
    }

    const { projectId, agentId, sessionId, provider = 'Agent', agentName } = context;
    const displayName = agentName || (provider ? provider.toUpperCase() : 'Agent');

    let notificationType: OrbitNotificationType | null = null;
    let priority: NotificationPriority = 'normal';
    let title = '';
    let body = '';
    let actionRequired = false;

    switch (event.type) {
      case 'approval_requested': {
        if (!prefs.approvalRequired) return null;
        notificationType = 'approval_required';
        priority = 'high';
        actionRequired = true;
        title = `Approval Required · ${displayName}`;
        body = event.title
          ? `${event.title} (${event.action})`
          : `${displayName} requires confirmation to proceed.`;
        break;
      }

      case 'session_completed': {
        if (!prefs.agentCompleted) return null;
        notificationType = 'agent_completed';
        priority = 'normal';
        title = `Task Completed · ${displayName}`;
        body = `${displayName} finished execution in project workspace.`;
        break;
      }

      case 'session_status_changed': {
        if (event.status === 'input_required' || event.status === 'waiting') {
          if (event.status === 'input_required' && !prefs.needsInput) return null;
          if (event.status === 'waiting' && !prefs.waiting) return null;
          notificationType = event.status === 'input_required' ? 'agent_needs_input' : 'agent_waiting';
          priority = event.status === 'input_required' ? 'high' : 'normal';
          actionRequired = event.status === 'input_required';
          title = event.status === 'input_required' ? `Input Needed · ${displayName}` : `Waiting for Prompt · ${displayName}`;
          body = `${displayName} is paused and waiting for your instructions.`;
        } else if (event.status === 'error') {
          if (!prefs.errors) return null;
          notificationType = 'agent_error';
          priority = 'high';
          title = `Agent Error · ${displayName}`;
          body = `${displayName} encountered an error during task execution.`;
        } else {
          return null;
        }
        break;
      }

      case 'error': {
        if (!prefs.errors) return null;
        notificationType = 'agent_error';
        priority = 'high';
        title = `Agent Error · ${displayName}`;
        body = event.message ? `${displayName}: ${event.message.slice(0, 120)}` : `${displayName} reported an execution error.`;
        break;
      }

      default:
        // All token streaming, tool progress, internal activity, and message events MUST NOT notify
        return null;
    }

    if (!notificationType) {
      return null;
    }

    // Filter by high-priority preference
    if (prefs.highPriorityOnly && priority !== 'high') {
      return null;
    }

    // Quiet hours check
    if (prefs.quietHours?.enabled && this.isQuietHour(prefs.quietHours.start, prefs.quietHours.end)) {
      if (priority !== 'high') {
        return null; // Suppress normal priority during quiet hours
      }
    }

    const eventId = `evt_${event.timestamp}_${event.type}`;
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const collapseKey = `${projectId}:${agentId}:${sessionId}:${notificationType}`;

    return {
      notificationId,
      eventId,
      type: notificationType,
      projectId,
      agentId,
      sessionId,
      createdAt: new Date(event.timestamp || Date.now()).toISOString(),
      priority,
      title,
      body,
      collapseKey,
      data: {
        projectId,
        agentId,
        sessionId,
        eventId,
        notificationId,
        provider,
        actionRequired,
      },
    };
  }

  private static isQuietHour(startStr: string, endStr: string): boolean {
    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = startStr.split(':').map(Number);
      const [eh, em] = endStr.split(':').map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;

      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Overnight window (e.g. 22:00 to 07:00)
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    } catch {
      return false;
    }
  }
}
