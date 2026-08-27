import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLiveRelayStore } from '../../src/stores/liveRelay.store';
import { secureStorage } from '../../src/services/secureStorage';
import { mobileRelayService } from '../../src/services/mobileRelay.service';
import { OrbitTokens } from '../../src/design-system/tokens';
import { GlassCard } from '../../src/design-system/primitives/GlassCard';
import { AstryxBadge } from '../../src/design-system/primitives/AstryxBadge';
import { AstryxButton } from '../../src/design-system/primitives/AstryxButton';
import { User, Bell, Radio, Shield, LogOut, Cpu, HardDrive } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function SettingsScreen() {
  const isConnected = useLiveRelayStore((s) => s.isConnected);
  const deviceMeta = useLiveRelayStore((s) => s.device);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [isUnpairing, setIsUnpairing] = useState(false);

  const handleUnlink = async () => {
    if (isUnpairing) return;
    setIsUnpairing(true);
    try {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
      await mobileRelayService.unpairAndDisconnect();
      Alert.alert('Unlinked', 'Your device pairing has been cleared.');
    } finally {
      setIsUnpairing(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appGreeting}>Preferences</Text>
          <Text style={styles.pageTitle}>Settings</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Account / Workstation Profile Card */}
        <GlassCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <User size={22} color="#FB923C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Orbit Cockpit</Text>
              <Text style={styles.cardSubtitle}>
                {isConnected ? `Linked to ${deviceMeta?.deviceName || 'Workstation'}` : 'Offline Mode'}
              </Text>
            </View>
            <AstryxBadge
              label={isConnected ? 'PRO' : 'FREE'}
              variant={isConnected ? 'primary' : 'neutral'}
            />
          </View>
        </GlassCard>

        {/* Telemetry & Relay Diagnostics */}
        <GlassCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Radio size={20} color="#FB923C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Live Tunnel Diagnostics</Text>
              <Text style={styles.cardSubtitle}>
                Zero-cache websocket telemetry relay
              </Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Host Platform</Text>
            <Text style={styles.settingValue}>{deviceMeta?.os || 'Linux / macOS / Windows'}</Text>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Relay Architecture</Text>
            <Text style={styles.settingValue}>Pure Memory Stream (0ms)</Text>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Hardware Storage</Text>
            <Text style={styles.settingValue}>iOS KeyStore / Android KeyStore</Text>
          </View>
        </GlassCard>

        {/* Preferences Toggle */}
        <GlassCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Bell size={20} color="#FB923C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Notifications & Haptics</Text>
              <Text style={styles.cardSubtitle}>
                Alerts when agents request action approval
              </Text>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Approval Push Notifications</Text>
              <Text style={styles.settingSubtext}>Get notified when an agent needs command approval</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#26212E', true: '#FB923C' }}
              thumbColor="#FFF7ED"
            />
          </View>

          <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.06)', paddingTop: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Tactile Haptics</Text>
              <Text style={styles.settingSubtext}>Feedback on command approvals and taps</Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
              trackColor={{ false: '#26212E', true: '#FB923C' }}
              thumbColor="#FFF7ED"
            />
          </View>
        </GlassCard>

        {/* Disconnect / Unpair Card */}
        {isConnected && (
          <GlassCard>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.14)' }]}>
                <LogOut size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: '#FCA5A5' }]}>Unlink Workstation</Text>
                <Text style={styles.cardSubtitle}>
                  Clear hardware credentials and disconnect live session
                </Text>
              </View>
            </View>

            <AstryxButton
              label={isUnpairing ? 'Unlinking...' : 'Disconnect Workstation'}
              variant="danger"
              size="md"
              onPress={handleUnlink}
              disabled={isUnpairing}
              isLoading={isUnpairing}
              icon={<LogOut size={16} color="#EF4444" />}
            />
          </GlassCard>
        )}
      </ScrollView>
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
    paddingBottom: 120,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(251, 146, 60, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  settingLabel: {
    fontSize: 13,
    color: '#D6C7B8',
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 12.5,
    fontFamily: 'monospace',
    color: '#FFF7ED',
    fontWeight: '600',
  },
  settingSubtext: {
    fontSize: 11.5,
    color: '#8C827A',
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
});
