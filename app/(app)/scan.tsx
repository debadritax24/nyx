import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseTotpUri } from '../../src/core/totp';
import { useVaultStore } from '../../src/store/vaultStore';
import { useTheme } from '../../src/store/themeStore';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { QrCodeIcon, UploadIcon, KeyIcon } from '../../src/components/Icons';
import { Radius, Spacing, Typography, Shadows, Palette } from '../../src/components/tokens';

type AddMode = 'camera' | 'upload';

export default function ScanScreen() {
  const router = useRouter();
  const addAccount = useVaultStore((state) => state.addAccount);
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<AddMode>('camera');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [uriInput, setUriInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUriProcess = async (rawUri: string) => {
    let parsed;
    try {
      parsed = parseTotpUri(rawUri.trim());
    } catch (parseErr: any) {
      Alert.alert('Invalid QR / URI', parseErr.message || 'Data is not a valid TOTP URI', [
        { text: 'Try Again', onPress: () => setScanned(false) },
      ]);
      return;
    }

    try {
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
        `Successfully encrypted credentials for ${parsed.issuer} (${parsed.account}).`,
        [{ text: 'View Codes', onPress: () => router.replace('/(app)') }]
      );
    } catch (storageErr: any) {
      Alert.alert('Registration Failed', storageErr.message || 'Could not save account to local vault', [
        { text: 'Try Again', onPress: () => setScanned(false) },
      ]);
    }
  };

  const handleBarcodeScanned = async (data: string) => {
    if (scanned) return;
    setScanned(true);
    await handleUriProcess(data);
  };

  const handleUploadSubmit = async () => {
    setUploadError(null);
    if (!uriInput.trim()) {
      setUploadError('Please provide a valid TOTP QR code text or otpauth:// URI.');
      return;
    }
    await handleUriProcess(uriInput);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.heading }]}>Add Account</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Secure your credentials with client-side encryption
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.closeBtn, { backgroundColor: theme.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.closeText, { color: theme.textMuted }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* 3 Tab Mode Switcher (Section 9) */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('camera')}
          style={[
            styles.tabItem,
            activeTab === 'camera' && {
              backgroundColor: theme.primary,
            },
          ]}
        >
          <QrCodeIcon
            size={16}
            color={activeTab === 'camera' ? theme.primaryText : theme.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'camera' ? theme.primaryText : theme.textMuted,
              },
            ]}
          >
            1. Scan QR
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('upload')}
          style={[
            styles.tabItem,
            activeTab === 'upload' && {
              backgroundColor: theme.primary,
            },
          ]}
        >
          <UploadIcon
            size={16}
            color={activeTab === 'upload' ? theme.primaryText : theme.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'upload' ? theme.primaryText : theme.textMuted,
              },
            ]}
          >
            2. Upload QR
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(app)/add-manual')}
          style={styles.tabItem}
        >
          <KeyIcon size={16} color={theme.textMuted} />
          <Text style={[styles.tabText, { color: theme.textMuted }]}>3. Manual</Text>
        </TouchableOpacity>
      </View>

      {/* Tab 1: Live Camera Scanner */}
      {activeTab === 'camera' && (
        <View style={styles.cameraContainer}>
          {!permission?.granted ? (
            <View
              style={[
                styles.permissionBox,
                { backgroundColor: theme.surface, borderColor: theme.border },
                Shadows.card,
              ]}
            >
              <View style={[styles.permIconBox, { backgroundColor: theme.surfaceHighlight }]}>
                <QrCodeIcon size={32} color={theme.primary} />
              </View>
              <Text style={[styles.permissionTitle, { color: theme.heading }]}>
                Camera Access Required
              </Text>
              <Text style={[styles.permissionText, { color: theme.textMuted }]}>
                NYX needs camera access to scan authenticator QR codes. Scanned secrets are decrypted and processed entirely on your device.
              </Text>
              <Button
                title="Grant Camera Permission"
                onPress={requestPermission}
                style={styles.permBtn}
              />
              <Button
                title="Enter Details Manually"
                variant="secondary"
                onPress={() => router.replace('/(app)/add-manual')}
              />
            </View>
          ) : (
            <View style={styles.cameraWrapper}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={scanned ? undefined : ({ data }) => handleBarcodeScanned(data)}
              />

              {/* Viewfinder Frame with Burgundy Accents */}
              <View style={styles.overlayFrame}>
                <View style={[styles.targetCornerTL, { borderColor: Palette.lightBeige }]} />
                <View style={[styles.targetCornerTR, { borderColor: Palette.lightBeige }]} />
                <View style={[styles.targetCornerBL, { borderColor: Palette.lightBeige }]} />
                <View style={[styles.targetCornerBR, { borderColor: Palette.lightBeige }]} />
                <Text style={styles.hintText}>Align QR code inside viewfinder</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Tab 2: Upload QR Image / URI */}
      {activeTab === 'upload' && (
        <ScrollView contentContainerStyle={styles.uploadContainer}>
          <View
            style={[
              styles.uploadCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
              Shadows.card,
            ]}
          >
            <View style={[styles.uploadIconCircle, { backgroundColor: theme.surfaceHighlight }]}>
              <UploadIcon size={32} color={theme.primary} />
            </View>

            <Text style={[styles.uploadTitle, { color: theme.heading }]}>
              Upload QR Code / Key
            </Text>
            <Text style={[styles.uploadSubtitle, { color: theme.textMuted }]}>
              Paste a TOTP export URI or screenshot barcode payload. It will be validated and encrypted immediately.
            </Text>

            {uploadError && (
              <View
                style={[
                  styles.uploadErrorBox,
                  { backgroundColor: theme.dangerMuted, borderColor: theme.danger },
                ]}
              >
                <Text style={[styles.uploadErrorText, { color: theme.danger }]}>
                  {uploadError}
                </Text>
              </View>
            )}

            <Input
              label="TOTP URI or QR Payload"
              placeholder="otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP"
              value={uriInput}
              onChangeText={setUriInput}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={3}
              style={{ height: 80, textAlignVertical: 'top', paddingTop: 8 }}
            />

            <Button
              title="Parse & Encrypt Account"
              size="lg"
              onPress={handleUploadSubmit}
              style={{ marginTop: Spacing.md }}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: Typography.fontFamilyBody,
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
  tabBar: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 4,
    marginBottom: Spacing.lg,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.sm,
    gap: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyBody,
  },
  cameraContainer: {
    flex: 1,
  },
  cameraWrapper: {
    flex: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: '#000000',
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
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
  },
  targetCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
  },
  targetCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 32,
    height: 32,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
  },
  targetCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
  },
  hintText: {
    color: '#FFF8F2',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(56, 37, 40, 0.85)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  permissionBox: {
    flex: 1,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permIconBox: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
    marginBottom: Spacing.xs,
  },
  permissionText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: Typography.fontFamilyBody,
    marginBottom: Spacing.xl,
  },
  permBtn: {
    width: '100%',
    marginBottom: Spacing.sm,
  },
  uploadContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  uploadCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  uploadIconCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  uploadTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
    marginBottom: 6,
  },
  uploadSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    fontFamily: Typography.fontFamilyBody,
    marginBottom: Spacing.lg,
  },
  uploadErrorBox: {
    width: '100%',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  uploadErrorText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
