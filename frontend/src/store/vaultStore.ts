import { create } from 'zustand';
import {
  DecryptedAccountRecord,
  KeystoreService,
  generateVaultKey,
  generateRecoveryCode,
  wrapVaultKey,
  unwrapVaultKey,
  wrapVaultKeyWithRecoveryCode,
  unwrapVaultKeyWithRecoveryCode,
  LocalVaultStorage,
  WrappedVaultKeyEnvelope,
  zeroMemory,
} from '../core/crypto';
import { SyncService } from '../services/syncService';
import { VaultService } from '../services/vaultService';
import { useSyncStore } from './syncStore';
import { useAuthStore } from './authStore';

interface VaultStoreState {
  isUnlocked: boolean;
  vaultKey: Uint8Array | null;
  vaultId: string | null;
  accounts: DecryptedAccountRecord[];
  searchQuery: string;
  autoLockMinutes: number;
  lastActiveTimestamp: number;

  setVaultId: (id: string | null) => void;
  createVault: (passphrase: string) => Promise<{
    recoveryCode: string;
    passphraseEnvelope: WrappedVaultKeyEnvelope;
    recoveryEnvelope: WrappedVaultKeyEnvelope;
  }>;
  unlockWithKey: (key: Uint8Array, vaultId?: string) => Promise<void>;
  unlockWithPassphrase: (passphrase: string, envelope: WrappedVaultKeyEnvelope, vaultId?: string) => Promise<void>;
  unlockWithRecoveryCode: (recoveryCode: string, envelope: WrappedVaultKeyEnvelope, vaultId?: string) => Promise<void>;
  loadFromLocalKeystore: (promptBiometrics?: boolean) => Promise<boolean>;
  lock: () => void;
  resetVault: () => Promise<void>;

  setSearchQuery: (query: string) => void;
  setAccountsFromSync: (merged: DecryptedAccountRecord[]) => Promise<void>;
  addAccount: (
    account: Omit<DecryptedAccountRecord, 'id' | 'created_at' | 'updated_at' | 'version'>
  ) => Promise<DecryptedAccountRecord>;
  deleteAccount: (id: string) => Promise<void>;
  updateAccount: (id: string, updates: Partial<DecryptedAccountRecord>) => Promise<void>;
  recordActivity: () => void;
}

