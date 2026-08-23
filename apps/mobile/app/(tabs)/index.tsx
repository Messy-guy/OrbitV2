import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useProjects } from '../../src/hooks/useProjects';
import { ProjectCard } from '../../src/components/project/ProjectCard';
import { mobileRelayService } from '../../src/services/mobileRelay.service';
import { useRouter } from 'expo-router';
import { Orbit, Wifi, Sparkles, Plus, Zap, Laptop } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProjectsCockpitScreen() {
  const router = useRouter();
  const { data: projects, isLoading, isRefetching, refetch, error } = useProjects();
  const [isDesktopConnected, setIsDesktopConnected] = useState(mobileRelayService.latestState.isDesktopOnline);

  useEffect(() => {
    mobileRelayService.connect();
    const unsubscribe = mobileRelayService.subscribe(() => {
      setIsDesktopConnected(mobileRelayService.latestState.isDesktopOnline);
    });
    return unsubscribe;
  }, []);

  return (
    <View className="flex-1 bg-[#090A0F] px-4 pt-12">
      {/* Dynamic Top Glow Ambient Layer */}
      <View
        className="absolute top-0 left-0 right-0 h-48 opacity-25"
        pointerEvents="none"
      >
        <LinearGradient
          colors={['#10B981', '#6366F1', 'transparent']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          className="flex-1"
        />
      </View>

      {/* App Header */}
      <View className="flex-row justify-between items-center mb-6">
        <View className="flex-row items-center gap-2.5">
          <View className="w-9 h-9 rounded-2xl bg-[#141620] border border-white/10 flex items-center justify-center shadow-lg">
            <Orbit size={18} color="#10B981" />
          </View>
          <View>
            <Text className="text-white font-mono font-bold text-lg tracking-wider">ORBIT</Text>
            <Text className="text-zinc-400 font-mono text-[10px] uppercase tracking-widest font-semibold">
              Mobile Command Center
            </Text>
          </View>
        </View>

        {/* Desktop Connection Indicator */}
        <View className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm ${
          isDesktopConnected
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-zinc-800 border-zinc-700'
        }`}>
          <View className={`w-2 h-2 rounded-full ${
            isDesktopConnected ? 'bg-emerald-400' : 'bg-zinc-500'
          }`} />
          <Text className={`font-mono text-xs font-bold ${
            isDesktopConnected ? 'text-emerald-400' : 'text-zinc-400'
          }`}>
            {isDesktopConnected ? 'Desktop Synced' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Section Header */}
      <View className="flex-row justify-between items-center mb-3.5 px-1">
        <Text className="text-zinc-400 font-mono text-xs uppercase tracking-widest font-bold">
          Active Workspaces ({projects?.length || 0})
        </Text>
      </View>

      {/* Projects List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#10B981" />
          <Text className="text-zinc-400 font-mono text-xs mt-3">Connecting to Desktop...</Text>
        </View>
      ) : !projects || projects.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <View className="w-14 h-14 rounded-3xl bg-[#141620] border border-white/10 flex items-center justify-center mb-3.5 shadow-lg">
            <Orbit size={24} color="#10B981" />
          </View>
          <Text className="text-white font-mono font-bold text-sm mb-1">No Active Workspaces</Text>
          <Text className="text-zinc-400 font-mono text-xs text-center max-w-xs leading-relaxed mb-4">
            Link your phone in the <Text className="text-emerald-400 font-bold">Sync</Text> tab to see your real-time desktop workspaces and active agents.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/settings')}
            className="px-4 py-2.5 rounded-2xl bg-emerald-500 active:opacity-85"
          >
            <Text className="text-black font-mono font-bold text-xs">Pair Workstation →</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => router.push(`/project/${item.id}`)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#10B981"
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
        />
      )}
    </View>
  );
}
