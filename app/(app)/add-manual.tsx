import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useTheme } from '../../src/store/themeStore';
import { isValidBase32, sanitizeBase32, HashAlgorithm } from '../../src/core/totp';
import { useVaultStore } from '../../src/store/vaultStore';
import { Radius, Spacing, Typography, Shadows } from '../../src/components/tokens';

export default function AddManualScreen() {
  const router = useRouter();
  const addAccount = useVaultStore((state) => state.addAccount);
  const { theme } = useTheme();

  const [issuer, setIssuer] = useState('');
  const [accountName, setAccountName] = useState('');
  const [secret, setSecret] = useState('');
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA1');
  const [digits, setDigits] = useState<number>(6);
  const [period, setPeriod] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setErrorMsg(null);

    if (!issuer.trim() || !accountName.trim() || !secret.trim()) {
      setErrorMsg('Issuer, account name, and secret key are all required.');
      return;
    }

    const sanitizedSecret = sanitizeBase32(secret);
    if (!isValidBase32(sanitizedSecret)) {
      setErrorMsg('The secret must be a valid Base32 key (A-Z and digits 2-7).');
      return;
    }

    try {
      setLoading(true);
      await addAccount({
        issuer: issuer.trim(),
        account_name: accountName.trim(),
        secret: sanitizedSecret,
        algorithm,
        digits,
        period,
      });

      Alert.alert('Account Encrypted', `Successfully registered ${issuer.trim()}.`, [
        { text: 'View Codes', onPress: () => router.replace('/(app)') },
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not encrypt account to vault.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.contentWrapper}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.heading }]}>
              Manual Account Setup
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Configure cryptographic TOTP parameters manually
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.closeBtn, { backgroundColor: theme.surface }]}
          >
            <Text style={[styles.closeText, { color: theme.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
          {errorMsg && (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: theme.dangerMuted, borderColor: theme.danger },
              ]}
            >
              <Text style={[styles.errorText, { color: theme.danger }]}>{errorMsg}</Text>
            </View>
          )}

          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
              Shadows.card,
            ]}
          >
            {/* Account Details */}
            <Input
              label="Service / Issuer"
              placeholder="e.g. GitHub, Google, AWS"
              value={issuer}
              onChangeText={(t) => {
                setIssuer(t);
                if (errorMsg) setErrorMsg(null);
              }}
            />

            <Input
              label="Account Identifier / Email"
              placeholder="e.g. alex@example.com"
              value={accountName}
              onChangeText={(t) => {
                setAccountName(t);
                if (errorMsg) setErrorMsg(null);
              }}
              autoCapitalize="none"
            />

            <Input
              label="Secret Key (Base32)"
              placeholder="e.g. JBSWY3DPEHPK3PXP"
              value={secret}
              onChangeText={(t) => {
                setSecret(t);
                if (errorMsg) setErrorMsg(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            {/* Cryptographic Selectors */}
            <Text style={[styles.selectorLabel, { color: theme.textMuted }]}>
              HASH ALGORITHM
            </Text>
            <View style={styles.selectorRow}>
              {(['SHA1', 'SHA256', 'SHA512'] as HashAlgorithm[]).map((algo) => (
                <TouchableOpacity
                  key={algo}
                  onPress={() => setAlgorithm(algo)}
                  style={[
                    styles.selectorBtn,
                    {
                      backgroundColor:
                        algorithm === algo ? theme.primary : theme.backgroundSecondary,
                      borderColor: algorithm === algo ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectorText,
                      {
                        color: algorithm === algo ? theme.primaryText : theme.text,
                      },
                    ]}
                  >
                    {algo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.selectorLabel, { color: theme.textMuted }]}>
              NUMBER OF DIGITS
            </Text>
            <View style={styles.selectorRow}>
              {[6, 8].map((num) => (
                <TouchableOpacity
                  key={num}
                  onPress={() => setDigits(num)}
                  style={[
                    styles.selectorBtn,
                    {
                      backgroundColor:
                        digits === num ? theme.primary : theme.backgroundSecondary,
                      borderColor: digits === num ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectorText,
                      {
                        color: digits === num ? theme.primaryText : theme.text,
                      },
                    ]}
                  >
                    {num} Digits
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.selectorLabel, { color: theme.textMuted }]}>
              TIME INTERVAL
            </Text>
            <View style={styles.selectorRow}>
              {[30, 60].map((sec) => (
                <TouchableOpacity
                  key={sec}
                  onPress={() => setPeriod(sec)}
                  style={[
                    styles.selectorBtn,
                    {
                      backgroundColor:
                        period === sec ? theme.primary : theme.backgroundSecondary,
                      borderColor: period === sec ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectorText,
                      {
                        color: period === sec ? theme.primaryText : theme.text,
                      },
                    ]}
                  >
                    {sec} Seconds
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <Button
                title="Save & Encrypt"
                size="lg"
                onPress={handleSave}
                loading={loading}
                style={styles.saveBtn}
              />
              <Button
                title="Cancel"
                size="lg"
                variant="outline"
                onPress={() => router.back()}
                style={styles.cancelBtn}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    padding: Spacing.lg,
    maxWidth: 580,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: Typography.fontFamilyBody,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  formScroll: {
    paddingBottom: Spacing.xxl,
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Typography.fontFamilyBody,
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  selectorBtn: {
    flex: 1,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyBody,
  },
  actionsRow: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  saveBtn: {
    width: '100%',
  },
  cancelBtn: {
    width: '100%',
  },
});
