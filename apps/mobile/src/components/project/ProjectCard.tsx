import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MobileProjectSummary } from '../../types/orbit';
import { FolderGit2, ShieldCheck, ChevronRight, Activity, GitBranch, Cpu } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ProjectCardProps {
  project: MobileProjectSummary;
  onPress: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onPress }) => {
  const isHealthy = project.failingTestsCount === 0;

  return (
    <Pressable
      onPress={onPress}
      className="mb-3.5 rounded-3xl overflow-hidden active:opacity-85"
      style={{
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      <LinearGradient
        colors={['#161822', '#0E1017']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-5 border border-white/[0.08] rounded-3xl"
      >
        {/* Top Glow Ambient Strip */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center gap-2.5 flex-1 min-w-0 pr-2">
            <View className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <FolderGit2 size={16} color="#10B981" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-white font-mono font-bold text-base tracking-tight truncate">
                {project.name}
              </Text>
              <Text className="text-zinc-400 font-mono text-[10.5px] truncate">
                {project.projectPath}
              </Text>
            </View>
          </View>

          {/* Active Agents Capsule */}
          <View className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex-row items-center gap-1.5 shadow-sm">
            <View className="w-2 h-2 rounded-full bg-emerald-400" />
            <Text className="text-emerald-300 font-mono font-bold text-[11px]">
              {project.activeAgentsCount} {project.activeAgentsCount === 1 ? 'Agent' : 'Agents'}
            </Text>
          </View>
        </View>

        {/* Middle: AI Last Turn Digest Card */}
        <View className="p-3 bg-black/40 border border-white/[0.05] rounded-2xl mb-3.5 flex-row items-start gap-2">
          <Activity size={13} color="#A1A1AA" className="mt-0.5 shrink-0" />
          <Text className="text-zinc-300 font-mono text-xs leading-relaxed flex-1" numberOfLines={2}>
            {project.lastActivitySummary || 'Ready for multi-agent dispatch'}
          </Text>
        </View>

        {/* Bottom Metrics Bar */}
        <View className="flex-row items-center justify-between pt-3 border-t border-white/[0.06]">
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1 bg-white/[0.06] px-2.5 py-1 rounded-lg border border-white/[0.08]">
              <GitBranch size={11} color="#A1A1AA" />
              <Text className="text-zinc-300 font-mono text-[11px] font-semibold">
                {project.gitBranch || 'main'}
              </Text>
            </View>

            <Text className="text-zinc-400 font-mono text-[11px]">
              {project.filesModifiedCount} files edited
            </Text>
          </View>

          <View className="flex-row items-center gap-1">
            <View className="flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck size={12} color="#10B981" />
              <Text className="text-emerald-400 font-mono text-[11px] font-bold">
                {project.contextFreshnessPercentage}% Fresh
              </Text>
            </View>
            <ChevronRight size={14} color="#71717A" />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
};
