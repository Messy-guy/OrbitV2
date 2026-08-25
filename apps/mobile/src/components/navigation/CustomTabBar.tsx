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
  const bottomMargin = Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : 14;

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
            colors={['rgba(26, 36, 56, 0.96)', 'rgba(11, 17, 32, 0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        <View style={styles.dockRow}>
          {state.routes.map((route, index) => {
            const descriptor = descriptors[route.key];
            const opts = descriptor.options;
            const isFocused = state.index === index;
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
                  {renderIcon(isFocused ? '#93C5FD' : '#64748B')}
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
    left: 14,
    right: 14,
    alignItems: 'center',
  },
  dockContainer: {
    width: '100%',
    height: 72,
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'rgba(11, 17, 32, 0.9)',
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
    paddingHorizontal: 2,
  },
  tabHighlightPill: {
    width: '92%',
    maxWidth: 76,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    gap: 3.5,
    overflow: 'hidden',
  },
  tabHighlightPillFocused: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
    includeFontPadding: false,
  },
  tabLabelFocused: {
    color: '#93C5FD',
    fontWeight: '700',
  },
  tabLabelMuted: {
    color: '#64748B',
  },
});
