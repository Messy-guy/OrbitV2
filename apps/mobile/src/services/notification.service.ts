import { Platform, AppState, AppStateStatus } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { mobileRelayService } from './mobileRelay.service';
import { secureStorage } from './secureStorage';

export interface NotificationDeepLinkData {
  projectId: string;
  agentId: string;
  sessionId: string;
  eventId?: string;
  notificationId?: string;
}

class MobileNotificationService {
  private pushToken: string | null = null;
  private pendingDeepLink: NotificationDeepLinkData | null = null;
  private onDeepLinkListener: ((data: NotificationDeepLinkData) => void) | null = null;
  private isInitialized = false;
  private currentAttention: {
    appState: 'active' | 'background' | 'terminated';
    activeProjectId?: string;
    activeAgentId?: string;
    activeSessionId?: string;
  } = {
    appState: 'active',
  };

  /**
   * Lazily load expo-notifications to prevent native initialization crash on Android standalone APK
   */
  private getNotificationsModule() {
    try {
      if (Platform.OS === 'web') return null;
      return require('expo-notifications');
    } catch (e) {
      console.warn('[Notifications] Native module not available:', e);
      return null;
    }
  }

  /**
   * Initialize notification channels and listeners safely inside React lifecycle
   */
  async initialize() {
    if (this.isInitialized || Platform.OS === 'web') {
      return;
    }
    this.isInitialized = true;

    try {
      const Notifications = this.getNotificationsModule();
      if (!Notifications) return;

      const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

      if (!isExpoGo) {
        // 1. Configure foreground presentation handler
        try {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
              shouldShowBanner: true,
              shouldShowList: true,
              priority: Notifications.AndroidNotificationPriority?.HIGH ?? 4,
            }),
          });
        } catch (e) {
          console.warn('[Notifications] setNotificationHandler error:', e);
        }

        // 2. Setup channels & tokens
        await this.setupNotificationChannels(Notifications);
        await this.registerForPushNotificationsAsync(Notifications);
      } else {
        console.log('ℹ️ [Notifications] Running in Expo Go');
      }

      this.setupListeners(Notifications);
      this.setupAppStateTracking();
    } catch (e) {
      console.warn('[Notifications] Initialization error:', e);
    }
  }

  /**
   * Set up Android Notification Channels with proper importance levels (§33)
   */
  private async setupNotificationChannels(Notifications: any) {
    if (Platform.OS === 'android' && Notifications?.setNotificationChannelAsync) {
      try {
        await Notifications.setNotificationChannelAsync('agent_attention', {
          name: 'Agent Attention & Approvals',
          importance: Notifications.AndroidImportance?.MAX ?? 5,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF5722',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
        });

        await Notifications.setNotificationChannelAsync('agent_completion', {
          name: 'Agent Task Completed',
          importance: Notifications.AndroidImportance?.DEFAULT ?? 3,
          lightColor: '#4CAF50',
        });

        await Notifications.setNotificationChannelAsync('agent_errors', {
          name: 'Agent Errors & Crashes',
          importance: Notifications.AndroidImportance?.HIGH ?? 4,
          vibrationPattern: [0, 500, 200, 500],
          lightColor: '#F44336',
        });
      } catch (e) {
        console.warn('[Notifications] setupNotificationChannels error:', e);
      }
    }
  }

  /**
   * Obtain Expo Push Token and register with Orbit Relay (§12)
   */
  async registerForPushNotificationsAsync(Notifications?: any): Promise<string | null> {
    const notif = Notifications || this.getNotificationsModule();
    if (!notif) return null;

    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (isExpoGo) {
      return null;
    }

    try {
      const { status: existingStatus } = await notif.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await notif.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ [Notifications] Push notification permission not granted.');
        return null;
      }

      // Get Expo push token
      const tokenData = await notif.getExpoPushTokenAsync().catch(() => null);
      if (!tokenData?.data) {
        console.log('ℹ️ [Notifications] Push tokens not available in current environment.');
        return null;
      }

      this.pushToken = tokenData.data;
      console.log('✅ [Notifications] Registered push token:', this.pushToken.slice(0, 10) + '...');

      await this.syncTokenWithBackend();
      return this.pushToken;
    } catch (e) {
      console.warn('[Notifications] Registration error:', e);
      return null;
    }
  }

  /**
   * Sync push token to Orbit relay / device registry
   */
  async syncTokenWithBackend() {
    if (!this.pushToken) return;
    try {
      const userId = (await secureStorage.getAccessToken()) || 'default-user';
      mobileRelayService.registerDevicePushToken({
        userId,
        token: this.pushToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        appVersion: '1.0.0',
        environment: __DEV__ ? 'development' : 'production',
      });
    } catch (err) {
      console.warn('[Notifications] syncTokenWithBackend error:', err);
    }
  }

  /**
   * Track foreground/background state and current viewing context for suppression (§9, §39)
   */
  private setupAppStateTracking() {
    try {
      AppState.addEventListener('change', (nextState: AppStateStatus) => {
        this.currentAttention.appState =
          nextState === 'active' ? 'active' : nextState === 'background' ? 'background' : 'terminated';
        this.broadcastAttention();
      });
    } catch (e) {
      console.warn('[Notifications] setupAppStateTracking error:', e);
    }
  }

  /**
   * Notify relay when user views an active session screen (e.g. inside terminal/chat)
   */
  setActiveViewingSession(projectId?: string, agentId?: string, sessionId?: string) {
    this.currentAttention.activeProjectId = projectId;
    this.currentAttention.activeAgentId = agentId;
    this.currentAttention.activeSessionId = sessionId;
    this.broadcastAttention();
  }

  private broadcastAttention() {
    try {
      mobileRelayService.sendAttentionUpdate({
        deviceId: this.pushToken || `mob_${Platform.OS}`,
        connected: true,
        appState: this.currentAttention.appState,
        activeProjectId: this.currentAttention.activeProjectId,
        activeAgentId: this.currentAttention.activeAgentId,
        activeSessionId: this.currentAttention.activeSessionId,
        lastHeartbeatAt: Date.now(),
      });
    } catch (err) {
      // non-blocking
    }
  }

  /**
   * Setup Notification Received and Response Listeners (§30, §31)
   */
  private setupListeners(Notifications: any) {
    if (Platform.OS === 'web' || !Notifications) return;

    try {
      // 1. Foreground Notification Received
      Notifications.addNotificationReceivedListener?.((notification: any) => {
        console.log('🔔 [Notifications] Notification received in foreground:', notification.request?.identifier);
      });

      // 2. Notification Response / Tap Listener (Deep Linking §11)
      Notifications.addNotificationResponseReceivedListener?.((response: any) => {
        const data = response.notification?.request?.content?.data as any;
        if (data && data.projectId) {
          const linkData: NotificationDeepLinkData = {
            projectId: data.projectId,
            agentId: data.agentId,
            sessionId: data.sessionId,
            eventId: data.eventId,
            notificationId: data.notificationId,
          };

          if (this.onDeepLinkListener) {
            this.onDeepLinkListener(linkData);
          } else {
            // Cold start pending navigation buffer (§31)
            this.pendingDeepLink = linkData;
          }
        }
      });

      // Check if app was opened via notification tap on cold-start
      if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
        Notifications.getLastNotificationResponseAsync()
          .then((response: any) => {
            if (response) {
              const data = response.notification?.request?.content?.data as any;
              if (data && data.projectId) {
                this.pendingDeepLink = {
                  projectId: data.projectId,
                  agentId: data.agentId,
                  sessionId: data.sessionId,
                  eventId: data.eventId,
                  notificationId: data.notificationId,
                };
                if (this.onDeepLinkListener) {
                  this.onDeepLinkListener(this.pendingDeepLink);
                  this.pendingDeepLink = null;
                }
              }
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      console.warn('[Notifications] setupListeners fallback:', e);
    }
  }

  /**
   * Register router navigation callback for deep linking
   */
  setDeepLinkHandler(handler: (data: NotificationDeepLinkData) => void) {
    this.onDeepLinkListener = handler;
    if (this.pendingDeepLink) {
      handler(this.pendingDeepLink);
      this.pendingDeepLink = null;
    }
  }
}

export const mobileNotificationService = new MobileNotificationService();
