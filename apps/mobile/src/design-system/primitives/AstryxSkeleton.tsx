import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle, StyleProp } from 'react-native';

interface AstryxSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export const AstryxSkeleton: React.FC<AstryxSkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 12,
  style,
  className = '',
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: '#1C2130',
          opacity,
        },
        style,
      ]}
      className={className}
    />
  );
};
