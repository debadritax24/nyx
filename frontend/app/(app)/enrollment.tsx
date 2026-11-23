import { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { useVaultStore } from '../../src/store/vaultStore';
import { useSyncStore } from '../../src/store/syncStore';
import { VaultService } from '../../src/services/vaultService';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors, Radius, Spacing } from '../../src/components/tokens';

export default function EnrollmentScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { unlockWithKey, setVaultId, accounts, setAccountsFromSync } = useVaultStore();
  const { triggerSync } = useSyncStore();

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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Device Enrollment</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          A cloud-encrypted vault exists for <Text style={styles.emailHighlight}>{user?.email}</Text>. Authenticate with your credentials to obtain the Vault Key locally.
        </Text>

        <View style={styles.tabRow}>
          <TouchableOpacity
            onPress={() => setMode('passphrase')}
            style={[styles.tab, mode === 'passphrase' && styles.activeTab]}
          >
            <Text style={[styles.tabText, mode === 'passphrase' && styles.activeTabText]}>
              Master Passphrase
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode('recovery')}
            style={[styles.tab, mode === 'recovery' && styles.activeTab]}
          >
            <Text style={[styles.tabText, mode === 'recovery' && styles.activeTabText]}>
              24-Word Code
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'passphrase' ? (
          <View style={styles.form}>
            <Input
              label="Master Passphrase"
              placeholder="Enter your master passphrase"
              secureTextEntry
              value={passphrase}
              onChangeText={setPassphrase}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <Input
              label="24-Word Recovery Code"
              placeholder="e.g. abandon ability able about above absent..."
              multiline
              numberOfLines={4}
              value={recoveryCode}
              onChangeText={setRecoveryCode}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.multilineInput}
            />
          </View>
        )}

        <Button
          title={loading ? 'Unwrapping Vault Key...' : 'Enroll & Synchronize Device'}
          onPress={handleEnroll}
          loading={loading}
          style={styles.submitBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  closeText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    paddingBottom: Spacing.xl,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  emailHighlight: {
    color: Colors.primary,
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  tabText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: Colors.primary,
  },
  form: {
    marginBottom: Spacing.lg,
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
