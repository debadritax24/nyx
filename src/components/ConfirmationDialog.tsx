import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { useTheme } from '../store/themeStore';
import { Button } from './Button';
import { Radius, Spacing, Typography, Shadows } from './tokens';

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            Shadows.elevated,
          ]}
        >
          <Text style={[styles.title, { color: isDestructive ? theme.danger : theme.heading }]}>
            {title}
          </Text>
          <Text style={[styles.message, { color: theme.textMuted }]}>{message}</Text>

          <View style={styles.actions}>
            <Button
              title={cancelLabel}
              variant="outline"
              size="md"
              onPress={onCancel}
              style={styles.actionBtn}
            />
            <Button
              title={confirmLabel}
              variant={isDestructive ? 'danger' : 'primary'}
              size="md"
              onPress={onConfirm}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(56, 37, 40, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
    marginBottom: Spacing.xs,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: Typography.fontFamilyBody,
    marginBottom: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
