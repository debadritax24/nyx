import { supabase } from './supabase';
import {
  DecryptedAccountRecord,
  EncryptedPayload,
  encryptAesGcm,
  decryptAesGcm,
} from '../core/crypto';
import { DeviceService } from './deviceService';
import { PersistentMutationQueue } from './queueService';

export type SyncState = 'idle' | 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed' | 'offline';

export interface RemoteAccountRow {
  id: string;
  user_id: string;
  vault_id: string;
  ciphertext: string;
  nonce: string;
  crypto_version: number;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncMutation {
  id: string; // account ID
  vault_id: string;
  action: 'UPSERT' | 'DELETE';
  expectedVersion: number;
  nextVersion: number;
  ciphertext: string;
  nonce: string;
  crypto_version: number;
  deleted_at: string | null;
  timestamp: number;
  retryCount: number;
  mutationId?: string;
}

export interface SyncResult {
  pushedCount: number;
  pulledCount: number;
  conflictsCount: number;
  updatedAccounts: DecryptedAccountRecord[];
}

export class SyncService {
  /**
   * Encrypts a client account record for cloud synchronization.
   * Never transmits plaintext secrets or unencrypted metadata.
   */
  static async encryptAccountForSync(
    vaultKey: Uint8Array,
    account: DecryptedAccountRecord
  ): Promise<EncryptedPayload> {
    const payload = JSON.stringify({
      id: account.id,
      issuer: account.issuer,
      account_name: account.account_name,
      secret: account.secret,
      algorithm: account.algorithm,
      digits: account.digits,
      period: account.period,
      version: account.version,
      deleted_at: account.deleted_at || null,
      created_at: account.created_at,
      updated_at: account.updated_at,
    });

    const aad = `nyx-account:${account.id}:v1`;
    return encryptAesGcm(vaultKey, payload, aad);
  }

