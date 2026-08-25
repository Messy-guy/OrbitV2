import React, { useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { mobileRelayService } from '../../services/mobileRelay.service';
import { OrbitTokens } from '../../design-system/tokens';
import { AstryxButton } from '../../design-system/primitives/AstryxButton';
import { Activity, Pause } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  activeAgentsCount: number;
  isDesktopOnline: boolean;
}

export const SwarmEmergencyBar: React.FC<Props> = ({
  activeAgentsCount,
  isDesktopOnline,
}) => {
  const [isPausing, setIsPausing] = useState(false);

  const handlePauseAll = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}

    Alert.alert(
      'Pause All Agents',
      `Are you sure you want to pause all ${activeAgentsCount} active agents?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause All',
          style: 'destructive',
          onPress: () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {}
            setIsPausing(true);
            mobileRelayService.emergencyStopAll();
            setTimeout(() => setIsPausing(false), 1200);
          },
        },
      ]
    );
  };

  if (!isDesktopOnline || activeAgentsCount === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.leftCol}>
        <View style={styles.beacon}>
          <Activity size={14} color="#60A5FA" />
          <Text style={styles.title}>
            {activeAgentsCount} {activeAgentsCount === 1 ? 'agent is active' : 'agents are active'}
          </Text>
        </View>
        <Text style={styles.sub}>
          Running background tasks on your computer
        </Text>
      </View>

      <AstryxButton
        label={isPausing ? 'Pausing...' : 'Pause All'}
        variant="danger"
        size="sm"
        onPress={handlePauseAll}
        disabled={isPausing}
        icon={<Pause size={12} color={OrbitTokens.colors.accent.danger} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderRadius: OrbitTokens.radii.sm,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  leftCol: {
    flex: 1,
    paddingRight: 10,
  },
  beacon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sub: {
    fontSize: 11.5,
    color: '#94A3B8',
  },
});
