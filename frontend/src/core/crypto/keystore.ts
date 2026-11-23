import { bytesToBase64, base64ToBytes } from './vault';

const SECURE_STORE_VAULT_KEY_ALIAS = 'nyx_master_vault_key_v1';
const SECURE_STORE_BIOMETRIC_PREF = 'nyx_biometrics_enabled_v1';

/**
 * Storage abstraction for the Android Keystore backed by Expo SecureStore.
 */
export class KeystoreService {
  private static async getSecureStore() {
    try {
      return require('expo-secure-store');
    } catch {
      return null;
    }
  }

  /**
   * Stores the 256-bit Vault Key in hardware-backed storage.
   */
  static async saveVaultKey(keyBytes: Uint8Array): Promise<void> {
    const SecureStore = await this.getSecureStore();
    const encoded = bytesToBase64(keyBytes);
    if (SecureStore) {
      await SecureStore.setItemAsync(SECURE_STORE_VAULT_KEY_ALIAS, encoded, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } else {
      // Memory/mock fallback in test environments
      (globalThis as any).__nyx_mock_keystore = encoded;
    }
  }

  /**
   * Retrieves the 256-bit Vault Key from hardware-backed storage.
   */
  static async getVaultKey(): Promise<Uint8Array | null> {
    const SecureStore = await this.getSecureStore();
    let encoded: string | null = null;
    if (SecureStore) {
      encoded = await SecureStore.getItemAsync(SECURE_STORE_VAULT_KEY_ALIAS);
    } else {
      encoded = (globalThis as any).__nyx_mock_keystore || null;
    }

    if (!encoded) return null;
    return base64ToBytes(encoded);
  }

  /**
   * Deletes the local Vault Key from hardware-backed storage (e.g. on full reset).
   */
  static async deleteVaultKey(): Promise<void> {
    const SecureStore = await this.getSecureStore();
    if (SecureStore) {
      await SecureStore.deleteItemAsync(SECURE_STORE_VAULT_KEY_ALIAS);
    } else {
      delete (globalThis as any).__nyx_mock_keystore;
    }
  }

  static async setBiometricsEnabled(enabled: boolean): Promise<void> {
    const SecureStore = await this.getSecureStore();
    if (SecureStore) {
      await SecureStore.setItemAsync(SECURE_STORE_BIOMETRIC_PREF, enabled ? 'true' : 'false');
    }
  }

  static async isBiometricsEnabled(): Promise<boolean> {
    const SecureStore = await this.getSecureStore();
    if (SecureStore) {
      const val = await SecureStore.getItemAsync(SECURE_STORE_BIOMETRIC_PREF);
      return val === 'true';
    }
    return false;
  }
}
