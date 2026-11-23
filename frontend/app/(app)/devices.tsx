import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DeviceMetadata, DeviceService } from '../../src/services/deviceService';
import { Colors, Radius, Spacing } from '../../src/components/tokens';

export default function DevicesScreen() {
  const router = useRouter();
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Enrolled Devices</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeText}>Done</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Devices enrolled in your zero-knowledge synchronization ring. Only devices holding your Vault Key can decrypt records.
      </Text>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadDevices}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isThisDevice = item.id === currentDeviceId;
          return (
            <View style={[styles.deviceCard, isThisDevice && styles.thisDeviceCard]}>
              <View style={styles.deviceInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.deviceName}>{item.device_name || 'Android Device'}</Text>
                  {isThisDevice && <View style={styles.thisBadge}><Text style={styles.thisBadgeText}>THIS DEVICE</Text></View>}
                </View>
                <Text style={styles.deviceMeta}>
                  Platform: {item.platform.toUpperCase()} • Registered: {new Date(item.created_at).toLocaleDateString()}
                </Text>
                <Text style={styles.deviceMeta}>
                  Last Active: {item.last_active_at ? new Date(item.last_active_at).toLocaleString() : 'Just now'}
                </Text>
              </View>

              {!isThisDevice && (
                <TouchableOpacity
                  onPress={() => handleRevokeDevice(item)}
                  style={styles.revokeBtn}
                >
                  <Text style={styles.revokeText}>Revoke</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No devices registered yet.</Text>
            </View>
          ) : null
        }
      />
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
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  closeText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  list: {
    paddingBottom: Spacing.xl,
  },
  deviceCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thisDeviceCard: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
  },
  deviceInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  deviceName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  thisBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  thisBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  deviceMeta: {
    color: Colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  revokeBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  revokeText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: Colors.textDim,
    fontSize: 14,
  },
});
