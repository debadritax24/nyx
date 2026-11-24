import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { DecryptedAccountRecord } from '../core/crypto';
import { useTheme } from '../store/themeStore';
import { BrandIcon } from './BrandIcon';
import { CountdownCircle } from './CountdownCircle';
import { Button } from './Button';
import { CopyIcon } from './Icons';
import { Radius, Spacing, Typography, Shadows } from './tokens';

interface AccountDetailsModalProps {
  visible: boolean;
  account: DecryptedAccountRecord | null;
  code: string;
  remaining: number;
  onClose: () => void;
  onCopy: (code: string) => void;
  onDelete: (id: string) => void;
}

export const AccountDetailsModal: React.FC<AccountDetailsModalProps> = ({
  visible,
  account,
  code,
  remaining,
  onClose,
  onCopy,
  onDelete,
}) => {
  const { theme } = useTheme();

  if (!account) return null;

  const formattedCode =
    code.length === 6
      ? `${code.slice(0, 3)} ${code.slice(3)}`
      : code.length === 8
      ? `${code.slice(0, 4)} ${code.slice(4)}`
      : code;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <BrandIcon issuer={account.issuer} size={48} />
              <View style={styles.titleCol}>
                <Text style={[styles.issuer, { color: theme.heading }]}>
                  {account.issuer || 'Account'}
                </Text>
                <Text style={[styles.accountName, { color: theme.textMuted }]}>
                  {account.account_name}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeIcon, { color: theme.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* OTP Spotlight */}
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
              <CountdownCircle remaining={remaining} total={account.period || 30} size={42} />
              <View style={[styles.copyPill, { backgroundColor: theme.surfaceHighlight }]}>
                <CopyIcon size={14} color={theme.text} />
                <Text style={[styles.copyPillText, { color: theme.text }]}>Copy</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Security & Cryptographic Metadata */}
          <View style={styles.metaSection}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              SPECIFICATIONS & ENCRYPTION
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
              <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Digits</Text>
              <Text style={[styles.metaValue, { color: theme.text }]}>
                {account.digits || 6} Digits
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.textMuted }]}>
                Time Interval
              </Text>
              <Text style={[styles.metaValue, { color: theme.text }]}>
                {account.period || 30} Seconds
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.textMuted }]}>
                Vault Protection
              </Text>
              <Text style={[styles.metaValue, { color: theme.success }]}>
                AES-256-GCM Authenticated
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              title="Delete Account"
              variant="danger"
              onPress={() => {
                onClose();
                onDelete(account.id);
              }}
              style={styles.deleteBtn}
            />
            <Button
              title="Close"
              variant="outline"
              onPress={onClose}
              style={styles.doneBtn}
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
    maxWidth: 480,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
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
    fontWeight: '700',
    fontFamily: Typography.fontFamilyHeading,
  },
  accountName: {
    fontSize: 14,
    marginTop: 2,
    fontFamily: Typography.fontFamilyBody,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 18,
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  codeText: {
    fontSize: 30,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyMono,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  codeRight: {
    alignItems: 'center',
    gap: 8,
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    gap: 4,
  },
  copyPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 213, 200, 0.4)',
  },
  metaLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamilyBody,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Typography.fontFamilyBody,
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
