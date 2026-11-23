import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseTotpUri } from '../../src/core/totp';
import { useVaultStore } from '../../src/store/vaultStore';
import { Button } from '../../src/components/Button';
import { Colors, Radius, Spacing } from '../../src/components/tokens';

export default function ScanScreen() {
  const router = useRouter();
  const addAccount = useVaultStore((state) => state.addAccount);
  const [scanned, setScanned] = useState(false);

  const processScanData = async (data: string) => {
    if (scanned) return;
    setScanned(true);

    try {
      const parsed = parseTotpUri(data);
      await addAccount({
        issuer: parsed.issuer,
        account_name: parsed.account,
        secret: parsed.secret,
        algorithm: parsed.algorithm,
        digits: parsed.digits,
        period: parsed.period,
      });

      Alert.alert(
        'Account Registered',
        `Successfully registered ${parsed.issuer} (${parsed.account})`,
        [{ text: 'View Codes', onPress: () => router.replace('/(app)') }]
      );
    } catch (err: any) {
      Alert.alert('Invalid QR Code', err.message || 'QR code is not a valid TOTP URI', [
        { text: 'Try Again', onPress: () => setScanned(false) },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan 2FA QR Code</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraPlaceholder}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => processScanData('otpauth://totp/Demo:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Demo')}
          style={styles.overlayBox}
        >
          <Text style={styles.hintText}>Point camera at two-factor authentication QR code</Text>
          <Text style={styles.subHint}>(Tap box to simulate demo scan)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <Button
          title="Enter Key Manually"
          variant="outline"
          onPress={() => router.replace('/(app)/add-manual')}
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
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  closeText: {
    color: Colors.textMuted,
    fontSize: 20,
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: '#0F131C',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  overlayBox: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  hintText: {
    color: Colors.textMuted,
    textAlign: 'center',
    fontSize: 13,
  },
  subHint: {
    color: Colors.textDim,
    fontSize: 11,
    marginTop: 8,
  },
  actions: {
    marginTop: Spacing.xl,
  },
});
