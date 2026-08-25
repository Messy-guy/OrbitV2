import React from 'react';
import { Text, Pressable, ActivityIndicator, StyleSheet, ViewStyle, StyleProp, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { OrbitTokens } from '../tokens';

interface AstryxButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const AstryxButton: React.FC<AstryxButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  isLoading = false,
  disabled = false,
  style,
}) => {
  const handlePress = () => {
    if (disabled || isLoading) return;
    try {
      if (variant === 'danger') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
    onPress();
  };

  const isPrimary = variant === 'primary';

  const content = isLoading ? (
    <ActivityIndicator size="small" color="#FFFFFF" />
  ) : (
    <View style={styles.contentRow}>
      {icon}
      {label ? (
        <Text
          style={[
            styles.labelBase,
            styles[`label_${variant}`],
            styles[`labelSize_${size}`],
            disabled && styles.labelDisabled,
          ]}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        styles.pressableContainer,
        styles[`size_${size}`],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={['#1D4ED8', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.innerGradient, styles[`size_${size}`]]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.innerView, styles[variant], styles[`size_${size}`]]}>
          {content}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressableContainer: {
    borderRadius: 9999,
    overflow: 'hidden',
  },
  innerGradient: {
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  innerView: {
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  size_sm: {
    height: 38,
    paddingHorizontal: 16,
  },
  size_md: {
    height: 46,
    paddingHorizontal: 20,
  },
  size_lg: {
    height: 52,
    paddingHorizontal: 24,
  },
  secondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: OrbitTokens.border.glassHairline,
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: OrbitTokens.border.glassSpecular,
  },
  danger: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.45,
  },
  labelBase: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  labelSize_sm: {
    fontSize: 12.5,
  },
  labelSize_md: {
    fontSize: 14,
  },
  labelSize_lg: {
    fontSize: 15,
    fontWeight: '700',
  },
  label_primary: {
    color: '#FFFFFF',
  },
  label_secondary: {
    color: OrbitTokens.colors.text.primary,
  },
  label_glass: {
    color: OrbitTokens.colors.text.primary,
  },
  label_danger: {
    color: OrbitTokens.colors.accent.danger,
    fontWeight: '700',
  },
  label_ghost: {
    color: OrbitTokens.colors.text.secondary,
  },
  labelDisabled: {
    color: OrbitTokens.colors.text.disabled,
  },
});
