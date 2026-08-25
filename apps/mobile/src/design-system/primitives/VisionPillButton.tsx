import React from 'react';
import { Text, Pressable, ActivityIndicator, ViewStyle, StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';

interface VisionPillButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'glass' | 'danger' | 'subtle';
  icon?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export const VisionPillButton: React.FC<VisionPillButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  icon,
  isLoading = false,
  disabled = false,
  style,
  className = '',
}) => {
  const handlePress = () => {
    if (disabled || isLoading) return;
    try {
      if (variant === 'danger') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {}
    onPress();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-[#00F5A0] text-black border-transparent shadow-lg';
      case 'danger':
        return 'bg-red-500/20 border-red-500/40 text-red-300';
      case 'glass':
        return 'bg-white/[0.12] border-t border-white/[0.25] border-x border-b border-white/[0.1] text-white shadow-md';
      case 'subtle':
      default:
        return 'bg-white/[0.06] border border-white/[0.1] text-zinc-300';
    }
  };

  const getLabelStyles = () => {
    switch (variant) {
      case 'primary':
        return 'text-black font-bold';
      case 'danger':
        return 'text-red-300 font-bold';
      case 'glass':
        return 'text-white font-bold';
      case 'subtle':
      default:
        return 'text-zinc-200 font-semibold';
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || isLoading}
      className={`min-h-[48px] px-5 py-3 rounded-full border flex-row items-center justify-center gap-2 active:opacity-80 ${getVariantStyles()} ${className}`}
      style={style}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#000000' : '#FFFFFF'} />
      ) : (
        <>
          {icon}
          {label ? (
            <Text className={`font-mono text-xs tracking-wide uppercase ${getLabelStyles()}`}>
              {label}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
};
