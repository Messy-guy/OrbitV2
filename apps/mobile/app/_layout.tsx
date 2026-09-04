import React, { useEffect } from 'react';
import '../global.css';
import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { mobileNotificationService } from '../src/services/notification.service';
import { mobileAppUpdateService } from '../src/services/appUpdate.service';
import { markStartupPhase, recordStartupFailure } from '../src/services/startupDiagnostics';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s cache freshness
      gcTime: 1000 * 60 * 10, // 10 min cache garbage collection
      retry: 1,
    },
  },
});

// Robust Error Boundary that renders an informative recovery screen instead of closing or blanking out
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    recordStartupFailure(error, 'NAVIGATION_READY');
    console.error('[RootLayout] Global React Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#08090C', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
            Orbit Encountered an Error
          </Text>
          <Text style={{ color: '#8E8E93', fontSize: 12, marginBottom: 20, textAlign: 'center', fontFamily: 'monospace' }}>
            {String(this.state.error?.message || this.state.error || 'Unknown runtime error')}
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: '#FB923C', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}
          >
            <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    markStartupPhase('CONFIG_LOADED');
    markStartupPhase('STORAGE_HYDRATED');
    markStartupPhase('NAVIGATION_READY');

    // Optional services initialize AFTER the navigation tree exists. Neither
    // update checks nor notifications are allowed to become a startup dependency.
    void mobileAppUpdateService.checkForUpdates(true).catch((err) => {
      recordStartupFailure(err, 'APP_READY');
    });

    void (async () => {
      markStartupPhase('NOTIFICATIONS_INITIALIZING');
      try {
        await mobileNotificationService.initialize();
        markStartupPhase('NOTIFICATIONS_READY');
      } catch (err) {
        // Notification capability is optional; keep the app usable.
        recordStartupFailure(err, 'NOTIFICATIONS_INITIALIZING');
      }
    })();

    try {
      mobileNotificationService.setDeepLinkHandler((data) => {
        try {
          console.log('[Orbit DeepLink] Notification navigation:', data.projectId);
          if (data.projectId) {
            router.push({
              pathname: '/project/[id]',
              params: {
                id: data.projectId,
                targetAgentId: data.agentId,
                targetSessionId: data.sessionId,
              },
            });
          }
        } catch (err) {
          recordStartupFailure(err, 'NAVIGATION_READY');
        }
      });
    } catch (err) {
      recordStartupFailure(err, 'NAVIGATION_READY');
    }

    markStartupPhase('APP_READY');
  }, [router]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#08090C' },
            animation: 'slide_from_right',
            presentation: 'card',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            animationDuration: 220,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="project/[id]"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              presentation: 'card',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
        </Stack>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
