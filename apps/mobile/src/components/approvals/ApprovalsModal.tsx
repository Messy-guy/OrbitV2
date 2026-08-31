import React from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePendingApprovals, useAgentControls } from '../../hooks/useAgentControls';
import { Check, X, Terminal, ShieldCheck } from 'lucide-react-native';
import { AstryxBadge } from '../../design-system/primitives/AstryxBadge';
import { AstryxButton } from '../../design-system/primitives/AstryxButton';
import { GlassCard } from '../../design-system/primitives/GlassCard';
import { OrbitTokens } from '../../design-system/tokens';
import * as Haptics from 'expo-haptics';

interface ApprovalsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApprovalsModal: React.FC<ApprovalsModalProps> = ({ isOpen, onClose }) => {
  const { data: approvals } = usePendingApprovals();
  const { approveAction, isApproving } = useAgentControls();

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.responsiveWrapper}>
          {/* Modal Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.iconCircle}>
                <ShieldCheck size={20} color="#FB923C" />
              </View>
              <View>
                <Text style={styles.title}>Action Approvals</Text>
                <Text style={styles.subtitle}>Authorize commands & agent actions</Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                onClose();
              }}
              style={styles.closeButton}
              hitSlop={8}
            >
              <X size={18} color="#FFF7ED" />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!approvals || approvals.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <ShieldCheck size={32} color="#10B981" />
              </View>
              <Text style={styles.emptyTitle}>All Clear</Text>
              <Text style={styles.emptySubtitle}>
                No pending authorization requests. When an agent requests permission to execute bash commands, it will appear here.
              </Text>
            </View>
          ) : (
            approvals.map((item) => (
              <GlassCard key={item.id}>
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
                    <Terminal size={14} color="#FB923C" style={{ marginTop: 2 }} />
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
            ))
          )}
        </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0A0D',
  },
  responsiveWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(251, 146, 60, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF7ED',
  },
  subtitle: {
    fontSize: 11.5,
    color: '#D6C7B8',
    marginTop: 1,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    gap: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF7ED',
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: '#D6C7B8',
    textAlign: 'center',
    lineHeight: 20,
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
    color: '#FFF7ED',
  },
  providerName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D6C7B8',
  },
  questionText: {
    fontSize: 14,
    color: '#FFF7ED',
    lineHeight: 20,
    marginBottom: 12,
  },
  codeBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(19, 17, 23, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.25)',
    borderRadius: OrbitTokens.radii.sm,
    padding: 12,
    marginBottom: 16,
  },
  codeText: {
    fontSize: 12.5,
    color: '#FDBA74',
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
