import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProjectDetail } from '../../src/hooks/useProjects';
import { useAgentsByProject, useAgentControls } from '../../src/hooks/useAgentControls';
import { AgentTile } from '../../src/components/agent/AgentTile';
import { WhatsHappeningModal } from '../../src/components/brief/WhatsHappeningModal';
import { briefModule } from '../../src/modules/brief.module';
import { MobileWhatsHappeningBrief } from '../../src/types/orbit';
import { ArrowLeft, Sparkles, FolderGit2, ShieldCheck, GitBranch } from 'lucide-react-native';

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id || '';

  const { data: project, isLoading: isProjectLoading, refetch: refetchProject } = useProjectDetail(projectId);
  const { data: agents, isLoading: isAgentsLoading, refetch: refetchAgents } = useAgentsByProject(projectId);
  const { pauseAgent, stopAgent, isPausing } = useAgentControls(projectId);

  const [isBriefOpen, setIsBriefOpen] = useState(false);
  const [briefData, setBriefData] = useState<MobileWhatsHappeningBrief | undefined>();
  const [isBriefLoading, setIsBriefLoading] = useState(false);

  const handleOpenBrief = async () => {
    setIsBriefOpen(true);
    setIsBriefLoading(true);
    try {
      const res = await briefModule.getWhatsHappeningSummary(projectId);
      setBriefData(res);
    } catch (e) {
      console.warn('Failed to fetch brief summary:', e);
    } finally {
      setIsBriefLoading(false);
    }
  };

  const isRefreshing = isProjectLoading || isAgentsLoading;
  const handleRefresh = () => {
    refetchProject();
    refetchAgents();
  };

  return (
    <View className="flex-1 bg-[#0A0B0E] px-4 pt-12">
      
      {/* Top Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Pressable
          onPress={() => router.back()}
          className="w-8 h-8 rounded-lg bg-[#121318] border border-white/10 flex items-center justify-center active:opacity-75"
        >
          <ArrowLeft size={16} color="#FFFFFF" />
        </Pressable>

        <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08]">
          <GitBranch size={11} color="#A1A1AA" />
          <Text className="text-zinc-300 font-mono text-xs font-semibold">
            {project?.gitBranch || 'main'}
          </Text>
        </View>
      </View>

      {/* Project Title & Path */}
      <View className="mb-4">
        <Text className="text-white font-mono font-bold text-xl mb-1">
          {project?.name || 'Project Cockpit'}
        </Text>
        <Text className="text-zinc-400 font-mono text-xs truncate">
          {project?.projectPath}
        </Text>
      </View>

      {/* The Killer Button: What's Happening */}
      <Pressable
        onPress={handleOpenBrief}
        className="w-full p-3.5 bg-gradient-to-r from-emerald-500/20 via-indigo-500/20 to-emerald-500/20 border border-emerald-500/30 rounded-2xl flex-row items-center justify-between mb-5 shadow-lg active:opacity-80"
      >
        <View className="flex-row items-center gap-2.5">
          <View className="w-7 h-7 rounded-xl bg-emerald-500/30 flex items-center justify-center">
            <Sparkles size={14} color="#10B981" />
          </View>
          <View>
            <Text className="text-white font-mono font-bold text-xs">WHAT'S HAPPENING?</Text>
            <Text className="text-zinc-400 font-mono text-[10.5px]">1-Tap Plain-English AI Digest</Text>
          </View>
        </View>

        <View className="px-2.5 py-1 rounded-lg bg-white text-black">
          <Text className="text-black font-mono font-bold text-[11px]">View Brief →</Text>
        </View>
      </Pressable>

      {/* Active Agents Section */}
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-zinc-400 font-mono text-xs uppercase tracking-widest font-bold">
          Active Swarm ({agents?.length || 0})
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#10B981"
          />
        }
      >
        {isAgentsLoading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : !agents || agents.length === 0 ? (
          <View className="p-6 bg-[#121318] border border-white/10 rounded-2xl items-center justify-center">
            <Text className="text-zinc-400 font-mono text-xs">No active agents in this workspace.</Text>
          </View>
        ) : (
          agents.map((agent) => (
            <AgentTile
              key={agent.id}
              agent={agent}
              onPause={() => pauseAgent(agent.id)}
              onStop={() => stopAgent(agent.id)}
              onHandoff={() => {
                // Navigate or trigger remote handoff
              }}
              isPausing={isPausing}
            />
          ))
        )}
      </ScrollView>

      {/* Brief Modal */}
      <WhatsHappeningModal
        isOpen={isBriefOpen}
        onClose={() => setIsBriefOpen(false)}
        brief={briefData}
        isLoading={isBriefLoading}
      />
    </View>
  );
}
