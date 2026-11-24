import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVaultStore } from '../../src/store/vaultStore';
import { useAuthStore } from '../../src/store/authStore';
import { useSyncStore } from '../../src/store/syncStore';
import { useTheme } from '../../src/store/themeStore';
import { TotpCard } from '../../src/components/TotpCard';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { NYXLogo } from '../../src/components/NYXLogo';
import { SearchBar } from '../../src/components/SearchBar';
import { BottomNavigation, NavTab } from '../../src/components/BottomNavigation';
import { ToastNotification } from '../../src/components/ToastNotification';
import { AddAccountSheet } from '../../src/components/AddAccountSheet';
import {
  ShieldIcon,
  LockIcon,
  SearchIcon,
  PlusIcon,
  RefreshIcon,
} from '../../src/components/Icons';
import { Radius, Spacing, Typography, Shadows } from '../../src/components/tokens';

export default function DashboardScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const {
    isUnlocked,
    accounts,
    vaultKey,
    searchQuery,
    setSearchQuery,
    loadFromLocalKeystore,
    createVault,
    deleteAccount,
    updateAccount,
    setAccountsFromSync,
  } = useVaultStore();

  const { user } = useAuthStore();
  const { syncState, triggerSync } = useSyncStore();

  const [activeNav, setActiveNav] = useState<NavTab>('home');
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
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

      // Purge sensitive OTP from clipboard after 30 seconds
      setTimeout(async () => {
        try {
          const current = await Clipboard.getStringAsync();
          if (current === code) {
            await Clipboard.setStringAsync('');
          }
        } catch {}
      }, 30000);
    } catch {
      // Fallback
    }

    setCopyToast('Code copied! Auto-purging in 30s');
    setTimeout(() => setCopyToast(null), 2500);
  };

  const handleUnlock = async () => {
    try {
      setLoading(true);
      const unlocked = await loadFromLocalKeystore(true);
      if (!unlocked) {
        setShowSetupModal(true);
      }
    } catch {
      setShowSetupModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVault = async () => {
    if (!passphrase || passphrase.length < 8) {
      alert('Master passphrase must be at least 8 characters.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      alert('Passphrases do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await createVault(passphrase);
      setCreatedRecoveryCode(res.recoveryCode);
    } catch (err: any) {
      alert(err.message || 'Setup Failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.account_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTabChange = (tab: NavTab) => {
    if (tab === 'settings') {
      router.push('/(app)/settings');
      return;
    }
    setActiveNav(tab);
  };

  // If vault is locked, present the mobile unlock screen
  if (!isUnlocked) {
    return (
      <SafeAreaView style={[styles.lockedContainer, { backgroundColor: theme.background }]}>
        <View style={styles.lockedTopBar}>
          <NYXLogo size="sm" />
          <ThemeToggle size={38} />
        </View>

        <View
          style={[
            styles.lockedCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            Shadows.elevated,
          ]}
        >
          <View style={[styles.lockedIconCircle, { backgroundColor: theme.surfaceHighlight }]}>
            <LockIcon size={34} color={theme.primary} />
          </View>

          <Text style={[styles.lockedTitle, { color: theme.heading }]}>NYX Vault Locked</Text>
          <Text style={[styles.lockedSubtitle, { color: theme.textMuted }]}>
            Biometric authentication or master passphrase is required to unwrap your 256-bit Vault Key.
          </Text>

          <Button
            title="Unlock Vault"
            size="lg"
            onPress={handleUnlock}
            loading={loading}
            style={styles.unlockBtn}
          />

          <Button
            title="Initialize New Vault"
            size="lg"
            variant="secondary"
            onPress={() => setShowSetupModal(true)}
            style={styles.initBtn}
          />
        </View>

        {/* Vault Setup Modal */}
        <Modal visible={showSetupModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
                Shadows.elevated,
              ]}
            >
              {!createdRecoveryCode ? (
                <>
                  <Text style={[styles.modalTitle, { color: theme.heading }]}>
                    Create Encrypted Vault
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
                    Choose a strong master passphrase. This wraps your symmetric Vault Key with Argon2id.
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
                    size="lg"
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
                  <Text style={[styles.modalTitle, { color: theme.heading }]}>
                    Emergency Recovery Code
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
                    Save these 24 words in a secure location. They provide an independent recovery path to unwrap your vault key.
                  </Text>

                  <View
                    style={[
                      styles.recoveryBox,
                      {
                        backgroundColor: theme.codeBoxBg,
                        borderColor: theme.codeBoxBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.recoveryText, { color: theme.primary }]} selectable>
                      {createdRecoveryCode}
                    </Text>
                  </View>

                  <Button
                    title="I Have Saved My Recovery Code"
                    size="lg"
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Toast Notification */}
      <ToastNotification message={copyToast} />

      {/* Main Mobile App Header */}
      <View style={styles.header}>
        <NYXLogo size="md" />

        <View style={styles.headerRightControls}>
          {user && (
            <TouchableOpacity
              onPress={() => vaultKey && triggerSync(user.id, vaultKey, accounts, setAccountsFromSync)}
              accessibilityRole="button"
              accessibilityLabel={`Synchronization status: ${syncState}. Tap to sync.`}
              style={[
                styles.syncPill,
                {
                  backgroundColor:
                    syncState === 'synced'
                      ? theme.successMuted
                      : syncState === 'syncing'
                      ? theme.warningMuted
                      : theme.surfaceHighlight,
                },
              ]}
            >
              <RefreshIcon
                size={11}
                color={syncState === 'synced' ? theme.success : theme.primary}
              />
              <Text
                style={[
                  styles.syncPillText,
                  { color: syncState === 'synced' ? theme.success : theme.primary },
                ]}
              >
                {syncState.toUpperCase()}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setActiveNav(activeNav === 'search' ? 'home' : 'search')}
            style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Search accounts"
          >
            <SearchIcon size={18} color={theme.text} />
          </TouchableOpacity>

          <ThemeToggle size={38} />
        </View>
      </View>

      {/* Hero Title Section */}
      <View style={styles.titleSection}>
        <Text style={[styles.pageHeading, { color: theme.heading }]}>
          Your Authenticator
        </Text>
        <Text style={[styles.pageSubtitle, { color: theme.textMuted }]}>
          Your security codes, all in one place.
        </Text>

        {/* Dedicated Mobile Search Bar (Visible when in search mode or when query exists) */}
        {(activeNav === 'search' || searchQuery.length > 0) && (
          <View style={styles.searchBarWrapper}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              count={filteredAccounts.length}
              autoFocus={activeNav === 'search'}
            />
          </View>
        )}
      </View>

      {/* OTP Accounts FlatList */}
      <FlatList
        data={filteredAccounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TotpCard
            account={item}
            onCopy={handleCopy}
            onDelete={(id) => deleteAccount(id)}
            onUpdate={(id, updates) => updateAccount(id, updates)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.surfaceHighlight }]}>
              {searchQuery.length > 0 ? (
                <SearchIcon size={34} color={theme.primary} />
              ) : (
                <ShieldIcon size={34} color={theme.primary} />
              )}
            </View>
            <Text style={[styles.emptyTitle, { color: theme.heading }]}>
              {searchQuery.length > 0 ? 'No Accounts Match Search' : 'No Accounts Yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              {searchQuery.length > 0
                ? `No credentials found matching "${searchQuery}". Check the spelling or add a new account.`
                : 'Scan a 2FA QR code or enter your secret key manually to protect your digital accounts.'}
            </Text>

            {searchQuery.length === 0 ? (
              <View style={styles.emptyActionsRow}>
                <Button
                  title="+ Add First Account"
                  size="md"
                  onPress={() => setShowAddSheet(true)}
                  style={styles.emptyPrimaryBtn}
                />
              </View>
            ) : (
              <Button
                title="Clear Search"
                variant="outline"
                size="sm"
                onPress={() => setSearchQuery('')}
              />
            )}
          </View>
        }
      />

      {/* Mobile Floating Action Button (+ Add Account) */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setShowAddSheet(true)}
        style={[styles.fab, { backgroundColor: theme.primary }, Shadows.elevated]}
        accessibilityRole="button"
        accessibilityLabel="Add account"
      >
        <PlusIcon size={22} color={theme.primaryText} />
      </TouchableOpacity>

      {/* Bottom Navigation Bar */}
      <BottomNavigation
        activeTab={activeNav}
        onTabChange={handleTabChange}
        accountsCount={accounts.length}
      />

      {/* Add Account Bottom Sheet (Scan QR, Upload QR Image, Manual Setup) */}
      <AddAccountSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onSelectScan={() => router.push('/(app)/scan')}
        onSelectUpload={() => router.push('/(app)/scan')}
        onSelectManual={() => router.push('/(app)/add-manual')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  syncPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  pageHeading: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: Typography.fontFamilyBody,
  },
  searchBarWrapper: {
    marginTop: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: 110, // Generous padding to clear BottomNavigation and FAB
  },
  fab: {
    position: 'absolute',
    bottom: 84,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
    fontFamily: Typography.fontFamilyBody,
    marginBottom: Spacing.lg,
  },
  emptyActionsRow: {
    width: '100%',
    maxWidth: 240,
  },
  emptyPrimaryBtn: {
    width: '100%',
  },
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  lockedTopBar: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lockedCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
  },
  lockedIconCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  lockedTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
    marginBottom: 6,
    textAlign: 'center',
  },
  lockedSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Typography.fontFamilyBody,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  unlockBtn: {
    width: '100%',
    marginBottom: Spacing.sm,
  },
  initBtn: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(56, 37, 40, 0.65)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Typography.fontFamilyBody,
    marginBottom: Spacing.lg,
  },
  modalBtn: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  recoveryBox: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  recoveryText: {
    fontSize: 13,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: Typography.fontFamilyMono,
  },
});