  /**
   * Decrypts a remote cloud record using the client's local Vault Key.
   */
  static async decryptRemoteAccount(
    vaultKey: Uint8Array,
    row: RemoteAccountRow
  ): Promise<DecryptedAccountRecord> {
    const aad = `nyx-account:${row.id}:v1`;
    const decryptedJson = await decryptAesGcm(
      vaultKey,
      {
        ciphertext: row.ciphertext,
        nonce: row.nonce,
        crypto_version: row.crypto_version,
      },
      aad
    );

    const parsed = JSON.parse(decryptedJson);
    return {
      id: row.id,
      vault_id: row.vault_id,
      issuer: parsed.issuer,
      account_name: parsed.account_name,
      secret: parsed.secret,
      algorithm: parsed.algorithm || 'SHA1',
      digits: parsed.digits || 6,
      period: parsed.period || 30,
      version: row.version,
      deleted_at: row.deleted_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Pushes a single mutation to Supabase using atomic Compare-And-Swap (CAS) semantics.
   */
  static async pushMutation(
    _userId: string,
    mutation: SyncMutation
  ): Promise<{ success: boolean; conflict: boolean; remoteRow?: RemoteAccountRow }> {
    try {
      // Execute Atomic Compare-And-Swap (CAS) Stored Procedure
      const { data, error } = await supabase.rpc('sync_push_account', {
        p_id: mutation.id,
        p_vault_id: mutation.vault_id,
        p_ciphertext: mutation.ciphertext,
        p_nonce: mutation.nonce,
        p_crypto_version: mutation.crypto_version,
        p_expected_version: mutation.expectedVersion,
        p_next_version: mutation.nextVersion,
        p_deleted_at: mutation.deleted_at || null,
      });

      if (error) {
        // Concurrency conflict thrown by sync_push_account (code 23514 or Concurrency conflict message)
        if (
          error.code === '23514' ||
          error.message.includes('Concurrency conflict') ||
          error.message.includes('Expected version')
        ) {
          const { data: currentRemote } = await supabase
            .from('authenticator_accounts')
            .select('*')
            .eq('id', mutation.id)
            .single();

          return { success: false, conflict: true, remoteRow: currentRemote || undefined };
        }
        throw error;
      }

      return { success: true, conflict: false, remoteRow: data };
    } catch (err: any) {
      if (err.message && (err.message.includes('Concurrency conflict') || err.message.includes('Expected version'))) {
        return { success: false, conflict: true };
      }
      throw err;
    }
  }

  /**
   * Pulls encrypted account records modified since last sync timestamp.
   */
  static async pullAccounts(sinceTimestamp?: string): Promise<RemoteAccountRow[]> {
    let query = supabase
      .from('authenticator_accounts')
      .select('*')
      .order('updated_at', { ascending: true });

    if (sinceTimestamp) {
      query = query.gt('updated_at', sinceTimestamp);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Deterministic Reconciler: Merges local and remote account collections.
   * Invariant: Never silently discards data. Handles tombstones and forks conflicting edits.
   */
  static reconcileAccounts(
    localAccounts: DecryptedAccountRecord[],
    remoteAccounts: DecryptedAccountRecord[],
    conflictedAccountIds?: Set<string>
  ): {
    merged: DecryptedAccountRecord[];
    conflictsResolved: number;
  } {
    const accountMap = new Map<string, DecryptedAccountRecord>();
    let conflictsResolved = 0;

    // Index all local accounts
    for (const acc of localAccounts) {
      accountMap.set(acc.id, acc);
    }

    // Merge remote accounts
    for (const remote of remoteAccounts) {
      const local = accountMap.get(remote.id);

      if (!local) {
        // Brand new remote record: add if not tombstoned
        if (!remote.deleted_at) {
          accountMap.set(remote.id, remote);
        }
      } else {
        // Record exists on both sides
        if (remote.version > local.version) {
          // Remote is strictly newer
          if (remote.deleted_at) {
            // Check if local had an unpushed / conflicting offline edit
            const isConflicted = conflictedAccountIds?.has(remote.id);
            if (isConflicted) {
              // Delete vs Update Conflict!
              // Remote deleted the canonical record, but local edited it while offline.
              // Enforce tombstone on the canonical ID (purge remote.id), but preserve local edits as a recovered copy!
              accountMap.delete(remote.id);
              conflictsResolved++;
              const restoredCopy: DecryptedAccountRecord = {
                ...local,
                id: globalThis.crypto?.randomUUID
                  ? globalThis.crypto.randomUUID()
                  : `restored_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                account_name: `${local.account_name} (Restored from Deleted Copy)`,
                version: 1,
                deleted_at: null,
                updated_at: new Date().toISOString(),
              };
              accountMap.set(restoredCopy.id, restoredCopy);
            } else {
              // Clean tombstone deletion: remove from active set, prevent resurrection
              accountMap.delete(remote.id);
            }
          } else {
            // If local had a conflicting offline edit that collided with remote
            const isConflicted = conflictedAccountIds?.has(remote.id);
            if (isConflicted) {
              // Conflict! Preserve both without data loss:
              // Adopt remote as the canonical ID, fork local into a separate preserved copy
              conflictsResolved++;
              const forkedCopy: DecryptedAccountRecord = {
                ...local,
                id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `fork_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                account_name: `${local.account_name} (Conflicted Copy)`,
                version: 1,
                deleted_at: null,
                updated_at: new Date().toISOString(),
              };
              accountMap.set(remote.id, remote);
              accountMap.set(forkedCopy.id, forkedCopy);
            } else {
              // Clean fast-forward: adopt remote version
              accountMap.set(remote.id, remote);
            }
          }
        } else if (remote.version === local.version) {
          // Same version: if remote is deleted, apply tombstone
          if (remote.deleted_at && !local.deleted_at) {
            const isConflicted = conflictedAccountIds?.has(remote.id);
            if (isConflicted) {
              accountMap.delete(remote.id);
              conflictsResolved++;
              const restoredCopy: DecryptedAccountRecord = {
                ...local,
                id: globalThis.crypto?.randomUUID
                  ? globalThis.crypto.randomUUID()
                  : `restored_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                account_name: `${local.account_name} (Restored from Deleted Copy)`,
                version: 1,
                deleted_at: null,
                updated_at: new Date().toISOString(),
              };
              accountMap.set(restoredCopy.id, restoredCopy);
            } else {
              accountMap.delete(remote.id);
            }
          } else if (!remote.deleted_at && !local.deleted_at) {
            // If contents differ at the exact same version, concurrent edits branched
            const contentDiffers =
              local.issuer !== remote.issuer ||
              local.account_name !== remote.account_name ||
              local.secret !== remote.secret;

            if (contentDiffers) {
              conflictsResolved++;
              const forkedCopy: DecryptedAccountRecord = {
                ...local,
                id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `fork_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                account_name: `${local.account_name} (Conflicted Copy)`,
                version: 1,
                deleted_at: null,
                updated_at: new Date().toISOString(),
              };
              accountMap.set(remote.id, remote);
              accountMap.set(forkedCopy.id, forkedCopy);
            }
          }
        }
        // If local.version > remote.version, local remains and will be pushed on next mutation
      }
    }

    return {
      merged: Array.from(accountMap.values()),
      conflictsResolved,
    };
  }

  /**
   * Re-encrypts a forked or restored account under its new UUID identity with fresh nonce and bound AAD.
   */
  static async reencryptForkedAccount(
    vaultKey: Uint8Array,
    forkedAccount: DecryptedAccountRecord
  ): Promise<EncryptedPayload> {
    return this.encryptAccountForSync(vaultKey, forkedAccount);
  }

  /**
   * Executes a full bidirectional sync cycle with crash-safe queue recovery.
   */
  static async executeFullSync(
    userId: string,
    vaultKey: Uint8Array,
    localAccounts: DecryptedAccountRecord[],
    pendingMutations?: SyncMutation[],
    lastSyncedAt?: string
  ): Promise<SyncResult> {
    let pushedCount = 0;
    let conflictsCount = 0;
    const conflictedAccountIds = new Set<string>();

    // 0. Crash-Safe Startup Recovery:
    // Inspect and recover any mutations that were interrupted in 'PROCESSING' state by crash / app kill
    await PersistentMutationQueue.recoverInterruptedMutations(async (accountId, expectedNextVersion) => {
      try {
        const { data } = await supabase
          .from('authenticator_accounts')
          .select('version')
          .eq('id', accountId)
          .maybeSingle();
        return { alreadyCommitted: !!data && data.version >= expectedNextVersion };
      } catch {
        return { alreadyCommitted: false };
      }
    });

    // 1. Enqueue any in-memory pending mutations into the persistent journal
    if (pendingMutations && pendingMutations.length > 0) {
      for (const m of pendingMutations) {
        if (!m.mutationId) {
          const enqueued = await PersistentMutationQueue.enqueue({
            accountId: m.id,
            vaultId: m.vault_id,
            action: m.action,
            expectedVersion: m.expectedVersion,
            nextVersion: m.nextVersion,
            ciphertext: m.ciphertext,
            nonce: m.nonce,
            crypto_version: m.crypto_version,
            deleted_at: m.deleted_at,
          });
          m.mutationId = enqueued.mutationId;
        }
      }
    }

    // 2. Fetch all eligible persistent mutations (ENQUEUED or backoff-ready RETRYING)
    const eligible = await PersistentMutationQueue.getEligibleMutations();

    // 3. Process eligible mutations with transactional journal transitions
    for (const pMutation of eligible) {
      await PersistentMutationQueue.markProcessing(pMutation.mutationId);
      try {
        const res = await this.pushMutation(userId, {
          id: pMutation.accountId,
          vault_id: pMutation.vaultId,
          action: pMutation.action,
          expectedVersion: pMutation.expectedVersion,
          nextVersion: pMutation.nextVersion,
          ciphertext: pMutation.ciphertext,
          nonce: pMutation.nonce,
          crypto_version: pMutation.crypto_version,
          deleted_at: pMutation.deleted_at,
          timestamp: pMutation.createdAt,
          retryCount: pMutation.retryCount,
          mutationId: pMutation.mutationId,
        });

        if (res.success) {
          pushedCount++;
          await PersistentMutationQueue.acknowledge(pMutation.mutationId);
        } else if (res.conflict) {
          conflictsCount++;
          conflictedAccountIds.add(pMutation.accountId);
          // Acknowledge conflict from queue; state will reconcile from remote pull
          await PersistentMutationQueue.acknowledge(pMutation.mutationId);
        }
      } catch (err: any) {
        const isPermanent = err.code === '42501' || err.message?.includes('Unauthorized');
        await PersistentMutationQueue.recordFailure(pMutation.mutationId, err.message, isPermanent);
      }
    }

    // 4. Pull remote records
    const remoteRows = await this.pullAccounts(lastSyncedAt);
    const decryptedRemoteList: DecryptedAccountRecord[] = [];

    for (const row of remoteRows) {
      try {
        const decrypted = await this.decryptRemoteAccount(vaultKey, row);
        decryptedRemoteList.push(decrypted);
      } catch (err: any) {
        console.warn(`Failed to decrypt remote record ${row.id}:`, err.message);
      }
    }

    // 5. Reconcile local and remote records
    const reconciliation = this.reconcileAccounts(localAccounts, decryptedRemoteList, conflictedAccountIds);
    conflictsCount += reconciliation.conflictsResolved;

    // 6. Update device sync heartbeat
    await DeviceService.updateSyncTimestamp(userId).catch(() => {});

    return {
      pushedCount,
      pulledCount: decryptedRemoteList.length,
      conflictsCount,
      updatedAccounts: reconciliation.merged,
    };
  }
}
