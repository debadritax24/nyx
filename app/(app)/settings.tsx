import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Switch,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { useVaultStore } from '../../src/store/vaultStore';
import { useSyncStore } from '../../src/store/syncStore';
import { useTheme } from '../../src/store/themeStore';
import { Button } from '../../src/components/Button';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { KeystoreService } from '../../src/core/crypto';
import { Radius, Spacing, Typography, Shadows, Palette } from '../../src/components/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { lock, accounts, resetVault, vaultKey, setAccountsFromSync } = useVaultStore();
  const { triggerSync, syncState, lastSyncedAt, conflictsCount } = useSyncStore();
  const { theme, isDark } = useTheme();

  const [signingOut, setSigningOut] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  useEffect(() => {
    KeystoreService.isBiometricsEnabled().then(setBiometricsEnabled);
  }, []);

  const handleToggleBiometrics = async (val: boolean) => {
    await KeystoreService.setBiometricsEnabled(val);
    setBiometricsEnabled(val);
  };

  const handleSync = async () => {
    if (!user || !vaultKey) {
      Alert.alert(
        'Sync Offline',
        'Please authenticate with Supabase and unlock your vault to synchronize credentials.'
      );
      return;
    }
    await triggerSync(user.id, vaultKey, accounts, setAccountsFromSync);
  };

  const handleLockVault = () => {
    lock();
    Alert.alert('Vault Locked', 'Your local vault is locked. Decrypted secrets cleared from RAM.', [
      { text: 'OK', onPress: () => router.replace('/') },
    ]);
  };

  const handleResetVault = () => {
    Alert.alert(
      'Reset Local Vault',
      'This will erase all locally stored credentials and cryptographic keys from this device. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase Vault',
          style: 'destructive',
          onPress: async () => {
            await resetVault();
            router.replace('/');
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      lock();
      await signOut();
      router.replace('/(auth)/login');
    } catch (err: any) {
      Alert.alert('Sign Out Error', err.message);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.contentWrapper}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.heading }]}>Vault Settings</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Security controls & cryptographic synchronization
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.closeBtn, { backgroundColor: theme.surface }]}
          >
            <Text style={[styles.closeText, { color: theme.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Appearance Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              APPEARANCE & THEME
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
                Shadows.subtle,
              ]}
            >
              <View style={styles.themeRow}>
                <View>
                  <Text style={[styles.themeLabel, { color: theme.text }]}>
                    {isDark ? 'Dark Theme (Burgundy Charcoal)' : 'Light Theme (Warm Cream)'}
                  </Text>
                  <Text style={[styles.themeSublabel, { color: theme.textMuted }]}>
                    Seamless switch across light cream and dark burgundy palettes
                  </Text>
                </View>
                <ThemeToggle size={42} />
              </View>
            </View>
          </View>

          {/* Account & Cloud Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              ACCOUNT & CLOUD VAULT
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
                Shadows.subtle,
              ]}
            >
              <Text style={[styles.label, { color: theme.textMuted }]}>Authenticated User</Text>
              <Text style={[styles.value, { color: theme.text }]}>
                {user?.email || 'Offline Encrypted Vault'}
              </Text>

              <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

              <Text style={[styles.label, { color: theme.textMuted }]}>Total Active Accounts</Text>
              <Text style={[styles.value, { color: theme.text }]}>
                {accounts.length} encrypted credentials
              </Text>

              <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

              <Text style={[styles.label, { color: theme.textMuted }]}>Sync Status</Text>
              <Text
                style={[
                  styles.value,
                  { color: syncState === 'synced' ? theme.success : theme.primary },
                ]}
              >
                {syncState.toUpperCase()}{' '}
                {conflictsCount > 0 ? `(${conflictsCount} conflicts resolved)` : ''}
              </Text>

              <Text style={[styles.label, { color: theme.textMuted }]}>
                Last Cloud Synchronization
              </Text>
              <Text style={[styles.value, { color: theme.text }]}>
                {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Never / Pending'}
              </Text>

              <Button
                title={syncState === 'syncing' ? 'Synchronizing...' : 'Sync Now'}
                variant="secondary"
                loading={syncState === 'syncing'}
                onPress={handleSync}
                style={styles.syncBtn}
              />
            </View>
          </View>

          {/* Multi-Device Synchronization */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              MULTI-DEVICE SYNCHRONIZATION
            </Text>
            <View style={styles.actionCol}>
              <Button
                title="Manage Enrolled Devices"
                variant="secondary"
                onPress={() => router.push('/(app)/devices')}
                style={styles.actionBtn}
              />
              <Button
                title="Enroll Another Device / Restore Vault"
                variant="outline"
                onPress={() => router.push('/(app)/enrollment')}
                style={styles.actionBtn}
              />
            </View>
          </View>

          {/* Hardware Security Preferences */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              HARDWARE KEYSTORE SECURITY
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
                Shadows.subtle,
              ]}
            >
              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>
                    Biometric Hardware Unlock
                  </Text>
                  <Text style={[styles.switchSublabel, { color: theme.textMuted }]}>
                    Require fingerprint or face authentication before unwrapping Vault Key
                  </Text>
                </View>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={handleToggleBiometrics}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={biometricsEnabled ? Palette.lightBeige : '#F5E8DE'}
                />
              </View>
            </View>
          </View>

          {/* Critical Security Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              SECURITY ACTIONS
            </Text>
            <View style={styles.actionCol}>
              <Button
                title="Lock Vault Now"
                variant="secondary"
                onPress={handleLockVault}
                style={styles.actionBtn}
              />
              <Button
                title="Sign Out"
                variant="outline"
                loading={signingOut}
                onPress={handleSignOut}
                style={styles.actionBtn}
              />
              <Button
                title="Erase Local Vault"
                variant="danger"
                onPress={handleResetVault}
                style={styles.actionBtn}
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
    maxWidth: 600,
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
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
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
  scroll: {
    paddingBottom: Spacing.xxl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  themeSublabel: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
    maxWidth: 280,
  },
  label: {
    fontSize: 12,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: Spacing.xs,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  syncBtn: {
    marginTop: Spacing.sm,
  },
  actionCol: {
    gap: Spacing.sm,
  },
  actionBtn: {
    width: '100%',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  switchSublabel: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
});
