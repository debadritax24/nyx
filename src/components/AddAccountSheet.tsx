import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '../store/themeStore';
import { QrCodeIcon, UploadIcon, KeyIcon } from './Icons';
import { Radius, Spacing, Typography, Shadows } from './tokens';

interface AddAccountSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectScan: () => void;
  onSelectUpload: () => void;
  onSelectManual: () => void;
}

export const AddAccountSheet: React.FC<AddAccountSheetProps> = ({
  visible,
  onClose,
  onSelectScan,
  onSelectUpload,
  onSelectManual,
}) => {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.overlay}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }, Shadows.elevated]}>
          {/* Top Drag Handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <Text style={[styles.title, { color: theme.heading }]}>Add New Account</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Choose how you would like to enroll your 2FA credentials
          </Text>

          <View style={styles.optionsList}>
            {/* Option 1: Scan QR */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                onClose();
                onSelectScan();
              }}
              style={[styles.optionCard, { backgroundColor: theme.cardBackgroundAlt, borderColor: theme.border }]}
            >
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceHighlight }]}>
                <QrCodeIcon size={24} color={theme.primary} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: theme.heading }]}>Scan QR Code</Text>
                <Text style={[styles.optionDesc, { color: theme.textMuted }]}>
                  Point your camera at a 2FA barcode on your computer screen
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Upload QR Image */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                onClose();
                onSelectUpload();
              }}
              style={[styles.optionCard, { backgroundColor: theme.cardBackgroundAlt, borderColor: theme.border }]}
            >
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceHighlight }]}>
                <UploadIcon size={24} color={theme.primary} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: theme.heading }]}>Upload QR Image</Text>
                <Text style={[styles.optionDesc, { color: theme.textMuted }]}>
                  Import a saved QR code screenshot or paste an export link
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 3: Manual Setup */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                onClose();
                onSelectManual();
              }}
              style={[styles.optionCard, { backgroundColor: theme.cardBackgroundAlt, borderColor: theme.border }]}
            >
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceHighlight }]}>
                <KeyIcon size={24} color={theme.primary} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: theme.heading }]}>Enter Details Manually</Text>
                <Text style={[styles.optionDesc, { color: theme.textMuted }]}>
                  Type your Base32 secret key, service issuer, and account email
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(56, 37, 40, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: Spacing.lg,
    fontFamily: Typography.fontFamilyBody,
  },
  optionsList: {
    gap: Spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyHeading,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Typography.fontFamilyBody,
  },
});
