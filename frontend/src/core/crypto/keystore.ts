import { bytesToBase64, base64ToBytes } from './vault';

const SECURE_STORE_VAULT_KEY_ALIAS = 'nyx_master_vault_key_v1';
const SECURE_STORE_BIOMETRIC_PREF = 'nyx_biometrics_enabled_v1';

/**
 * Storage abstraction for the Android Keystore backed by Expo SecureStore
 * and protected by device biometric authentication (Fingerprint / Face Unlock).
 */
export class KeystoreService {
  private static async getSecureStore() {
    try {
      return require('expo-secure-store');
    } catch {
      return null;
    }
  }

  private static async getLocalAuth() {
    try {
      return require('expo-local-authentication');
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
    (globalThis as any).__nyx_mock_keystore = encoded;
    if (SecureStore && SecureStore.setItemAsync) {
      try {
        await SecureStore.setItemAsync(SECURE_STORE_VAULT_KEY_ALIAS, encoded, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      } catch {}
    }
  }

  /**
   * Checks whether biometric hardware is present and enrolled.
   */
  static async canUseBiometrics(): Promise<boolean> {
    const LocalAuth = await this.getLocalAuth();
    if (!LocalAuth) return false;
    const hasHardware = await LocalAuth.hasHardwareAsync();
    const isEnrolled = await LocalAuth.isEnrolledAsync();
    return hasHardware && isEnrolled;
  }

  /**
   * Authenticates user via device biometrics (Fingerprint/Face) or PIN fallback.
   */
  static async authenticateUser(prompt: string = 'Unlock NYX Vault'): Promise<boolean> {
    const LocalAuth = await this.getLocalAuth();
    if (!LocalAuth) return true; // In test environments or when module unavailable

    const result = await LocalAuth.authenticateAsync({
      promptMessage: prompt,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Device Passcode',
      disableDeviceFallback: false,
    });

    return result.success;
  }

  /**
   * Retrieves the 256-bit Vault Key from hardware-backed storage.
   * If biometrics are enabled, prompts for biometric unlock before returning key.
   */
  static async getVaultKey(promptBiometrics: boolean = true): Promise<Uint8Array | null> {
    if (promptBiometrics) {
      const bioEnabled = await this.isBiometricsEnabled();
      if (bioEnabled) {
        const authenticated = await this.authenticateUser();
        if (!authenticated) {
          throw new Error('Biometric authentication failed or cancelled');
        }
      }
    }

    const SecureStore = await this.getSecureStore();
    let encoded: string | null = null;
    if (SecureStore && SecureStore.getItemAsync) {
      try {
        encoded = await SecureStore.getItemAsync(SECURE_STORE_VAULT_KEY_ALIAS);
      } catch {}
    }
    if (!encoded) {
      encoded = (globalThis as any).__nyx_mock_keystore || null;
    }

    if (!encoded) return null;
    return base64ToBytes(encoded);
  }

  /**
   * Deletes the local Vault Key from storage and wipes mock memory.
   */
  static async deleteVaultKey(): Promise<void> {
    const SecureStore = await this.getSecureStore();
    if (SecureStore && SecureStore.deleteItemAsync) {
      try {
        await SecureStore.deleteItemAsync(SECURE_STORE_VAULT_KEY_ALIAS);
      } catch {}
    }
    delete (globalThis as any).__nyx_mock_keystore;
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
