import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MobileAgentDetail } from '../../types/orbit';
import { GlassCard } from '../../design-system/primitives/GlassCard';
import { AstryxBadge } from '../../design-system/primitives/AstryxBadge';
import { AstryxButton } from '../../design-system/primitives/AstryxButton';
import { Play, Pause, Bot, MessageSquare } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface AgentTileProps {
  agent: MobileAgentDetail;
  onPause: () => void;
  onStop: () => void;
  onHandoff?: () => void;
  onOpenTerminal?: () => void;
  isPausing?: boolean;
}

export const AgentTile: React.FC<AgentTileProps> = ({
  agent,
  onPause,
  onOpenTerminal,
  isPausing = false,
}) => {
  const isWorking = agent.status === 'working';
  const isStarting = agent.status === 'starting';
  const isReady = (agent.status === 'ready' || agent.status === 'waiting') && (agent.runtime?.isAlive ?? agent.isLive ?? true);
  const isPaused = agent.status === 'paused';
  const isError = agent.status === 'error';
  const isOffline = !isWorking && !isStarting && !isReady && !isPaused && !isError;

  const badgeLabel = isWorking ? 'Working' : isStarting ? 'Starting' : isReady ? 'Ready' : isPaused ? 'Paused' : isError ? 'Error' : 'Offline';
  const badgeVariant = isWorking ? 'primary' : isStarting ? 'warning' : isReady ? 'primary' : isPaused ? 'warning' : isError ? 'danger' : 'neutral';
  const showBadgeDot = isWorking || isStarting;

  const preview = agent.preview || agent.currentTaskDescription || (isOffline ? 'Offline · Tap to view previous conversation' : 'Ready for conversation...');

  return (
    <GlassCard active={isWorking}>
      {/* Header */}
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <Bot size={18} color={isWorking ? '#FB923C' : isReady ? '#34D399' : '#94A3B8'} />
        </View>

        <View style={styles.identity}>
          <Text style={styles.agentName}>{agent.title || `@${agent.name}`}</Text>
          <Text style={styles.providerText}>
            {agent.provider.toUpperCase()} • {agent.name.toUpperCase()}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <AstryxBadge
            label={badgeLabel}
            variant={badgeVariant}
            showDot={showBadgeDot}
          />
          {agent.fidelity?.conversation && (
            <View style={styles.fidelityPill}>
              <Text style={[styles.fidelityText, agent.fidelity.conversation === 'STRUCTURED' ? styles.fidelityStructured : styles.fidelityFallback]}>
                {agent.fidelity.conversation === 'STRUCTURED' ? 'STRUCTURED' : 'TERMINAL'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Conversation Preview Box */}
      <Pressable
        onPress={() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
          onOpenTerminal?.();
        }}
        style={({ pressed }) => [styles.taskBox, pressed && styles.taskBoxPressed]}
      >
        <View style={styles.taskHeader}>
          <MessageSquare size={12} color="#FB923C" />
          <Text style={styles.taskHeaderLabel}>Latest Conversation</Text>
        </View>
        <Text style={styles.taskDescription} numberOfLines={2}>
          {preview}
        </Text>
      </Pressable>

      {/* Actions Row */}
      <View style={styles.actionsRow}>
        <AstryxButton
          label={isPaused ? 'Resume' : 'Pause'}
          variant={isPaused ? 'primary' : 'glass'}
          size="sm"
          onPress={onPause}
          isLoading={isPausing}
          icon={
            isPaused ? (
              <Play size={12} color="#FFFFFF" />
            ) : (
              <Pause size={12} color="#FFFFFF" />
            )
          }
          style={{ width: 90 }}
        />
        <AstryxButton
          label="Open Chat"
          variant="primary"
          size="sm"
          onPress={onOpenTerminal || (() => {})}
          icon={<MessageSquare size={12} color="#FFFFFF" />}
          style={{ flex: 1 }}
        />
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  identity: {
    flex: 1,
  },
  agentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF7ED',
    letterSpacing: -0.2,
  },
  providerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.2,
    marginTop: 1,
  },
  taskBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 12,
  },
  taskBoxPressed: {
    backgroundColor: 'rgba(251, 146, 60, 0.06)',
    borderColor: 'rgba(251, 146, 60, 0.2)',
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  taskHeaderLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FB923C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taskDescription: {
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fidelityPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  fidelityText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  fidelityStructured: {
    color: '#34d399',
  },
  fidelityFallback: {
    color: '#a1a1aa',
  },
});
