import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLiveRelayStore } from '../../src/stores/liveRelay.store';
import { ProjectCard } from '../../src/components/project/ProjectCard';
import { SwarmEmergencyBar } from '../../src/components/agent/SwarmEmergencyBar';
import { ApprovalsModal } from '../../src/components/approvals/ApprovalsModal';
import { usePendingApprovals } from '../../src/hooks/useAgentControls';
import { OrbitTokens } from '../../src/design-system/tokens';
import { FolderGit2, Bell, Radio } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

type FilterType = 'all' | 'active' | 'issues';

export default function HomeScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [approvalsModalOpen, setApprovalsModalOpen] = useState(false);

  // Direct zero-cache reactive subscription to live store
  const isConnected = useLiveRelayStore((s) => s.isConnected);
  const projects = useLiveRelayStore((s) => s.projects);
  const agents = useLiveRelayStore((s) => s.agents);

  const { data: approvals } = usePendingApprovals();
  const pendingApprovalsCount = approvals?.length || 0;

  const runningCount = agents.filter((a) => a.status === 'working').length;

  const filtered = useMemo(() => {
    if (!projects) return [];
    if (filter === 'active') return projects.filter((p) => p.activeAgentsCount > 0);
    if (filter === 'issues') return projects.filter((p) => p.failingTestsCount > 0);
    return projects;
  }, [projects, filter]);

  const activeCount = projects?.filter((p) => p.activeAgentsCount > 0).length || 0;
  const issuesCount = projects?.filter((p) => p.failingTestsCount > 0).length || 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Top Header Strip: Greeting + Notification Bell + Connection Indicator */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appGreeting}>Orbit Cockpit</Text>
          <Text style={styles.pageTitle}>Workspaces</Text>
        </View>

        <View style={styles.headerActions}>
          {/* Action Approvals Bell Icon */}
          <Pressable
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              setApprovalsModalOpen(true);
            }}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <Bell size={18} color={pendingApprovalsCount > 0 ? '#FB923C' : '#D6C7B8'} />
            {pendingApprovalsCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{pendingApprovalsCount}</Text>
              </View>
            )}
          </Pressable>

          {/* Sync / Status Pill */}
          <Pressable
            onPress={() => router.push('/(tabs)/sync')}
            style={({ pressed }) => [styles.statusPill, pressed && styles.statusPillPressed]}
          >
            <View style={[styles.statusDot, isConnected ? styles.dotConnected : styles.dotOffline]} />
            <Text style={styles.statusText}>
              {isConnected ? 'Connected' : 'Offline'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Active Agents Emergency Bar */}
      <SwarmEmergencyBar
        activeAgentsCount={runningCount}
        isDesktopOnline={isConnected}
      />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'issues'] as FilterType[]).map((tabKey) => {
          const isSelected = filter === tabKey;
          const label = tabKey === 'all' ? 'All Projects' : tabKey === 'active' ? 'Active' : 'Issues';
          const count = tabKey === 'all' ? projects.length : tabKey === 'active' ? activeCount : issuesCount;

          return (
            <Pressable
              key={tabKey}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                setFilter(tabKey);
              }}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                {label}
              </Text>
              <View style={[styles.chipBadge, isSelected && styles.chipBadgeSelected]}>
                <Text style={[styles.chipBadgeText, isSelected && styles.chipBadgeTextSelected]}>
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Live Project Stream (Zero-Cache & Real Desktop Metadata) */}
      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <FolderGit2 size={26} color="#FB923C" />
          </View>
          <Text style={styles.emptyTitle}>
            {isConnected ? 'No Workspaces Open' : 'Workstation Disconnected'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isConnected
              ? 'Open a project in Orbit on your desktop to inspect spawned agents and conversation history.'
              : 'Pair your computer in the Sync tab or open a cached workspace to read previous conversations.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => router.push(`/project/${item.id}`)}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Approvals Notification Modal */}
      <ApprovalsModal
        isOpen={approvalsModalOpen}
        onClose={() => setApprovalsModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0A0D',
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
    color: '#FB923C',
    letterSpacing: -0.2,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF7ED',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconButtonPressed: {
    opacity: 0.75,
  },
  notificationBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#F97316',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0B0A0D',
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: OrbitTokens.radii.pill,
  },
  statusPillPressed: {
    opacity: 0.8,
  },
  statusDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
  },
  dotConnected: {
    backgroundColor: '#10B981',
  },
  dotOffline: {
    backgroundColor: '#6E645D',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF7ED',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: OrbitTokens.radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipSelected: {
    backgroundColor: 'rgba(251, 146, 60, 0.2)',
    borderColor: 'rgba(251, 146, 60, 0.45)',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D6C7B8',
  },
  filterChipTextSelected: {
    color: '#FFF7ED',
    fontWeight: '700',
  },
  chipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipBadgeSelected: {
    backgroundColor: '#EA580C',
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D6C7B8',
  },
  chipBadgeTextSelected: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(251, 146, 60, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF7ED',
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: '#D6C7B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
});
