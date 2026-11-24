import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  useWindowDimensions,
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
import {
  ShieldIcon,
  LockIcon,
  SearchIcon,
  SettingsIcon,
  RefreshIcon,
} from '../../src/components/Icons';
import { Radius, Spacing, Typography, Shadows, Palette } from '../../src/components/tokens';

export default function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const numColumns = isDesktop ? 3 : isTablet ? 2 : 1;

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
      // Fallback
    }

    setCopyFeedback('Code copied to clipboard (auto-purging in 30s)');
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

  // If vault is locked, present an editorial unlock screen
  if (!isUnlocked) {
    return (
      <SafeAreaView style={[styles.lockedContainer, { backgroundColor: theme.background }]}>
        <View style={styles.lockedTopBar}>
          <View style={styles.brandRow}>
            <View style={[styles.logoMark, { backgroundColor: Palette.primaryBurgundy }]}>
              <Text style={styles.logoMarkText}>N</Text>
            </View>
            <Text style={[styles.brandTitle, { color: theme.heading }]}>NYX</Text>
          </View>
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
            <LockIcon size={32} color={theme.primary} />
          </View>

          <Text style={[styles.lockedTitle, { color: theme.heading }]}>
            NYX Vault is Locked
          </Text>

          <Text style={[styles.lockedSubtitle, { color: theme.textMuted }]}>
            Biometric or passphrase authentication is required to decrypt your local TOTP credentials.
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
                    Save these 24 words in a secure offline location. They provide an independent recovery path to unwrap your vault key.
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
      {copyFeedback && (
        <View style={[styles.feedbackToast, { backgroundColor: theme.primary, borderColor: theme.border }]}>
          <Text style={styles.feedbackText}>{copyFeedback}</Text>
        </View>
      )}

      {/* Main Container */}
      <View style={styles.mainContainer}>
        {/* Navigation Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={[styles.logoMark, { backgroundColor: Palette.primaryBurgundy }]}>
              <Text style={styles.logoMarkText}>N</Text>
            </View>
            <View>
              <Text style={[styles.brandTitle, { color: theme.heading }]}>NYX</Text>
              <View style={styles.userStatusRow}>
                <Text style={[styles.userBadge, { color: theme.textMuted }]} numberOfLines={1}>
                  {user?.email || 'Offline Encrypted Vault'}
                </Text>
                {user && (
                  <TouchableOpacity
                    onPress={() => vaultKey && triggerSync(user.id, vaultKey, accounts, setAccountsFromSync)}
                    testID="sync-status-pill"
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
                      size={10}
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
              </View>
            </View>
          </View>

          {/* Header Controls */}
          <View style={styles.headerControls}>
            <ThemeToggle size={38} />

            <TouchableOpacity
              onPress={() => router.push('/(app)/settings')}
              style={[
                styles.iconButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <SettingsIcon size={18} color={theme.text} />
            </TouchableOpacity>

            {/* Quick Add on Desktop Header */}
            {isDesktop && (
              <Button
                title="Add Account"
                size="sm"
                onPress={() => router.push('/(app)/scan')}
                style={styles.desktopAddBtn}
              />
            )}
          </View>
        </View>

        {/* Hero Section Banner */}
        <View style={styles.heroBanner}>
          <View>
            <Text style={[styles.pageHeading, { color: theme.heading }]}>
              Your Authenticator
            </Text>
            <Text style={[styles.pageSubtitle, { color: theme.textMuted }]}>
              Your security codes, all in one place.
            </Text>
          </View>

          {/* Desktop Search & Quick Buttons */}
          <View style={styles.searchAndActionsRow}>
            <View style={styles.searchWrapper}>
              <Input
                placeholder="Search accounts or issuers..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="Search accounts or issuers"
                style={styles.searchInput}
                rightElement={<SearchIcon size={18} color={theme.textDim} />}
              />
            </View>

            {!isDesktop && (
              <View style={styles.quickAddRow}>
                <Button
                  title="+ Scan QR"
                  size="sm"
                  onPress={() => router.push('/(app)/scan')}
                  style={styles.quickBtn}
                />
                <Button
                  title="Manual"
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push('/(app)/add-manual')}
                  style={styles.quickBtn}
                />
              </View>
            )}
          </View>
        </View>

        {/* Authenticator Cards Grid */}
        <FlatList
          key={`grid-${numColumns}`}
          data={filteredAccounts}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={numColumns > 1 ? { flex: 1 / numColumns } : undefined}>
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
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.surfaceHighlight }]}>
                <ShieldIcon size={36} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.heading }]}>
                No Accounts Yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                Scan a 2FA QR code or enter your secret key manually to protect your digital accounts.
              </Text>

              <View style={styles.emptyActionsRow}>
                <Button
                  title="Scan QR Code"
                  size="md"
                  onPress={() => router.push('/(app)/scan')}
                  style={styles.emptyActionBtn}
                />
                <Button
                  title="Enter Key Manually"
                  size="md"
                  variant="secondary"
                  onPress={() => router.push('/(app)/add-manual')}
                  style={styles.emptyActionBtn}
                />
              </View>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
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
    maxWidth: 420,
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
    marginBottom: Spacing.lg,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  lockedSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
    textAlign: 'center',
    marginBottom: Spacing.xl,
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
    backgroundColor: 'rgba(56, 37, 40, 0.65)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
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
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: Typography?.fontFamilyMono ?? 'monospace',
  },
  feedbackToast: {
    position: 'absolute',
    top: Spacing.md,
    alignSelf: 'center',
    zIndex: 999,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  feedbackText: {
    color: '#FFF8F2',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    color: '#FFF8F2',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    letterSpacing: 1.5,
  },
  userStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  userBadge: {
    fontSize: 12,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
    maxWidth: 180,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  syncPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopAddBtn: {
    marginLeft: Spacing.xs,
  },
  heroBanner: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  pageHeading: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    marginTop: 4,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  searchAndActionsRow: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  searchWrapper: {
    flex: 1,
  },
  searchInput: {
    height: 44,
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.xs,
  },
  quickBtn: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  columnWrapper: {
    gap: Spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 380,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
    marginBottom: Spacing.xl,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptyActionBtn: {
    minWidth: 160,
  },
});
