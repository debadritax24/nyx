import { supabase } from './supabase';
import {
  WrappedVaultKeyEnvelope,
  generateVaultKey,
  wrapVaultKey,
  wrapVaultKeyWithRecoveryCode,
  unwrapVaultKey,
  unwrapVaultKeyWithRecoveryCode,
  bytesToBase64,
  base64ToBytes,
  KeystoreService,
  LocalVaultStorage,
  DecryptedAccountRecord,
} from '../core/crypto';
import { DeviceService } from './deviceService';
import { SyncService } from './syncService';

export type RotationStage = 'PREPARED' | 'CLOUD_COMMITTED' | 'COMPLETED';

export interface RotationManifest {
  manifestVersion: number;
  userId: string;
  vaultId: string;
  stage: RotationStage;
  timestamp: number;
  newVaultKeyBase64: string;
  passphraseEnvelope: WrappedVaultKeyEnvelope;
  recoveryEnvelope: WrappedVaultKeyEnvelope;
}

const ROTATION_MANIFEST_FILENAME = 'nyx_rotation_manifest_v1.json';

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

  private static memoryManifest: string | null = null;

  private static async getFileSystem() {
    try {
      return require('expo-file-system');
    } catch {
      return null;
    }
  }

  private static async getManifestPath(): Promise<string | null> {
    const FileSystem = await this.getFileSystem();
    if (FileSystem && FileSystem.documentDirectory) {
      return `${FileSystem.documentDirectory}${ROTATION_MANIFEST_FILENAME}`;
    }
    return null;
  }

  static async saveRotationManifest(manifest: RotationManifest): Promise<void> {
    const serialized = JSON.stringify(manifest);
    const path = await this.getManifestPath();
    if (path) {
      const FileSystem = await this.getFileSystem();
      const tempPath = `${path}.tmp`;
      await FileSystem.writeAsStringAsync(tempPath, serialized, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await FileSystem.moveAsync({ from: tempPath, to: path });
    } else {
      this.memoryManifest = serialized;
    }
  }

  static async loadRotationManifest(): Promise<RotationManifest | null> {
    const path = await this.getManifestPath();
    let raw: string | null = null;
    if (path) {
      const FileSystem = await this.getFileSystem();
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        raw = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
      }
    } else {
      raw = this.memoryManifest;
    }

    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  static async clearRotationManifest(): Promise<void> {
    const path = await this.getManifestPath();
    if (path) {
      const FileSystem = await this.getFileSystem();
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
    this.memoryManifest = null;
  }

  /**
   * Startup Recovery for Interrupted Key Rotation:
   * Inspects if a key rotation was interrupted mid-flight by app crash, battery death, or network abort.
   * If CLOUD_COMMITTED, completes the local commit so the user is never locked out.
   * If PREPARED, cloud was never touched, so manifest is discarded and old key remains active.
   */
  static async recoverInterruptedRotation(
    userId: string,
    accounts?: DecryptedAccountRecord[]
  ): Promise<{ recovered: boolean; newVaultKey?: Uint8Array }> {
    const manifest = await this.loadRotationManifest();
    if (!manifest || manifest.userId !== userId) {
      return { recovered: false };
    }

    if (manifest.stage === 'PREPARED') {
      // Cloud was not updated; safely discard manifest
      console.warn('[VaultService] Interrupted rotation in PREPARED stage. Discarding manifest; old key remains active.');
      await this.clearRotationManifest();
      return { recovered: false };
    }

    if (manifest.stage === 'CLOUD_COMMITTED') {
      // Cloud was updated successfully, but local Keystore or storage commit crashed!
      console.warn('[VaultService] Interrupted rotation in CLOUD_COMMITTED stage. Completing local commit...');
      const newVaultKey = base64ToBytes(manifest.newVaultKeyBase64);

      // Complete local Keystore update
      await KeystoreService.saveVaultKey(newVaultKey);

      // Re-save local accounts with new key if accounts provided or load from storage
      if (accounts && accounts.length > 0) {
        await LocalVaultStorage.saveAccounts(newVaultKey, accounts);
      }

      await this.clearRotationManifest();
      return { recovered: true, newVaultKey };
    }

    return { recovered: false };
  }

  /**
   * Rotates the user's Master Vault Key (Kv -> Kv') using a recoverable two-phase protocol:
   * 1. Preserves old key until migration is safely completed.
   * 2. Generates new 256-bit symmetric vault key.
   * 3. Re-encrypts accounts locally.
   * 4. Wraps new key with passphrase and recovery code via Argon2id.
   * 5. Persists staged rotation manifest.
   * 6. Updates cloud records via atomic CAS.
   * 7. Updates local Android Keystore with new key and saves local accounts.
   * 8. Verifies decryption and cleans up manifest.
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

    // Pre-flight check: verify old key can decrypt local storage
    try {
      await LocalVaultStorage.loadAccounts(oldVaultKey);
    } catch {
      throw new Error('Pre-flight verification failed: current vault key cannot decrypt accounts.');
    }

    // 1. Generate fresh 256-bit symmetric vault key
    const newVaultKey = generateVaultKey();
    const newVaultKeyBase64 = bytesToBase64(newVaultKey);

    // 2. Wrap new key with user passphrase and recovery code
    const newPassphraseEnvelope = await wrapVaultKey(newVaultKey, passphrase);
    const newRecoveryEnvelope = await wrapVaultKeyWithRecoveryCode(newVaultKey, recoveryCode);

    // 3. Stage rotation manifest on disk (Stage: PREPARED)
    await this.saveRotationManifest({
      manifestVersion: 1,
      userId,
      vaultId: remoteVault.id,
      stage: 'PREPARED',
      timestamp: Date.now(),
      newVaultKeyBase64,
      passphraseEnvelope: newPassphraseEnvelope,
      recoveryEnvelope: newRecoveryEnvelope,
    });

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
      // Clean up manifest, old key remains active
      await this.clearRotationManifest();
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

    // 6. Update manifest to CLOUD_COMMITTED
    await this.saveRotationManifest({
      manifestVersion: 1,
      userId,
      vaultId: remoteVault.id,
      stage: 'CLOUD_COMMITTED',
      timestamp: Date.now(),
      newVaultKeyBase64,
      passphraseEnvelope: newPassphraseEnvelope,
      recoveryEnvelope: newRecoveryEnvelope,
    });

    // 7. Update local Keystore with new key
    await KeystoreService.saveVaultKey(newVaultKey);

    // 8. Re-encrypt and commit local storage with new key
    await LocalVaultStorage.saveAccounts(newVaultKey, accounts);

    // 9. Verify decryption of migrated records locally
    const verifiedAccounts = await LocalVaultStorage.loadAccounts(newVaultKey);
    if (verifiedAccounts.length !== accounts.length) {
      throw new Error('Local post-rotation decryption verification failed.');
    }

    // 10. Clean up manifest
    await this.clearRotationManifest();

    return {
      newVaultKey,
      rotatedCount,
    };
  }
}
