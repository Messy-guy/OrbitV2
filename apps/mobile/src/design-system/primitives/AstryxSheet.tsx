import React from 'react';
import { View, Text, Modal, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { OrbitTokens } from '../tokens';
import * as Haptics from 'expo-haptics';

interface AstryxSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const AstryxSheet: React.FC<AstryxSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
}) => {
  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheet}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleGroup}>
              {icon}
              <View>
                <Text style={styles.title}>{title}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>
            </View>

            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <X size={15} color={OrbitTokens.colors.text.primary} />
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.body}>{children}</View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: OrbitTokens.colors.bg.surface,
    borderTopWidth: 1,
    borderTopColor: OrbitTokens.colors.border.subtle,
    borderTopLeftRadius: OrbitTokens.radii.sm,
    borderTopRightRadius: OrbitTokens.radii.sm,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: OrbitTokens.colors.border.hairline,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontFamily: OrbitTokens.typography.mono,
    fontSize: 13,
    fontWeight: '800',
    color: OrbitTokens.colors.text.primary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: OrbitTokens.typography.mono,
    fontSize: 10.5,
    color: OrbitTokens.colors.text.muted,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OrbitTokens.colors.bg.elevated,
    borderRadius: OrbitTokens.radii.xs,
    borderWidth: 1,
    borderColor: OrbitTokens.colors.border.hairline,
  },
  body: {
    padding: 16,
  },
});
