import React from 'react';
import {
  View, Text, FlatList, RefreshControl, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePendingApprovals, useAgentControls } from '../../src/hooks/useAgentControls';
import { Check, X, Terminal, ShieldCheck } from 'lucide-react-native';
import { AstryxSkeleton } from '../../src/design-system/primitives/AstryxSkeleton';
import { AstryxBadge } from '../../src/design-system/primitives/AstryxBadge';
import { AstryxButton } from '../../src/design-system/primitives/AstryxButton';
import { GlassCard } from '../../src/design-system/primitives/GlassCard';
import { OrbitTokens } from '../../src/design-system/tokens';

export default function ApprovalsScreen() {
  const { data: approvals, isLoading, isRefetching, refetch } = usePendingApprovals();
  const { approveAction, isApproving } = useAgentControls();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appGreeting}>Gatekeeper</Text>
          <Text style={styles.pageTitle}>Approvals</Text>
        </View>

        {approvals && approvals.length > 0 && (
          <AstryxBadge
            label={`${approvals.length} Pending`}
            variant="warning"
            showDot
          />
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          <AstryxSkeleton height={180} borderRadius={24} style={{ marginBottom: 14 }} />
          <AstryxSkeleton height={180} borderRadius={24} style={{ marginBottom: 14 }} />
        </View>
      ) : !approvals || approvals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <ShieldCheck size={28} color="#10B981" />
          </View>
          <Text style={styles.emptyTitle}>All Clear</Text>
          <Text style={styles.emptySubtitle}>
            When an agent requests authorization for terminal commands or destructive changes, it will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={approvals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#2563EB"
            />
          }
          renderItem={({ item }) => (
            <GlassCard>
              {/* Agent Tag Row */}
              <View style={styles.cardHeader}>
                <View style={styles.agentTag}>
                  <Text style={styles.agentName}>@{item.agentName}</Text>
                  <Text style={styles.providerName}>{item.provider.toUpperCase()}</Text>
                </View>
                <AstryxBadge label="Requires Approval" variant="danger" />
              </View>

              {/* Question */}
              <Text style={styles.questionText}>{item.question}</Text>

              {/* Command Block */}
              {item.commandSnippet && (
                <View style={styles.codeBlock}>
                  <Terminal size={14} color="#60A5FA" style={{ marginTop: 2 }} />
                  <Text style={styles.codeText}>{item.commandSnippet}</Text>
                </View>
              )}

              {/* Authorization Actions */}
              <View style={styles.actionsRow}>
                <AstryxButton
                  label="Authorize"
                  variant="primary"
                  size="md"
                  onPress={() =>
                    approveAction({
                      agentId: item.agentId,
                      approvalId: item.id,
                      decision: 'APPROVE',
                    })
                  }
                  isLoading={isApproving}
                  icon={<Check size={16} color="#FFFFFF" />}
                  style={{ flex: 1 }}
                />
                <AstryxButton
                  label="Deny"
                  variant="danger"
                  size="md"
                  onPress={() =>
                    approveAction({
                      agentId: item.agentId,
                      approvalId: item.id,
                      decision: 'REJECT',
                    })
                  }
                  isLoading={isApproving}
                  icon={<X size={16} color={OrbitTokens.colors.accent.danger} />}
                  style={{ flex: 1 }}
                />
              </View>
            </GlassCard>
          )}
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
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
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
    paddingBottom: 100,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  agentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agentName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  providerName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  questionText: {
    fontSize: 14,
    color: '#F1F5F9',
    lineHeight: 20,
    marginBottom: 12,
  },
  codeBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(11, 17, 32, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: OrbitTokens.radii.sm,
    padding: 12,
    marginBottom: 16,
  },
  codeText: {
    fontSize: 12.5,
    color: '#93C5FD',
    fontFamily: 'monospace',
    flex: 1,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
