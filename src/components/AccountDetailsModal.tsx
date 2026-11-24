import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput } from 'react-native';
import { DecryptedAccountRecord } from '../core/crypto';
import { useTheme } from '../store/themeStore';
import { BrandIcon } from './BrandIcon';
import { CountdownCircle } from './CountdownCircle';
import { Button } from './Button';
import { CopyIcon, EditIcon, CheckIcon } from './Icons';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Radius, Spacing, Typography, Shadows } from './tokens';

interface AccountDetailsModalProps {
  visible: boolean;
  account: DecryptedAccountRecord | null;
  code: string;
  remaining: number;
  onClose: () => void;
  onCopy: (code: string) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, updates: { issuer: string; account_name: string }) => void;
}

export const AccountDetailsModal: React.FC<AccountDetailsModalProps> = ({
  visible,
  account,
  code,
  remaining,
  onClose,
  onCopy,
  onDelete,
  onUpdate,
}) => {
  const { theme } = useTheme();

  const [isEditing, setIsEditing] = useState(false);
  const [editIssuer, setEditIssuer] = useState('');
  const [editAccountName, setEditAccountName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync edit state when modal opens
  React.useEffect(() => {
    if (account) {
      setEditIssuer(account.issuer);
      setEditAccountName(account.account_name);
      setIsEditing(false);
      setShowDeleteConfirm(false);
    }
  }, [account]);

  if (!account) return null;

  const formattedCode =
    code.length === 6
      ? `${code.slice(0, 3)} ${code.slice(3)}`
      : code.length === 8
      ? `${code.slice(0, 4)} ${code.slice(4)}`
      : code;

  const handleSaveEdit = () => {
    if (onUpdate && editIssuer.trim() && editAccountName.trim()) {
      onUpdate(account.id, {
        issuer: editIssuer.trim(),
        account_name: editAccountName.trim(),
      });
      setIsEditing(false);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
            {/* Modal Header */}
            <View style={styles.header}>
              <View style={styles.brandRow}>
                <BrandIcon issuer={isEditing ? editIssuer : account.issuer} size={46} />
                <View style={styles.titleCol}>
                  {isEditing ? (
                    <View style={styles.editInputsBox}>
                      <TextInput
                        value={editIssuer}
                        onChangeText={setEditIssuer}
                        placeholder="Issuer / Service"
                        placeholderTextColor={theme.textDim}
                        style={[styles.inlineInput, { color: theme.heading, borderColor: theme.border }]}
                      />
                      <TextInput
                        value={editAccountName}
                        onChangeText={setEditAccountName}
                        placeholder="Account Email"
                        placeholderTextColor={theme.textDim}
                        style={[styles.inlineInput, { color: theme.textMuted, borderColor: theme.border }]}
                      />
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.issuer, { color: theme.heading }]} numberOfLines={1}>
                        {account.issuer || 'Account'}
                      </Text>
                      <Text style={[styles.accountName, { color: theme.textMuted }]} numberOfLines={1}>
                        {account.account_name}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              <View style={styles.headerRightBtns}>
                <TouchableOpacity
                  onPress={() => (isEditing ? handleSaveEdit() : setIsEditing(true))}
                  style={[styles.roundBtn, { backgroundColor: theme.surfaceHighlight }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {isEditing ? (
                    <CheckIcon size={14} color={theme.success} />
                  ) : (
                    <EditIcon size={14} color={theme.primary} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.roundBtn, { backgroundColor: theme.surfaceHighlight }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.closeIcon, { color: theme.textMuted }]}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* OTP Spotlight Box */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onCopy(code)}
              style={[
                styles.codeBox,
                {
                  backgroundColor: theme.codeBoxBg,
                  borderColor: theme.codeBoxBorder,
                },
              ]}
            >
              <View>
                <Text style={[styles.codeLabel, { color: theme.textMuted }]}>
                  CURRENT SECURITY CODE
                </Text>
                <Text style={[styles.codeText, { color: theme.primary }]}>
                  {formattedCode}
                </Text>
              </View>
              <View style={styles.codeRight}>
                <CountdownCircle remaining={remaining} total={account.period || 30} size={40} />
                <View style={[styles.copyPill, { backgroundColor: theme.surfaceHighlight }]}>
                  <CopyIcon size={12} color={theme.text} />
                  <Text style={[styles.copyPillText, { color: theme.text }]}>Copy</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Specifications & Cryptographic Details */}
            <View style={styles.metaSection}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                CRYPTOGRAPHIC PARAMETERS
              </Text>

              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: theme.textMuted }]}>
                  Authentication Method
                </Text>
                <Text style={[styles.metaValue, { color: theme.text }]}>
                  RFC 6238 TOTP
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Algorithm</Text>
                <Text style={[styles.metaValue, { color: theme.text }]}>
                  {account.algorithm || 'SHA1'}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Code Digits</Text>
                <Text style={[styles.metaValue, { color: theme.text }]}>
                  {account.digits || 6} Digits
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: theme.textMuted }]}>
                  Refresh Interval
                </Text>
                <Text style={[styles.metaValue, { color: theme.text }]}>
                  {account.period || 30} Seconds
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: theme.textMuted }]}>
                  Storage Invariant
                </Text>
                <Text style={[styles.metaValue, { color: theme.success }]}>
                  AES-256-GCM Encrypted
                </Text>
              </View>
            </View>

            {/* Actions: Delete Account & Done */}
            <View style={styles.actions}>
              <Button
                title="Delete Account"
                variant="danger"
                size="md"
                onPress={() => setShowDeleteConfirm(true)}
                style={styles.deleteBtn}
              />
              <Button
                title="Done"
                variant="outline"
                size="md"
                onPress={onClose}
                style={styles.doneBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Dialog for Destructive Deletion */}
      <ConfirmationDialog
        visible={showDeleteConfirm}
        title={`Delete ${account.issuer || 'Account'}?`}
        message={`Are you sure you want to remove ${account.account_name} from your encrypted vault? This cannot be undone.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onClose();
          onDelete(account.id);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(56, 37, 40, 0.65)',
    justifyContent: 'flex-end',
  },
  card: {
    width: '100%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleCol: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  issuer: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
  },
  accountName: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  editInputsBox: {
    gap: 4,
  },
  inlineInput: {
    height: 32,
    borderWidth: 1,
    borderRadius: Radius.xs,
    paddingHorizontal: 8,
    fontSize: 13,
  },
  headerRightBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  roundBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: '600',
  },
  codeBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  codeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyMono ?? 'monospace',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  codeRight: {
    alignItems: 'center',
    gap: 6,
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    gap: 4,
  },
  copyPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 213, 200, 0.3)',
  },
  metaLabel: {
    fontSize: 13,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  deleteBtn: {
    flex: 1,
  },
  doneBtn: {
    flex: 1,
  },
});
