import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { MobileAgentDetail } from '../../types/orbit';
import { Pause, Square, ArrowLeftRight, Terminal, Cpu, Code2, Play, Flame } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AgentTileProps {
  agent: MobileAgentDetail;
  onPause: () => void;
  onStop: () => void;
  onHandoff: () => void;
  isPausing?: boolean;
}

export const AgentTile: React.FC<AgentTileProps> = ({
  agent,
  onPause,
  onStop,
  onHandoff,
  isPausing,
}) => {
  const isWorking = agent.status === 'working';
  const isPaused = agent.status === 'paused';

  const getProviderBadge = () => {
    switch (agent.provider) {
      case 'antigravity':
        return {
          icon: <Text className="text-emerald-400 font-mono font-bold text-xs">▲</Text>,
          bg: 'bg-emerald-500/15',
          border: 'border-emerald-500/30',
          label: 'AGY',
        };
      case 'claude':
        return {
          icon: <Cpu size={13} color="#F59E0B" />,
          bg: 'bg-amber-500/15',
          border: 'border-amber-500/30',
          label: 'CLAUDE',
        };
      case 'opencode':
        return {
          icon: <Code2 size={13} color="#06B6D4" />,
          bg: 'bg-cyan-500/15',
          border: 'border-cyan-500/30',
          label: 'CODEX',
        };
      default:
        return {
          icon: <Terminal size={13} color="#A1A1AA" />,
          bg: 'bg-white/10',
          border: 'border-white/20',
          label: 'TERMINAL',
        };
    }
  };

  const badge = getProviderBadge();

  return (
    <View
      className="mb-3.5 rounded-3xl overflow-hidden"
      style={{
        shadowColor: isWorking ? '#10B981' : '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isWorking ? 0.12 : 0.05,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <LinearGradient
        colors={['#161822', '#0E1017']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-4.5 border border-white/[0.08] rounded-3xl"
      >
        {/* Top Header */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center gap-2.5">
            <View className={`w-7 h-7 rounded-xl ${badge.bg} border ${badge.border} flex items-center justify-center`}>
              {badge.icon}
            </View>
            <View>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-white font-mono font-bold text-sm tracking-tight">{agent.name}</Text>
                {agent.profileId && agent.profileId !== 'default' && (
                  <View className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30">
                    <Text className="text-indigo-400 font-mono text-[9px] uppercase font-bold">
                      {agent.profileId}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Status Badge */}
          <View
            className={`px-3 py-1 rounded-full border flex-row items-center gap-1.5 ${
              isWorking
                ? 'bg-emerald-500/15 border-emerald-500/30'
                : isPaused
                ? 'bg-amber-500/15 border-amber-500/30'
                : 'bg-zinc-800 border-zinc-700'
            }`}
          >
            <View
              className={`w-2 h-2 rounded-full ${
                isWorking ? 'bg-emerald-400' : isPaused ? 'bg-amber-400' : 'bg-zinc-400'
              }`}
            />
            <Text
              className={`font-mono text-[10.5px] uppercase font-bold ${
                isWorking ? 'text-emerald-300' : isPaused ? 'text-amber-300' : 'text-zinc-400'
              }`}
            >
              {agent.status}
            </Text>
          </View>
        </View>

        {/* Active Task Terminal Snippet */}
        <View className="p-3 bg-black/50 border border-white/[0.05] rounded-2xl mb-3.5">
          <Text className="text-zinc-300 font-mono text-xs leading-relaxed">
            {agent.currentTaskDescription || 'Ready and listening for swarm commands'}
          </Text>
        </View>

        {/* Telemetry & Action Buttons */}
        <View className="flex-row items-center justify-between pt-3 border-t border-white/[0.06]">
          <View className="flex-row items-center gap-1.5">
            <Flame size={12} color="#F59E0B" />
            <Text className="text-zinc-400 font-mono text-[11px]">
              {agent.tokensUsed.toLocaleString()} tokens • {agent.filesTouchedCount} files
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={onPause}
              disabled={isPausing}
              className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1.5 active:opacity-75 ${
                isPaused
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-white/[0.08] border-white/10 text-white'
              }`}
            >
              {isPausing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : isPaused ? (
                <>
                  <Play size={11} color="#10B981" fill="#10B981" />
                  <Text className="text-emerald-400 font-mono text-xs font-bold">Resume</Text>
                </>
              ) : (
                <>
                  <Pause size={11} color="#FFFFFF" fill="#FFFFFF" />
                  <Text className="text-white font-mono text-xs font-bold">Pause</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={onHandoff}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 active:opacity-75 flex-row items-center gap-1.5"
            >
              <ArrowLeftRight size={11} color="#10B981" />
              <Text className="text-emerald-400 font-mono text-xs font-bold">Handoff</Text>
            </Pressable>

            <Pressable
              onPress={onStop}
              className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 active:opacity-75"
            >
              <Square size={11} color="#EF4444" fill="#EF4444" />
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};
