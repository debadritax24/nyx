import { create } from 'zustand';
import { Platform } from 'react-native';
import { lightTheme, darkTheme, ThemeColors } from '../components/tokens';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'nyx_theme_mode_v1';

interface ThemeState {
  mode: ThemeMode;
  theme: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  initTheme: () => Promise<void>;
}

const getStoredThemeSync = (): ThemeMode => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch {}
  }
  return 'light'; // Default to light warm cream per brand specification
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  theme: lightTheme,
  isDark: false,

  toggleTheme: () => {
    const nextMode: ThemeMode = get().mode === 'light' ? 'dark' : 'light';
    get().setTheme(nextMode);
  },

  setTheme: (mode: ThemeMode) => {
    const nextTheme = mode === 'dark' ? darkTheme : lightTheme;
    set({
      mode,
      theme: nextTheme,
      isDark: mode === 'dark',
    });

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, mode);
        if (mode === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch {}
    } else {
      try {
        const SecureStore = require('expo-secure-store');
        SecureStore.setItemAsync(THEME_STORAGE_KEY, mode).catch(() => {});
      } catch {}
    }
  },

  initTheme: async () => {
    let mode: ThemeMode = getStoredThemeSync();
    if (Platform.OS !== 'web') {
      try {
        const SecureStore = require('expo-secure-store');
        const stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
          mode = stored;
        }
      } catch {}
    }
    get().setTheme(mode);
  },
}));

export const useTheme = () => {
  const { theme, mode, isDark, toggleTheme, setTheme } = useThemeStore();
  return { theme, mode, isDark, toggleTheme, setTheme };
};
