import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MobileAgentDetail } from '../../types/orbit';
import { OrbitTokens } from '../../design-system/tokens';
import { GlassCard } from '../../design-system/primitives/GlassCard';
import { AstryxBadge } from '../../design-system/primitives/AstryxBadge';
import { AstryxButton } from '../../design-system/primitives/AstryxButton';
import { Play, Pause, Square, Terminal, Cpu, Sparkles } from 'lucide-react-native';

interface AgentTileProps {
  agent: MobileAgentDetail;
  onPause: () => void;
  onStop: () => void;
  onHandoff: () => void;
  onOpenTerminal?: () => void;
  isPausing?: boolean;
}

export const AgentTile: React.FC<AgentTileProps> = ({
  agent,
  onPause,
  onStop,
  onHandoff,
  onOpenTerminal,
  isPausing = false,
}) => {
  const isWorking = agent.status === 'working';
  const isPaused = agent.status === 'paused';

  return (
    <GlassCard active={isWorking}>
      {/* Header */}
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <Cpu size={18} color={isWorking ? '#38BDF8' : '#94A3B8'} />
        </View>

        <View style={styles.identity}>
          <Text style={styles.agentName}>@{agent.name}</Text>
          <Text style={styles.providerText}>
            {agent.provider.toUpperCase()} • {Math.floor(agent.runtimeSeconds / 60)}m active
          </Text>
        </View>

        <AstryxBadge
          label={agent.status}
          variant={isWorking ? 'primary' : isPaused ? 'warning' : 'neutral'}
          showDot={isWorking}
        />
      </View>

      {/* Task Preview */}
      <Pressable
        onPress={onOpenTerminal}
        style={({ pressed }) => [styles.taskBox, pressed && styles.taskBoxPressed]}
      >
        <View style={styles.taskHeader}>
          <Sparkles size={12} color="#38BDF8" />
          <Text style={styles.taskHeaderLabel}>Current Task</Text>
        </View>
        <Text style={styles.taskDescription} numberOfLines={2}>
          {agent.currentTaskDescription || 'Standing by for new task instructions'}
        </Text>
      </Pressable>

      {/* Telemetry Row */}
      <View style={styles.metricsRow}>
        <Text style={styles.metaText}>{agent.tokensUsed.toLocaleString()} tokens</Text>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.metaText}>{agent.filesTouchedCount} files touched</Text>
      </View>

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
          style={{ flex: 1 }}
        />
        <AstryxButton
          label="Inspect Logs"
          variant="glass"
          size="sm"
          onPress={onOpenTerminal || (() => {})}
          icon={<Terminal size={12} color="#FFFFFF" />}
          style={{ flex: 1 }}
        />
        <AstryxButton
          label=""
          variant="danger"
          size="sm"
          onPress={onStop}
          icon={<Square size={12} color={OrbitTokens.colors.accent.danger} />}
          style={{ width: 40 }}
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  agentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  providerText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#94A3B8',
  },
  taskBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: OrbitTokens.radii.sm,
    borderWidth: 1,
    borderColor: OrbitTokens.border.glassHairline,
    padding: 12,
    marginBottom: 12,
  },
  taskBoxPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  taskHeaderLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8',
  },
  taskDescription: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  bullet: {
    color: '#64748B',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
