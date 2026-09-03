import React, { useEffect } from 'react';
import '../global.css';
import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { mobileNotificationService } from '../src/services/notification.service';
import { mobileAppUpdateService } from '../src/services/appUpdate.service';

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
    // Check for updates seamlessly in background
    mobileAppUpdateService.checkForUpdates(true).catch(() => {});

    // Initialize push notification lifecycle & channels defensively
    try {
      mobileNotificationService.initialize().catch((err) => {
        console.warn('[RootLayout] Notification init error:', err);
      });

      // Deep Link Navigation Handler (§11, §31)
      mobileNotificationService.setDeepLinkHandler((data) => {
        console.log('🚀 [DeepLink] Navigating from notification tap:', data);
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
      });
    } catch (err) {
      console.warn('[RootLayout] Error in notification setup:', err);
    }
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
