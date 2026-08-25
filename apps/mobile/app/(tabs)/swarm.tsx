import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, KeyboardAvoidingView,
  Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mobileRelayService } from '../../src/services/mobileRelay.service';
import { MobileAgentDetail } from '../../src/types/orbit';
import { AgentTile } from '../../src/components/agent/AgentTile';
import { AgentTerminalModal } from '../../src/components/agent/AgentTerminalModal';
import { AstryxButton } from '../../src/design-system/primitives/AstryxButton';
import { OrbitTokens } from '../../src/design-system/tokens';
import { Send, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function AgentsScreen() {
  const [agents, setAgents] = useState<MobileAgentDetail[]>(mobileRelayService.latestState.agents);
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTerminalAgent, setActiveTerminalAgent] = useState<MobileAgentDetail | null>(null);

  useEffect(() => {
    mobileRelayService.connect();
    const unsub = mobileRelayService.subscribe(() => setAgents(mobileRelayService.latestState.agents));
    return unsub;
  }, []);

  const handleBroadcast = () => {
    if (!prompt.trim() || sending) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setSending(true);
    agents.forEach((a) => mobileRelayService.sendAction('SEND_INPUT', a.id, undefined, { input: prompt }));
    setPrompt('');
    setTimeout(() => setSending(false), 500);
  };

  const totalTokens = agents.reduce((acc, curr) => acc + curr.tokensUsed, 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appGreeting}>Workstation</Text>
            <Text style={styles.pageTitle}>Active Agents</Text>
          </View>

          <View style={styles.metricPill}>
            <Text style={styles.metricPillText}>
              {(totalTokens / 1000).toFixed(1)}k tokens
            </Text>
          </View>
        </View>

        {/* Worker Stream */}
        {agents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Users size={26} color="#60A5FA" />
            </View>
            <Text style={styles.emptyTitle}>No Active Agents</Text>
            <Text style={styles.emptySubtitle}>
              Launch an agent in Orbit on your desktop to inspect live outputs and send commands.
            </Text>
          </View>
        ) : (
          <FlatList
            data={agents}
            keyExtractor={(a) => a.id}
            renderItem={({ item }) => (
              <AgentTile
                agent={item}
                onPause={() => mobileRelayService.sendAction('PAUSE', item.id)}
                onStop={() => mobileRelayService.sendAction('STOP', item.id)}
                onHandoff={() => {}}
                onOpenTerminal={() => setActiveTerminalAgent(item)}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Floating Broadcast Pill Bar */}
        <View style={styles.broadcastContainer}>
          <View style={styles.broadcastBox}>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Send instruction to all agents..."
              placeholderTextColor="#64748B"
              style={styles.textInput}
              returnKeyType="send"
              onSubmitEditing={handleBroadcast}
            />
            <AstryxButton
              label=""
              variant="primary"
              size="sm"
              onPress={handleBroadcast}
              disabled={!prompt.trim() || sending}
              isLoading={sending}
              icon={<Send size={15} color="#FFFFFF" />}
              style={{ width: 36, height: 36 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Terminal Modal */}
      {activeTerminalAgent && (
        <AgentTerminalModal
          agent={activeTerminalAgent}
          isOpen={!!activeTerminalAgent}
          onClose={() => setActiveTerminalAgent(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#070B14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  appGreeting: {
    fontSize: 13,
    fontWeight: '600',
    color: '#60A5FA',
    letterSpacing: -0.2,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  metricPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: OrbitTokens.radii.pill,
  },
  metricPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 8,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  broadcastContainer: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
  },
  broadcastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: OrbitTokens.radii.pill,
    borderWidth: 1,
    borderColor: OrbitTokens.border.glassSpecular,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
    ...OrbitTokens.shadows.depth3D,
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#FFFFFF',
    height: 40,
  },
});
