import { create } from 'zustand';
import { SyncMutation, SyncService, SyncState } from '../services/syncService';
import { PersistentMutationQueue } from '../services/queueService';
import { DecryptedAccountRecord } from '../core/crypto';

interface SyncStoreState {
  syncState: SyncState;
  lastSyncedAt: string | null;
  pendingMutations: SyncMutation[];
  conflictsCount: number;
  syncError: string | null;

  queueMutation: (mutation: SyncMutation) => Promise<void>;
  triggerSync: (
    userId: string,
    vaultKey: Uint8Array,
    localAccounts: DecryptedAccountRecord[],
    onAccountsUpdated: (merged: DecryptedAccountRecord[]) => Promise<void>
  ) => Promise<void>;
  resetSync: () => Promise<void>;
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  syncState: 'idle',
  lastSyncedAt: null,
  pendingMutations: [],
  conflictsCount: 0,
  syncError: null,

  queueMutation: async (mutation: SyncMutation) => {
    // Durable Write-Ahead Journaling: persist to disk first
    const enqueued = await PersistentMutationQueue.enqueue({
      accountId: mutation.id,
      vaultId: mutation.vault_id,
      action: mutation.action,
      expectedVersion: mutation.expectedVersion,
      nextVersion: mutation.nextVersion,
      ciphertext: mutation.ciphertext,
      nonce: mutation.nonce,
      crypto_version: mutation.crypto_version,
      deleted_at: mutation.deleted_at,
    });
    mutation.mutationId = enqueued.mutationId;

    set((state) => ({
      pendingMutations: [...state.pendingMutations, mutation],
      syncState: 'pending',
    }));
  },

  resetSync: async () => {
    await PersistentMutationQueue.clearQueue();
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

      // Reload remaining/failed mutations from persistent queue
      const remainingJournal = await PersistentMutationQueue.loadJournal();
      const mappedRemaining: SyncMutation[] = remainingJournal.map((m) => ({
        id: m.accountId,
        vault_id: m.vaultId,
        action: m.action,
        expectedVersion: m.expectedVersion,
        nextVersion: m.nextVersion,
        ciphertext: m.ciphertext,
        nonce: m.nonce,
        crypto_version: m.crypto_version,
        deleted_at: m.deleted_at,
        timestamp: m.createdAt,
        retryCount: m.retryCount,
        mutationId: m.mutationId,
      }));

      set({
        syncState: result.conflictsCount > 0 ? 'conflict' : 'synced',
        lastSyncedAt: new Date().toISOString(),
        pendingMutations: mappedRemaining,
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
