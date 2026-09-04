import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FolderGit2,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Radio,
  FileCode2,
  Activity,
  Bot,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { OrbitTokens } from '../../design-system/tokens';
import { AstryxButton } from '../../design-system/primitives/AstryxButton';
import { secureStorage } from '../../services/secureStorage';

interface StepData {
  eyebrow: string;
  headline: string;
  body: string;
  visual: React.ReactNode;
}

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
  onNavigateSync?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  visible,
  onComplete,
  onNavigateSync,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleDismiss = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    await secureStorage.setOnboardingCompleted(true);
    onComplete();
  };

  const handleFinishAndSync = async () => {
    await handleDismiss();
    if (onNavigateSync) {
      onNavigateSync();
    }
  };

  const steps: StepData[] = [
    {
      eyebrow: 'Universal Cockpit',
      headline: 'Workspaces on the Go',
      body: 'Inspect live projects, agent workloads, and execution contexts directly from your pocket.',
      visual: (
        <View style={styles.cardPreviewContainer}>
          <View style={styles.cardPreviewHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <FolderGit2 size={16} color="#FB923C" />
              <Text style={styles.cardPreviewTitle}>~/projects/core-engine</Text>
            </View>
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>Active</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <FileCode2 size={14} color="#FB923C" />
              <Text style={styles.statLabel}>148 files indexed</Text>
            </View>
            <View style={styles.statCard}>
              <Activity size={14} color="#34D399" />
              <Text style={styles.statLabelSuccess}>Live State Synced</Text>
            </View>
          </View>
          <View style={styles.cardPreviewFooter}>
            <Text style={styles.footerBranch}>Branch: <Text style={{ color: '#FFF7ED', fontWeight: '600' }}>main</Text></Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Connected</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      eyebrow: 'Swarm Intelligence',
      headline: 'Control Autonomous Agents',
      body: 'Monitor multiple CLI and IDE agents concurrently. Steer tasks, approve diffs, and halt runs remotely.',
      visual: (
        <View style={styles.cardPreviewContainer}>
          <View style={styles.agentItem}>
            <View style={styles.agentAvatar}>
              <Text style={styles.agentAvatarText}>A1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.agentName}>Architect Agent</Text>
              <Text style={styles.agentTask}>Refactoring state orchestration</Text>
            </View>
            <View style={styles.agentStatusBusy}>
              <Text style={styles.statusBusyText}>busy</Text>
            </View>
          </View>
          <View style={[styles.agentItem, { marginTop: 10 }]}>
            <View style={[styles.agentAvatar, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
              <Text style={[styles.agentAvatarText, { color: '#34D399' }]}>A2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.agentName}>Test Runner</Text>
              <Text style={styles.agentTask}>Running verification suite</Text>
            </View>
            <View style={styles.agentStatusIdle}>
              <Text style={styles.statusIdleText}>idle</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      eyebrow: 'Zero-Latency Pairing',
      headline: 'Pair With Orbit Desktop',
      body: 'Scan a QR code or type your 6-digit pairing code to securely link with your computer instantly.',
      visual: (
        <View style={[styles.cardPreviewContainer, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={styles.syncDeviceRow}>
            <View style={styles.deviceIconCircle}>
              <Smartphone size={26} color="#FB923C" />
            </View>
            <View style={styles.syncPulseLine}>
              <View style={styles.pulseDot} />
            </View>
            <View style={[styles.deviceIconCircle, { backgroundColor: 'rgba(167, 139, 250, 0.12)', borderColor: 'rgba(167, 139, 250, 0.3)' }]}>
              <Radio size={26} color="#A78BFA" />
            </View>
          </View>
          <Text style={styles.syncPreviewHint}>End-to-end encrypted hardware relay</Text>
        </View>
      ),
    },
  ];

  const current = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeContainer} edges={['top', 'bottom']}>
          <View style={styles.modalContent}>
            {/* Ambient specular highlight */}
            <LinearGradient
              colors={['rgba(251, 146, 60, 0.08)', 'rgba(0, 0, 0, 0)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            {/* Header: Skip button & indicators */}
            <View style={styles.modalHeader}>
              <View style={styles.stepIndicator}>
                {steps.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.indicatorBar,
                      i === currentStep && styles.indicatorBarActive,
                      i < currentStep && styles.indicatorBarDone,
                    ]}
                  />
                ))}
              </View>
              <Pressable
                onPress={handleDismiss}
                hitSlop={14}
                style={({ pressed }) => [styles.skipButton, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            </View>

            {/* Visual Preview Section */}
            <View style={styles.visualContainer}>
              {current.visual}
            </View>

            {/* Copy Content Section */}
            <View style={styles.textContainer}>
              <Text style={styles.eyebrow}>{current.eyebrow}</Text>
              <Text style={styles.headline}>{current.headline}</Text>
              <Text style={styles.body}>{current.body}</Text>
            </View>

            {/* Actions Bar */}
            <View style={styles.actionRow}>
              {currentStep > 0 ? (
                <Pressable
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    setCurrentStep((prev) => Math.max(0, prev - 1));
                  }}
                  style={({ pressed }) => [styles.navIconButton, pressed && { opacity: 0.7 }]}
                >
                  <ArrowLeft size={18} color="#D6C7B8" />
                </Pressable>
              ) : (
                <View style={{ width: 44 }} />
              )}

              {isLast ? (
                <View style={{ flex: 1, flexDirection: 'row', gap: 10, marginLeft: 10 }}>
                  <AstryxButton
                    label="Pair Computer"
                    onPress={handleFinishAndSync}
                    variant="primary"
                    size="md"
                    style={{ flex: 1 }}
                    icon={<Radio size={16} color="#FFFFFF" />}
                  />
                  <AstryxButton
                    label="Get Started"
                    onPress={handleDismiss}
                    variant="glass"
                    size="md"
                    style={{ flex: 1 }}
                    icon={<CheckCircle2 size={16} color="#FB923C" />}
                  />
                </View>
              ) : (
                <AstryxButton
                  label="Continue"
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1));
                  }}
                  variant="primary"
                  size="md"
                  style={{ flex: 1, marginLeft: 10 }}
                  icon={<ArrowRight size={16} color="#FFFFFF" />}
                />
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 4, 7, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#121016',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    padding: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  indicatorBar: {
    width: 22,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  indicatorBarActive: {
    width: 36,
    backgroundColor: '#FB923C',
  },
  indicatorBarDone: {
    backgroundColor: '#EA580C',
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  skipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#8C827A',
  },
  visualContainer: {
    width: '100%',
    height: 190,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardPreviewContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(23, 20, 28, 0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderTopColor: 'rgba(255, 255, 255, 0.16)',
    padding: 16,
    justifyContent: 'space-between',
  },
  cardPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 10,
  },
  cardPreviewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF7ED',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FB923C',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D6C7B8',
  },
  statLabelSuccess: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34D399',
  },
  cardPreviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
  },
  footerBranch: {
    fontSize: 11,
    color: '#8C827A',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#34D399',
  },
  onlineText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '600',
  },
  agentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(251, 146, 60, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FB923C',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  agentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF7ED',
  },
  agentTask: {
    fontSize: 11,
    color: '#8C827A',
    marginTop: 1,
  },
  agentStatusBusy: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusBusyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FBBF24',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  agentStatusIdle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  statusIdleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34D399',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  syncDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  deviceIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(251, 146, 60, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncPulseLine: {
    width: 48,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#FB923C',
  },
  syncPreviewHint: {
    fontSize: 12,
    color: '#8C827A',
    fontWeight: '500',
  },
  textContainer: {
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#FB923C',
    marginBottom: 6,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF7ED',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  body: {
    fontSize: 13.5,
    color: '#D6C7B8',
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navIconButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
