import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVaultStore } from '../../src/store/vaultStore';
import { useAuthStore } from '../../src/store/authStore';
import { TotpCard } from '../../src/components/TotpCard';
import { Input } from '../../src/components/Input';
import { Colors, Radius, Spacing } from '../../src/components/tokens';

export default function DashboardScreen() {
  const router = useRouter();
  const { accounts, searchQuery, setSearchQuery } = useVaultStore();
  const { user } = useAuthStore();
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.account_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = (code: string) => {
    try {
      const Clipboard = require('expo-clipboard');
      Clipboard.setStringAsync(code);
    } catch {
      // fallback
    }
    setCopyFeedback('Code copied to clipboard!');
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>NYX</Text>
          <Text style={styles.userBadge}>{user?.email || 'Offline Vault'}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(app)/settings')}
          style={styles.settingsButton}
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
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={filteredAccounts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TotpCard account={item} onCopy={handleCopy} />}
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
          onPress={() => router.push('/(app)/add-manual')}
        >
          <Text style={styles.fabSecondaryText}>Manual Key</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.fab, styles.fabPrimary]}
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
    marginTop: 2,
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
