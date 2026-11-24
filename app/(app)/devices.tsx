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
import { DeviceIcon } from '../../src/components/Icons';
import { Radius, Spacing, Typography, Shadows } from '../../src/components/tokens';

export default function DevicesScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [devices, setDevices] = useState<DeviceMetadata[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleRevokeDevice = (device: DeviceMetadata) => {
    Alert.alert(
      'Revoke Device',
      `Revoke synchronization access for "${device.device_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await DeviceService.removeDevice(device.id);
              await loadDevices();
            } catch (err: any) {
              Alert.alert('Revocation Failed', err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.contentWrapper}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.heading }]}>Enrolled Devices</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Devices enrolled in your zero-knowledge synchronization ring
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.closeBtn, { backgroundColor: theme.surface }]}
          >
            <Text style={[styles.closeText, { color: theme.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          refreshing={loading}
          onRefresh={loadDevices}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isThisDevice = item.id === currentDeviceId;
            return (
              <View
                style={[
                  styles.deviceCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: isThisDevice ? theme.primary : theme.border,
                  },
                  Shadows.subtle,
                ]}
              >
                <View style={styles.deviceRow}>
                  <View style={[styles.iconBox, { backgroundColor: theme.surfaceHighlight }]}>
                    <DeviceIcon size={20} color={theme.primary} />
                  </View>

                  <View style={styles.deviceInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.deviceName, { color: theme.text }]}>
                        {item.device_name || 'Personal Device'}
                      </Text>
                      {isThisDevice && (
                        <View style={[styles.thisBadge, { backgroundColor: theme.surfaceHighlight }]}>
                          <Text style={[styles.thisBadgeText, { color: theme.secondaryText }]}>
                            THIS DEVICE
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.deviceMeta, { color: theme.textMuted }]}>
                      Platform: {item.platform.toUpperCase()} • Registered:{' '}
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                    <Text style={[styles.deviceMeta, { color: theme.textDim }]}>
                      Last Active:{' '}
                      {item.last_active_at
                        ? new Date(item.last_active_at).toLocaleString()
                        : 'Just now'}
                    </Text>
                  </View>

                  {!isThisDevice && (
                    <TouchableOpacity
                      onPress={() => handleRevokeDevice(item)}
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
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  No devices registered in sync ring yet.
                </Text>
              </View>
            ) : undefined
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    padding: Spacing.lg,
    maxWidth: 600,
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
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
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
  list: {
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
    width: 40,
    height: 40,
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
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  thisBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  thisBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  deviceMeta: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  revokeBtn: {
    paddingHorizontal: Spacing.sm,
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
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
});
