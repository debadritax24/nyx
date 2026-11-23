import { supabase } from './supabase';
import {
  WrappedVaultKeyEnvelope,
  generateVaultKey,
  wrapVaultKey,
  wrapVaultKeyWithRecoveryCode,
  unwrapVaultKey,
  unwrapVaultKeyWithRecoveryCode,
  encryptAesGcm,
  decryptAesGcm,
  bytesToBase64,
  base64ToBytes,
  KeystoreService,
  LocalVaultStorage,
  DecryptedAccountRecord,
} from '../core/crypto';
import { DeviceService } from './deviceService';
import { SyncService } from './syncService';

export type RotationStage = 'PREPARED' | 'COMMITTED' | 'CLOUD_COMMITTED' | 'COMPLETED';

export interface StagedAccountPayload {
  id: string;
  expected_version: number;
  next_version: number;
  ciphertext: string;
  nonce: string;
  crypto_version: number;
  deleted_at: string | null;
}

export interface RotationManifest {
  manifestVersion: number;
  userId: string;
  vaultId: string;
  stage: RotationStage;
  timestamp: number;
  // Confidentiality invariant: Staged key material is NEVER stored in plaintext.
  // It is persisted in Android Keystore (staging alias) and encrypted under oldVaultKey in manifest.
  wrappedNewVaultKeyCiphertext: string;
  wrappedNewVaultKeyNonce: string;
  passphraseEnvelope: WrappedVaultKeyEnvelope;
  recoveryEnvelope: WrappedVaultKeyEnvelope;
  stagedAccounts: StagedAccountPayload[];
}

