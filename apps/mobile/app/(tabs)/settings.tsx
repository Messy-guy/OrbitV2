import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, Alert,
  Modal, StyleSheet, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { secureStorage } from '../../src/services/secureStorage';
import { mobileRelayService } from '../../src/services/mobileRelay.service';
import { useRouter } from 'expo-router';
import { OrbitTokens } from '../../src/design-system/tokens';
import { GlassCard } from '../../src/design-system/primitives/GlassCard';
import { AstryxBadge } from '../../src/design-system/primitives/AstryxBadge';
import { AstryxButton } from '../../src/design-system/primitives/AstryxButton';
import { Radio, QrCode, Key, LogOut, Check, X, Laptop } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function SyncScreen() {
  const router = useRouter();
  const [manualToken, setManualToken] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairingSuccess, setPairingSuccess] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [connected, setConnected] = useState(mobileRelayService.latestState.isDesktopOnline);

  useEffect(() => {
    mobileRelayService.connect();
    const unsub = mobileRelayService.subscribe(() => setConnected(mobileRelayService.latestState.isDesktopOnline));
    return unsub;
  }, []);

  const applyPairing = async (raw: string) => {
    if (!raw || isPairing) return;
    setIsPairing(true);
    try {
      let token = '';
      let relayUrl = '';

      if (raw.trim().startsWith('{')) {
        const parsed = JSON.parse(raw.trim());
        token = parsed.token || parsed.accessToken || '';
        relayUrl = parsed.relayUrl || '';
      } else {
        token = raw.trim();
      }

      if (!token) throw new Error('No token found in payload');

      await secureStorage.setAccessToken(token);
      if (relayUrl) {
        await secureStorage.setRelayUrl(relayUrl);
      }

      await mobileRelayService.connect();
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setPairingSuccess(true);
      setScannerOpen(false);
      setManualToken('');
      setTimeout(() => {
        setPairingSuccess(false);
        router.replace('/(tabs)');
      }, 900);
    } catch {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Pairing Failed', 'Invalid pairing secret or workstation QR token.');
    } finally {
      setIsPairing(false);
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
          label={connected ? 'Connected' : 'Offline'}
          variant={connected ? 'success' : 'neutral'}
          showDot={connected}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Connection Status Card */}
        <GlassCard active={connected}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Laptop size={20} color="#60A5FA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Primary Computer</Text>
              <Text style={styles.cardSubtitle}>
                {connected ? 'Live relay streaming • 12ms latency' : 'Offline or awaiting desktop launch'}
              </Text>
            </View>
          </View>

          <View style={styles.detailsRow}>
            <Text style={styles.detailLabel}>Tunnel Protocol</Text>
            <Text style={styles.detailValue}>Socket.IO WebSocket</Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailLabel}>Encryption</Text>
            <Text style={styles.detailValue}>End-to-End TLS</Text>
          </View>
        </GlassCard>

        {/* Pairing Actions Card */}
        <GlassCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <QrCode size={20} color="#60A5FA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Pair New Device</Text>
              <Text style={styles.cardSubtitle}>
                Scan QR from Orbit Desktop to connect this phone
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
              <AstryxButton
                label="Scan Desktop QR Code"
                variant="primary"
                size="lg"
                onPress={openScanner}
                icon={<QrCode size={20} color="#FFFFFF" />}
                style={styles.scanButton}
              />

              <View style={styles.orDivider}>
                <View style={styles.line} />
                <Text style={styles.orText}>or enter token</Text>
                <View style={styles.line} />
              </View>

              <TextInput
                value={manualToken}
                onChangeText={setManualToken}
                placeholder="Paste pairing token..."
                placeholderTextColor="#64748B"
                style={styles.textInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {manualToken.trim().length > 0 && (
                <AstryxButton
                  label={isPairing ? 'Linking...' : 'Connect Workstation'}
                  variant="glass"
                  size="md"
                  onPress={() => applyPairing(manualToken)}
                  disabled={isPairing}
                  isLoading={isPairing}
                  icon={<Key size={16} color="#FFFFFF" />}
                  style={{ marginTop: 12 }}
                />
              )}
            </View>
          )}
        </GlassCard>

        {/* Disconnect Option */}
        <GlassCard>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <LogOut size={20} color={OrbitTokens.colors.accent.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: '#FCA5A5' }]}>Unlink Workstation</Text>
              <Text style={styles.cardSubtitle}>
                Clear saved authentication keys on this mobile app
              </Text>
            </View>
          </View>

          <AstryxButton
            label="Disconnect Device"
            variant="danger"
            size="md"
            onPress={async () => {
              await secureStorage.clearTokens();
              try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch {}
              router.replace('/(tabs)');
            }}
            icon={<LogOut size={16} color={OrbitTokens.colors.accent.danger} />}
          />
        </GlassCard>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 2,
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
    color: '#94A3B8',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  pairingContainer: {
    paddingTop: 4,
  },
  scanButton: {
    marginBottom: 16,
    height: 52,
    borderRadius: OrbitTokens.radii.pill,
    ...OrbitTokens.shadows.subtle,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  orText: {
    fontSize: 12,
    color: '#64748B',
  },
  textInput: {
    backgroundColor: 'rgba(11, 17, 32, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: OrbitTokens.radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 13,
    fontSize: 13.5,
    color: '#FFFFFF',
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
    backgroundColor: '#070B14',
  },
  scannerHint: {
    fontSize: 13.5,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
