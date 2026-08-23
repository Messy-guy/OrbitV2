import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { MobileWhatsHappeningBrief } from '../../types/orbit';
import { Sparkles, X, Check, AlertTriangle, Lightbulb, ArrowRight } from 'lucide-react-native';

interface WhatsHappeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  brief?: MobileWhatsHappeningBrief;
  isLoading: boolean;
}

export const WhatsHappeningModal: React.FC<WhatsHappeningModalProps> = ({
  isOpen,
  onClose,
  brief,
  isLoading,
}) => {
  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/70">
        <View className="bg-[#121318] border-t border-white/10 rounded-t-3xl p-5 max-h-[85%]">
          
          {/* Header Bar */}
          <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-white/[0.06]">
            <View className="flex-row items-center gap-2">
              <View className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Sparkles size={13} color="#10B981" />
              </View>
              <Text className="text-white font-mono font-bold text-sm tracking-wider uppercase">
                What's Happening?
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              className="p-1 rounded-lg bg-white/[0.06] active:opacity-75"
            >
              <X size={15} color="#A1A1AA" />
            </Pressable>
          </View>

          {isLoading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" color="#10B981" />
              <Text className="text-zinc-400 font-mono text-xs mt-3">
                Distilling recent agent memory & diffs...
              </Text>
            </View>
          ) : brief ? (
            <ScrollView showsVerticalScrollIndicator={false} className="space-y-4">
              
              {/* Executive Headline & Summary */}
              <View className="p-3.5 bg-white/[0.04] border border-white/[0.06] rounded-2xl">
                <Text className="text-emerald-400 font-mono font-bold text-xs uppercase mb-1">
                  Executive Brief
                </Text>
                <Text className="text-white font-mono text-xs leading-relaxed font-semibold mb-2">
                  {brief.headline}
                </Text>
                <Text className="text-zinc-300 font-mono text-xs leading-relaxed">
                  {brief.executiveSummary}
                </Text>
              </View>

              {/* Completed Tasks */}
              {brief.accomplished.length > 0 && (
                <View className="p-3.5 bg-white/[0.04] border border-white/[0.06] rounded-2xl">
                  <Text className="text-zinc-400 font-mono text-[11px] uppercase tracking-wider font-bold mb-2">
                    Accomplished in this Turn
                  </Text>
                  {brief.accomplished.map((item, idx) => (
                    <View key={idx} className="flex-row items-start gap-2 mb-1.5 last:mb-0">
                      <Check size={13} color="#10B981" className="mt-0.5 shrink-0" />
                      <Text className="text-zinc-300 font-mono text-xs flex-1">{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Blockers & Errors */}
              {brief.blockersAndErrors.length > 0 && (
                <View className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                  <View className="flex-row items-center gap-1.5 mb-2">
                    <AlertTriangle size={13} color="#F59E0B" />
                    <Text className="text-amber-400 font-mono text-[11px] uppercase font-bold">
                      Blockers & Failures
                    </Text>
                  </View>
                  {brief.blockersAndErrors.map((err, idx) => (
                    <Text key={idx} className="text-amber-200 font-mono text-xs mb-1 last:mb-0">
                      • {err}
                    </Text>
                  ))}
                </View>
              )}

              {/* Key Decisions */}
              {brief.keyDecisions.length > 0 && (
                <View className="p-3.5 bg-white/[0.04] border border-white/[0.06] rounded-2xl">
                  <View className="flex-row items-center gap-1.5 mb-2">
                    <Lightbulb size={13} color="#60A5FA" />
                    <Text className="text-blue-400 font-mono text-[11px] uppercase font-bold">
                      Architectural Decisions
                    </Text>
                  </View>
                  {brief.keyDecisions.map((dec, idx) => (
                    <Text key={idx} className="text-zinc-300 font-mono text-xs mb-1 last:mb-0">
                      • {dec}
                    </Text>
                  ))}
                </View>
              )}

              {/* Recommended Next Step */}
              {brief.recommendedNextStep && (
                <View className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-4">
                  <Text className="text-indigo-400 font-mono text-[11px] uppercase font-bold mb-1">
                    Recommended Next Step
                  </Text>
                  <Text className="text-indigo-200 font-mono text-xs leading-relaxed">
                    {brief.recommendedNextStep}
                  </Text>
                </View>
              )}

            </ScrollView>
          ) : (
            <View className="py-8 items-center justify-center">
              <Text className="text-zinc-400 font-mono text-xs">No active summary available.</Text>
            </View>
          )}

          {/* Dismiss Button */}
          <Pressable
            onPress={onClose}
            className="w-full py-3 bg-white rounded-xl items-center justify-center active:opacity-90 mt-3"
          >
            <Text className="text-black font-mono font-bold text-xs">Close Brief</Text>
          </Pressable>

        </View>
      </View>
    </Modal>
  );
};
