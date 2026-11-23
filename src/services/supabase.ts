import { createClient } from '@supabase/supabase-js';

// Access only explicitly exposed public Expo variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Custom storage adapter using Expo SecureStore where available, falling back to in-memory
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const SecureStore = require('expo-secure-store');
      if (SecureStore && typeof SecureStore.isAvailableAsync === 'function') {
        const isAvailable = await SecureStore.isAvailableAsync().catch(() => false);
        if (!isAvailable) {
          return (globalThis as any)[`__supa_store_${key}`] || null;
        }
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return (globalThis as any)[`__supa_store_${key}`] || null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const SecureStore = require('expo-secure-store');
      if (SecureStore && typeof SecureStore.isAvailableAsync === 'function') {
        const isAvailable = await SecureStore.isAvailableAsync().catch(() => false);
        if (!isAvailable) {
          (globalThis as any)[`__supa_store_${key}`] = value;
          return;
        }
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      (globalThis as any)[`__supa_store_${key}`] = value;
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const SecureStore = require('expo-secure-store');
      if (SecureStore && typeof SecureStore.isAvailableAsync === 'function') {
        const isAvailable = await SecureStore.isAvailableAsync().catch(() => false);
        if (!isAvailable) {
          delete (globalThis as any)[`__supa_store_${key}`];
          return;
        }
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      delete (globalThis as any)[`__supa_store_${key}`];
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
