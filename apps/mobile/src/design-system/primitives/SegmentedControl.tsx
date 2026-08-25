import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

interface SegmentedControlProps<T extends string> {
  options: { key: T; label: string; count?: number }[];
  selectedKey: T;
  onSelect: (key: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  selectedKey,
  onSelect,
  className = '',
}: SegmentedControlProps<T>) {
  const handleSelect = (key: T) => {
    if (key !== selectedKey) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      onSelect(key);
    }
  };

  return (
    <View className={`flex-row p-1 bg-[#0B0D14] border border-white/[0.08] rounded-2xl ${className}`}>
      {options.map((option) => {
        const isSelected = option.key === selectedKey;
        return (
          <Pressable
            key={option.key}
            onPress={() => handleSelect(option.key)}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5 ${
              isSelected ? 'bg-white/[0.12] border border-white/[0.16]' : 'bg-transparent'
            }`}
          >
            <Text
              className={`font-mono text-xs font-bold ${
                isSelected ? 'text-white' : 'text-zinc-400'
              }`}
            >
              {option.label}
            </Text>
            {option.count !== undefined && (
              <View
                className={`px-1.5 py-0.2 rounded-md ${
                  isSelected ? 'bg-[#00F5A0]/20' : 'bg-white/[0.06]'
                }`}
              >
                <Text
                  className={`font-mono text-[10px] font-bold ${
                    isSelected ? 'text-[#00F5A0]' : 'text-zinc-400'
                  }`}
                >
                  {option.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
