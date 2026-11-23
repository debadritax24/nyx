import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenCapture from 'expo-screen-capture';
import * as Crypto from 'expo-crypto';
import { useAuthStore } from '../src/store/authStore';
import { useVaultStore } from '../src/store/vaultStore';
import { Colors } from '../src/components/tokens';
import '../src/core/crypto/vault'; // Initialize CSPRNG & WebCrypto polyfill

// Polyfill globalThis.crypto on mobile platforms where WebCrypto getRandomValues is missing
if (typeof globalThis !== 'undefined') {
  if (!globalThis.crypto) {
    (globalThis as any).crypto = {};
  }
  if (!globalThis.crypto.getRandomValues && typeof Crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
      if (!array) return array;
      return Crypto.getRandomValues(array as any) as any;
    };
  }
  if (!globalThis.crypto.randomUUID && typeof Crypto.randomUUID === 'function') {
    globalThis.crypto.randomUUID = () => Crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`;
  }
}

export default function RootLayout() {
  const initAuth = useAuthStore((state) => state.initAuth);
  const lockVault = useVaultStore((state) => state.lock);

  useEffect(() => {
    initAuth();

    // 1. App Privacy: Prevent screenshots and obscure app switcher preview on Android
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});

    // 2. Automatic Vault Locking when app transitions to background
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        lockVault();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, [initAuth, lockVault]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </SafeAreaProvider>
  );
}
