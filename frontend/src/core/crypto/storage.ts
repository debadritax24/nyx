import { DecryptedAccountRecord, EncryptedPayload } from './types';
import { encryptAesGcm, decryptAesGcm } from './vault';

const LOCAL_VAULT_FILENAME = 'nyx_vault_accounts_v1.enc';
const STORAGE_AAD = 'nyx-local-vault-storage:v1';

/**
 * Local Vault Encrypted Storage Service
 * Encrypts and persists account records in the application private storage directory using AES-256-GCM.
 */
export class LocalVaultStorage {
  private static mockStorage: string | null = null;

  private static async getFileSystem() {
    try {
      return require('expo-file-system');
    } catch {
      return null;
    }
  }

  private static async getFilePath(): Promise<string | null> {
    const FileSystem = await this.getFileSystem();
    if (FileSystem && FileSystem.documentDirectory) {
      return `${FileSystem.documentDirectory}${LOCAL_VAULT_FILENAME}`;
    }
    return null;
  }

  /**
   * Saves and encrypts the list of account records to disk.
   */
  static async saveAccounts(
    vaultKey: Uint8Array,
    accounts: DecryptedAccountRecord[]
  ): Promise<void> {
    const serialized = JSON.stringify(accounts);
    const encryptedPayload = await encryptAesGcm(vaultKey, serialized, STORAGE_AAD);
    const fileContent = JSON.stringify(encryptedPayload);

    const path = await this.getFilePath();
    if (path) {
      const FileSystem = await this.getFileSystem();
      const tempPath = `${path}.tmp`;
      // Write atomically via temporary file
      await FileSystem.writeAsStringAsync(tempPath, fileContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await FileSystem.moveAsync({ from: tempPath, to: path });
    } else {
      this.mockStorage = fileContent;
    }
  }

  /**
   * Loads and decrypts account records from disk using the Master Vault Key.
   */
  static async loadAccounts(vaultKey: Uint8Array): Promise<DecryptedAccountRecord[]> {
    let rawContent: string | null = null;
    const path = await this.getFilePath();

    if (path) {
      const FileSystem = await this.getFileSystem();
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        return [];
      }
      rawContent = await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } else {
      rawContent = this.mockStorage;
    }

    if (!rawContent) {
      return [];
    }

    try {
      const payload: EncryptedPayload = JSON.parse(rawContent);
      const decryptedJson = await decryptAesGcm(vaultKey, payload, STORAGE_AAD);
      const accounts: DecryptedAccountRecord[] = JSON.parse(decryptedJson);
      return Array.isArray(accounts) ? accounts : [];
    } catch (err: any) {
      // Archive corrupted file for safety
      if (path) {
        const FileSystem = await this.getFileSystem();
        await FileSystem.moveAsync({
          from: path,
          to: `${path}.corrupted.${Date.now()}`,
        }).catch(() => {});
      }
      throw new Error(`Failed to decrypt local vault data: ${err.message}`);
    }
  }

  /**
   * Deletes all local vault encrypted account data (e.g. on user reset).
   */
  static async clearLocalData(): Promise<void> {
    const path = await this.getFilePath();
    if (path) {
      const FileSystem = await this.getFileSystem();
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
    this.mockStorage = null;
  }
}
