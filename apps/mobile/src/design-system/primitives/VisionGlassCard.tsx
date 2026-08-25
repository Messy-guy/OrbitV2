import React from 'react';
import { View, Pressable, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface VisionGlassCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'base' | 'elevated' | 'active';
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export const VisionGlassCard: React.FC<VisionGlassCardProps> = ({
  children,
  onPress,
  variant = 'base',
  style,
  className = '',
}) => {
  const handlePress = () => {
    if (onPress) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      onPress();
    }
  };

  const getGradientColors = () => {
    switch (variant) {
      case 'active':
        return ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.04)'] as const;
      case 'elevated':
        return ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)'] as const;
      default:
        return ['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.015)'] as const;
    }
  };

  const cardContent = (
    <LinearGradient
      colors={getGradientColors()}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className={`p-4 border-t border-white/[0.22] border-x border-b border-white/[0.08] rounded-3xl ${className}`}
      style={style}
    >
      {children}
    </LinearGradient>
  );

  const shadowStyles = {
    shadowColor: variant === 'active' ? '#00F5A0' : '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: variant === 'active' ? 0.2 : 0.4,
    shadowRadius: 20,
    elevation: 6,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        className="mb-3.5 rounded-3xl overflow-hidden active:opacity-85"
        style={shadowStyles}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View className="mb-3.5 rounded-3xl overflow-hidden" style={shadowStyles}>
      {cardContent}
    </View>
  );
};
