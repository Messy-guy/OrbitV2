import React from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { OrbitTokens } from '../../design-system/tokens';

let BlurViewComponent: any = null;
try {
  if (Platform.OS === 'ios') {
    BlurViewComponent = require('expo-blur').BlurView;
  }
} catch {}

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomMargin = Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : Math.max(insets.bottom, 14);

  // Filter routes so only active visible tab screens render
  const visibleRoutes = state.routes.filter((route) => {
    const opts = descriptors[route.key]?.options;
    return (opts as any)?.href !== null && ['index', 'sync', 'settings'].includes(route.name);
  });

  return (
    <View style={[styles.floatingWrapper, { bottom: bottomMargin }]} pointerEvents="box-none">
      <View style={[styles.dockContainer, OrbitTokens.shadows.floatingDock]}>
        {Platform.OS === 'ios' && BlurViewComponent ? (
          <BlurViewComponent
            tint="dark"
            intensity={90}
            style={StyleSheet.absoluteFillObject}
          />
        ) : (
          <LinearGradient
            colors={['rgba(28, 24, 34, 0.96)', 'rgba(15, 13, 18, 0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        <View style={styles.dockRow}>
          {visibleRoutes.map((route) => {
            const descriptor = descriptors[route.key];
            const opts = descriptor.options;
            const routeIndex = state.routes.findIndex((r) => r.key === route.key);
            const isFocused = state.index === routeIndex;
            const label =
              typeof opts.tabBarLabel === 'string'
                ? opts.tabBarLabel
                : (opts.title ?? route.name);

            const renderIcon = (color: string) => {
              if (opts.tabBarIcon) {
                return opts.tabBarIcon({ color, focused: isFocused, size: 20 });
              }
              return null;
            };

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                android_ripple={{ color: 'transparent' }}
                style={styles.tabItem}
              >
                <View
                  style={[
                    styles.tabHighlightPill,
                    isFocused && styles.tabHighlightPillFocused,
                  ]}
                >
                  {renderIcon(isFocused ? '#FB923C' : '#8C827A')}
                  <Text
                    style={[
                      styles.tabLabel,
                      isFocused ? styles.tabLabelFocused : styles.tabLabelMuted,
                    ]}
                    numberOfLines={1}
                    allowFontScaling={false}
                  >
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: 18,
    right: 18,
    alignItems: 'center',
  },
  dockContainer: {
    width: '100%',
    maxWidth: 440,
    height: 68,
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(19, 17, 23, 0.92)',
  },
  dockRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  tabHighlightPill: {
    width: '90%',
    maxWidth: 92,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    gap: 3,
    overflow: 'hidden',
  },
  tabHighlightPillFocused: {
    backgroundColor: 'rgba(251, 146, 60, 0.2)',
    borderColor: 'rgba(251, 146, 60, 0.45)',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
    includeFontPadding: false,
  },
  tabLabelFocused: {
    color: '#FB923C',
    fontWeight: '700',
  },
  tabLabelMuted: {
    color: '#8C827A',
  },
});
