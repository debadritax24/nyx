import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { useVaultStore } from '../src/store/vaultStore';
import { Colors } from '../src/components/tokens';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { isUnlocked, loadFromLocalKeystore } = useVaultStore();

  useEffect(() => {
    if (isLoading) return;

    const routeUser = async () => {
      if (!isAuthenticated) {
        router.replace('/(auth)/login');
      } else {
        if (!isUnlocked) {
          const unlocked = await loadFromLocalKeystore();
          if (unlocked) {
            router.replace('/(app)');
          } else {
            router.replace('/(app)');
          }
        } else {
          router.replace('/(app)');
        }
      }
    };

    routeUser();
  }, [isAuthenticated, isLoading, isUnlocked, router, loadFromLocalKeystore]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NYX</Text>
      <Text style={styles.subtitle}>Privacy-First Authenticator</Text>
      <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 8,
  },
  loader: {
    marginTop: 32,
  },
});