export const useVaultStore = create<VaultStoreState>((set, get) => ({
  isUnlocked: false,
  vaultKey: null,
  vaultId: null,
  accounts: [],
  searchQuery: '',
  autoLockMinutes: 2,
  lastActiveTimestamp: Date.now(),

  setVaultId: (id) => set({ vaultId: id }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  recordActivity: () => set({ lastActiveTimestamp: Date.now() }),

  createVault: async (passphrase: string) => {
    const key = generateVaultKey();
    const recoveryCode = generateRecoveryCode();

    // 1. Wrap with passphrase via Argon2id
    const passphraseEnvelope = await wrapVaultKey(key, passphrase);

    // 2. Wrap independently with recovery code via Argon2id
    const recoveryEnvelope = await wrapVaultKeyWithRecoveryCode(key, recoveryCode);

    // 3. Save to local Keystore
    await KeystoreService.saveVaultKey(key);

    // 4. Initialize empty encrypted local storage
    await LocalVaultStorage.saveAccounts(key, []);

    set({
      isUnlocked: true,
      vaultKey: key,
      accounts: [],
      lastActiveTimestamp: Date.now(),
    });

    return {
      recoveryCode,
      passphraseEnvelope,
      recoveryEnvelope,
    };
  },

  unlockWithKey: async (key: Uint8Array, vaultId?: string) => {
    const loadedAccounts = await LocalVaultStorage.loadAccounts(key);
    await KeystoreService.saveVaultKey(key);
    set({
      isUnlocked: true,
      vaultKey: key,
      vaultId: vaultId || get().vaultId,
      accounts: loadedAccounts,
      lastActiveTimestamp: Date.now(),
    });
  },

  unlockWithPassphrase: async (passphrase: string, envelope: WrappedVaultKeyEnvelope, vaultId?: string) => {
    const key = await unwrapVaultKey(envelope, passphrase);
    await get().unlockWithKey(key, vaultId);
  },

  unlockWithRecoveryCode: async (recoveryCode: string, envelope: WrappedVaultKeyEnvelope, vaultId?: string) => {
    const key = await unwrapVaultKeyWithRecoveryCode(envelope, recoveryCode);
    await get().unlockWithKey(key, vaultId);
  },

  loadFromLocalKeystore: async (promptBiometrics = true) => {
    try {
      // Check and recover from any interrupted key rotation before reading keystore
      const user = useAuthStore.getState().user;
      if (user) {
        await VaultService.recoverInterruptedRotation(user.id).catch(() => {});
      }

      const key = await KeystoreService.getVaultKey(promptBiometrics);
      if (key) {
        const loadedAccounts = await LocalVaultStorage.loadAccounts(key);
        set({
          isUnlocked: true,
          vaultKey: key,
          accounts: loadedAccounts,
          lastActiveTimestamp: Date.now(),
        });
        return true;
      }
    } catch (err: any) {
      console.warn('Keystore unlock aborted:', err.message);
    }
    return false;
  },

  lock: () => {
    const { vaultKey } = get();
    if (vaultKey) {
      zeroMemory(vaultKey);
    }
    set({
      isUnlocked: false,
      vaultKey: null,
      accounts: [],
    });
  },

  resetVault: async () => {
    get().lock();
    await KeystoreService.deleteVaultKey();
    await LocalVaultStorage.clearLocalData();
    useSyncStore.getState().resetSync();
  },

  setAccountsFromSync: async (mergedAccounts: DecryptedAccountRecord[]) => {
    const { vaultKey } = get();
    if (vaultKey) {
      await LocalVaultStorage.saveAccounts(vaultKey, mergedAccounts);
    }
    set({ accounts: mergedAccounts, lastActiveTimestamp: Date.now() });
  },

  addAccount: async (data) => {
    const { accounts, vaultKey, vaultId } = get();
    if (!vaultKey) {
      throw new Error('Vault is locked. Cannot add account.');
    }

    // Check for duplicate account under same issuer & name
    const exists = accounts.some(
      (a) =>
        a.issuer.trim().toLowerCase() === data.issuer.trim().toLowerCase() &&
        a.account_name.trim().toLowerCase() === data.account_name.trim().toLowerCase()
    );
    if (exists) {
      throw new Error(`An account for "${data.issuer} (${data.account_name})" already exists.`);
    }

    const newRecord: DecryptedAccountRecord = {
      ...data,
      id: globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      vault_id: vaultId || undefined,
      version: 1,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedAccounts = [newRecord, ...accounts];
    await LocalVaultStorage.saveAccounts(vaultKey, updatedAccounts);
    set({ accounts: updatedAccounts, lastActiveTimestamp: Date.now() });

    // Queue sync mutation if vaultId exists
    if (vaultId) {
      const encrypted = await SyncService.encryptAccountForSync(vaultKey, newRecord);
      await useSyncStore.getState().queueMutation({
        id: newRecord.id,
        vault_id: vaultId,
        action: 'UPSERT',
        expectedVersion: 0,
        nextVersion: 1,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        crypto_version: encrypted.crypto_version,
        deleted_at: null,
        timestamp: Date.now(),
        retryCount: 0,
      });
    }

    return newRecord;
  },

  deleteAccount: async (id: string) => {
    const { accounts, vaultKey, vaultId } = get();
    if (!vaultKey) throw new Error('Vault is locked.');

    const target = accounts.find((a) => a.id === id);
    const updatedAccounts = accounts.filter((acc) => acc.id !== id);
    await LocalVaultStorage.saveAccounts(vaultKey, updatedAccounts);
    set({ accounts: updatedAccounts, lastActiveTimestamp: Date.now() });

    if (vaultId && target) {
      const tombstoneRecord: DecryptedAccountRecord = {
        ...target,
        deleted_at: new Date().toISOString(),
        version: target.version + 1,
        updated_at: new Date().toISOString(),
      };
      const encrypted = await SyncService.encryptAccountForSync(vaultKey, tombstoneRecord);
      await useSyncStore.getState().queueMutation({
        id: target.id,
        vault_id: vaultId,
        action: 'DELETE',
        expectedVersion: target.version,
        nextVersion: target.version + 1,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        crypto_version: encrypted.crypto_version,
        deleted_at: tombstoneRecord.deleted_at ?? null,
        timestamp: Date.now(),
        retryCount: 0,
      });
    }
  },

  updateAccount: async (id: string, updates: Partial<DecryptedAccountRecord>) => {
    const { accounts, vaultKey, vaultId } = get();
    if (!vaultKey) throw new Error('Vault is locked.');

    let modifiedRecord: DecryptedAccountRecord | null = null;
    const updatedAccounts = accounts.map((acc) => {
      if (acc.id === id) {
        modifiedRecord = {
          ...acc,
          ...updates,
          version: acc.version + 1,
          updated_at: new Date().toISOString(),
        };
        return modifiedRecord;
      }
      return acc;
    });

    await LocalVaultStorage.saveAccounts(vaultKey, updatedAccounts);
    set({ accounts: updatedAccounts, lastActiveTimestamp: Date.now() });

    if (vaultId && modifiedRecord) {
      const rec = modifiedRecord as DecryptedAccountRecord;
      const encrypted = await SyncService.encryptAccountForSync(vaultKey, rec);
      await useSyncStore.getState().queueMutation({
        id: rec.id,
        vault_id: vaultId,
        action: 'UPSERT',
        expectedVersion: rec.version - 1,
        nextVersion: rec.version,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        crypto_version: encrypted.crypto_version,
        deleted_at: null,
        timestamp: Date.now(),
        retryCount: 0,
      });
    }
  },
}));
