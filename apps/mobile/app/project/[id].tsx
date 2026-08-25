import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProjectDetail } from '../../src/hooks/useProjects';
import { useAgentsByProject, useAgentControls } from '../../src/hooks/useAgentControls';
import { AgentTile } from '../../src/components/agent/AgentTile';
import { AgentTerminalModal } from '../../src/components/agent/AgentTerminalModal';
import { WhatsHappeningModal } from '../../src/components/brief/WhatsHappeningModal';
import { briefModule } from '../../src/modules/brief.module';
import { MobileWhatsHappeningBrief, MobileAgentDetail } from '../../src/types/orbit';
import { AstryxSkeleton } from '../../src/design-system/primitives/AstryxSkeleton';
import { AstryxBadge } from '../../src/design-system/primitives/AstryxBadge';
import { AstryxButton } from '../../src/design-system/primitives/AstryxButton';
import { GlassCard } from '../../src/design-system/primitives/GlassCard';
import { OrbitTokens } from '../../src/design-system/tokens';
import { ArrowLeft, GitBranch, Sparkles, FolderGit2, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id || '';

  const { data: project, isLoading: isProjectLoading, refetch: refetchProject } = useProjectDetail(projectId);
  const { data: agents, isLoading: isAgentsLoading, refetch: refetchAgents } = useAgentsByProject(projectId);
  const { pauseAgent, stopAgent, isPausing } = useAgentControls(projectId);

  const [activeAgent, setActiveAgent] = useState<MobileAgentDetail | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefData, setBriefData] = useState<MobileWhatsHappeningBrief | undefined>();
  const [briefLoading, setBriefLoading] = useState(false);

  const openBrief = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setBriefOpen(true);
    setBriefLoading(true);
    try {
      const res = await briefModule.getWhatsHappeningSummary(projectId);
      setBriefData(res);
    } catch (e) {
      console.warn(e);
    } finally {
      setBriefLoading(false);
    }
  };

  const activeCount = agents?.filter((a) => a.status === 'working').length ?? 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
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
        >
          <ArrowLeft size={18} color="#FFFFFF" />
        </Pressable>

        <View style={styles.navTitleBox}>
          <Text style={styles.navTitle} numberOfLines={1}>
            {project?.name || 'Workspace'}
          </Text>
        </View>

        <View style={styles.branchPill}>
          <GitBranch size={13} color="#38BDF8" />
          <Text style={styles.branchText}>{project?.gitBranch || 'main'}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isProjectLoading || isAgentsLoading}
            onRefresh={() => {
              refetchProject();
              refetchAgents();
            }}
            tintColor="#38BDF8"
          />
        }
      >
        {/* Workspace Hero Card */}
        <GlassCard>
          <Text style={styles.heroName}>{project?.name || 'Workspace'}</Text>
          <Text style={styles.projectPath} numberOfLines={1}>{project?.projectPath}</Text>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Active Agents</Text>
              <Text style={[styles.metricValue, activeCount > 0 && { color: '#38BDF8' }]}>
                {activeCount}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Modified</Text>
              <Text style={styles.metricValue}>{project?.filesModifiedCount ?? 0} files</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Freshness</Text>
              <Text style={[styles.metricValue, { color: '#38BDF8' }]}>
                {project?.contextFreshnessPercentage ?? 0}%
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* AI Synthesis Brief Card */}
        <GlassCard onPress={openBrief} active>
          <View style={styles.briefRow}>
            <View style={styles.briefIconCircle}>
              <Sparkles size={18} color="#38BDF8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.briefTitle}>What's Happening?</Text>
              <Text style={styles.briefSubtitle}>
                1-tap multi-agent memory synthesis & task digest
              </Text>
            </View>
            <AstryxButton
              label="View"
              variant="primary"
              size="sm"
              onPress={openBrief}
            />
          </View>
        </GlassCard>

        {/* Agents Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Workspace Agents</Text>
          <AstryxBadge label={`${agents?.length || 0}`} variant="neutral" />
        </View>

        {isAgentsLoading ? (
          <View style={styles.skeletonBox}>
            <AstryxSkeleton height={140} borderRadius={24} style={{ marginBottom: 14 }} />
          </View>
        ) : !agents || agents.length === 0 ? (
          <GlassCard>
            <Text style={styles.emptyAgentsText}>No agents currently running in this workspace</Text>
          </GlassCard>
        ) : (
          agents.map((agent) => (
            <AgentTile
              key={agent.id}
              agent={agent}
              onPause={() => pauseAgent(agent.id)}
              onStop={() => stopAgent(agent.id)}
              onHandoff={() => {}}
              onOpenTerminal={() => setActiveAgent(agent)}
              isPausing={isPausing}
            />
          ))
        )}
      </ScrollView>

      {/* Terminal & Brief Modals */}
      {activeAgent && (
        <AgentTerminalModal
          agent={activeAgent}
          isOpen={!!activeAgent}
          onClose={() => setActiveAgent(null)}
        />
      )}
      <WhatsHappeningModal
        isOpen={briefOpen}
        onClose={() => setBriefOpen(false)}
        brief={briefData}
        isLoading={briefLoading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  navTitleBox: {
    flex: 1,
    paddingHorizontal: 12,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: OrbitTokens.radii.pill,
  },
  branchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#BAE6FD',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  projectPath: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 14,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  briefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  briefIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  briefTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  briefSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  skeletonBox: {
    gap: 12,
  },
  emptyAgentsText: {
    fontSize: 13.5,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
