import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseTotpUri } from '../../src/core/totp';
import { useVaultStore } from '../../src/store/vaultStore';
import { Button } from '../../src/components/Button';
import { Colors, Radius, Spacing } from '../../src/components/tokens';

export default function ScanScreen() {
  const router = useRouter();
  const addAccount = useVaultStore((state) => state.addAccount);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarcodeScanned = async (data: string) => {
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

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.hintText}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Camera Access Required</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.permissionBox}>
          <Text style={styles.permissionText}>
            NYX requires camera access to scan authenticator QR codes. Secrets are processed entirely on your device.
          </Text>
          <Button title="Grant Camera Permission" onPress={requestPermission} style={styles.grantBtn} />
          <Button
            title="Enter Key Manually"
            variant="outline"
            onPress={() => router.replace('/(app)/add-manual')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan Authenticator QR</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraWrapper}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : ({ data }) => handleBarcodeScanned(data)}
        />
        <View style={styles.overlayFrame}>
          <View style={styles.targetCornerTL} />
          <View style={styles.targetCornerTR} />
          <View style={styles.targetCornerBL} />
          <View style={styles.targetCornerBR} />
          <Text style={styles.hintText}>Align QR code within the frame</Text>
        </View>
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
    marginBottom: Spacing.lg,
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
  cameraWrapper: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayFrame: {
    width: 250,
    height: 250,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.primary,
  },
  targetCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.primary,
  },
  targetCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.primary,
  },
  targetCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.primary,
  },
  hintText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  permissionText: {
    color: Colors.textMuted,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  grantBtn: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  actions: {
    marginTop: Spacing.lg,
  },
});
