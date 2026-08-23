import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FolderGit2, ShieldAlert, Settings as SettingsIcon } from 'lucide-react-native';
import { Platform, View } from 'react-native';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  // Dynamically compute bottom padding so Android navigation bars and iOS home indicators never overlap
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 16);
  const barHeight = 58 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0D0E13',
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 1,
          height: barHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          position: 'relative',
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 2,
        },
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#71717A',
        tabBarLabelStyle: {
          fontFamily: 'monospace',
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Cockpit',
          tabBarIcon: ({ color, focused }) => (
            <View className={`items-center justify-center p-1 rounded-xl ${focused ? 'bg-emerald-500/10' : ''}`}>
              <FolderGit2 size={18} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="actions"
        options={{
          title: 'Approvals',
          tabBarIcon: ({ color, focused }) => (
            <View className={`items-center justify-center p-1 rounded-xl ${focused ? 'bg-emerald-500/10' : ''}`}>
              <ShieldAlert size={18} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Sync',
          tabBarIcon: ({ color, focused }) => (
            <View className={`items-center justify-center p-1 rounded-xl ${focused ? 'bg-emerald-500/10' : ''}`}>
              <SettingsIcon size={18} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
