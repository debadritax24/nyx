import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { useVaultStore } from '../../src/store/vaultStore';
import { useSyncStore } from '../../src/store/syncStore';
import { useTheme } from '../../src/store/themeStore';
import { Button } from '../../src/components/Button';
import { ConfirmationDialog } from '../../src/components/ConfirmationDialog';
import { BottomNavigation } from '../../src/components/BottomNavigation';
import {
  ShieldIcon,
  LockIcon,
  KeyIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  DeviceIcon,
  RefreshIcon,
  SunIcon,
  MoonIcon,
  SettingsIcon,
  UserIcon,
} from '../../src/components/Icons';
import { KeystoreService } from '../../src/core/crypto';
import { Radius, Spacing, Typography, Shadows, Palette } from '../../src/components/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { lock, accounts, resetVault, vaultKey, setAccountsFromSync } = useVaultStore();
  const { triggerSync, syncState, lastSyncedAt, conflictsCount } = useSyncStore();
  const { theme, mode, setTheme, isDark } = useTheme();

  const [signingOut, setSigningOut] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

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
        'Offline Vault',
        'Please authenticate with Supabase and unlock your vault to synchronize credentials.'
      );
      return;
    }
    await triggerSync(user.id, vaultKey, accounts, setAccountsFromSync);
  };

  const handleLockVault = () => {
    lock();
    router.replace('/');
  };

  const handleConfirmReset = async () => {
    setShowResetDialog(false);
    await resetVault();
    router.replace('/');
  };

  const handleConfirmSignOut = async () => {
    setShowSignOutDialog(false);
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

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'N';

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.background }]}
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
          <Text style={[styles.title, { color: theme.heading }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Security controls & zero-knowledge sync
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Card */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
            Shadows.subtle,
          ]}
        >
          <View style={styles.profileRow}>
            <View style={[styles.avatarBox, { backgroundColor: Palette.primaryBurgundy }]}>
              <Text style={styles.avatarText}>{userInitial}</Text>
            </View>
            <View style={styles.profileDetails}>
              <Text style={[styles.profileEmail, { color: theme.text }]} numberOfLines={1}>
                {user?.email || 'Offline Encrypted Vault'}
              </Text>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.secureBadge,
                    { backgroundColor: isDark ? 'rgba(254, 215, 184, 0.12)' : 'rgba(89, 23, 27, 0.08)' },
                  ]}
                >
                  <ShieldIcon size={12} color={isDark ? Palette.lightBeige : Palette.primaryBurgundy} />
                  <Text
                    style={[
                      styles.secureBadgeText,
                      { color: isDark ? Palette.lightBeige : Palette.primaryBurgundy },
                    ]}
                  >
                    Zero-Knowledge Protected
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View style={[styles.metricsRow, { borderColor: theme.borderLight }]}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, { color: theme.heading }]}>
                {accounts.length}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
                Encrypted Credentials
              </Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: theme.borderLight }]} />
            <View style={styles.metricItem}>
              <View style={styles.syncStatusWrap}>
                <View
                  style={[
                    styles.syncDot,
                    {
                      backgroundColor:
                        syncState === 'synced'
                          ? theme.success
                          : syncState === 'syncing'
                          ? theme.warning
                          : theme.textMuted,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.metricNumber,
                    {
                      color:
                        syncState === 'synced'
                          ? theme.success
                          : syncState === 'syncing'
                          ? theme.warning
                          : theme.text,
                    },
                  ]}
                >
                  {syncState === 'synced' ? 'Synced' : syncState === 'syncing' ? 'Syncing' : 'Ready'}
                </Text>
              </View>
              <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
                Cloud Status
              </Text>
            </View>
          </View>
        </View>

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
            <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
              Select application visual theme
            </Text>
            <View
              style={[
                styles.themeSelectorRow,
                { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => setTheme('light')}
                style={[
                  styles.themeTab,
                  mode === 'light' && {
                    backgroundColor: Palette.primaryBurgundy,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.15,
                    shadowRadius: 2,
                    elevation: 2,
                  },
                ]}
              >
                <SunIcon
                  size={15}
                  color={mode === 'light' ? Palette.white : theme.textMuted}
                />
                <Text
                  style={[
                    styles.themeTabText,
                    { color: mode === 'light' ? Palette.white : theme.textMuted },
                  ]}
                >
                  Light
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setTheme('dark')}
                style={[
                  styles.themeTab,
                  mode === 'dark' && {
                    backgroundColor: Palette.primaryBurgundy,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.15,
                    shadowRadius: 2,
                    elevation: 2,
                  },
                ]}
              >
                <MoonIcon
                  size={15}
                  color={mode === 'dark' ? Palette.white : theme.textMuted}
                />
                <Text
                  style={[
                    styles.themeTabText,
                    { color: mode === 'dark' ? Palette.white : theme.textMuted },
                  ]}
                >
                  Dark
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setTheme('system')}
                style={[
                  styles.themeTab,
                  mode === 'system' && {
                    backgroundColor: Palette.primaryBurgundy,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.15,
                    shadowRadius: 2,
                    elevation: 2,
                  },
                ]}
              >
                <SettingsIcon
                  size={15}
                  color={mode === 'system' ? Palette.white : theme.textMuted}
                />
                <Text
                  style={[
                    styles.themeTabText,
                    { color: mode === 'system' ? Palette.white : theme.textMuted },
                  ]}
                >
                  System
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.themeDescription, { color: theme.textDim }]}>
              {mode === 'light'
                ? 'Warm Cream & Primary Burgundy for elegant daytime clarity.'
                : mode === 'dark'
                ? 'Deep Burgundy & Charcoal for low-light cryptographic focus.'
                : 'Automatically matches your native OS appearance.'}
            </Text>
          </View>
        </View>

        {/* Security & Keystore Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
            HARDWARE KEYSTORE & SECURITY
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
                <Text style={[styles.settingItemTitle, { color: theme.text }]}>
                  Biometric Hardware Unlock
                </Text>
                <Text style={[styles.settingItemDescription, { color: theme.textMuted }]}>
                  Require Face ID or fingerprint recognition before unwrapping the 256-bit Vault Key
                </Text>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: theme.border, true: Palette.primaryBurgundy }}
                thumbColor={biometricsEnabled ? Palette.lightBeige : Palette.secondaryBeige}
              />
            </View>

            <View style={[styles.itemDivider, { backgroundColor: theme.borderLight }]} />

            <TouchableOpacity
              onPress={handleLockVault}
              style={styles.actionRow}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBox, { backgroundColor: theme.backgroundSecondary }]}>
                <LockIcon size={18} color={theme.heading} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={[styles.settingItemTitle, { color: theme.text }]}>
                  Lock Vault Immediately
                </Text>
                <Text style={[styles.settingItemDescription, { color: theme.textMuted }]}>
                  Purges all decrypted secret keys from device volatile RAM
                </Text>
              </View>
              <ChevronRightIcon size={18} color={theme.textDim} />
            </TouchableOpacity>

            <View style={[styles.itemDivider, { backgroundColor: theme.borderLight }]} />

            <TouchableOpacity
              onPress={() => setShowResetDialog(true)}
              style={styles.actionRow}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBox, { backgroundColor: theme.dangerMuted }]}>
                <ShieldIcon size={18} color={theme.danger} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={[styles.settingItemTitle, { color: theme.danger }]}>
                  Erase Local Vault
                </Text>
                <Text style={[styles.settingItemDescription, { color: theme.textMuted }]}>
                  Wipe all credentials and local cryptographic keystore keys
                </Text>
              </View>
              <ChevronRightIcon size={18} color={theme.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Cloud Sync & Devices Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
            CLOUD SYNC & MULTI-DEVICE
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
              Shadows.subtle,
            ]}
          >
            <View style={styles.syncHeaderRow}>
              <View>
                <Text style={[styles.settingItemTitle, { color: theme.text }]}>
                  Encrypted Cloud Backup
                </Text>
                <Text style={[styles.settingItemDescription, { color: theme.textMuted }]}>
                  {lastSyncedAt
                    ? `Last synced: ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Pending initial sync'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleSync}
                disabled={syncState === 'syncing'}
                style={[
                  styles.syncNowBtn,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
                ]}
              >
                {syncState === 'syncing' ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <RefreshIcon size={14} color={theme.heading} />
                    <Text style={[styles.syncNowText, { color: theme.heading }]}>Sync</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {conflictsCount > 0 && (
              <View style={[styles.conflictBanner, { backgroundColor: theme.warningMuted }]}>
                <Text style={[styles.conflictText, { color: theme.warning }]}>
                  {conflictsCount} conflict(s) resolved via cryptographic timestamps
                </Text>
              </View>
            )}

            <View style={[styles.itemDivider, { backgroundColor: theme.borderLight }]} />

            <TouchableOpacity
              onPress={() => router.push('/(app)/devices')}
              style={styles.actionRow}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBox, { backgroundColor: theme.backgroundSecondary }]}>
                <DeviceIcon size={18} color={theme.heading} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={[styles.settingItemTitle, { color: theme.text }]}>
                  Enrolled Devices
                </Text>
                <Text style={[styles.settingItemDescription, { color: theme.textMuted }]}>
                  Manage devices in your zero-knowledge ring
                </Text>
              </View>
              <ChevronRightIcon size={18} color={theme.textDim} />
            </TouchableOpacity>

            <View style={[styles.itemDivider, { backgroundColor: theme.borderLight }]} />

            <TouchableOpacity
              onPress={() => router.push('/(app)/enrollment')}
              style={styles.actionRow}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBox, { backgroundColor: theme.backgroundSecondary }]}>
                <KeyIcon size={18} color={theme.heading} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={[styles.settingItemTitle, { color: theme.text }]}>
                  Enroll New Device
                </Text>
                <Text style={[styles.settingItemDescription, { color: theme.textMuted }]}>
                  Restore or pair another device via Passphrase or 24-Word Code
                </Text>
              </View>
              <ChevronRightIcon size={18} color={theme.textDim} />
            </TouchableOpacity>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
            ABOUT NYX
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
              Shadows.subtle,
            ]}
          >
            <View style={styles.aboutHeader}>
              <View style={[styles.aboutLogoBox, { backgroundColor: Palette.primaryBurgundy }]}>
                <ShieldIcon size={20} color={Palette.lightBeige} />
              </View>
              <View style={styles.aboutInfo}>
                <Text style={[styles.aboutTitle, { color: theme.heading }]}>
                  NYX Authenticator
                </Text>
                <Text style={[styles.aboutTagline, { color: theme.textMuted }]}>
                  "Your digital security, beautifully simplified."
                </Text>
              </View>
            </View>

            <View style={[styles.architectureBox, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.architectureTitle, { color: theme.heading }]}>
                ZERO PLAINTEXT ARCHITECTURE
              </Text>
              <Text style={[styles.architectureText, { color: theme.textMuted }]}>
                • AES-256-GCM authenticated cipher with 96-bit unique IVs{'\n'}
                • Argon2id password key derivation (64MB, 3 iterations){'\n'}
                • Hardware Keystore wrapping & RAM-only unwrap{'\n'}
                • RFC 6238 TOTP engine with SHA1 / SHA256 / SHA512 support
              </Text>
            </View>

            <Text style={[styles.versionText, { color: theme.textDim }]}>
              Version 1.0.0 • Native Mobile Edition
            </Text>
          </View>
        </View>

        {/* Sign Out Button */}
        <View style={styles.signOutWrap}>
          <Button
            title="Sign Out of NYX"
            variant="outline"
            size="lg"
            loading={signingOut}
            onPress={() => setShowSignOutDialog(true)}
            icon={<UserIcon size={18} color={theme.text} />}
            style={styles.signOutBtn}
          />
        </View>
      </ScrollView>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        visible={showResetDialog}
        title="Erase Local Vault?"
        message="This will completely wipe all credentials, account secrets, and cryptographic keys from this device. If you haven't synced, these accounts cannot be recovered."
        confirmLabel="Erase Vault"
        isDestructive
        onConfirm={handleConfirmReset}
        onCancel={() => setShowResetDialog(false)}
      />

      <ConfirmationDialog
        visible={showSignOutDialog}
        title="Sign Out of NYX?"
        message="Your local vault will be locked and all sensitive secrets will be cleared from RAM. You will need your master passphrase or credentials to sign back in."
        confirmLabel="Sign Out"
        onConfirm={handleConfirmSignOut}
        onCancel={() => setShowSignOutDialog(false)}
      />

      {/* Mobile Bottom Navigation */}
      <BottomNavigation
        activeTab="settings"
        onTabChange={(tab) => {
          if (tab === 'home' || tab === 'search') {
            router.replace('/(app)');
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
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
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 110,
  },
  profileCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: Palette.lightBeige,
    fontFamily: Typography.fontFamilyHeading,
  },
  profileDetails: {
    flex: 1,
  },
  profileEmail: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyHeading,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  secureBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontFamily: Typography.fontFamilyBody,
  },
  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
  },
  metricNumber: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
  },
  metricLabel: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: Typography.fontFamilyBody,
  },
  syncStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
    marginLeft: 4,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  cardSubtitle: {
    fontSize: 12,
    marginBottom: Spacing.sm,
    fontFamily: Typography.fontFamilyBody,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  themeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: Radius.sm,
  },
  themeTabText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyBody,
  },
  themeDescription: {
    fontSize: 11,
    marginTop: Spacing.sm,
    fontFamily: Typography.fontFamilyBody,
    fontStyle: 'italic',
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
  settingItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  settingItemDescription: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
    fontFamily: Typography.fontFamilyBody,
  },
  itemDivider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  actionInfo: {
    flex: 1,
  },
  syncHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  syncNowText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyBody,
  },
  conflictBanner: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  conflictText: {
    fontSize: 11,
    fontWeight: '600',
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  aboutLogoBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  aboutInfo: {
    flex: 1,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
  },
  aboutTagline: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 1,
    fontFamily: Typography.fontFamilyBody,
  },
  architectureBox: {
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  architectureTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  architectureText: {
    fontSize: 11,
    lineHeight: 17,
    fontFamily: Typography.fontFamilyMono,
  },
  versionText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.xs,
    fontFamily: Typography.fontFamilyBody,
  },
  signOutWrap: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  signOutBtn: {
    width: '100%',
  },
});
