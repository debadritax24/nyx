import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { useVaultStore } from '../../src/store/vaultStore';
import { useSyncStore } from '../../src/store/syncStore';
import { Button } from '../../src/components/Button';
import { Colors, Radius, Spacing } from '../../src/components/tokens';
import { KeystoreService } from '../../src/core/crypto';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { lock, accounts, resetVault } = useVaultStore();
  const { syncNow, isSyncing, lastSyncedAt } = useSyncStore();
  const [signingOut, setSigningOut] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  useEffect(() => {
    KeystoreService.isBiometricsEnabled().then(setBiometricsEnabled);
  }, []);

  const handleToggleBiometrics = async (val: boolean) => {
    await KeystoreService.setBiometricsEnabled(val);
    setBiometricsEnabled(val);
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
      'This will erase all locally stored credentials and keys from this device. Are you sure?',
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vault Settings</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeText}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account & Cloud</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Authenticated User</Text>
          <Text style={styles.value}>{user?.email || 'Offline Encrypted Vault'}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>Total Active Accounts</Text>
          <Text style={styles.value}>{accounts.length} credentials</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>Last Cloud Synchronization</Text>
          <Text style={styles.value}>
            {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Never / Pending'}
          </Text>

          <Button
            title={isSyncing ? 'Synchronizing...' : 'Sync Now'}
            variant="outline"
            loading={isSyncing}
            onPress={syncNow}
            style={styles.syncBtn}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security Preferences</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Biometric Unlock</Text>
              <Text style={styles.switchSublabel}>Require fingerprint or face unlock to access vault key</Text>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              trackColor={{ false: Colors.cardBorder, true: Colors.primary }}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security Actions</Text>
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
          title="Reset Local Vault"
          variant="danger"
          onPress={handleResetVault}
          style={styles.actionBtn}
        />
      </View>
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
    marginBottom: Spacing.xl,
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  closeText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  label: {
    color: Colors.textDim,
    fontSize: 12,
  },
  value: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: Spacing.sm,
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
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  switchSublabel: {
    color: Colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  syncBtn: {
    marginTop: Spacing.md,
    height: 40,
  },
  actionBtn: {
    marginBottom: Spacing.sm,
  },
});
