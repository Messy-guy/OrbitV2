import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Terminal, X, Send, Play, Pause, Square } from 'lucide-react-native';
import { MobileAgentDetail } from '../../types/orbit';
import { mobileRelayService } from '../../services/mobileRelay.service';
import { OrbitTokens } from '../../design-system/tokens';
import { AstryxBadge } from '../../design-system/primitives/AstryxBadge';
import { AstryxButton } from '../../design-system/primitives/AstryxButton';
import * as Haptics from 'expo-haptics';

interface AgentTerminalModalProps {
  agent: MobileAgentDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_COMMANDS = [
  'Continue & finish task',
  'Run test suite',
  'Git diff summary',
  'Show plan',
];

export const AgentTerminalModal: React.FC<AgentTerminalModalProps> = ({
  agent,
  isOpen,
  onClose,
}) => {
  const [inputCommand, setInputCommand] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (autoScroll && isOpen && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [agent?.terminalLogs, autoScroll, isOpen]);

  if (!agent) return null;

  const handleSendCommand = (cmd?: string) => {
    const textToSend = cmd || inputCommand;
    if (!textToSend.trim()) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    mobileRelayService.sendAction('SEND_INPUT', agent.id, undefined, { input: textToSend });
    if (!cmd) setInputCommand('');
  };

  const isWorking = agent.status === 'working';

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetContainer}
        >
          {/* Header */}
          <View style={styles.headerBar}>
            <View style={styles.agentInfo}>
              <View style={styles.iconCircle}>
                <Terminal size={16} color="#818CF8" />
              </View>
              <View>
                <Text style={styles.agentName}>@{agent.name}</Text>
                <Text style={styles.agentProvider}>
                  {agent.provider.toUpperCase()} • {agent.status}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <AstryxButton
                label={isWorking ? 'Pause' : 'Resume'}
                variant={isWorking ? 'glass' : 'primary'}
                size="sm"
                onPress={() => {
                  if (isWorking) {
                    mobileRelayService.sendAction('PAUSE', agent.id);
                  } else {
                    mobileRelayService.sendAction('SEND_INPUT', agent.id, undefined, { input: 'continue\r' });
                  }
                }}
                icon={
                  isWorking ? (
                    <Pause size={12} color="#FFFFFF" />
                  ) : (
                    <Play size={12} color="#FFFFFF" />
                  )
                }
              />
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <X size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Quick Prompts Strip */}
          <View style={styles.quickCommandsStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
              {QUICK_COMMANDS.map((cmd, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleSendCommand(cmd)}
                  style={({ pressed }) => [styles.quickChip, pressed && styles.quickChipPressed]}
                >
                  <Text style={styles.quickChipText}>{cmd}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Terminal Console Output */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.terminalWindow}
            contentContainerStyle={styles.terminalContent}
            showsVerticalScrollIndicator={false}
          >
            {agent.terminalLogs && agent.terminalLogs.length > 0 ? (
              agent.terminalLogs.map((log, index) => (
                <View key={index} style={styles.logRow}>
                  <Text style={styles.logIndex}>{(index + 1).toString().padStart(2, '0')}</Text>
                  <Text style={styles.logText}>{log}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyLogs}>
                <Text style={styles.emptyLogsText}>Live Stream Active</Text>
                <Text style={styles.emptyLogsSub}>Awaiting stdout / stderr buffer from workstation...</Text>
              </View>
            )}
          </ScrollView>

          {/* Prompt / Input Bar */}
          <View style={styles.inputBar}>
            <View style={styles.inputBox}>
              <TextInput
                value={inputCommand}
                onChangeText={setInputCommand}
                placeholder="Send terminal instruction..."
                placeholderTextColor="#64748B"
                style={styles.textInput}
                returnKeyType="send"
                onSubmitEditing={() => handleSendCommand()}
              />
            </View>
            <AstryxButton
              label=""
              variant="primary"
              size="md"
              onPress={() => handleSendCommand()}
              disabled={!inputCommand.trim()}
              icon={<Send size={15} color="#FFFFFF" />}
              style={{ width: 44, height: 44 }}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#111726',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    borderTopLeftRadius: OrbitTokens.radii.lg,
    borderTopRightRadius: OrbitTokens.radii.lg,
    height: '88%',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  agentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  agentProvider: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickCommandsStrip: {
    backgroundColor: 'rgba(11, 15, 25, 0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 10,
  },
  quickScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  quickChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: OrbitTokens.radii.pill,
  },
  quickChipPressed: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  terminalWindow: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  terminalContent: {
    padding: 16,
  },
  logRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  logIndex: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#475569',
  },
  logText: {
    fontFamily: 'monospace',
    fontSize: 12.5,
    color: '#A5B4FC',
    flex: 1,
    lineHeight: 18,
  },
  emptyLogs: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 6,
  },
  emptyLogsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#818CF8',
  },
  emptyLogsSub: {
    fontSize: 12.5,
    color: '#64748B',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111726',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: OrbitTokens.radii.pill,
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 13.5,
    color: '#FFFFFF',
    height: '100%',
  },
});
