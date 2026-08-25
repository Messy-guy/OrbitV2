import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { OrbitTokens } from '../tokens';
import * as Haptics from 'expo-haptics';

interface GlassCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  onPress,
  style,
  active = false,
}) => {
  const handlePress = () => {
    if (onPress) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      onPress();
    }
  };

  const cardBody = (
    <View style={[styles.cardContainer, active && styles.activeCard, OrbitTokens.shadows.depth3D, style]}>
      {/* Specular 3D Top Highlight - subtle and non-neon */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.01)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        {cardBody}
      </Pressable>
    );
  }

  return cardBody;
};

const styles = StyleSheet.create({
  pressable: {
    marginBottom: 14,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  cardContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: OrbitTokens.radii.md,
    borderWidth: 1,
    borderColor: OrbitTokens.border.glassHairline,
    borderTopColor: OrbitTokens.border.glassSpecular,
    padding: 16,
    overflow: 'hidden',
    marginBottom: 14,
  },
  activeCard: {
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderTopColor: 'rgba(96, 165, 250, 0.5)',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
  },
});
