import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { usePendingApprovals, useAgentControls } from '../../src/hooks/useAgentControls';
import { Check, X, ShieldAlert, Terminal, MessageSquare, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ApprovalsScreen() {
  const { data: approvals, isLoading, isRefetching, refetch } = usePendingApprovals();
  const { approveAction, isApproving } = useAgentControls();

  return (
    <View className="flex-1 bg-[#090A0F] px-4 pt-12">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <Text className="text-white font-mono font-bold text-lg">TERMINAL APPROVALS</Text>
          <Text className="text-zinc-400 font-mono text-xs">
            Approve or reject CLI commands requested by your agents
          </Text>
        </View>

        <View className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
          <Text className="text-amber-400 font-mono text-xs font-bold">
            {approvals?.length || 0} Waiting
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : !approvals || approvals.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <View className="w-14 h-14 rounded-3xl bg-[#141620] border border-white/10 flex items-center justify-center mb-3.5 shadow-lg">
            <ShieldCheck size={24} color="#10B981" />
          </View>
          <Text className="text-white font-mono font-bold text-sm mb-1">No Actions Pending</Text>
          <Text className="text-zinc-400 font-mono text-xs text-center max-w-xs leading-relaxed">
            When an agent (like Claude Code or AGY) asks to run a sensitive command (e.g. `git push` or `rm -rf`), it will appear here for 1-tap mobile approval.
          </Text>
        </View>
      ) : (
        <FlatList
          data={approvals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LinearGradient
              colors={['#161822', '#0E1017']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="p-4.5 border border-white/[0.08] rounded-3xl mb-3.5"
            >
              {/* Agent Identifier */}
              <View className="flex-row justify-between items-center mb-2.5">
                <View className="flex-row items-center gap-2">
                  <ShieldAlert size={14} color="#F59E0B" />
                  <Text className="text-amber-400 font-mono font-bold text-xs">
                    @{item.agentName}
                  </Text>
                </View>
                <Text className="text-zinc-400 font-mono text-[10px] uppercase font-bold">
                  {item.provider}
                </Text>
              </View>

              {/* Action Question */}
              <Text className="text-white font-mono text-xs font-semibold mb-2.5 leading-relaxed">
                {item.question}
              </Text>

              {/* Command Preview if any */}
              {item.commandSnippet && (
                <View className="p-3 bg-black/60 border border-white/[0.06] rounded-2xl mb-3.5">
                  <Text className="text-emerald-400 font-mono text-xs font-semibold">
                    $ {item.commandSnippet}
                  </Text>
                </View>
              )}

              {/* Quick Approval Buttons */}
              <View className="flex-row items-center gap-2.5 pt-3 border-t border-white/[0.06]">
                <Pressable
                  onPress={() =>
                    approveAction({
                      agentId: item.agentId,
                      approvalId: item.id,
                      decision: 'APPROVE',
                    })
                  }
                  disabled={isApproving}
                  className="flex-1 py-3 rounded-2xl bg-emerald-500 items-center justify-center flex-row gap-1.5 active:opacity-85 shadow-sm"
                >
                  <Check size={14} color="#000000" strokeWidth={3} />
                  <Text className="text-black font-mono font-bold text-xs">Approve Command</Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    approveAction({
                      agentId: item.agentId,
                      approvalId: item.id,
                      decision: 'REJECT',
                    })
                  }
                  disabled={isApproving}
                  className="flex-1 py-3 rounded-2xl bg-white/[0.06] border border-white/10 items-center justify-center flex-row gap-1.5 active:opacity-85"
                >
                  <X size={14} color="#EF4444" strokeWidth={3} />
                  <Text className="text-red-400 font-mono font-bold text-xs">Reject</Text>
                </Pressable>
              </View>
            </LinearGradient>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#10B981"
            />
          }
        />
      )}
    </View>
  );
}
