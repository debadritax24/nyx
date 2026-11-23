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

interface VaultStoreState {
  isUnlocked: boolean;
  vaultKey: Uint8Array | null;
  accounts: DecryptedAccountRecord[];
  searchQuery: string;
  autoLockMinutes: number;
  lastActiveTimestamp: number;

  createVault: (passphrase: string) => Promise<{
    recoveryCode: string;
    passphraseEnvelope: WrappedVaultKeyEnvelope;
    recoveryEnvelope: WrappedVaultKeyEnvelope;
  }>;
  unlockWithKey: (key: Uint8Array) => Promise<void>;
  unlockWithPassphrase: (passphrase: string, envelope: WrappedVaultKeyEnvelope) => Promise<void>;
  unlockWithRecoveryCode: (recoveryCode: string, envelope: WrappedVaultKeyEnvelope) => Promise<void>;
  loadFromLocalKeystore: (promptBiometrics?: boolean) => Promise<boolean>;
  lock: () => void;
  resetVault: () => Promise<void>;

  setSearchQuery: (query: string) => void;
  addAccount: (
    account: Omit<DecryptedAccountRecord, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<DecryptedAccountRecord>;
  deleteAccount: (id: string) => Promise<void>;
  updateAccount: (id: string, updates: Partial<DecryptedAccountRecord>) => Promise<void>;
  recordActivity: () => void;
}

export const useVaultStore = create<VaultStoreState>((set, get) => ({
  isUnlocked: false,
  vaultKey: null,
  accounts: [],
  searchQuery: '',
  autoLockMinutes: 2,
  lastActiveTimestamp: Date.now(),

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

  unlockWithKey: async (key: Uint8Array) => {
    const loadedAccounts = await LocalVaultStorage.loadAccounts(key);
    await KeystoreService.saveVaultKey(key);
    set({
      isUnlocked: true,
      vaultKey: key,
      accounts: loadedAccounts,
      lastActiveTimestamp: Date.now(),
    });
  },

  unlockWithPassphrase: async (passphrase: string, envelope: WrappedVaultKeyEnvelope) => {
    const key = await unwrapVaultKey(envelope, passphrase);
    await get().unlockWithKey(key);
  },

  unlockWithRecoveryCode: async (recoveryCode: string, envelope: WrappedVaultKeyEnvelope) => {
    const key = await unwrapVaultKeyWithRecoveryCode(envelope, recoveryCode);
    await get().unlockWithKey(key);
  },

  loadFromLocalKeystore: async (promptBiometrics = true) => {
    try {
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
  },

  addAccount: async (data) => {
    const { accounts, vaultKey } = get();
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
      id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedAccounts = [newRecord, ...accounts];
    // Persist to encrypted local file storage immediately
    await LocalVaultStorage.saveAccounts(vaultKey, updatedAccounts);

    set({ accounts: updatedAccounts, lastActiveTimestamp: Date.now() });
    return newRecord;
  },

  deleteAccount: async (id: string) => {
    const { accounts, vaultKey } = get();
    if (!vaultKey) {
      throw new Error('Vault is locked.');
    }
    const updatedAccounts = accounts.filter((acc) => acc.id !== id);
    await LocalVaultStorage.saveAccounts(vaultKey, updatedAccounts);
    set({ accounts: updatedAccounts, lastActiveTimestamp: Date.now() });
  },

  updateAccount: async (id: string, updates: Partial<DecryptedAccountRecord>) => {
    const { accounts, vaultKey } = get();
    if (!vaultKey) {
      throw new Error('Vault is locked.');
    }
    const updatedAccounts = accounts.map((acc) =>
      acc.id === id ? { ...acc, ...updates, updated_at: new Date().toISOString() } : acc
    );
    await LocalVaultStorage.saveAccounts(vaultKey, updatedAccounts);
    set({ accounts: updatedAccounts, lastActiveTimestamp: Date.now() });
  },
}));
