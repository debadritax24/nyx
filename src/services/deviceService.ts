import { supabase } from './supabase';
import { getRandomBytes, bytesToBase64 } from '../core/crypto/vault';

const DEVICE_ID_KEY = 'nyx_device_id_v1';
const DEVICE_LABEL_KEY = 'nyx_device_label_v1';

export interface DeviceMetadata {
  id: string;
  user_id: string;
  device_name: string;
  device_label?: string | null;
  platform: string;
  last_synced_at?: string | null;
  last_active_at?: string | null;
  created_at: string;
  updated_at: string;
}

export class DeviceService {
  private static cachedDeviceId: string | null = null;
  private static cachedDeviceLabel: string | null = null;

  private static async getSecureStore() {
    try {
      const ss = require('expo-secure-store');
      if (ss && typeof ss.isAvailableAsync === 'function') {
        const isAvailable = await ss.isAvailableAsync().catch(() => false);
        if (!isAvailable) {
          return null;
        }
      }
      return ss;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves or initializes a persistent, cryptographically secure UUID for this client device.
   */
  static async getDeviceId(): Promise<string> {
    if (this.cachedDeviceId) {
      return this.cachedDeviceId;
    }

    const SecureStore = await this.getSecureStore();
    if (SecureStore) {
      try {
        let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
        if (!id) {
          id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `dev_${bytesToBase64(getRandomBytes(16)).replace(/[^a-zA-Z0-9]/g, '')}`;
          await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
        }
        this.cachedDeviceId = id;
        return id;
      } catch {
        // Fall back to memory
      }
    }

    if (!this.cachedDeviceId) {
      this.cachedDeviceId = `dev_${bytesToBase64(getRandomBytes(16)).replace(/[^a-zA-Z0-9]/g, '')}`;
    }
    return this.cachedDeviceId;
  }

  static async getDeviceLabel(): Promise<string> {
    if (this.cachedDeviceLabel) {
      return this.cachedDeviceLabel;
    }
    const SecureStore = await this.getSecureStore();
    if (SecureStore) {
      try {
        const label = await SecureStore.getItemAsync(DEVICE_LABEL_KEY);
        if (label) {
          this.cachedDeviceLabel = label;
          return label;
        }
      } catch {}
    }
    return this.cachedDeviceLabel || 'Android Phone';
  }

  static async setDeviceLabel(label: string): Promise<void> {
    this.cachedDeviceLabel = label;
    const SecureStore = await this.getSecureStore();
    if (SecureStore) {
      try {
        await SecureStore.setItemAsync(DEVICE_LABEL_KEY, label);
      } catch {}
    }
  }

  /**
   * Registers or updates device metadata in Supabase devices table.
   * Never transmits or stores private key material.
   */
  static async registerDevice(userId: string): Promise<DeviceMetadata> {
    const deviceId = await this.getDeviceId();
    const label = await this.getDeviceLabel();

    const { data, error } = await supabase
      .from('devices')
      .upsert({
        id: deviceId,
        user_id: userId,
        device_name: label,
        device_label: label,
        platform: 'android',
        last_active_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Updates last synchronization timestamp for this device.
   */
  static async updateSyncTimestamp(userId: string): Promise<void> {
    const deviceId = await this.getDeviceId();
    await supabase
      .from('devices')
      .update({
        last_synced_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      })
      .eq('id', deviceId)
      .eq('user_id', userId);
  }

  /**
   * Lists all devices enrolled by the current authenticated user.
   */
  static async listUserDevices(): Promise<DeviceMetadata[]> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .order('last_active_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Removes a device registration (revocation from account view).
   */
  static async removeDevice(deviceId: string): Promise<void> {
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', deviceId);

    if (error) throw error;
  }
}
