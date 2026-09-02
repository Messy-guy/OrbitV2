import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { Bot, User, Copy, Check, Sparkles } from 'lucide-react-native';
import { MobileAgentChatMessage } from '../../types/orbit';
import { ActivityCard } from './ActivityCard';
import { normalizeMobileAssistantContent } from '../../utils/normalizeAssistant';
import * as Haptics from 'expo-haptics';

interface MessageBubbleProps {
  message: MobileAgentChatMessage;
  agentName: string;
  showHeader?: boolean;
}

const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({ message, agentName, showHeader = true }) => {
  const isUser = message.sender === 'user';
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCopiedCodeIndex(index);
      setTimeout(() => setCopiedCodeIndex(null), 2000);
    } catch {}
  };

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText} selectable>
            {message.content}
          </Text>
        </View>
        <View style={styles.userAvatar}>
          <User size={13} color="#f4f4f5" />
        </View>
      </View>
    );
  }

  // Parse prose lines with support for headings, bullet points, numbered lists, blockquotes, and inline code
  const renderFormattedProse = (text: string, blockKey: string | number) => {
    const lines = text.split('\n');
    return (
      <View key={blockKey} style={styles.proseBlock}>
        {lines.map((line, lineIdx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <View key={lineIdx} style={styles.proseEmptyLine} />;
          }

          // Heading 1 / 2 / 3
          if (trimmed.startsWith('### ')) {
            return (
              <Text key={lineIdx} style={styles.heading3} selectable>
                {trimmed.slice(4)}
              </Text>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <Text key={lineIdx} style={styles.heading2} selectable>
                {trimmed.slice(3)}
              </Text>
            );
          }
          if (trimmed.startsWith('# ')) {
            return (
              <Text key={lineIdx} style={styles.heading1} selectable>
                {trimmed.slice(2)}
              </Text>
            );
          }

          // Bullet List Item
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
            const bulletText = trimmed.replace(/^[-*•]\s+/, '');
            return (
              <View key={lineIdx} style={styles.listItemRow}>
                <Text style={styles.bulletSymbol}>•</Text>
                <Text style={styles.listItemText} selectable>
                  {renderInlineTokens(bulletText)}
                </Text>
              </View>
            );
          }

          // Numbered List Item (e.g. 1. , 2. )
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
          if (numMatch) {
            return (
              <View key={lineIdx} style={styles.listItemRow}>
                <Text style={styles.numberSymbol}>{numMatch[1]}.</Text>
                <Text style={styles.listItemText} selectable>
                  {renderInlineTokens(numMatch[2])}
                </Text>
              </View>
            );
          }

          // Blockquote (e.g. > note)
          if (trimmed.startsWith('> ')) {
            return (
              <View key={lineIdx} style={styles.blockquoteContainer}>
                <Text style={styles.blockquoteText} selectable>
                  {renderInlineTokens(trimmed.slice(2))}
                </Text>
              </View>
            );
          }

          // Standard paragraph line
          return (
            <Text key={lineIdx} style={styles.assistantText} selectable>
              {renderInlineTokens(line)}
            </Text>
          );
        })}
      </View>
    );
  };

  // Inline formatting helper for bold (**text**) and inline code (`code`)
  const renderInlineTokens = (lineText: string) => {
    const tokens = lineText.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    if (tokens.length === 1) return lineText;

    return tokens.map((tok, i) => {
      if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
        return (
          <Text key={i} style={styles.inlineCode}>
            {tok.slice(1, -1)}
          </Text>
        );
      }
      if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
        return (
          <Text key={i} style={styles.boldText}>
            {tok.slice(2, -2)}
          </Text>
        );
      }
      return tok;
    });
  };

  // Split entire content by fenced code blocks (```lang ... ```)
  const renderedBody = useMemo(() => {
    // INV-19/20 — render-boundary defense: strip any surviving terminal
    // artifacts before display (the data boundary already normalized this).
    const content = normalizeMobileAssistantContent(message.content || '');
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
        const isCopied = copiedCodeIndex === index;

        return (
          <View key={index} style={styles.codeBlock}>
            <View style={styles.codeHeader}>
              <Text style={styles.codeLang}>{lang || 'code'}</Text>
              <Pressable
                style={styles.copyBtn}
                onPress={() => handleCopy(code, index)}
                hitSlop={8}
              >
                {isCopied ? <Check size={11} color="#10b981" /> : <Copy size={11} color="#71717a" />}
                <Text style={[styles.copyBtnText, isCopied && { color: '#10b981' }]}>
                  {isCopied ? 'Copied' : 'Copy'}
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              nestedScrollEnabled={true}
              directionalLockEnabled={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.codeScrollContent}
            >
              <Text style={styles.codeText} selectable>
                {code}
              </Text>
            </ScrollView>
          </View>
        );
      }

      return renderFormattedProse(part, index);
    });
  }, [message.content, message.streaming, copiedCodeIndex]);

  return (
    <View style={styles.assistantCard}>
      {/* Header (Only shown if showHeader is true) */}
      {showHeader && (
        <View style={styles.agentHeader}>
          <View style={styles.agentAvatar}>
            <Bot size={13} color="#f97316" />
          </View>
          <Text style={styles.agentTitle} numberOfLines={1}>
            @{agentName}
          </Text>
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
      <View style={styles.body}>{renderedBody}</View>
    </View>
  );
};

export const MessageBubble = React.memo(MessageBubbleComponent);

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: 8,
    marginVertical: 4,
    width: '100%',
  },
  userBubble: {
    maxWidth: '85%',
    backgroundColor: '#ea580c',
    borderRadius: 16,
    borderBottomRightRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexShrink: 1,
  },
  userText: {
    fontSize: 13.5,
    color: '#ffffff',
    lineHeight: 19,
    fontWeight: '500',
    flexShrink: 1,
  },
  userAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  assistantCard: {
    backgroundColor: '#121215',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    marginVertical: 4,
    gap: 8,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'flex-start',
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
    flexShrink: 1,
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
    width: '100%',
  },
  proseBlock: {
    gap: 3,
    width: '100%',
  },
  proseEmptyLine: {
    height: 6,
  },
  assistantText: {
    fontSize: 13,
    color: '#e4e4e7',
    lineHeight: 20,
    flexShrink: 1,
  },
  boldText: {
    fontWeight: '700',
    color: '#ffffff',
  },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11.5,
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  heading1: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f4f4f5',
    marginTop: 6,
    marginBottom: 2,
  },
  heading2: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f4f4f5',
    marginTop: 4,
    marginBottom: 2,
  },
  heading3: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fdba74',
    marginTop: 3,
    marginBottom: 1,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingLeft: 4,
    width: '100%',
  },
  bulletSymbol: {
    fontSize: 13,
    color: '#f97316',
    lineHeight: 20,
  },
  numberSymbol: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f97316',
    lineHeight: 20,
  },
  listItemText: {
    fontSize: 13,
    color: '#e4e4e7',
    lineHeight: 20,
    flex: 1,
  },
  blockquoteContainer: {
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
    paddingLeft: 8,
    paddingVertical: 2,
    marginVertical: 3,
    backgroundColor: 'rgba(249, 115, 22, 0.05)',
    borderRadius: 4,
  },
  blockquoteText: {
    fontSize: 12.5,
    color: '#d4d4d8',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  codeBlock: {
    backgroundColor: '#090a0f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    marginVertical: 4,
    width: '100%',
    overflow: 'hidden',
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
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  copyBtnText: {
    fontSize: 10,
    color: '#71717a',
    fontWeight: '600',
  },
  codeScrollContent: {
    paddingRight: 16,
  },
  codeText: {
    fontSize: 11.5,
    color: '#38bdf8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 17,
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
