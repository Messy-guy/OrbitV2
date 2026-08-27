import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, Alert,
  Modal, StyleSheet, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLiveRelayStore } from '../../src/stores/liveRelay.store';
import { secureStorage } from '../../src/services/secureStorage';
import { mobileRelayService } from '../../src/services/mobileRelay.service';
import { useRouter } from 'expo-router';
import { OrbitTokens } from '../../src/design-system/tokens';
import { GlassCard } from '../../src/design-system/primitives/GlassCard';
import { AstryxBadge } from '../../src/design-system/primitives/AstryxBadge';
import { AstryxButton } from '../../src/design-system/primitives/AstryxButton';
import { QrCode, KeyRound, LogOut, Check, X, Laptop } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function SyncScreen() {
  const router = useRouter();
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairingSuccess, setPairingSuccess] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Pure live state
  const isConnected = useLiveRelayStore((s) => s.isConnected);
  const deviceMeta = useLiveRelayStore((s) => s.device);
  const projectsCount = useLiveRelayStore((s) => s.projects.length);
  const agentsCount = useLiveRelayStore((s) => s.agents.length);

  const applyPairing = async (inputVal: string) => {
    const raw = inputVal.trim();
    if (!raw || isPairing) return;
    setIsPairing(true);
    mobileRelayService.resetExplicitDisconnect();

    try {
      let token = '';
      let relayUrl = '';
      let code = '';

      if (raw.startsWith('{')) {
        const parsed = JSON.parse(raw);
        token = parsed.token || parsed.accessToken || '';
        relayUrl = parsed.relayUrl || '';
        code = parsed.code || '';
      } else if (/^\d{6}$/.test(raw)) {
        code = raw;
        token = `orbit_dev_${raw}`;
      } else {
        token = raw;
      }

      if (!token && !code) throw new Error('Please enter a valid 6-digit code or scan a valid QR code.');

      const verifyResult = await mobileRelayService.verifyAndConnect(raw, relayUrl);

      if (!verifyResult.success) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
        Alert.alert(
          'Workstation Not Found',
          verifyResult.error || 'No active Orbit Desktop found with this code. Please check that Orbit Desktop is open on your computer.'
        );
        return;
      }

      if (token) await secureStorage.setAccessToken(token);
      if (code) await secureStorage.setPairingCode(code);
      if (relayUrl) await secureStorage.setRelayUrl(relayUrl);

      await mobileRelayService.connect();
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      setPairingSuccess(true);
      setScannerOpen(false);
      setPairingCodeInput('');
      setTimeout(() => {
        setPairingSuccess(false);
        router.replace('/(tabs)');
      }, 900);
    } catch (e: any) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Pairing Error', e.message || 'Invalid code or workstation not found.');
    } finally {
      setIsPairing(false);
    }
  };

  const handleDisconnect = async () => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);
    try {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}

      await mobileRelayService.unpairAndDisconnect();
      Alert.alert('Disconnected', 'Your workstation has been unlinked.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Camera Access', 'Please allow camera permission to scan the pairing QR code.');
        return;
      }
    }
    setScannerOpen(true);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appGreeting}>Workstation</Text>
          <Text style={styles.pageTitle}>Sync & Connect</Text>
        </View>

        <AstryxBadge
          label={isConnected ? 'Connected' : 'Offline'}
          variant={isConnected ? 'success' : 'neutral'}
          showDot={isConnected}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Real-Time Connected Device Hero Card */}
        <GlassCard active={isConnected}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, isConnected && styles.iconCircleConnected]}>
              <Laptop size={22} color={isConnected ? '#FB923C' : '#FDBA74'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {isConnected ? (deviceMeta?.deviceName || 'Primary Workstation') : 'No Device Linked'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {isConnected
                  ? `${deviceMeta?.os || 'Desktop Host'} • Pure Live Stream Active`
                  : 'Enter code or scan QR to link your computer'}
              </Text>
            </View>
          </View>

          {isConnected ? (
            <View style={styles.telemetryGrid}>
              <View style={styles.telemetryStat}>
                <Text style={styles.statLabel}>Open Projects</Text>
                <Text style={styles.statValue}>{projectsCount}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.telemetryStat}>
                <Text style={styles.statLabel}>Active Agents</Text>
                <Text style={[styles.statValue, agentsCount > 0 && { color: '#FB923C' }]}>
                  {agentsCount}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.telemetryStat}>
                <Text style={styles.statLabel}>Live State</Text>
                <Text style={[styles.statValue, { color: '#34D399' }]}>Zero-Lag</Text>
              </View>
            </View>
          ) : (
            <View style={styles.detailsRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={styles.detailValue}>Awaiting Connection</Text>
            </View>
          )}
        </GlassCard>

        {/* 6-Digit OTP Pairing Card */}
        <GlassCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <KeyRound size={20} color="#FB923C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Pair with 6-Digit Code</Text>
              <Text style={styles.cardSubtitle}>
                Enter the code shown in the Orbit Desktop pairing window
              </Text>
            </View>
          </View>

          {pairingSuccess ? (
            <View style={styles.successBanner}>
              <Check size={16} color="#10B981" />
              <Text style={styles.successText}>Paired Successfully! Redirecting...</Text>
            </View>
          ) : (
            <View style={styles.pairingContainer}>
              <TextInput
                value={pairingCodeInput}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9]/g, '').slice(0, 6);
                  setPairingCodeInput(cleaned);
                  if (cleaned.length === 6) {
                    applyPairing(cleaned);
                  }
                }}
                placeholder="000 000"
                placeholderTextColor="#6E645D"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.otpInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.buttonWrapper}>
                <AstryxButton
                  label={isPairing ? 'Verifying Workstation...' : 'Link Workstation'}
                  variant="primary"
                  size="md"
                  onPress={() => applyPairing(pairingCodeInput)}
                  disabled={pairingCodeInput.length < 6 || isPairing}
                  isLoading={isPairing}
                  icon={<KeyRound size={16} color={pairingCodeInput.length < 6 ? '#A89F97' : '#FFFFFF'} />}
                />
              </View>

              <View style={styles.orDivider}>
                <View style={styles.line} />
                <Text style={styles.orText}>or use camera</Text>
                <View style={styles.line} />
              </View>

              <AstryxButton
                label="Scan Desktop QR Code"
                variant="glass"
                size="md"
                onPress={openScanner}
                icon={<QrCode size={16} color="#FFFFFF" />}
              />
            </View>
          )}
        </GlassCard>

        {/* Disconnect Option */}
        {isConnected && (
          <GlassCard>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <LogOut size={20} color={OrbitTokens.colors.accent.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: '#FCA5A5' }]}>Unlink Workstation</Text>
                <Text style={styles.cardSubtitle}>
                  Disconnect and reset live stream connection
                </Text>
              </View>
            </View>

            <AstryxButton
              label={isDisconnecting ? 'Unlinking...' : 'Disconnect Device'}
              variant="danger"
              size="md"
              onPress={handleDisconnect}
              disabled={isDisconnecting}
              isLoading={isDisconnecting}
              icon={<LogOut size={16} color={OrbitTokens.colors.accent.danger} />}
            />
          </GlassCard>
        )}
      </ScrollView>

      {/* QR Scanner Modal */}
      <Modal visible={scannerOpen} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.scannerRoot} edges={['top', 'bottom']}>
          <View style={styles.scannerNav}>
            <Text style={styles.scannerTitle}>Scan QR Code</Text>
            <Pressable onPress={() => setScannerOpen(false)} style={styles.scannerClose}>
              <X size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (data && !isPairing) applyPairing(data);
            }}
          />

          <View style={styles.scannerFooter}>
            <Text style={styles.scannerHint}>
              Point camera at the QR code displayed in the Orbit Desktop header
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(251, 146, 60, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleConnected: {
    backgroundColor: 'rgba(251, 146, 60, 0.2)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF7ED',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: '#D6C7B8',
    marginTop: 2,
  },
  telemetryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 12,
    marginTop: 4,
  },
  telemetryStat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#D6C7B8',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF7ED',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  detailLabel: {
    fontSize: 13,
    color: '#D6C7B8',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF7ED',
  },
  pairingContainer: {
    paddingTop: 4,
  },
  otpInput: {
    backgroundColor: 'rgba(19, 17, 23, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(251, 146, 60, 0.45)',
    borderRadius: OrbitTokens.radii.pill,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF7ED',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
  },
  buttonWrapper: {
    marginTop: 4,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 18,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  orText: {
    fontSize: 12,
    color: '#8C827A',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: OrbitTokens.radii.pill,
    padding: 14,
  },
  successText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#34D399',
  },
  scannerRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  scannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scannerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFooter: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#0B0A0D',
  },
  scannerHint: {
    fontSize: 13.5,
    color: '#D6C7B8',
    textAlign: 'center',
  },
});
