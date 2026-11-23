import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVaultStore } from '../../src/store/vaultStore';
import { useAuthStore } from '../../src/store/authStore';
import { useSyncStore } from '../../src/store/syncStore';
import { TotpCard } from '../../src/components/TotpCard';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors, Radius, Spacing } from '../../src/components/tokens';

export default function DashboardScreen() {
  const router = useRouter();
  const {
    isUnlocked,
    accounts,
    vaultKey,
    searchQuery,
    setSearchQuery,
    loadFromLocalKeystore,
    createVault,
    deleteAccount,
    setAccountsFromSync,
  } = useVaultStore();
  const { user } = useAuthStore();
  const { syncState, triggerSync } = useSyncStore();

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [createdRecoveryCode, setCreatedRecoveryCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isUnlocked) {
      loadFromLocalKeystore(false);
    }
  }, [isUnlocked, loadFromLocalKeystore]);

  const handleCopy = (code: string) => {
    try {
      const Clipboard = require('expo-clipboard');
      Clipboard.setStringAsync(code);

      // Purge sensitive OTP from system clipboard after 30 seconds
      setTimeout(async () => {
        try {
          const current = await Clipboard.getStringAsync();
          if (current === code) {
            await Clipboard.setStringAsync('');
          }
        } catch {}
      }, 30000);
    } catch {
      // fallback
    }
    setCopyFeedback('Code copied! Purging from clipboard in 30s');
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const handleUnlock = async () => {
    try {
      setLoading(true);
      const unlocked = await loadFromLocalKeystore(true);
      if (!unlocked) {
        setShowSetupModal(true);
      }
    } catch (err: any) {
      Alert.alert('Unlock Failed', err.message || 'Could not unlock vault');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVault = async () => {
    if (!passphrase || passphrase.length < 8) {
      Alert.alert('Validation Error', 'Passphrase must be at least 8 characters.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      Alert.alert('Validation Error', 'Passphrases do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await createVault(passphrase);
      setCreatedRecoveryCode(res.recoveryCode);
    } catch (err: any) {
      Alert.alert('Setup Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.account_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If vault is locked, present explicit unlock screen
  if (!isUnlocked) {
    return (
      <SafeAreaView style={styles.lockedContainer}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockedTitle}>NYX Vault is Locked</Text>
        <Text style={styles.lockedSubtitle}>
          Authentication is required to decrypt your TOTP credentials.
        </Text>

        <Button
          title="Unlock Vault"
          onPress={handleUnlock}
          loading={loading}
          style={styles.unlockBtn}
        />

        <Button
          title="Initialize New Vault"
          variant="outline"
          onPress={() => setShowSetupModal(true)}
          style={styles.initBtn}
        />

        {/* Vault Setup Modal */}
        <Modal visible={showSetupModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {!createdRecoveryCode ? (
                <>
                  <Text style={styles.modalTitle}>Create Encrypted Vault</Text>
                  <Text style={styles.modalSubtitle}>
                    Choose a strong master passphrase. This wraps your 256-bit Vault Key with Argon2id.
                  </Text>

                  <Input
                    label="Master Passphrase"
                    placeholder="Min 8 characters"
                    secureTextEntry
                    value={passphrase}
                    onChangeText={setPassphrase}
                  />

                  <Input
                    label="Confirm Passphrase"
                    placeholder="Re-enter passphrase"
                    secureTextEntry
                    value={confirmPassphrase}
                    onChangeText={setConfirmPassphrase}
                  />

                  <Button
                    title="Initialize Vault"
                    onPress={handleCreateVault}
                    loading={loading}
                    style={styles.modalBtn}
                  />

                  <Button
                    title="Cancel"
                    variant="outline"
                    onPress={() => setShowSetupModal(false)}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>Emergency Recovery Code</Text>
                  <Text style={styles.modalSubtitle}>
                    Save these 24 words in a secure offline location. They provide an independent recovery path to unwrap your vault key.
                  </Text>

                  <View style={styles.recoveryBox}>
                    <Text style={styles.recoveryText} selectable>
                      {createdRecoveryCode}
                    </Text>
                  </View>

                  <Button
                    title="I Have Saved My Recovery Code"
                    onPress={() => {
                      setShowSetupModal(false);
                      setCreatedRecoveryCode(null);
                    }}
                    style={styles.modalBtn}
                  />
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>NYX</Text>
          <View style={styles.userRow}>
            <Text style={styles.userBadge}>{user?.email || 'Offline Encrypted Vault'}</Text>
            {user && (
              <TouchableOpacity
                onPress={() => vaultKey && triggerSync(user.id, vaultKey, accounts, setAccountsFromSync)}
                testID="sync-status-pill"
                accessibilityRole="button"
                accessibilityLabel={`Cloud synchronization status: ${syncState}. Tap to synchronize now.`}
                style={[
                  styles.syncPill,
                  syncState === 'synced' && styles.syncPillSynced,
                  syncState === 'conflict' && styles.syncPillConflict,
                  syncState === 'syncing' && styles.syncPillSyncing,
                ]}
              >
                <Text style={styles.syncPillText}>{syncState.toUpperCase()}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(app)/settings')}
          style={styles.settingsButton}
          testID="settings-button"
          accessibilityRole="button"
          accessibilityLabel="Settings"
          activeOpacity={0.8}
        >
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      {copyFeedback && (
        <View style={styles.feedbackToast}>
          <Text style={styles.feedbackText}>{copyFeedback}</Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <Input
          placeholder="Search accounts or issuers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel="Search accounts or issuers"
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={filteredAccounts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TotpCard
            account={item}
            onCopy={handleCopy}
            onDelete={(id) => {
              Alert.alert('Delete Account', `Delete ${item.issuer}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteAccount(id) },
              ]);
            }}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Accounts Yet</Text>
            <Text style={styles.emptySubtitle}>
              Scan a 2FA QR code or enter your secret key manually to get started.
            </Text>
          </View>
        }
      />

      <View style={styles.fabRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.fab, styles.fabSecondary]}
          testID="manual-key-fab"
          accessibilityRole="button"
          accessibilityLabel="Add account with manual key"
          onPress={() => router.push('/(app)/add-manual')}
        >
          <Text style={styles.fabSecondaryText}>Manual Key</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.fab, styles.fabPrimary]}
          testID="add-account-fab"
          accessibilityRole="button"
          accessibilityLabel="Scan QR code"
          onPress={() => router.push('/(app)/scan')}
        >
          <Text style={styles.fabPrimaryText}>+ Scan QR</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  lockedContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  lockIcon: {
    fontSize: 54,
    marginBottom: Spacing.md,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  lockedSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  unlockBtn: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  initBtn: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  modalBtn: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  recoveryBox: {
    backgroundColor: '#0A0D14',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primaryMuted,
    marginBottom: Spacing.md,
  },
  recoveryText: {
    color: Colors.primary,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  logo: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 3,
  },
  userBadge: {
    fontSize: 12,
    color: Colors.textDim,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  syncPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cardBorder,
  },
  syncPillSynced: {
    backgroundColor: Colors.primaryMuted,
  },
  syncPillConflict: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  syncPillSyncing: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  syncPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
    color: Colors.textMuted,
  },
  feedbackToast: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  feedbackText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  searchInput: {
    height: 44,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    color: Colors.textDim,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  fabRow: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  fab: {
    flex: 1,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabPrimary: {
    backgroundColor: Colors.primary,
  },
  fabSecondary: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  fabPrimaryText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 16,
  },
  fabSecondaryText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
});
