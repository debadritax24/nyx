import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DeviceMetadata, DeviceService } from '../../src/services/deviceService';
import { useTheme } from '../../src/store/themeStore';
import { ConfirmationDialog } from '../../src/components/ConfirmationDialog';
import { Button } from '../../src/components/Button';
import {
  DeviceIcon,
  ChevronLeftIcon,
  ShieldIcon,
  PlusIcon,
} from '../../src/components/Icons';
import { Radius, Spacing, Typography, Shadows, Palette } from '../../src/components/tokens';

export default function DevicesScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [devices, setDevices] = useState<DeviceMetadata[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceToRevoke, setDeviceToRevoke] = useState<DeviceMetadata | null>(null);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const [allDevices, myId] = await Promise.all([
        DeviceService.listUserDevices(),
        DeviceService.getDeviceId(),
      ]);
      setDevices(allDevices);
      setCurrentDeviceId(myId);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load enrolled devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const confirmRevokeDevice = async () => {
    if (!deviceToRevoke) return;
    const target = deviceToRevoke;
    setDeviceToRevoke(null);
    try {
      await DeviceService.removeDevice(target.id);
      await loadDevices();
    } catch (err: any) {
      Alert.alert('Revocation Failed', err.message);
    }
  };

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
          <Text style={[styles.title, { color: theme.heading }]}>Enrolled Devices</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Devices in your zero-knowledge sync ring
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadDevices}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isThisDevice = item.id === currentDeviceId;
          return (
            <View
              style={[
                styles.deviceCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: isThisDevice ? Palette.primaryBurgundy : theme.border,
                },
                Shadows.subtle,
              ]}
            >
              <View style={styles.deviceRow}>
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: isThisDevice
                        ? Palette.primaryBurgundy
                        : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <DeviceIcon
                    size={20}
                    color={isThisDevice ? Palette.lightBeige : theme.heading}
                  />
                </View>

                <View style={styles.deviceInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.deviceName, { color: theme.text }]} numberOfLines={1}>
                      {item.device_name || 'Mobile Device'}
                    </Text>
                    {isThisDevice && (
                      <View
                        style={[
                          styles.thisBadge,
                          {
                            backgroundColor: isDark
                              ? 'rgba(254, 215, 184, 0.15)'
                              : 'rgba(89, 23, 27, 0.08)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.thisBadgeText,
                            {
                              color: isDark ? Palette.lightBeige : Palette.primaryBurgundy,
                            },
                          ]}
                        >
                          THIS DEVICE
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.deviceMeta, { color: theme.textMuted }]}>
                    Platform: {item.platform.toUpperCase()} • Enrolled:{' '}
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={[styles.deviceMeta, { color: theme.textDim }]}>
                    Last Active:{' '}
                    {item.last_active_at
                      ? new Date(item.last_active_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now'}
                  </Text>
                </View>

                {!isThisDevice && (
                  <TouchableOpacity
                    onPress={() => setDeviceToRevoke(item)}
                    style={[styles.revokeBtn, { backgroundColor: theme.dangerMuted }]}
                  >
                    <Text style={[styles.revokeText, { color: theme.danger }]}>Revoke</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View
                style={[styles.emptyIconBox, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ShieldIcon size={32} color={theme.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.heading }]}>
                No External Devices
              </Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Only this device is currently enrolled in your cryptographic ring.
              </Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          <View style={styles.footerWrap}>
            <Button
              title="Enroll Another Device"
              variant="secondary"
              size="lg"
              onPress={() => router.push('/(app)/enrollment')}
              icon={<PlusIcon size={18} color={Palette.darkBurgundy} />}
              style={styles.enrollBtn}
            />
          </View>
        }
      />

      {/* Confirmation Dialog for Revocation */}
      <ConfirmationDialog
        visible={!!deviceToRevoke}
        title="Revoke Device Access?"
        message={`Are you sure you want to decouple "${deviceToRevoke?.device_name || 'this device'}" from your synchronization ring? It will lose access to vault updates.`}
        confirmLabel="Revoke Access"
        isDestructive
        onConfirm={confirmRevokeDevice}
        onCancel={() => setDeviceToRevoke(null)}
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
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  deviceCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  deviceInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyHeading,
  },
  thisBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  thisBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  deviceMeta: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: Typography.fontFamilyBody,
  },
  revokeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  revokeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: Spacing.lg,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    fontFamily: Typography.fontFamilyBody,
  },
  footerWrap: {
    marginTop: Spacing.md,
  },
  enrollBtn: {
    width: '100%',
  },
});
