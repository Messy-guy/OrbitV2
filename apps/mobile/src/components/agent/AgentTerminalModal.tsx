import React, { useState } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X, Send, Play, Pause, Bot, AlertCircle,
} from 'lucide-react-native';
import { MobileAgentDetail } from '../../types/orbit';
import { useLiveRelayStore } from '../../stores/liveRelay.store';
import { mobileRelayService } from '../../services/mobileRelay.service';
import { ConversationTimeline } from '../conversation/ConversationTimeline';
import * as Haptics from 'expo-haptics';

interface AgentTerminalModalProps {
  agent: MobileAgentDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_COMMANDS = [
  'Continue & finish task',
  'Run test suite',
  'Show git diff summary',
  'Explain changes',
];

export const AgentTerminalModal: React.FC<AgentTerminalModalProps> = ({
  agent: initialAgent,
  isOpen,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [inputCommand, setInputCommand] = useState('');

  // Directly subscribe to live store by agent ID to get streaming real-time updates
  const liveAgent = useLiveRelayStore((s) =>
    s.agents.find((a) => a.id === initialAgent?.id) || initialAgent
  );

  const agent = liveAgent;
  const chatHistory = agent?.chatHistory || [];

  if (!agent) return null;

  const handleSendCommand = (cmd?: string) => {
    const textToSend = cmd || inputCommand;
    if (!textToSend.trim()) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    // Send action with session ID
    mobileRelayService.sendAction('SEND_INPUT', agent.id, agent.workspaceId, { input: textToSend });
    if (!cmd) setInputCommand('');
  };

  const handleResumeSession = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    mobileRelayService.sendAction('RESUME' as any, agent.id, agent.workspaceId);
  };

  const isRelayConnected = useLiveRelayStore((s) => s.isConnected);
  const isWorking = agent.status === 'working';
  const isOffline = !isRelayConnected || agent.status === 'offline';
  const isStopped = agent.status === 'ready' || agent.status === 'paused' || agent.status === 'stopped' || agent.status === 'offline';
  const canResume = agent.capabilities?.resume ?? true;

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={[styles.root, { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 12) : 0 }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
          style={styles.keyboardView}
        >
          <View style={styles.contentContainer}>
            {/* Top Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.avatar}>
                  <Bot size={18} color="#f97316" />
                </View>
                <View style={styles.titleColumn}>
                  <Text style={styles.agentName} numberOfLines={1}>
                    {agent.title || `@${agent.name.toUpperCase()}`}
                  </Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, isOffline ? styles.dotOffline : isWorking ? styles.dotWorking : styles.dotIdle]} />
                    <Text style={[styles.statusText, isOffline && { color: '#f59e0b' }]}>
                      {isOffline ? 'OFFLINE • RUNTIME UNAVAILABLE' : `${agent.provider.toUpperCase()} • ${agent.status.toUpperCase()}`}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.headerActions}>
                {isWorking && (
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                      mobileRelayService.sendAction('PAUSE', agent.id, agent.workspaceId);
                    }}
                    hitSlop={8}
                  >
                    <Pause size={14} color="#f4f4f5" />
                  </Pressable>
                )}

                {isStopped && canResume && !isOffline && (
                  <Pressable
                    style={[styles.actionButton, styles.resumeButton]}
                    onPress={handleResumeSession}
                    hitSlop={8}
                  >
                    <Play size={14} color="#10b981" />
                  </Pressable>
                )}

                <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
                  <X size={17} color="#a1a1aa" />
                </Pressable>
              </View>
            </View>

            {/* Quick Directive Chips */}
            {!isOffline && (
              <View style={styles.topUtilityBar}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickScroll}
                >
                  {QUICK_COMMANDS.map((cmd) => (
                    <Pressable
                      key={cmd}
                      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                      onPress={() => handleSendCommand(cmd)}
                    >
                      <Text style={styles.chipText}>{cmd}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* MAIN CONVERSATION VIEWPORT */}
            <ConversationTimeline
              messages={chatHistory}
              agentName={agent.name}
              isWorking={isWorking}
            />

            {/* Bottom Input Bar / Offline Notice */}
            <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              {isOffline ? (
                <View style={styles.offlineBanner}>
                  <AlertCircle size={14} color="#f59e0b" />
                  <Text style={styles.offlineBannerText}>
                    Desktop agent is offline · Reconnect your computer to continue conversation
                  </Text>
                </View>
              ) : (
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={`Message @${agent.name}...`}
                    placeholderTextColor="#71717a"
                    value={inputCommand}
                    onChangeText={setInputCommand}
                    multiline={true}
                    blurOnSubmit={false}
                    autoCorrect={false}
                  />
                  <Pressable
                    style={[styles.sendButton, !inputCommand.trim() && styles.sendButtonDisabled]}
                    onPress={() => handleSendCommand()}
                    disabled={!inputCommand.trim()}
                    hitSlop={6}
                  >
                    <Send size={15} color={inputCommand.trim() ? '#f4f4f5' : '#52525b'} />
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#121214',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  titleColumn: {
    flex: 1,
  },
  agentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f4f4f5',
    letterSpacing: 0.3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotWorking: {
    backgroundColor: '#f97316',
  },
  dotIdle: {
    backgroundColor: '#10b981',
  },
  dotOffline: {
    backgroundColor: '#71717a',
  },
  statusText: {
    fontSize: 10,
    color: '#71717a',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  resumeButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  keyboardView: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  topUtilityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: '#0d0d10',
  },
  quickScroll: {
    gap: 6,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipPressed: {
    opacity: 0.6,
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
  },
  chipText: {
    fontSize: 11,
    color: '#a1a1aa',
    fontWeight: '500',
  },
  inputContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: '#121214',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  textInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 110,
    fontSize: 13.5,
    color: '#f4f4f5',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    paddingRight: 8,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#27272a',
    opacity: 0.5,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  offlineBannerText: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },
});
