import { create } from 'zustand';
import { Platform, Appearance } from 'react-native';
import { lightTheme, darkTheme, ThemeColors } from '../components/tokens';
import { isExpoNativeModuleAvailable } from '../core/nativeModules';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'nyx_theme_mode_v2';

interface ThemeState {
  mode: ThemeMode;
  theme: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  initTheme: () => Promise<void>;
}

const resolveIsDark = (mode: ThemeMode): boolean => {
  if (mode === 'system') {
    const sys = Appearance.getColorScheme();
    return sys === 'dark';
  }
  return mode === 'dark';
};

const getStoredThemeSync = (): ThemeMode => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light' || stored === 'system') return stored as ThemeMode;
    } catch {}
  }
  return 'light'; // Default to light warm cream per brand specification
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  theme: lightTheme,
  isDark: false,

  toggleTheme: () => {
    const currentIsDark = get().isDark;
    const nextMode: ThemeMode = currentIsDark ? 'light' : 'dark';
    get().setTheme(nextMode);
  },

  setTheme: (mode: ThemeMode) => {
    const isDark = resolveIsDark(mode);
    const nextTheme = isDark ? darkTheme : lightTheme;
    set({
      mode,
      theme: nextTheme,
      isDark,
    });

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, mode);
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch {}
    } else if (isExpoNativeModuleAvailable('ExpoSecureStore')) {
      try {
        const SecureStore = require('expo-secure-store');
        SecureStore.setItemAsync(THEME_STORAGE_KEY, mode).catch(() => {});
      } catch {}
    }
  },

  initTheme: async () => {
    let mode: ThemeMode = getStoredThemeSync();
    if (Platform.OS !== 'web' && isExpoNativeModuleAvailable('ExpoSecureStore')) {
      try {
        const SecureStore = require('expo-secure-store');
        const stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light' || stored === 'system') {
          mode = stored;
        }
      } catch {}
    }
    get().setTheme(mode);

    // Listen for system appearance changes
    Appearance.addChangeListener((preferences) => {
      if (get().mode === 'system') {
        const isDark = preferences.colorScheme === 'dark';
        set({
          theme: isDark ? darkTheme : lightTheme,
          isDark,
        });
      }
    });
  },
}));

export const useTheme = () => {
  const { theme, mode, isDark, toggleTheme, setTheme } = useThemeStore();
  return { theme, mode, isDark, toggleTheme, setTheme };
};
