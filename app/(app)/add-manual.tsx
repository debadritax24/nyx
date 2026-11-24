import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { ChevronLeftIcon, KeyIcon, CheckIcon } from '../../src/components/Icons';
import { useTheme } from '../../src/store/themeStore';
import { isValidBase32, sanitizeBase32, HashAlgorithm } from '../../src/core/totp';
import { useVaultStore } from '../../src/store/vaultStore';
import { Radius, Spacing, Typography, Shadows, Palette } from '../../src/components/tokens';

const POPULAR_ISSUERS = ['Google', 'GitHub', 'Microsoft', 'AWS', 'Discord', 'Slack'];

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

  const sanitizedSecret = sanitizeBase32(secret);
  const isSecretValid = secret.length > 0 && isValidBase32(sanitizedSecret);

  const handleSelectIssuer = (name: string) => {
    setIssuer(name);
    if (errorMsg) setErrorMsg(null);
  };

  const handleSave = async () => {
    setErrorMsg(null);

    if (!issuer.trim()) {
      setErrorMsg('Please enter a service or issuer name.');
      return;
    }
    if (!accountName.trim()) {
      setErrorMsg('Please enter an account identifier or email.');
      return;
    }
    if (!secret.trim()) {
      setErrorMsg('Please provide a secret key.');
      return;
    }

    if (!isSecretValid) {
      setErrorMsg('The secret key contains invalid characters. Base32 only accepts A-Z and digits 2-7.');
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

      Alert.alert('Account Encrypted', `Successfully secured ${issuer.trim()} in your local vault.`, [
        { text: 'View Codes', onPress: () => router.replace('/(app)') },
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not encrypt account to vault.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: theme.surface }]}
            accessibilityLabel="Back"
          >
            <ChevronLeftIcon size={18} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.title, { color: theme.heading }]}>
              Manual Setup
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Configure cryptographic TOTP parameters manually
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.formScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
            {/* Quick Provider Chips */}
            <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>
              QUICK SERVICE SELECTION
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
            >
              {POPULAR_ISSUERS.map((name) => {
                const isSelected = issuer.toLowerCase() === name.toLowerCase();
                return (
                  <TouchableOpacity
                    key={name}
                    onPress={() => handleSelectIssuer(name)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? Palette.primaryBurgundy
                          : theme.backgroundSecondary,
                        borderColor: isSelected ? Palette.primaryBurgundy : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isSelected ? Palette.white : theme.text,
                        },
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

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
              keyboardType="email-address"
            />

            <View style={styles.secretWrap}>
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
              {secret.length > 0 && (
                <View style={styles.secretValidationRow}>
                  {isSecretValid ? (
                    <View style={styles.validRow}>
                      <CheckIcon size={14} color={theme.success} />
                      <Text style={[styles.validationText, { color: theme.success }]}>
                        Valid Base32 Secret ({sanitizedSecret.length} chars)
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.validationText, { color: theme.danger }]}>
                      Invalid characters (only A-Z and digits 2-7)
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Cryptographic Selectors */}
            <Text style={[styles.selectorLabel, { color: theme.textMuted }]}>
              HASH ALGORITHM
            </Text>
            <View style={styles.selectorRow}>
              {(['SHA1', 'SHA256', 'SHA512'] as HashAlgorithm[]).map((algo) => {
                const isSelected = algorithm === algo;
                return (
                  <TouchableOpacity
                    key={algo}
                    onPress={() => setAlgorithm(algo)}
                    style={[
                      styles.selectorBtn,
                      {
                        backgroundColor: isSelected
                          ? Palette.primaryBurgundy
                          : theme.backgroundSecondary,
                        borderColor: isSelected ? Palette.primaryBurgundy : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectorText,
                        {
                          color: isSelected ? Palette.white : theme.text,
                        },
                      ]}
                    >
                      {algo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.selectorLabel, { color: theme.textMuted }]}>
              NUMBER OF DIGITS
            </Text>
            <View style={styles.selectorRow}>
              {[6, 8].map((num) => {
                const isSelected = digits === num;
                return (
                  <TouchableOpacity
                    key={num}
                    onPress={() => setDigits(num)}
                    style={[
                      styles.selectorBtn,
                      {
                        backgroundColor: isSelected
                          ? Palette.primaryBurgundy
                          : theme.backgroundSecondary,
                        borderColor: isSelected ? Palette.primaryBurgundy : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectorText,
                        {
                          color: isSelected ? Palette.white : theme.text,
                        },
                      ]}
                    >
                      {num} Digits {num === 6 ? '(Standard)' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.selectorLabel, { color: theme.textMuted }]}>
              REFRESH INTERVAL
            </Text>
            <View style={styles.selectorRow}>
              {[30, 60].map((sec) => {
                const isSelected = period === sec;
                return (
                  <TouchableOpacity
                    key={sec}
                    onPress={() => setPeriod(sec)}
                    style={[
                      styles.selectorBtn,
                      {
                        backgroundColor: isSelected
                          ? Palette.primaryBurgundy
                          : theme.backgroundSecondary,
                        borderColor: isSelected ? Palette.primaryBurgundy : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectorText,
                        {
                          color: isSelected ? Palette.white : theme.text,
                        },
                      ]}
                    >
                      {sec} Seconds {sec === 30 ? '(Standard)' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <Button
                title="Save & Encrypt"
                size="lg"
                onPress={handleSave}
                loading={loading}
                icon={<KeyIcon size={18} color={Palette.white} />}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  headerTitleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamilyBody,
    marginTop: 1,
  },
  headerSpacer: {
    width: 36,
  },
  formScroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  chipsScroll: {
    gap: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyBody,
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
  secretWrap: {
    marginBottom: Spacing.xs,
  },
  secretValidationRow: {
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
    paddingHorizontal: 4,
  },
  validRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  validationText: {
    fontSize: 11,
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
    fontSize: 12,
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
