import { supabase } from './supabase';
import {
  WrappedVaultKeyEnvelope,
  generateVaultKey,
  wrapVaultKey,
  wrapVaultKeyWithRecoveryCode,
  unwrapVaultKey,
  unwrapVaultKeyWithRecoveryCode,
  KeystoreService,
  LocalVaultStorage,
  DecryptedAccountRecord,
} from '../core/crypto';
import { DeviceService } from './deviceService';
import { SyncService } from './syncService';

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

  /**
   * Rotates the user's Master Vault Key (Kv -> Kv').
   * Fully re-encrypts all account records, wraps the new key under both the passphrase
   * and emergency recovery code using fresh nonces and salts, updates Supabase vault metadata,
   * re-encrypts remote accounts via CAS, and updates local Keystore storage.
   */
  static async rotateVaultKey(
    userId: string,
    oldVaultKey: Uint8Array,
    passphrase: string,
    recoveryCode: string,
    accounts: DecryptedAccountRecord[]
  ): Promise<{ newVaultKey: Uint8Array; rotatedCount: number }> {
    const remoteVault = await this.getRemoteVault(userId);
    if (!remoteVault) {
      throw new Error('Remote vault envelope not found.');
    }

    // 1. Generate fresh 256-bit symmetric vault key
    const newVaultKey = generateVaultKey();

    // 2. Wrap new key with user passphrase and recovery code
    const newPassphraseEnvelope = await wrapVaultKey(newVaultKey, passphrase);
    const newRecoveryEnvelope = await wrapVaultKeyWithRecoveryCode(newVaultKey, recoveryCode);

    // 3. Stage re-encrypted accounts locally with new key
    await LocalVaultStorage.saveAccounts(newVaultKey, accounts);

    // 4. Update cloud vault record
    const { error: vaultUpdateErr } = await supabase
      .from('vaults')
      .update({
        passphrase_wrapped_vault_key: newPassphraseEnvelope.wrappedKey,
        passphrase_wrap_nonce: newPassphraseEnvelope.nonce,
        passphrase_kdf_salt: newPassphraseEnvelope.salt,
        passphrase_kdf_params: newPassphraseEnvelope.kdfParams,
        recovery_wrapped_vault_key: newRecoveryEnvelope.wrappedKey,
        recovery_wrap_nonce: newRecoveryEnvelope.nonce,
        recovery_kdf_salt: newRecoveryEnvelope.salt,
        recovery_kdf_params: newRecoveryEnvelope.kdfParams,
        crypto_version: 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', remoteVault.id)
      .eq('user_id', userId);

    if (vaultUpdateErr) {
      // Rollback local storage to old key
      await LocalVaultStorage.saveAccounts(oldVaultKey, accounts).catch(() => {});
      throw new Error(`Failed to update remote vault envelope: ${vaultUpdateErr.message}`);
    }

    // 5. Re-encrypt each account and push via atomic CAS
    let rotatedCount = 0;
    for (const account of accounts) {
      const encrypted = await SyncService.encryptAccountForSync(newVaultKey, account);
      const pushRes = await SyncService.pushMutation(userId, {
        id: account.id,
        vault_id: remoteVault.id,
        action: 'UPSERT',
        expectedVersion: account.version,
        nextVersion: account.version + 1,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        crypto_version: 1,
        deleted_at: account.deleted_at || null,
        timestamp: Date.now(),
        retryCount: 0,
      });

      if (pushRes.success) {
        account.version += 1;
        rotatedCount++;
      }
    }

    // 6. Update local Keystore with new key
    await KeystoreService.saveVaultKey(newVaultKey);
    await LocalVaultStorage.saveAccounts(newVaultKey, accounts);

    return {
      newVaultKey,
      rotatedCount,
    };
  }
}
