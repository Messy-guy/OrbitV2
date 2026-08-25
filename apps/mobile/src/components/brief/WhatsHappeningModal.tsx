import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { MobileWhatsHappeningBrief } from '../../types/orbit';
import { OrbitTokens } from '../../design-system/tokens';
import { Sparkles, X, Check, AlertTriangle, ArrowRight } from 'lucide-react-native';

interface WhatsHappeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  brief?: MobileWhatsHappeningBrief;
  isLoading: boolean;
}

export const WhatsHappeningModal: React.FC<WhatsHappeningModalProps> = ({
  isOpen,
  onClose,
  brief,
  isLoading,
}) => {
  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header Bar */}
          <View style={styles.headerBar}>
            <View style={styles.headerTitleBox}>
              <Sparkles size={18} color="#818CF8" />
              <Text style={styles.headerTitle}>What's Happening?</Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>
                Distilling agent memory & diffs...
              </Text>
            </View>
          ) : brief ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              {/* Headline & Summary */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeading}>Executive Summary</Text>
                <Text style={styles.headlineText}>{brief.headline}</Text>
                <Text style={styles.summaryText}>{brief.executiveSummary}</Text>
              </View>

              {/* Accomplished */}
              {brief.accomplished.length > 0 && (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeading}>Accomplished this turn</Text>
                  {brief.accomplished.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Check size={14} color="#10B981" style={{ marginTop: 2 }} />
                      <Text style={styles.itemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Blockers */}
              {brief.blockersAndErrors.length > 0 && (
                <View style={[styles.sectionCard, styles.blockerCard]}>
                  <View style={styles.blockerTitleRow}>
                    <AlertTriangle size={15} color="#F59E0B" />
                    <Text style={[styles.sectionHeading, { color: '#F59E0B', marginBottom: 0 }]}>
                      Issues & Blockers
                    </Text>
                  </View>
                  {brief.blockersAndErrors.map((err, idx) => (
                    <Text key={idx} style={styles.blockerText}>• {err}</Text>
                  ))}
                </View>
              )}

              {/* Next Step */}
              {brief.recommendedNextStep ? (
                <View style={[styles.sectionCard, styles.nextStepCard]}>
                  <Text style={styles.nextStepHeading}>Recommended Next Step</Text>
                  <Text style={styles.nextStepText}>{brief.recommendedNextStep}</Text>
                </View>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#111726',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    borderTopLeftRadius: OrbitTokens.radii.lg,
    borderTopRightRadius: OrbitTokens.radii.lg,
    maxHeight: '85%',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadingBox: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13.5,
    color: '#94A3B8',
  },
  scrollBody: {
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: 'rgba(23, 31, 51, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: OrbitTokens.radii.md,
    padding: 16,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#818CF8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  headlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    lineHeight: 21,
  },
  summaryText: {
    fontSize: 13.5,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  itemText: {
    fontSize: 13.5,
    color: '#E2E8F0',
    flex: 1,
    lineHeight: 19,
  },
  blockerCard: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  blockerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  blockerText: {
    fontSize: 13,
    color: '#FDE68A',
    lineHeight: 19,
    marginBottom: 4,
  },
  nextStepCard: {
    borderColor: 'rgba(99, 102, 241, 0.45)',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  nextStepHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A5B4FC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  nextStepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 20,
  },
});
