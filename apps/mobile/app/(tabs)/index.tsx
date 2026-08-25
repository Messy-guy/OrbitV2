import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, Pressable, RefreshControl, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProjects } from '../../src/hooks/useProjects';
import { ProjectCard } from '../../src/components/project/ProjectCard';
import { SwarmEmergencyBar } from '../../src/components/agent/SwarmEmergencyBar';
import { mobileRelayService } from '../../src/services/mobileRelay.service';
import { AstryxSkeleton } from '../../src/design-system/primitives/AstryxSkeleton';
import { OrbitTokens } from '../../src/design-system/tokens';
import { FolderGit2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

type FilterType = 'all' | 'active' | 'issues';

export default function HomeScreen() {
  const router = useRouter();
  const { data: projects, isLoading, isRefetching, refetch } = useProjects();
  const [isDesktopConnected, setIsDesktopConnected] = useState(mobileRelayService.latestState.isDesktopOnline);
  const [activeAgents, setActiveAgents] = useState(mobileRelayService.latestState.agents);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    mobileRelayService.connect();
    const unsub = mobileRelayService.subscribe(() => {
      setIsDesktopConnected(mobileRelayService.latestState.isDesktopOnline);
      setActiveAgents(mobileRelayService.latestState.agents);
    });
    return unsub;
  }, []);

  const runningCount = activeAgents.filter((a) => a.status === 'working').length;

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
      {/* Friendly Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appGreeting}>Orbit Studio</Text>
          <Text style={styles.pageTitle}>Projects</Text>
        </View>

        <Pressable
          onPress={() => router.push('/(tabs)/settings')}
          style={({ pressed }) => [styles.statusPill, pressed && styles.statusPillPressed]}
        >
          <View style={[styles.statusDot, isDesktopConnected ? styles.dotConnected : styles.dotOffline]} />
          <Text style={styles.statusText}>
            {isDesktopConnected ? 'Connected' : 'Offline'}
          </Text>
        </Pressable>
      </View>

      {/* Active Agents Summary Bar */}
      <SwarmEmergencyBar
        activeAgentsCount={runningCount}
        isDesktopOnline={isDesktopConnected}
      />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'issues'] as FilterType[]).map((tabKey) => {
          const isSelected = filter === tabKey;
          const label = tabKey === 'all' ? 'All Projects' : tabKey === 'active' ? 'Active' : 'Issues';
          const count = tabKey === 'all' ? projects?.length || 0 : tabKey === 'active' ? activeCount : issuesCount;

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

      {/* Project List */}
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          <AstryxSkeleton height={140} borderRadius={24} style={{ marginBottom: 14 }} />
          <AstryxSkeleton height={140} borderRadius={24} style={{ marginBottom: 14 }} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <FolderGit2 size={26} color="#60A5FA" />
          </View>
          <Text style={styles.emptyTitle}>No Projects Found</Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'all'
              ? 'Pair your computer in the Sync tab to view your active projects.'
              : `No projects match the "${filter}" filter.`}
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
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#2563EB"
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
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
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    backgroundColor: '#64748B',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
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
    backgroundColor: 'rgba(37, 99, 235, 0.18)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterChipTextSelected: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  chipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipBadgeSelected: {
    backgroundColor: '#2563EB',
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  chipBadgeTextSelected: {
    color: '#FFFFFF',
  },
  skeletonContainer: {
    paddingHorizontal: 20,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
});
