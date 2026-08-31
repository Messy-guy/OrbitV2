import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import {
  ChevronDown, ChevronRight, Wrench, Sparkles, FileCode, CheckCircle2, Terminal,
} from 'lucide-react-native';
import { ActivitySummary } from '../../types/orbit';
import * as Haptics from 'expo-haptics';

interface ActivityCardProps {
  activities: ActivitySummary[];
}

const ActivityCardComponent: React.FC<ActivityCardProps> = ({ activities }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!activities || activities.length === 0) return null;

  const toggle = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setIsExpanded(!isExpanded);
  };

  // Group summary lines
  const title = activities.map((a) => a.summary).join(' · ');

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'file':
        return <FileCode size={11} color="#38bdf8" />;
      case 'command':
        return <Terminal size={11} color="#f59e0b" />;
      case 'thinking':
        return <Sparkles size={11} color="#a855f7" />;
      default:
        return <Wrench size={11} color="#60a5fa" />;
    }
  };

  const primaryCategory = activities[0]?.category;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={toggle}
    >
      <View style={styles.header}>
        <View style={styles.leftRow}>
          <View style={styles.iconBox}>
            {getCategoryIcon(primaryCategory)}
          </View>
          <Text
            style={styles.titleText}
            numberOfLines={isExpanded ? undefined : 1}
            ellipsizeMode="tail"
          >
            {title || 'Activity summary'}
          </Text>
        </View>
        {isExpanded ? (
          <ChevronDown size={14} color="#71717a" />
        ) : (
          <ChevronRight size={14} color="#71717a" />
        )}
      </View>

      {isExpanded && (
        <View style={styles.detailsContainer}>
          {activities.map((act, i) => (
            <View key={act.id || i} style={styles.detailRow}>
              <CheckCircle2 size={11} color="#10b981" style={{ marginTop: 2 }} />
              <Text style={styles.detailText} selectable>
                {act.summary}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
};

export const ActivityCard = React.memo(ActivityCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161619',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginVertical: 3,
    width: '100%',
  },
  cardPressed: {
    backgroundColor: '#1c1c20',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: 8,
  },
  iconBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a1a1aa',
    flex: 1,
  },
  detailsContainer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    gap: 4,
    width: '100%',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    width: '100%',
  },
  detailText: {
    fontSize: 11,
    color: '#d4d4d8',
    flex: 1,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
