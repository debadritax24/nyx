import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../store/themeStore';
import { CountdownCircle } from './CountdownCircle';
import { BrandIcon } from './BrandIcon';
import { CopyIcon, CheckIcon, MoreIcon } from './Icons';
import { AccountDetailsModal } from './AccountDetailsModal';
import { DecryptedAccountRecord } from '../core/crypto';
import { generateTotpSync } from '../core/totp';
import { Radius, Spacing, Typography, Shadows } from './tokens';

interface TotpCardProps {
  account: DecryptedAccountRecord;
  onCopy?: (code: string) => void;
  onDelete?: (id: string) => void;
}

export const TotpCard: React.FC<TotpCardProps> = ({ account, onCopy, onDelete }) => {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const computeCode = () => {
    try {
      return generateTotpSync({
        secret: account.secret,
        algorithm: account.algorithm || 'SHA1',
        digits: Number(account.digits) || 6,
        period: Number(account.period) || 30,
      });
    } catch (err: any) {
      if (__DEV__) {
        console.warn(`[TotpCard] OTP calculation error for ${account.issuer || 'Account'}:`, err?.message || err);
      }
      return null;
    }
  };

  const initial = computeCode();
  const [code, setCode] = useState(initial ? initial.code : '------');
  const [remaining, setRemaining] = useState(
    initial ? initial.remainingSeconds : Number(account.period) || 30
  );

  useEffect(() => {
    let isMounted = true;

    const updateOtp = () => {
      const res = computeCode();
      if (isMounted) {
        if (res) {
          setCode(res.code);
          setRemaining(res.remainingSeconds);
        } else {
          setCode('ERROR');
        }
      }
    };

    updateOtp();
    const interval = setInterval(updateOtp, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [account.id, account.secret, account.algorithm, account.digits, account.period]);

  const handleCopyClick = () => {
    if (onCopy) onCopy(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedCode =
    code.length === 6
      ? `${code.slice(0, 3)} ${code.slice(3)}`
      : code.length === 8
      ? `${code.slice(0, 4)} ${code.slice(4)}`
      : code;

  const isUrgent = remaining <= 5;

  return (
    <>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
          Shadows.card,
        ]}
      >
        {/* Top Service Header */}
        <View style={styles.topRow}>
          <View style={styles.serviceMeta}>
            <BrandIcon issuer={account.issuer} size={42} />
            <View style={styles.textMeta}>
              <Text style={[styles.issuerText, { color: theme.heading }]} numberOfLines={1}>
                {account.issuer || 'Account'}
              </Text>
              <Text style={[styles.accountText, { color: theme.textMuted }]} numberOfLines={1}>
                {account.account_name}
              </Text>
            </View>
          </View>

          <View style={styles.topRightActions}>
            <CountdownCircle
              remaining={remaining}
              total={Number(account.period) || 30}
              size={36}
            />
            <TouchableOpacity
              onPress={() => setShowDetails(true)}
              style={[styles.moreBtn, { backgroundColor: theme.backgroundSecondary }]}
              accessibilityRole="button"
              accessibilityLabel="Account details and settings"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MoreIcon size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* OTP Code Display Box */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleCopyClick}
          accessibilityRole="button"
          accessibilityLabel={`One time password for ${account.issuer || 'account'}: ${formattedCode}. Tap to copy.`}
          testID="copy-otp-button"
          style={[
            styles.codeBox,
            {
              backgroundColor: theme.codeBoxBg,
              borderColor: copied ? theme.success : theme.codeBoxBorder,
            },
          ]}
        >
          <View style={styles.codeColumn}>
            <Text
              style={[
                styles.codeText,
                {
                  color: isUrgent ? theme.danger : theme.primary,
                  fontFamily: Typography.fontFamilyMono,
                },
              ]}
            >
              {formattedCode}
            </Text>
          </View>

          <View
            style={[
              styles.copyBadge,
              {
                backgroundColor: copied ? theme.successMuted : theme.surfaceHighlight,
              },
            ]}
          >
            {copied ? (
              <>
                <CheckIcon size={14} color={theme.success} />
                <Text style={[styles.copyBadgeText, { color: theme.success }]}>COPIED</Text>
              </>
            ) : (
              <>
                <CopyIcon size={14} color={theme.text} />
                <Text style={[styles.copyBadgeText, { color: theme.text }]}>COPY</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Account Details & Specifications Modal */}
      <AccountDetailsModal
        visible={showDetails}
        account={account}
        code={code}
        remaining={remaining}
        onClose={() => setShowDetails(false)}
        onCopy={handleCopyClick}
        onDelete={onDelete || (() => {})}
      />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  serviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  textMeta: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  issuerText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyHeading,
  },
  accountText: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: Typography.fontFamilyBody,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  codeBox: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  codeColumn: {
    flex: 1,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2.5,
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    gap: 4,
  },
  copyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyBody,
    letterSpacing: 0.5,
  },
});
