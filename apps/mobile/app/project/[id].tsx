import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLiveRelayStore } from '../../src/stores/liveRelay.store';
import { mobileRelayService } from '../../src/services/mobileRelay.service';
import { AgentTile } from '../../src/components/agent/AgentTile';
import { AgentTerminalModal } from '../../src/components/agent/AgentTerminalModal';
import { MobileAgentDetail } from '../../src/types/orbit';
import { AstryxBadge } from '../../src/design-system/primitives/AstryxBadge';
import { GlassCard } from '../../src/design-system/primitives/GlassCard';
import { ArrowLeft, GitBranch, LayoutGrid, Users, Zap, Clock, ShieldAlert } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id || '';

  // Direct Live Zero-Cache Subscription
  const project = useLiveRelayStore((s) => s.projects.find((p) => p.id === projectId));
  const allAgents = useLiveRelayStore((s) => s.agents);

  // Filter agents belonging to this project (or all if in single-workspace mode)
  const projectAgents = allAgents.filter((a) => !a.workspaceId || a.workspaceId === projectId);

  const [activeTerminalAgent, setActiveTerminalAgent] = useState<MobileAgentDetail | null>(null);

  // Categorize agents: Active Now vs Live & Ready vs Historical / Offline Conversations
  const workingAgents = projectAgents.filter(
    (a) => (a.status === 'working' || a.status === 'starting') && (a.runtime?.isAlive ?? a.isLive ?? true)
  );
  const liveReadyAgents = projectAgents.filter(
    (a) => (a.status === 'ready' || a.status === 'waiting') && (a.runtime?.isAlive ?? a.isLive ?? true)
  );
  const historicalAgents = projectAgents.filter(
    (a) => !workingAgents.includes(a) && !liveReadyAgents.includes(a)
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.responsiveWrapper}>
        {/* Top Nav Bar */}
        <View style={styles.navBar}>
          <Pressable
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              router.back();
            }}
            style={styles.backButton}
            hitSlop={8}
          >
            <ArrowLeft size={18} color="#FFF7ED" />
          </Pressable>

          <View style={styles.navTitleBox}>
            <Text style={styles.navTitle} numberOfLines={1}>
              {project?.name || 'Project Details'}
            </Text>
          </View>

          <View style={styles.branchPill}>
            <GitBranch size={12} color="#FB923C" />
            <Text style={styles.branchText} numberOfLines={1}>
              {project?.gitBranch || 'main'}
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Workspace Hero Overview */}
          <GlassCard>
            <View style={styles.heroTop}>
              <Text style={styles.heroName} numberOfLines={1}>{project?.name || 'Workspace'}</Text>
              <AstryxBadge
                label={workingAgents.length > 0 ? `${workingAgents.length} Active` : liveReadyAgents.length > 0 ? `${liveReadyAgents.length} Live` : 'Offline'}
                variant={workingAgents.length > 0 ? 'primary' : liveReadyAgents.length > 0 ? 'primary' : 'neutral'}
                showDot={workingAgents.length > 0}
              />
            </View>
            <Text style={styles.projectPath} numberOfLines={1}>{project?.projectPath}</Text>

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Total Sessions</Text>
                <Text style={[styles.metricValue, projectAgents.length > 0 && { color: '#FB923C' }]}>
                  {projectAgents.length}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Active Live</Text>
                <Text style={[styles.metricValue, workingAgents.length > 0 && { color: '#34D399' }]}>
                  {workingAgents.length}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Telemetry</Text>
                <Text style={[styles.metricValue, { color: '#34D399' }]}>Live</Text>
              </View>
            </View>
          </GlassCard>

          {/* Section 1: Active Now */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleGroup}>
              <Zap size={15} color="#FB923C" />
              <Text style={styles.sectionTitle}>Active Now</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{workingAgents.length}</Text>
            </View>
          </View>

          {workingAgents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Clock size={18} color="#8C827A" />
              <Text style={styles.emptyCardText}>No agents currently running active tasks in this project.</Text>
            </View>
          ) : (
            workingAgents.map((agent) => (
              <AgentTile
                key={agent.id}
                agent={agent}
                onPause={() => mobileRelayService.sendAction('PAUSE', agent.id, projectId)}
                onStop={() => mobileRelayService.sendAction('STOP', agent.id, projectId)}
                onHandoff={() => {}}
                onOpenTerminal={() => setActiveTerminalAgent(agent)}
              />
            ))
          )}

          {/* Section 2: Live & Ready (Only if there are live ready agents) */}
          {liveReadyAgents.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { marginTop: 12 }]}>
                <View style={styles.sectionTitleGroup}>
                  <Users size={15} color="#34D399" />
                  <Text style={styles.sectionTitle}>Live & Ready</Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
                  <Text style={[styles.countBadgeText, { color: '#34D399' }]}>{liveReadyAgents.length}</Text>
                </View>
              </View>

              {liveReadyAgents.map((agent) => (
                <AgentTile
                  key={agent.id}
                  agent={agent}
                  onPause={() => mobileRelayService.sendAction('PAUSE', agent.id, projectId)}
                  onStop={() => mobileRelayService.sendAction('STOP', agent.id, projectId)}
                  onHandoff={() => {}}
                  onOpenTerminal={() => setActiveTerminalAgent(agent)}
                />
              ))}
            </>
          )}

          {/* Section 3: Previous Conversations / Historical Sessions */}
          {historicalAgents.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { marginTop: 12 }]}>
                <View style={styles.sectionTitleGroup}>
                  <Users size={15} color="#8C827A" />
                  <Text style={styles.sectionTitle}>Recent Conversations</Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
                  <Text style={styles.countBadgeText}>{historicalAgents.length}</Text>
                </View>
              </View>

              {historicalAgents.map((agent) => (
                <AgentTile
                  key={agent.id}
                  agent={agent}
                  onPause={() => mobileRelayService.sendAction('PAUSE', agent.id, projectId)}
                  onStop={() => mobileRelayService.sendAction('STOP', agent.id, projectId)}
                  onHandoff={() => {}}
                  onOpenTerminal={() => setActiveTerminalAgent(agent)}
                />
              ))}
            </>
          )}

          {projectAgents.length === 0 && (
            <View style={styles.emptyCard}>
              <ShieldAlert size={18} color="#8C827A" />
              <Text style={styles.emptyCardText}>No agent sessions in this workspace yet. Start a conversation on Orbit Desktop to interact with it here.</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Interactive Agent Terminal & Live Input Modal */}
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
    backgroundColor: '#0B0A0D',
  },
  responsiveWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleBox: {
    flex: 1,
    marginHorizontal: 12,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF7ED',
    letterSpacing: -0.2,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 146, 60, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  branchText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FB923C',
    fontFamily: 'monospace',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
    gap: 12,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF7ED',
    letterSpacing: -0.4,
  },
  projectPath: {
    fontSize: 11.5,
    fontFamily: 'monospace',
    color: '#8C827A',
    marginTop: 4,
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: '#D6C7B8',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF7ED',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF7ED',
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: 'rgba(251, 146, 60, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FB923C',
  },
  emptyCard: {
    backgroundColor: 'rgba(23, 20, 28, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyCardText: {
    fontSize: 12.5,
    color: '#8C827A',
    textAlign: 'center',
  },
});
