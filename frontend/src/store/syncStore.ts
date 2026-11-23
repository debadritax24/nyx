import { create } from 'zustand';
import { SyncMutation, SyncService, SyncState } from '../services/syncService';
import { DecryptedAccountRecord } from '../core/crypto';

interface SyncStoreState {
  syncState: SyncState;
  lastSyncedAt: string | null;
  pendingMutations: SyncMutation[];
  conflictsCount: number;
  syncError: string | null;

  queueMutation: (mutation: SyncMutation) => void;
  triggerSync: (
    userId: string,
    vaultKey: Uint8Array,
    localAccounts: DecryptedAccountRecord[],
    onAccountsUpdated: (merged: DecryptedAccountRecord[]) => Promise<void>
  ) => Promise<void>;
  resetSync: () => void;
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  syncState: 'idle',
  lastSyncedAt: null,
  pendingMutations: [],
  conflictsCount: 0,
  syncError: null,

  queueMutation: (mutation: SyncMutation) => {
    set((state) => ({
      pendingMutations: [...state.pendingMutations, mutation],
      syncState: 'pending',
    }));
  },

  resetSync: () => {
    set({
      syncState: 'idle',
      lastSyncedAt: null,
      pendingMutations: [],
      conflictsCount: 0,
      syncError: null,
    });
  },

  triggerSync: async (userId, vaultKey, localAccounts, onAccountsUpdated) => {
    const { syncState, pendingMutations, lastSyncedAt } = get();
    if (syncState === 'syncing') return;

    try {
      set({ syncState: 'syncing', syncError: null });

      const result = await SyncService.executeFullSync(
        userId,
        vaultKey,
        localAccounts,
        pendingMutations,
        lastSyncedAt || undefined
      );

      // Save reconciled accounts to local encrypted storage
      await onAccountsUpdated(result.updatedAccounts);

      set({
        syncState: result.conflictsCount > 0 ? 'conflict' : 'synced',
        lastSyncedAt: new Date().toISOString(),
        pendingMutations: [],
        conflictsCount: result.conflictsCount,
        syncError: null,
      });
    } catch (err: any) {
      const isNetworkError =
        err.message?.includes('network') ||
        err.message?.includes('fetch') ||
        err.message?.includes('offline');

      set({
        syncState: isNetworkError ? 'offline' : 'failed',
        syncError: err.message || 'Synchronization failed',
      });
    }
  },
}));