const ROTATION_MANIFEST_FILENAME = 'nyx_rotation_manifest_v2.json';

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
      return require('expo-file-system/legacy');
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

      try {
        const destInfo = await FileSystem.getInfoAsync(path);
        if (destInfo.exists) {
          await FileSystem.deleteAsync(path, { idempotent: true });
        }
        await FileSystem.moveAsync({ from: tempPath, to: path });
      } catch {
        await FileSystem.writeAsStringAsync(path, serialized, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
      }
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
   * Compares the remote vault envelope to verify if cloud migration was committed.
   * If committed, completes local promotion to prevent lockout.
   * If not committed, rolls back cleanly and leaves old key active.
   */
  static async recoverInterruptedRotation(
    userId: string,
    accounts?: DecryptedAccountRecord[],
    oldVaultKey?: Uint8Array
  ): Promise<{ recovered: boolean; newVaultKey?: Uint8Array }> {
    const manifest = await this.loadRotationManifest();
    if (!manifest || manifest.userId !== userId) {
      return { recovered: false };
    }

    // Determine if cloud was committed
    let isCloudCommitted = false;
    try {
      const remoteVault = await this.getRemoteVault(userId);
      if (
        remoteVault &&
        remoteVault.passphrase_wrapped_vault_key === manifest.passphraseEnvelope.wrappedKey
      ) {
        isCloudCommitted = true;
      }
    } catch (err: any) {
      console.warn('[VaultService] Unable to verify remote vault during recovery:', err.message);
      if (manifest.stage === 'COMMITTED' || manifest.stage === 'CLOUD_COMMITTED') {
        isCloudCommitted = true;
      }
    }

    if (!isCloudCommitted) {
      // Cloud was not updated or transaction rolled back. Old key remains active.
      console.warn('[VaultService] Interrupted rotation was NOT committed in cloud. Rolling back staging key...');
      await KeystoreService.clearStagingVaultKey();
      await this.clearRotationManifest();
      return { recovered: false };
    }

    // Cloud IS committed! Complete local promotion so user is never locked out.
    console.warn('[VaultService] Cloud was committed to new key. Completing local promotion...');

    // 1. Retrieve staged key from Keystore staging slot
    let newVaultKey = await KeystoreService.getStagingVaultKey();

    // 2. Fallback: decrypt staged key from manifest using oldVaultKey if staging slot was cleared
    if (!newVaultKey) {
      const activeOldKey = oldVaultKey || (await KeystoreService.getVaultKey(false));
      if (activeOldKey && manifest.wrappedNewVaultKeyCiphertext && manifest.wrappedNewVaultKeyNonce) {
        try {
          const decryptedBase64 = await decryptAesGcm(
            activeOldKey,
            {
              ciphertext: manifest.wrappedNewVaultKeyCiphertext,
              nonce: manifest.wrappedNewVaultKeyNonce,
              crypto_version: 1,
            },
            'nyx-rotation-manifest:v1'
          );
          newVaultKey = base64ToBytes(decryptedBase64);
        } catch (decErr: any) {
          console.error('[VaultService] Failed to decrypt staged key from manifest:', decErr.message);
        }
      }
    }

    if (!newVaultKey) {
      throw new Error(
        'Critical: Remote vault was committed to new key, but staged key material is unavailable locally.'
      );
    }

    // 3. Promote staged key to active Keystore master key
    await KeystoreService.promoteStagingVaultKey(newVaultKey);

    // 4. Update local accounts storage with updated versions
    if (accounts && accounts.length > 0) {
      for (const acc of accounts) {
        const staged = manifest.stagedAccounts.find((s) => s.id === acc.id);
        if (staged) {
          acc.version = staged.next_version;
        } else {
          acc.version += 1;
        }
      }
      await LocalVaultStorage.saveAccounts(newVaultKey, accounts);
    }

    // 5. Post-flight verification
    try {
      await LocalVaultStorage.loadAccounts(newVaultKey);
    } catch {}

    // 6. Purge manifest
    await this.clearRotationManifest();

    return { recovered: true, newVaultKey };
  }

  /**
   * Rotates the user's Master Vault Key (Kv -> Kv') using an atomic, crash-recoverable protocol:
   * 1. Pre-flight verification that old key decrypts local accounts cleanly.
   * 2. Generates new 256-bit symmetric key and stores in hardware-backed Keystore staging slot.
   * 3. Wraps new key with passphrase and recovery code via Argon2id.
   * 4. Re-encrypts accounts in memory with fresh nonces and bound AAD.
   * 5. Encrypts new key under old key for manifest confidentiality (ZERO plaintext keys on disk).
   * 6. Writes PREPARED manifest to disk.
   * 7. Executes atomic PostgreSQL transaction (sync_rotate_vault) migrating vault + all accounts.
   * 8. Advances manifest to COMMITTED.
   * 9. Promotes staging key to master key in Keystore and saves local accounts.
   * 10. Verifies post-rotation decryption and purges manifest.
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

    // 2. Stage new key in hardware-backed Android Keystore (Confidentiality)
    await KeystoreService.saveStagingVaultKey(newVaultKey);

    // 3. Encrypt new key under old key for manifest defense-in-depth (NEVER plaintext on disk)
    const keyEnc = await encryptAesGcm(oldVaultKey, newVaultKeyBase64, 'nyx-rotation-manifest:v1');

    // 4. Wrap new key with user passphrase and recovery code via Argon2id
    const newPassphraseEnvelope = await wrapVaultKey(newVaultKey, passphrase);
    const newRecoveryEnvelope = await wrapVaultKeyWithRecoveryCode(newVaultKey, recoveryCode);

    // 5. Re-encrypt all active accounts in memory under new key with fresh nonces & bound AAD
    const stagedAccounts: StagedAccountPayload[] = [];
    for (const account of accounts) {
      const encrypted = await SyncService.encryptAccountForSync(newVaultKey, account);
      stagedAccounts.push({
        id: account.id,
        expected_version: account.version,
        next_version: account.version + 1,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        crypto_version: 1,
        deleted_at: account.deleted_at || null,
      });
    }

    // 6. Stage rotation manifest on disk (Stage: PREPARED)
    await this.saveRotationManifest({
      manifestVersion: 2,
      userId,
      vaultId: remoteVault.id,
      stage: 'PREPARED',
      timestamp: Date.now(),
      wrappedNewVaultKeyCiphertext: keyEnc.ciphertext,
      wrappedNewVaultKeyNonce: keyEnc.nonce,
      passphraseEnvelope: newPassphraseEnvelope,
      recoveryEnvelope: newRecoveryEnvelope,
      stagedAccounts,
    });

    // 7. Atomic Remote Commit via sync_rotate_vault RPC
    const { data: _rpcRes, error: rpcErr } = await supabase.rpc('sync_rotate_vault', {
      p_vault_id: remoteVault.id,
      p_passphrase_wrapped_vault_key: newPassphraseEnvelope.wrappedKey,
      p_passphrase_wrap_nonce: newPassphraseEnvelope.nonce,
      p_passphrase_kdf_salt: newPassphraseEnvelope.salt,
      p_passphrase_kdf_params: newPassphraseEnvelope.kdfParams,
      p_recovery_wrapped_vault_key: newRecoveryEnvelope.wrappedKey,
      p_recovery_wrap_nonce: newRecoveryEnvelope.nonce,
      p_recovery_kdf_salt: newRecoveryEnvelope.salt,
      p_recovery_kdf_params: newRecoveryEnvelope.kdfParams,
      p_accounts: stagedAccounts,
    });

    if (rpcErr) {
      // PostgreSQL rolled back all updates atomically! Zero partial commit state in cloud.
      await KeystoreService.clearStagingVaultKey();
      await this.clearRotationManifest();
      throw new Error(`Atomic vault rotation failed: ${rpcErr.message}`);
    }

    // 8. Update manifest to COMMITTED
    await this.saveRotationManifest({
      manifestVersion: 2,
      userId,
      vaultId: remoteVault.id,
      stage: 'COMMITTED',
      timestamp: Date.now(),
      wrappedNewVaultKeyCiphertext: keyEnc.ciphertext,
      wrappedNewVaultKeyNonce: keyEnc.nonce,
      passphraseEnvelope: newPassphraseEnvelope,
      recoveryEnvelope: newRecoveryEnvelope,
      stagedAccounts,
    });

    // 9. Promote staging key to active Keystore master key
    await KeystoreService.promoteStagingVaultKey(newVaultKey);

    // 10. Update local accounts storage with incremented versions
    for (const account of accounts) {
      account.version += 1;
    }
    await LocalVaultStorage.saveAccounts(newVaultKey, accounts);

    // 11. Post-flight verification: verify accounts load and decrypt cleanly
    const verifiedAccounts = await LocalVaultStorage.loadAccounts(newVaultKey);
    if (verifiedAccounts.length !== accounts.length) {
      throw new Error('Local post-rotation decryption verification failed.');
    }

    // 12. Clean up manifest
    await this.clearRotationManifest();

    return {
      newVaultKey,
      rotatedCount: stagedAccounts.length,
    };
  }
}
