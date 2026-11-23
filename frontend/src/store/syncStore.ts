import { create } from 'zustand';
import { SyncMutation, SyncService } from '../services/syncService';

interface SyncStoreState {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingMutations: SyncMutation[];
  queueMutation: (mutation: SyncMutation) => void;
  syncNow: () => Promise<void>;
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  isSyncing: false,
  lastSyncedAt: null,
  pendingMutations: [],

  queueMutation: (mutation: SyncMutation) => {
    set((state) => ({
      pendingMutations: [...state.pendingMutations, mutation],
    }));
  },

  syncNow: async () => {
    const { isSyncing, pendingMutations, lastSyncedAt } = get();
    if (isSyncing) return;

    try {
      set({ isSyncing: true });

      // 1. Process pending mutations push
      for (const mutation of pendingMutations) {
        await SyncService.pushAccount(mutation);
      }

      // 2. Pull remote records
      await SyncService.pullAccounts(lastSyncedAt || undefined);

      set({
        pendingMutations: [],
        lastSyncedAt: new Date().toISOString(),
        isSyncing: false,
      });
    } catch {
      set({ isSyncing: false });
    }
  },
}));
