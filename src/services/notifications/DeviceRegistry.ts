import { DevicePushToken } from '../../types/notifications';

/**
 * DeviceRegistry handles secure multi-device token storage and lifecycle.
 *
 * Requirements:
 * - Multi-device support per user (phone, tablet, secondary device)
 * - Environment separation
 * - Token invalidation & cleanup on DeviceNotRegistered
 * - Redacted token logging
 * - Persistent storage with fallback
 */
export class DeviceRegistry {
  private devices: Map<string, DevicePushToken> = new Map();
  private storageKey = 'orbit_device_push_tokens_v1';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const list: DevicePushToken[] = JSON.parse(raw);
        for (const dev of list) {
          this.devices.set(dev.id, dev);
        }
      }
    } catch (e) {
      console.warn('[DeviceRegistry] Failed to load tokens:', e);
    }
  }

  private saveToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const list = Array.from(this.devices.values());
      localStorage.setItem(this.storageKey, JSON.stringify(list));
    } catch (e) {
      console.warn('[DeviceRegistry] Failed to save tokens:', e);
    }
  }

  /**
   * Register or update a device push token
   */
  registerDevice(registration: {
    userId: string;
    token: string;
    platform: 'ios' | 'android' | 'web';
    appVersion?: string;
    environment?: 'development' | 'preview' | 'production';
  }): DevicePushToken {
    if (!registration.token || !registration.userId) {
      throw new Error('UserId and Push Token are required for registration.');
    }

    // Deterministic device ID based on userId + token to avoid duplicates
    const deviceId = `dev_${registration.userId}_${registration.token.slice(-10)}`;
    const now = Date.now();

    const existing = this.devices.get(deviceId);
    const updated: DevicePushToken = {
      id: deviceId,
      userId: registration.userId,
      token: registration.token,
      platform: registration.platform,
      appVersion: registration.appVersion || '1.0.0',
      environment: registration.environment || 'development',
      enabled: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastSeenAt: now,
      invalidatedAt: undefined,
    };

    this.devices.set(deviceId, updated);
    this.saveToStorage();

    console.log(
      `[DeviceRegistry] Registered device for user=${registration.userId} platform=${registration.platform} token=${this.redactToken(registration.token)}`
    );
    return updated;
  }

  /**
   * Get all active, valid devices for a specific user and environment
   */
  getValidDevicesForUser(
    userId: string,
    environment: 'development' | 'preview' | 'production' = 'development'
  ): DevicePushToken[] {
    return Array.from(this.devices.values()).filter(
      (d) =>
        d.userId === userId &&
        d.enabled &&
        !d.invalidatedAt &&
        (d.environment === environment || environment === 'development')
    );
  }

  /**
   * Invalidate a device token when Expo returns DeviceNotRegistered or user logs out
   */
  invalidateDevice(tokenOrDeviceId: string, reason = 'DeviceNotRegistered') {
    for (const [id, dev] of this.devices.entries()) {
      if (id === tokenOrDeviceId || dev.token === tokenOrDeviceId) {
        dev.enabled = false;
        dev.invalidatedAt = Date.now();
        console.log(`[DeviceRegistry] Invalidated device token: ${this.redactToken(dev.token)} (Reason: ${reason})`);
      }
    }
    this.saveToStorage();
  }

  /**
   * Unregister / remove device upon explicit user action
   */
  unregisterDevice(tokenOrDeviceId: string) {
    for (const [id, dev] of this.devices.entries()) {
      if (id === tokenOrDeviceId || dev.token === tokenOrDeviceId) {
        this.devices.delete(id);
        console.log(`[DeviceRegistry] Removed device token: ${this.redactToken(dev.token)}`);
      }
    }
    this.saveToStorage();
  }

  /**
   * Redact sensitive token for production logging compliance (§14)
   */
  redactToken(token: string): string {
    if (!token || token.length < 12) return '***';
    return `${token.slice(0, 6)}...${token.slice(-4)}`;
  }
}

export const deviceRegistry = new DeviceRegistry();
