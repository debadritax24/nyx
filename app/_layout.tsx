import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenCapture from 'expo-screen-capture';
import { useAuthStore } from '../src/store/authStore';
import { useVaultStore } from '../src/store/vaultStore';
import { useThemeStore } from '../src/store/themeStore';
import '../src/core/crypto/vault'; // Initialize CSPRNG & WebCrypto polyfill

export default function RootLayout() {
  const initAuth = useAuthStore((state) => state.initAuth);
  const lockVault = useVaultStore((state) => state.lock);
  const { theme, isDark, initTheme } = useThemeStore();

  useEffect(() => {
    initAuth();
    initTheme();

    // Inject editorial fonts on Web
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const fontId = 'nyx-editorial-fonts';
      if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,400&display=swap';
        document.head.appendChild(link);
      }
    }

    // 1. App Privacy: Prevent screenshots on Android
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
  }, [initAuth, lockVault, initTheme]);

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
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
