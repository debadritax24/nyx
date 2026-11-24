import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
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
import { Radius, Spacing, Typography, Shadows } from '../../src/components/tokens';

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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.contentWrapper}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.heading }]}>Device Enrollment</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Unwrap your zero-knowledge Vault Key onto this device
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.closeBtn, { backgroundColor: theme.surface }]}
          >
            <Text style={[styles.closeText, { color: theme.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
              Shadows.card,
            ]}
          >
            <Text style={[styles.infoText, { color: theme.textMuted }]}>
              A cloud-encrypted vault exists for{' '}
              <Text style={[styles.emailHighlight, { color: theme.primary }]}>
                {user?.email}
              </Text>
              . Authenticate to obtain the Vault Key locally.
            </Text>

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
                    backgroundColor: theme.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: mode === 'passphrase' ? theme.primaryText : theme.textMuted,
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
                    backgroundColor: theme.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: mode === 'recovery' ? theme.primaryText : theme.textMuted,
                    },
                  ]}
                >
                  24-Word Code
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'passphrase' ? (
              <Input
                label="Master Passphrase"
                placeholder="Enter your master passphrase"
                secureTextEntry
                value={passphrase}
                onChangeText={setPassphrase}
              />
            ) : (
              <Input
                label="24-Word Recovery Code"
                placeholder="abandon ability able about above absent..."
                multiline
                numberOfLines={4}
                value={recoveryCode}
                onChangeText={setRecoveryCode}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.multilineInput}
              />
            )}

            <Button
              title={loading ? 'Unwrapping Key...' : 'Enroll & Synchronize'}
              size="lg"
              onPress={handleEnroll}
              loading={loading}
              style={styles.submitBtn}
            />
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
    marginBottom: Spacing.md,
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
  content: {
    paddingBottom: Spacing.xxl,
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Typography.fontFamilyBody,
    marginBottom: Spacing.lg,
  },
  emailHighlight: {
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 4,
    marginBottom: Spacing.lg,
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
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyBody,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: Spacing.sm,
  },
  submitBtn: {
    marginTop: Spacing.md,
  },
});
