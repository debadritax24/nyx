import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Radius, Spacing } from './tokens';
import { CountdownCircle } from './CountdownCircle';
import { DecryptedAccountRecord } from '../core/crypto';
import { generateTotp } from '../core/totp';

interface TotpCardProps {
  account: DecryptedAccountRecord;
  onCopy?: (code: string) => void;
  onDelete?: (id: string) => void;
}

export const TotpCard: React.FC<TotpCardProps> = ({ account, onCopy, onDelete }) => {
  const [code, setCode] = useState('------');
  const [remaining, setRemaining] = useState(30);

  useEffect(() => {
    let isMounted = true;

    const updateOtp = async () => {
      try {
        const res = await generateTotp({
          secret: account.secret,
          algorithm: account.algorithm,
          digits: account.digits,
          period: account.period,
        });
        if (isMounted) {
          setCode(res.code);
          setRemaining(res.remainingSeconds);
        }
      } catch {
        if (isMounted) setCode('ERROR');
      }
    };

    updateOtp();
    const interval = setInterval(updateOtp, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [account]);

  const formattedCode =
    code.length === 6
      ? `${code.slice(0, 3)} ${code.slice(3)}`
      : code.length === 8
      ? `${code.slice(0, 4)} ${code.slice(4)}`
      : code;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.infoCol}>
          <Text style={styles.issuerText} numberOfLines={1}>
            {account.issuer || 'Account'}
          </Text>
          <Text style={styles.accountText} numberOfLines={1}>
            {account.account_name}
          </Text>
        </View>
        <View style={styles.actionRight}>
          <CountdownCircle remaining={remaining} total={account.period || 30} />
          {onDelete && (
            <TouchableOpacity
              onPress={() => onDelete(account.id)}
              style={styles.deleteBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.deleteIcon}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onCopy && onCopy(code)}
        style={styles.codeContainer}
      >
        <Text style={[styles.codeText, remaining <= 5 && styles.codeUrgent]}>{formattedCode}</Text>
        <Text style={styles.copyHint}>Tap to copy</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoCol: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    color: Colors.danger,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  issuerText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  accountText: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  codeContainer: {
    backgroundColor: '#0F131C',
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  codeText: {
    color: Colors.primary,
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  codeUrgent: {
    color: Colors.danger,
  },
  copyHint: {
    color: Colors.textDim,
    fontSize: 12,
  },
});
