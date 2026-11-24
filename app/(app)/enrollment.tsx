import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { useVaultStore } from '../../src/store/vaultStore';
import { useSyncStore } from '../../src/store/syncStore';
import { useTheme } from '../../src/store/themeStore';
import { VaultService } from '../../src/services/vaultService';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import {
  ChevronLeftIcon,
  ShieldIcon,
  KeyIcon,
} from '../../src/components/Icons';
import { Radius, Spacing, Typography, Shadows, Palette } from '../../src/components/tokens';

export default function EnrollmentScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { unlockWithKey, setVaultId, accounts, setAccountsFromSync } = useVaultStore();
  const { triggerSync } = useSyncStore();
  const { theme } = useTheme();

  const [mode, setMode] = useState<'passphrase' | 'recovery'>('passphrase');
  const [passphrase, setPassphrase] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);

  const wordCount = recoveryCode.trim().split(/\s+/).filter(Boolean).length;

  const handleEnroll = async () => {
    if (!user) {
      Alert.alert('Authentication Error', 'You must be signed in to enroll a device.');
      return;
    }

    try {
      setLoading(true);
      let enrolled: { vaultId: string; vaultKey: Uint8Array };

      if (mode === 'passphrase') {
        if (!passphrase.trim()) {
          Alert.alert('Validation Error', 'Please enter your Master Passphrase.');
          return;
        }
        enrolled = await VaultService.enrollDeviceWithPassphrase(user.id, passphrase.trim());
      } else {
        if (!recoveryCode.trim()) {
          Alert.alert('Validation Error', 'Please enter your 24-word recovery code.');
          return;
        }
        enrolled = await VaultService.enrollDeviceWithRecoveryCode(user.id, recoveryCode.trim());
      }

      // Unlock local vault with the unwrapped Vault Key
      await unlockWithKey(enrolled.vaultKey, enrolled.vaultId);
      setVaultId(enrolled.vaultId);

      // Trigger immediate initial pull to populate accounts on this device
      await triggerSync(user.id, enrolled.vaultKey, accounts, setAccountsFromSync);

      Alert.alert(
        'Device Enrolled Successfully',
        'Your 256-bit Vault Key has been unwrapped and stored securely in this device Keystore. Encrypted accounts synchronized.',
        [{ text: 'Open Vault', onPress: () => router.replace('/(app)') }]
      );
    } catch (err: any) {
      Alert.alert('Enrollment Failed', err.message || 'Incorrect passphrase or recovery code.');
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
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: theme.surface }]}
            accessibilityLabel="Back"
          >
            <ChevronLeftIcon size={18} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.title, { color: theme.heading }]}>Device Enrollment</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Unwrap your zero-knowledge Vault Key onto this device
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Explanatory Security Banner */}
          <View
            style={[
              styles.infoCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
              Shadows.subtle,
            ]}
          >
            <View style={styles.infoRow}>
              <View
                style={[styles.shieldBox, { backgroundColor: Palette.primaryBurgundy }]}
              >
                <ShieldIcon size={20} color={Palette.lightBeige} />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={[styles.infoTitle, { color: theme.heading }]}>
                  Cryptographic Key Wrapping
                </Text>
                <Text style={[styles.infoText, { color: theme.textMuted }]}>
                  An encrypted vault exists for{' '}
                  <Text style={[styles.emailHighlight, { color: theme.heading }]}>
                    {user?.email}
                  </Text>
                  . Authenticate to unwrap the 256-bit AES master key onto this device's hardware Keystore.
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
              Shadows.card,
            ]}
          >
            {/* Mode Tabs */}
            <View
              style={[
                styles.tabRow,
                { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => setMode('passphrase')}
                style={[
                  styles.tab,
                  mode === 'passphrase' && {
                    backgroundColor: Palette.primaryBurgundy,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: mode === 'passphrase' ? Palette.white : theme.textMuted,
                    },
                  ]}
                >
                  Master Passphrase
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMode('recovery')}
                style={[
                  styles.tab,
                  mode === 'recovery' && {
                    backgroundColor: Palette.primaryBurgundy,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: mode === 'recovery' ? Palette.white : theme.textMuted,
                    },
                  ]}
                >
                  24-Word Recovery Code
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'passphrase' ? (
              <View>
                <Input
                  label="Master Passphrase"
                  placeholder="Enter your master passphrase"
                  secureTextEntry
                  value={passphrase}
                  onChangeText={setPassphrase}
                />
                <Text style={[styles.fieldHint, { color: theme.textDim }]}>
                  The passphrase chosen when you initialized your NYX master vault.
                </Text>
              </View>
            ) : (
              <View>
                <Input
                  label="24-Word Recovery Code"
                  placeholder="abandon ability able about above absent absorb abstract absurd abuse..."
                  multiline
                  numberOfLines={4}
                  value={recoveryCode}
                  onChangeText={setRecoveryCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.multilineInput}
                />
                <View style={styles.counterRow}>
                  <Text style={[styles.fieldHint, { color: theme.textDim }]}>
                    Enter the BIP-39 mnemonic phrase generated during vault creation.
                  </Text>
                  <Text
                    style={[
                      styles.counterText,
                      {
                        color:
                          wordCount === 24
                            ? theme.success
                            : wordCount > 0
                            ? theme.warning
                            : theme.textDim,
                      },
                    ]}
                  >
                    {wordCount} / 24 words
                  </Text>
                </View>
              </View>
            )}

            <Button
              title={loading ? 'Unwrapping Key...' : 'Enroll & Synchronize'}
              size="lg"
              onPress={handleEnroll}
              loading={loading}
              icon={<KeyIcon size={18} color={Palette.white} />}
              style={styles.submitBtn}
            />
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
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  infoCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  shieldBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyHeading,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Typography.fontFamilyBody,
  },
  emailHighlight: {
    fontWeight: '700',
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 3,
    marginBottom: Spacing.md,
    gap: 4,
  },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  fieldHint: {
    fontSize: 11,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
    fontFamily: Typography.fontFamilyBody,
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: Spacing.sm,
    fontFamily: Typography.fontFamilyMono,
    fontSize: 13,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  counterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: Spacing.md,
  },
});
