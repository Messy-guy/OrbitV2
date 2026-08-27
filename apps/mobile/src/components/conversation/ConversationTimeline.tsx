import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Bot, Sparkles, ArrowDown } from 'lucide-react-native';
import { MobileAgentChatMessage } from '../../types/orbit';
import { MessageBubble } from './MessageBubble';
import * as Haptics from 'expo-haptics';

interface ConversationTimelineProps {
  messages: MobileAgentChatMessage[];
  agentName: string;
  isWorking?: boolean;
}

export const ConversationTimeline: React.FC<ConversationTimelineProps> = ({
  messages,
  agentName,
  isWorking,
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 60;
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    setIsNearBottom(isBottom);
    setShowScrollBottomBtn(!isBottom && messages.length > 3);
  };

  const scrollToBottom = (animated = true) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    scrollRef.current?.scrollToEnd({ animated });
    setShowScrollBottomBtn(false);
  };

  useEffect(() => {
    if (isNearBottom) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length, messages[messages.length - 1]?.content, isNearBottom]);

  if (!messages || messages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBox}>
          <Bot size={32} color="#f97316" />
        </View>
        <Text style={styles.emptyTitle}>@{agentName.toUpperCase()} is Ready</Text>
        <Text style={styles.emptyDesc}>
          Send a prompt or directive below to start or continue your session.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        {messages.map((msg, index) => {
          const prevMsg = messages[index - 1];
          const isFirstInGroup = !prevMsg || prevMsg.sender !== msg.sender;

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              agentName={agentName}
              showHeader={isFirstInGroup}
            />
          );
        })}

        {isWorking && messages[messages.length - 1]?.sender === 'user' && (
          <View style={styles.workingRow}>
            <Sparkles size={13} color="#f97316" />
            <Text style={styles.workingText}>@{agentName} is thinking & working...</Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottomBtn && (
        <Pressable style={styles.floatingBottomBtn} onPress={() => scrollToBottom(true)}>
          <ArrowDown size={13} color="#f4f4f5" />
          <Text style={styles.floatingBottomText}>New messages</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  content: {
    padding: 14,
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#71717a',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  workingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
    borderRadius: 8,
    marginVertical: 4,
  },
  workingText: {
    fontSize: 11,
    color: '#f97316',
    fontWeight: '500',
  },
  root: {
    flex: 1,
    position: 'relative',
  },
  floatingBottomBtn: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingBottomText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f4f4f5',
  },
});
