import { supabase } from './supabase';
import {
  WrappedVaultKeyEnvelope,
  unwrapVaultKey,
  unwrapVaultKeyWithRecoveryCode,
  KeystoreService,
} from '../core/crypto';
import { DeviceService } from './deviceService';

export interface RemoteVaultRow {
  id: string;
  user_id: string;
  passphrase_wrapped_vault_key: string;
  passphrase_wrap_nonce: string;
  passphrase_kdf_salt: string;
  passphrase_kdf_params: any;
  recovery_wrapped_vault_key: string;
  recovery_wrap_nonce: string;
  recovery_kdf_salt: string;
  recovery_kdf_params: any;
  crypto_version: number;
  created_at: string;
  updated_at: string;
}

export class VaultService {
  /**
   * Retrieves the user's remote vault envelope from Supabase.
   */
  static async getRemoteVault(userId: string): Promise<RemoteVaultRow | null> {
    const { data, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Uploads freshly wrapped Vault Keys during vault initialization.
   */
  static async uploadVaultEnvelope(
    userId: string,
    passphraseEnvelope: WrappedVaultKeyEnvelope,
    recoveryEnvelope: WrappedVaultKeyEnvelope
  ): Promise<RemoteVaultRow> {
    const { data, error } = await supabase
      .from('vaults')
      .insert({
        user_id: userId,
        passphrase_wrapped_vault_key: passphraseEnvelope.wrappedKey,
        passphrase_wrap_nonce: passphraseEnvelope.nonce,
        passphrase_kdf_salt: passphraseEnvelope.salt,
        passphrase_kdf_params: passphraseEnvelope.kdfParams,
        recovery_wrapped_vault_key: recoveryEnvelope.wrappedKey,
        recovery_wrap_nonce: recoveryEnvelope.nonce,
        recovery_kdf_salt: recoveryEnvelope.salt,
        recovery_kdf_params: recoveryEnvelope.kdfParams,
        crypto_version: 1,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Enrolls a new or secondary device using the Master Passphrase.
   * Downloads the remote vault envelope, derives the wrapping key via Argon2id,
   * unwraps the 256-bit Vault Key, stores it in device Keystore, and registers device.
   */
  static async enrollDeviceWithPassphrase(
    userId: string,
    passphrase: string
  ): Promise<{ vaultId: string; vaultKey: Uint8Array }> {
    const remoteVault = await this.getRemoteVault(userId);
    if (!remoteVault) {
      throw new Error('No existing cloud vault found for this account.');
    }

    const envelope: WrappedVaultKeyEnvelope = {
      wrappedKey: remoteVault.passphrase_wrapped_vault_key,
      nonce: remoteVault.passphrase_wrap_nonce,
      salt: remoteVault.passphrase_kdf_salt,
      kdfParams: remoteVault.passphrase_kdf_params,
      cryptoVersion: remoteVault.crypto_version,
    };

    const vaultKey = await unwrapVaultKey(envelope, passphrase);

    // Save to this device's local Android Keystore
    await KeystoreService.saveVaultKey(vaultKey);
    // Register this device
    await DeviceService.registerDevice(userId);

    return {
      vaultId: remoteVault.id,
      vaultKey,
    };
  }

  /**
   * Enrolls a device or restores a lost vault using the 24-word emergency recovery code.
   */
  static async enrollDeviceWithRecoveryCode(
    userId: string,
    recoveryCode: string
  ): Promise<{ vaultId: string; vaultKey: Uint8Array }> {
    const remoteVault = await this.getRemoteVault(userId);
    if (!remoteVault) {
      throw new Error('No existing cloud vault found for this account.');
    }

    const envelope: WrappedVaultKeyEnvelope = {
      wrappedKey: remoteVault.recovery_wrapped_vault_key,
      nonce: remoteVault.recovery_wrap_nonce,
      salt: remoteVault.recovery_kdf_salt,
      kdfParams: remoteVault.recovery_kdf_params,
      cryptoVersion: remoteVault.crypto_version,
    };

    const vaultKey = await unwrapVaultKeyWithRecoveryCode(envelope, recoveryCode);

    // Save to this device's local Android Keystore
    await KeystoreService.saveVaultKey(vaultKey);
    // Register this device
    await DeviceService.registerDevice(userId);

    return {
      vaultId: remoteVault.id,
      vaultKey,
    };
  }
}
