import React from 'react';
import '../global.css';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s cache freshness
      gcTime: 1000 * 60 * 10, // 10 min cache garbage collection
      retry: 1,
    },
  },
});

export default function RootLayout() {
  return (
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
  );
}
