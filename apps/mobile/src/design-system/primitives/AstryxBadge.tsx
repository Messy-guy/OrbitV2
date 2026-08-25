import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OrbitTokens } from '../tokens';

interface AstryxBadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'warning' | 'danger' | 'success' | 'neutral';
  icon?: React.ReactNode;
  showDot?: boolean;
}

export const AstryxBadge: React.FC<AstryxBadgeProps> = ({
  label,
  variant = 'neutral',
  icon,
  showDot = false,
}) => {
  return (
    <View style={[styles.badge, styles[variant]]}>
      {icon ? (
        icon
      ) : showDot ? (
        <View style={[styles.dot, styles[`dot_${variant}`]]} />
      ) : null}
      <Text style={[styles.label, styles[`label_${variant}`]]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: OrbitTokens.radii.pill,
    borderWidth: 1,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  neutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: OrbitTokens.border.glassHairline,
  },
  label_neutral: {
    color: OrbitTokens.colors.text.secondary,
  },
  dot_neutral: {
    backgroundColor: OrbitTokens.colors.text.muted,
  },
  primary: {
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  label_primary: {
    color: '#93C5FD',
  },
  dot_primary: {
    backgroundColor: '#3B82F6',
  },
  secondary: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  label_secondary: {
    color: '#CBD5E1',
  },
  dot_secondary: {
    backgroundColor: '#64748B',
  },
  success: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  label_success: {
    color: '#6EE7B7',
  },
  dot_success: {
    backgroundColor: '#10B981',
  },
  warning: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  label_warning: {
    color: '#FCD34D',
  },
  dot_warning: {
    backgroundColor: '#F59E0B',
  },
  danger: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderColor: 'rgba(239, 68, 68, 0.28)',
  },
  label_danger: {
    color: '#FCA5A5',
  },
  dot_danger: {
    backgroundColor: '#EF4444',
  },
});
