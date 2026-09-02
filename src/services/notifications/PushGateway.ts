import {
  NotificationIntent,
  DevicePushToken,
  PushDeliveryResult,
  MobileAttentionState,
} from '../../types/notifications';
import { IPushProvider, expoPushProvider } from './ExpoPushProvider';
import { DeviceRegistry, deviceRegistry } from './DeviceRegistry';

/**
 * Secure Push Gateway & Dispatcher
 *
 * Responsibilities:
 * - Multi-device fanout (§20)
 * - Persistent idempotency / deduplication (§18, §19)
 * - Foreground attention suppression (§9)
 * - Rate limiting / Debounce (§23)
 * - Async receipt processing & dead token invalidation (§22)
 * - Complete failure isolation from agent runtime (§28)
 */
export class PushGateway {
  private provider: IPushProvider;
  private dispatchedEventKeys = new Set<string>(); // Idempotency memory cache
  private recentDispatchesByAgent = new Map<string, number>(); // Rate limiting: agentId -> timestamp
  private mobileAttentionStates = new Map<string, MobileAttentionState>(); // deviceId -> state
  private pendingReceiptTicketIds: { ticketId: string; token: string }[] = [];
  private receiptCheckTimer: ReturnType<typeof setInterval> | null = null;

  private registry: DeviceRegistry;

  constructor(provider: IPushProvider = expoPushProvider, registry: DeviceRegistry = deviceRegistry) {
    this.provider = provider;
    this.registry = registry;
    this.loadDedupeStorage();
    this.startReceiptWorker();
  }

  private loadDedupeStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('orbit_push_dedupe_keys_v1');
      if (raw) {
        const list: string[] = JSON.parse(raw);
        for (const k of list.slice(-500)) {
          this.dispatchedEventKeys.add(k);
        }
      }
    } catch {}
  }

  private persistDedupeStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const list = Array.from(this.dispatchedEventKeys).slice(-500);
      localStorage.setItem('orbit_push_dedupe_keys_v1', JSON.stringify(list));
    } catch {}
  }

  /**
   * Update mobile client attention state received via Socket.IO
   */
  updateMobileAttention(state: MobileAttentionState) {
    this.mobileAttentionStates.set(state.deviceId, {
      ...state,
      lastHeartbeatAt: Date.now(),
    });
  }

  /**
   * Check if push should be suppressed because user is actively viewing this exact session
   */
  isForegroundSuppressed(intent: NotificationIntent, device: DevicePushToken): boolean {
    const attention = this.mobileAttentionStates.get(device.id);
    if (!attention) return false;

    const isRecent = Date.now() - attention.lastHeartbeatAt < 15000; // active within 15s
    const isViewingExactSession =
      attention.connected &&
      attention.appState === 'active' &&
      attention.activeSessionId === intent.sessionId &&
      attention.activeAgentId === intent.agentId;

    if (isRecent && isViewingExactSession) {
      console.log(
        `[PushGateway] Foreground suppressed for device=${deviceRegistry.redactToken(device.token)} session=${intent.sessionId}`
      );
      return true;
    }

    return false;
  }

  /**
   * Main dispatch pipeline
   */
  async dispatchNotification(
    userId: string,
    intent: NotificationIntent,
    environment: 'development' | 'preview' | 'production' = 'development'
  ): Promise<PushDeliveryResult> {
    const result: PushDeliveryResult = {
      notificationId: intent.notificationId,
      totalDevices: 0,
      dispatchedCount: 0,
      suppressedCount: 0,
      failedCount: 0,
      ticketIds: [],
      errors: [],
    };

    try {
      // 1. Idempotency Check (survives replayed events)
      const idempotencyKey = `orbit:${environment}:${intent.eventId}:${intent.type}`;
      if (this.dispatchedEventKeys.has(idempotencyKey)) {
        console.log(`[PushGateway] Duplicate event suppressed: ${idempotencyKey}`);
        result.suppressedCount++;
        return result;
      }

      // 2. Rate Limiting / Debounce per Agent (max 1 push every 5 seconds per agent for normal events)
      const now = Date.now();
      const lastSent = this.recentDispatchesByAgent.get(intent.agentId) || 0;
      if (intent.priority !== 'high' && now - lastSent < 5000) {
        console.log(`[PushGateway] Rate limited for agent=${intent.agentId}`);
        result.suppressedCount++;
        return result;
      }

      // 3. Resolve authorized devices for this user
      const devices = this.registry.getValidDevicesForUser(userId, environment);
      result.totalDevices = devices.length;

      if (devices.length === 0) {
        console.log(`[PushGateway] No active devices registered for user=${userId}`);
        return result;
      }

      // Mark idempotency immediately
      this.dispatchedEventKeys.add(idempotencyKey);
      this.persistDedupeStorage();
      this.recentDispatchesByAgent.set(intent.agentId, now);

      // 4. Multi-device Fanout (§20)
      for (const device of devices) {
        // Foreground suppression check
        if (this.isForegroundSuppressed(intent, device)) {
          result.suppressedCount++;
          continue;
        }

        try {
          const ticket = await this.provider.sendPush(device.token, intent);
          if (ticket.status === 'ok') {
            result.dispatchedCount++;
            result.ticketIds.push(ticket.id);
            this.pendingReceiptTicketIds.push({ ticketId: ticket.id, token: device.token });
          } else {
            result.failedCount++;
            if (ticket.details?.error === 'DeviceNotRegistered') {
              this.registry.invalidateDevice(device.token, 'DeviceNotRegistered');
            }
            if (ticket.message) result.errors.push(ticket.message);
          }
        } catch (devErr: any) {
          result.failedCount++;
          result.errors.push(String(devErr?.message || devErr));
        }
      }
    } catch (globalErr: any) {
      // Failure isolation: never crash caller
      console.error('[PushGateway] Unhandled dispatch exception:', globalErr);
      result.errors.push(String(globalErr?.message || globalErr));
    }

    return result;
  }

  /**
   * Periodic background worker for Expo receipt polling
   */
  private startReceiptWorker() {
    if (this.receiptCheckTimer) return;
    this.receiptCheckTimer = setInterval(async () => {
      if (!this.pendingReceiptTicketIds.length) return;

      const batch = this.pendingReceiptTicketIds.splice(0, 50);
      const ticketIds = batch.map((b) => b.ticketId);

      try {
        const receipts = await this.provider.getReceipts(ticketIds);
        for (const item of batch) {
          const receipt = receipts.get(item.ticketId);
          if (receipt && receipt.status === 'error') {
            if (receipt.details?.error === 'DeviceNotRegistered') {
              deviceRegistry.invalidateDevice(item.token, 'Receipt:DeviceNotRegistered');
            }
          }
        }
      } catch (e) {
        console.warn('[PushGateway] Receipt poll error:', e);
      }
    }, 30000);
  }

  destroy() {
    if (this.receiptCheckTimer) {
      clearInterval(this.receiptCheckTimer);
      this.receiptCheckTimer = null;
    }
  }
}

export const pushGateway = new PushGateway();
