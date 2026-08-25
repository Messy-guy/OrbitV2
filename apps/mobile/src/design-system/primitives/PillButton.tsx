import React from 'react';
import { Text, Pressable, ActivityIndicator, StyleSheet, ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { OrbitTokens } from '../tokens';

type ButtonVariant = 'primary' | 'glass' | 'danger' | 'subtle';

interface PillButtonProps {
  label?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  iconOnly?: boolean;
  flex?: boolean;
}

export const PillButton = ({ label, onPress, variant = 'primary', icon, loading, disabled, style, iconOnly, flex }: PillButtonProps) => {
  const handlePress = () => {
    if (disabled || loading) return;
    try {
      variant === 'danger'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onPress();
  };

  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        !isPrimary && styles[variant],
        iconOnly && styles.iconOnly,
        flex && { flex: 1 },
        isPrimary && OrbitTokens.shadows.subtle,
        { opacity: pressed ? 0.85 : disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
        style,
      ]}
    >
      {isPrimary && (
        <LinearGradient
          colors={['#1D4ED8', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <>
          {icon}
          {!iconOnly && label ? (
            <Text style={[styles.label, isPrimary && styles.primaryLabel, variant === 'danger' && styles.dangerLabel, variant === 'glass' && styles.glassLabel, variant === 'subtle' && styles.subtleLabel]}>
              {label}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: OrbitTokens.radii.pill,
    overflow: 'hidden',
  },
  primary: { backgroundColor: '#2563EB' },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  danger: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  subtle: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconOnly: { paddingHorizontal: 0, width: 44, minHeight: 44 },
  label: { fontSize: 13.5, fontWeight: '600', letterSpacing: -0.2 },
  primaryLabel: { color: '#FFFFFF' },
  glassLabel: { color: '#FFFFFF' },
  dangerLabel: { color: '#EF4444', fontWeight: '700' },
  subtleLabel: { color: '#94A3B8' },
});
