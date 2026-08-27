import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { Bot, User, Copy, Check, Sparkles } from 'lucide-react-native';
import { MobileAgentChatMessage } from '../../types/orbit';
import { ActivityCard } from './ActivityCard';
import * as Haptics from 'expo-haptics';

interface MessageBubbleProps {
  message: MobileAgentChatMessage;
  agentName: string;
  showHeader?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, agentName, showHeader = true }) => {
  const isUser = message.sender === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText} selectable>{message.content}</Text>
        </View>
        <View style={styles.userAvatar}>
          <User size={13} color="#f4f4f5" />
        </View>
      </View>
    );
  }

  // Parse code blocks and formatted markdown in assistant message
  const renderFormattedContent = (content: string) => {
    if (!content) {
      if (message.streaming) {
        return (
          <View style={styles.streamingRow}>
            <View style={styles.streamingDot} />
            <Text style={styles.streamingText}>Generating response...</Text>
          </View>
        );
      }
      return null;
    }

    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const lang = lines[0]?.match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : '';
        const code = lang ? lines.slice(1).join('\n') : lines.join('\n');

        return (
          <View key={index} style={styles.codeBlock}>
            <View style={styles.codeHeader}>
              <Text style={styles.codeLang}>{lang || 'code'}</Text>
              <Pressable style={styles.copyBtn} onPress={() => handleCopy(code)}>
                {copied ? <Check size={11} color="#10b981" /> : <Copy size={11} color="#71717a" />}
                <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text style={styles.codeText} selectable>{code}</Text>
            </ScrollView>
          </View>
        );
      }

      return (
        <Text key={index} style={styles.assistantText} selectable>
          {part}
        </Text>
      );
    });
  };

  return (
    <View style={styles.assistantCard}>
      {/* Header (Only shown if showHeader is true) */}
      {showHeader && (
        <View style={styles.agentHeader}>
          <View style={styles.agentAvatar}>
            <Bot size={13} color="#f97316" />
          </View>
          <Text style={styles.agentTitle}>@{agentName}</Text>
          {message.streaming && (
            <View style={styles.streamingPill}>
              <Sparkles size={10} color="#f97316" />
              <Text style={styles.streamingPillText}>Streaming</Text>
            </View>
          )}
        </View>
      )}

      {/* Activities if present */}
      {message.activities && message.activities.length > 0 && (
        <ActivityCard activities={message.activities} />
      )}

      {/* Body Content */}
      <View style={styles.body}>{renderFormattedContent(message.content)}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: 8,
    marginVertical: 4,
  },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: '#ea580c',
    borderRadius: 16,
    borderBottomRightRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  userText: {
    fontSize: 13,
    color: '#ffffff',
    lineHeight: 18,
    fontWeight: '500',
  },
  userAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantCard: {
    backgroundColor: '#121215',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    marginVertical: 4,
    gap: 8,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agentAvatar: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  streamingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  streamingPillText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#f97316',
  },
  body: {
    gap: 6,
  },
  assistantText: {
    fontSize: 13,
    color: '#e4e4e7',
    lineHeight: 20,
  },
  codeBlock: {
    backgroundColor: '#090a0f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    marginVertical: 4,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  codeLang: {
    fontSize: 10,
    color: '#71717a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textTransform: 'uppercase',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyBtnText: {
    fontSize: 10,
    color: '#71717a',
  },
  codeText: {
    fontSize: 11,
    color: '#38bdf8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  streamingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  streamingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f97316',
  },
  streamingText: {
    fontSize: 11,
    color: '#71717a',
    fontStyle: 'italic',
  },
});
