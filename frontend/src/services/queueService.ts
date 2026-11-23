/**
 * NYX Crash-Safe Persistent Mutation Queue
 * Implements atomic Write-Ahead Journaling (WAL) for offline mutations,
 * state machine transitions, crash recovery across application termination,
 * bounded exponential backoff with jitter, and idempotent retries.
 */

export type MutationState =
  | 'ENQUEUED'
  | 'PROCESSING'
  | 'ACKNOWLEDGED'
  | 'RETRYING'
  | 'PERMANENTLY_FAILED';

export interface PersistentMutation {
  mutationId: string; // Stable UUID for the mutation transaction
  accountId: string; // Account UUID
  vaultId: string;
  action: 'UPSERT' | 'DELETE';
  expectedVersion: number;
  nextVersion: number;
  ciphertext: string;
  nonce: string;
  crypto_version: number;
  deleted_at: string | null;
  createdAt: number;
  updatedAt: number;
  state: MutationState;
  retryCount: number;
  nextRetryTimestamp: number;
  lastError?: string;
}

const QUEUE_FILENAME = 'nyx_mutation_queue_v1.journal';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30000;

export class PersistentMutationQueue {
  private static memoryJournal: string | null = null;

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
      return `${FileSystem.documentDirectory}${QUEUE_FILENAME}`;
    }
    return null;
  }

  /**
   * Atomically writes the entire journal to persistent disk via temporary file rename.
   */
  private static async saveJournal(mutations: PersistentMutation[]): Promise<void> {
    const serialized = JSON.stringify(mutations);
    const path = await this.getFilePath();

    if (path) {
      const FileSystem = await this.getFileSystem();
      const tempPath = `${path}.tmp`;
      await FileSystem.writeAsStringAsync(tempPath, serialized, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await FileSystem.moveAsync({ from: tempPath, to: path });
    } else {
      this.memoryJournal = serialized;
    }
  }

  /**
   * Reads all mutations from the journal.
   */
  static async loadJournal(): Promise<PersistentMutation[]> {
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
      rawContent = this.memoryJournal;
    }

    if (!rawContent) return [];
    try {
      const parsed = JSON.parse(rawContent);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Enqueues a new mutation transaction.
   * Folds duplicate un-sent modifications for the same account to prevent queue bloat.
   */
  static async enqueue(
    mutationData: Omit<
      PersistentMutation,
      'mutationId' | 'createdAt' | 'updatedAt' | 'state' | 'retryCount' | 'nextRetryTimestamp'
    >
  ): Promise<PersistentMutation> {
    const journal = await this.loadJournal();
    const now = Date.now();
    const mutationId =
      globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `mut_${now}_${Math.random().toString(36).substring(2, 9)}`;

    // Fold un-sent mutations for the same account if they are still ENQUEUED or RETRYING
    const filteredJournal = journal.filter(
      (m) =>
        !(
          m.accountId === mutationData.accountId &&
          (m.state === 'ENQUEUED' || m.state === 'RETRYING') &&
          mutationData.action === 'UPSERT'
        )
    );

    const newMutation: PersistentMutation = {
      ...mutationData,
      mutationId,
      createdAt: now,
      updatedAt: now,
      state: 'ENQUEUED',
      retryCount: 0,
      nextRetryTimestamp: 0,
    };

    filteredJournal.push(newMutation);
    await this.saveJournal(filteredJournal);
    return newMutation;
  }

  /**
   * Transitions a mutation to PROCESSING.
   * Guarantees persistence before remote dispatch.
   */
  static async markProcessing(mutationId: string): Promise<void> {
    const journal = await this.loadJournal();
    const target = journal.find((m) => m.mutationId === mutationId);
    if (target) {
      target.state = 'PROCESSING';
      target.updatedAt = Date.now();
      await this.saveJournal(journal);
    }
  }

  /**
   * Transitions a mutation to ACKNOWLEDGED and purges it from the active journal.
   */
  static async acknowledge(mutationId: string): Promise<void> {
    const journal = await this.loadJournal();
    const updated = journal.filter((m) => m.mutationId !== mutationId);
    await this.saveJournal(updated);
  }

  /**
   * Records failure with bounded exponential backoff and randomized jitter.
   */
  static async recordFailure(
    mutationId: string,
    errorMsg: string,
    isPermanent: boolean = false
  ): Promise<void> {
    const journal = await this.loadJournal();
    const target = journal.find((m) => m.mutationId === mutationId);
    if (!target) return;

    target.updatedAt = Date.now();
    target.lastError = errorMsg;

    if (isPermanent || target.retryCount >= MAX_RETRIES) {
      target.state = 'PERMANENTLY_FAILED';
    } else {
      target.retryCount++;
      target.state = 'RETRYING';
      // Bounded exponential backoff + jitter
      const expDelay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, target.retryCount));
      const jitter = Math.floor(Math.random() * 250);
      target.nextRetryTimestamp = Date.now() + expDelay + jitter;
    }

    await this.saveJournal(journal);
  }

  /**
   * Retrieves mutations eligible for execution.
   */
  static async getEligibleMutations(): Promise<PersistentMutation[]> {
    const journal = await this.loadJournal();
    const now = Date.now();
    return journal.filter(
      (m) =>
        m.state === 'ENQUEUED' ||
        (m.state === 'RETRYING' && m.nextRetryTimestamp <= now)
    );
  }

  /**
   * Startup Recovery Mechanism:
   * Inspects and recovers mutations that were interrupted by application crash or OS kill
   * while in PROCESSING state.
   */
  static async recoverInterruptedMutations(
    checkRemoteAccountStatus?: (
      accountId: string,
      expectedNextVersion: number
    ) => Promise<{ alreadyCommitted: boolean }>
  ): Promise<{ recoveredCount: number; committedCount: number }> {
    const journal = await this.loadJournal();
    let recoveredCount = 0;
    let committedCount = 0;
    const now = Date.now();

    for (const mutation of journal) {
      if (mutation.state === 'PROCESSING') {
        let isCommittedRemotely = false;

        // If an inspection callback is provided, verify whether server received the write before local crash
        if (checkRemoteAccountStatus) {
          try {
            const check = await checkRemoteAccountStatus(mutation.accountId, mutation.nextVersion);
            isCommittedRemotely = check.alreadyCommitted;
          } catch {
            isCommittedRemotely = false;
          }
        }

        if (isCommittedRemotely) {
          // Server write succeeded before crash; acknowledge mutation
          mutation.state = 'ACKNOWLEDGED';
          committedCount++;
        } else {
          // Reset to ENQUEUED for safe idempotent retry
          mutation.state = 'ENQUEUED';
          mutation.updatedAt = now;
          recoveredCount++;
        }
      }
    }

    // Retain non-acknowledged mutations
    const activeMutations = journal.filter((m) => m.state !== 'ACKNOWLEDGED');
    await this.saveJournal(activeMutations);

    return { recoveredCount, committedCount };
  }

  /**
   * Clears the persistent queue (e.g. on vault reset or logout).
   */
  static async clearQueue(): Promise<void> {
    const path = await this.getFilePath();
    if (path) {
      const FileSystem = await this.getFileSystem();
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
    this.memoryJournal = null;
  }
}
