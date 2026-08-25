import React from 'react';
import { View, Pressable, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { OrbitTokens } from '../tokens';
import * as Haptics from 'expo-haptics';

interface AstryxCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'surface' | 'elevated' | 'active';
  style?: StyleProp<ViewStyle>;
}

export const AstryxCard: React.FC<AstryxCardProps> = ({
  children,
  onPress,
  variant = 'surface',
  style,
}) => {
  const handlePress = () => {
    if (onPress) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      onPress();
    }
  };

  const cardContent = (
    <View
      style={[
        styles.card,
        styles[variant],
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return <View style={styles.wrapper}>{cardContent}</View>;
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
  },
  pressed: {
    opacity: 0.85,
  },
  card: {
    backgroundColor: OrbitTokens.colors.bg.surface,
    borderWidth: 1,
    borderColor: OrbitTokens.colors.border.hairline,
    borderRadius: OrbitTokens.radii.sm,
    padding: 14,
  },
  surface: {
    backgroundColor: OrbitTokens.colors.bg.surface,
    borderColor: OrbitTokens.colors.border.hairline,
  },
  elevated: {
    backgroundColor: OrbitTokens.colors.bg.elevated,
    borderColor: OrbitTokens.colors.border.subtle,
  },
  active: {
    backgroundColor: OrbitTokens.colors.bg.surface,
    borderColor: 'rgba(0, 255, 157, 0.35)',
  },
});
