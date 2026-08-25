import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutGrid, Users, ShieldCheck, Radio } from 'lucide-react-native';
import { CustomTabBar } from '../../src/components/navigation/CustomTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <LayoutGrid size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="swarm"
        options={{
          title: 'Agents',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="actions"
        options={{
          title: 'Approvals',
          tabBarIcon: ({ color, size }) => <ShieldCheck size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Sync',
          tabBarIcon: ({ color, size }) => <Radio size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
