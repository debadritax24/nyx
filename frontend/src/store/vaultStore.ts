import { create } from 'zustand';
import { DecryptedAccountRecord, KeystoreService } from '../core/crypto';

interface VaultStoreState {
  isUnlocked: boolean;
  vaultKey: Uint8Array | null;
  accounts: DecryptedAccountRecord[];
  searchQuery: string;

  unlockWithKey: (key: Uint8Array) => Promise<void>;
  lock: () => void;
  setSearchQuery: (query: string) => void;
  addAccount: (account: Omit<DecryptedAccountRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<DecryptedAccountRecord>;
  deleteAccount: (id: string) => Promise<void>;
  updateAccount: (id: string, updates: Partial<DecryptedAccountRecord>) => Promise<void>;
  loadFromLocalKeystore: () => Promise<boolean>;
}

export const useVaultStore = create<VaultStoreState>((set) => ({
  isUnlocked: false,
  vaultKey: null,
  accounts: [],
  searchQuery: '',

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  unlockWithKey: async (key: Uint8Array) => {
    set({ isUnlocked: true, vaultKey: key });
    await KeystoreService.saveVaultKey(key);
  },

  lock: () => {
    set({ isUnlocked: false, vaultKey: null });
  },

  loadFromLocalKeystore: async () => {
    const key = await KeystoreService.getVaultKey();
    if (key) {
      set({ isUnlocked: true, vaultKey: key });
      return true;
    }
    return false;
  },

  addAccount: async (data) => {
    const newRecord: DecryptedAccountRecord = {
      ...data,
      id: (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `acc_${Date.now()}`),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      accounts: [newRecord, ...state.accounts],
    }));

    return newRecord;
  },

  deleteAccount: async (id: string) => {
    set((state) => ({
      accounts: state.accounts.filter((acc) => acc.id !== id),
    }));
  },

  updateAccount: async (id: string, updates: Partial<DecryptedAccountRecord>) => {
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        acc.id === id ? { ...acc, ...updates, updated_at: new Date().toISOString() } : acc
      ),
    }));
  },
}));
