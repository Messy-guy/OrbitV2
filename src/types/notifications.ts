/**
 * Orbit Canonical Push Notification & Remote Agent Attention Types
 *
 * Strict separation:
 * - Desktop Runtime = Brain
 * - Socket.IO = Live Wire
 * - Push Notifications = Out-of-band Doorbell
 * - ConversationStore = Authoritative Source of Truth
 */

export type OrbitNotificationType =
  | 'agent_completed'
  | 'agent_needs_input'
  | 'approval_required'
  | 'agent_error'
  | 'agent_waiting'
  | 'explicit_attention'
  | 'system_attention';

export type NotificationPriority = 'normal' | 'high';

export interface NotificationRoutingData {
  projectId: string;
  agentId: string;
  sessionId: string;
  eventId: string;
  notificationId: string;
  provider?: string;
  actionRequired?: boolean;
}

export interface NotificationIntent {
  notificationId: string;
  eventId: string;
  type: OrbitNotificationType;
  projectId: string;
  agentId: string;
  sessionId: string;
  createdAt: string;
  priority: NotificationPriority;
  title: string;
  body: string;
  data: NotificationRoutingData;
  collapseKey?: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  agentCompleted: boolean;
  needsInput: boolean;
  approvalRequired: boolean;
  errors: boolean;
  waiting: boolean;
  explicitAttention: boolean;
  highPriorityOnly: boolean;
  quietHours?: {
    enabled: boolean;
    start: string; // "22:00" (HH:mm)
    end: string;   // "07:00" (HH:mm)
  };
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  agentCompleted: true,
  needsInput: true,
  approvalRequired: true,
  errors: true,
  waiting: true,
  explicitAttention: true,
  highPriorityOnly: false,
};

export type MobileAppState = 'active' | 'background' | 'terminated';

export interface MobileAttentionState {
  deviceId: string;
  connected: boolean;
  appState: MobileAppState;
  activeProjectId?: string;
  activeAgentId?: string;
  activeSessionId?: string;
  lastHeartbeatAt: number;
}

export interface DevicePushToken {
  id: string;
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  appVersion?: string;
  environment: 'development' | 'preview' | 'production';
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
  invalidatedAt?: number;
}

export interface PushTicket {
  id: string;
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded';
  };
}

export interface PushReceipt {
  id: string;
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded';
  };
}

export interface PushDeliveryResult {
  notificationId: string;
  totalDevices: number;
  dispatchedCount: number;
  suppressedCount: number;
  failedCount: number;
  ticketIds: string[];
  errors: string[];
}
