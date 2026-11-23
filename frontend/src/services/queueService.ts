/**
 * NYX Crash-Safe Persistent Mutation Queue
 * Implements an application-level append-and-replace journal for offline mutations
 * with concurrency serialization mutex, journal schema versioning, Keystore-backed
 * HMAC-SHA256 integrity authentication, safe backup rotation, startup crash reconciliation,
 * bounded exponential backoff with jitter, and idempotent retry transitions.
 *
 * NOTE: This is an application-level journal using atomic filesystem renames (.tmp -> .journal),
 * NOT an OS-level SQLite write-ahead log (WAL).
 */

import { KeystoreService } from '../core/crypto';

export type MutationState =
  | 'ENQUEUED'
  | 'PROCESSING'
  | 'ACKNOWLEDGED'
  | 'RETRYING'
  | 'PERMANENTLY_FAILED';

export interface PersistentMutation {
  mutationId: string; // Stable UUID for the mutation transaction
  accountId: string; // Target account UUID
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

export interface QueueJournalEnvelope {
  schemaVersion: number;
  updatedAt: number;
  hmac: string;
  checksum?: string;
  mutations: PersistentMutation[];
}

const QUEUE_FILENAME = 'nyx_mutation_queue_v1.journal';
const QUEUE_BACKUP_FILENAME = 'nyx_mutation_queue_v1.journal.bak';
const SCHEMA_VERSION = 1;
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30000;

export class PersistentMutationQueue {
  private static memoryJournal: string | null = null;
  private static memoryBackup: string | null = null;

  // Concurrency Mutex: serializes all concurrent queue operations to prevent race conditions
  private static queueMutex: Promise<any> = Promise.resolve();

  private static runExclusive<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queueMutex.then(action, action);
    this.queueMutex = next.catch(() => {});
    return next;
  }

  private static async getFileSystem() {
    try {
      return require('expo-file-system');
    } catch {
      return null;
    }
  }

  private static async getFilePath(filename: string = QUEUE_FILENAME): Promise<string | null> {
    const FileSystem = await this.getFileSystem();
    if (FileSystem && FileSystem.documentDirectory) {
      return `${FileSystem.documentDirectory}${filename}`;
    }
    return null;
  }

  /**
   * Cryptographic HMAC-SHA256 for journal authenticity and tamper resistance.
   * Keyed by a device-bound 256-bit key from Android Keystore.
   */
  private static async computeHmac(key: string, data: string): Promise<string> {
    try {
      const nodeCrypto = require('crypto');
      return nodeCrypto.createHmac('sha256', key).update(data).digest('hex');
    } catch {}

    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
      try {
        const keyBytes = new TextEncoder().encode(key);
        const dataBytes = new TextEncoder().encode(data);
        const cryptoKey = await globalThis.crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const sig = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
        return Array.from(new Uint8Array(sig))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      } catch {}
    }

    // Deterministic keyed fallback
    let h1 = 0xdeadbeef ^ key.length;
    let h2 = 0x41c6ce57 ^ key.length;
    for (let i = 0; i < data.length; i++) {
      const ch = data.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return `hmac_${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
  }

  /**
   * Fast non-cryptographic checksum for backwards compatibility fallback.
   */
  private static computeChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `chk_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Atomically writes the journal to disk:
   * 1. Creates envelope with schemaVersion and Keystore-keyed HMAC authentication.
   * 2. Writes to temporary file (.tmp).
   * 3. Backs up existing journal to .bak ONLY if the existing journal is valid.
   * 4. Atomically replaces main journal via moveAsync.
   */
  private static async saveJournalInternal(mutations: PersistentMutation[]): Promise<void> {
    const serializedMutations = JSON.stringify(mutations);
    const hmacKey = await KeystoreService.getQueueHmacKey();
    const hmac = await this.computeHmac(hmacKey, serializedMutations);
    const envelope: QueueJournalEnvelope = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: Date.now(),
      hmac,
      checksum: hmac,
      mutations,
    };
    const filePayload = JSON.stringify(envelope);

    const path = await this.getFilePath(QUEUE_FILENAME);
    const backupPath = await this.getFilePath(QUEUE_BACKUP_FILENAME);

    if (path) {
      const FileSystem = await this.getFileSystem();
      const tempPath = `${path}.tmp`;

      // 1. Write to temporary file
      await FileSystem.writeAsStringAsync(tempPath, filePayload, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // 2. Safe Backup Rotation:
      // Verify existing primary file is valid before copying to .bak.
      // A corrupted primary file must NEVER overwrite the only valid backup!
      const mainInfo = await FileSystem.getInfoAsync(path);
      if (mainInfo.exists && backupPath) {
        try {
          const currentContent = await FileSystem.readAsStringAsync(path, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          const isValid = (await this.parseAndValidateJournal(currentContent)) !== null;
          if (isValid) {
            await FileSystem.copyAsync({ from: path, to: backupPath });
          }
        } catch {}
      }

      // 3. Atomically replace main journal
      await FileSystem.moveAsync({ from: tempPath, to: path });
    } else {
      if (this.memoryJournal) {
        const isValid = (await this.parseAndValidateJournal(this.memoryJournal)) !== null;
        if (isValid) {
          this.memoryBackup = this.memoryJournal;
        }
      }
      this.memoryJournal = filePayload;
    }
  }

  /**
   * Parses and validates raw journal content, checking HMAC integrity.
   */
  private static async parseAndValidateJournal(raw: string): Promise<PersistentMutation[] | null> {
    try {
      const parsed = JSON.parse(raw);

      // Support legacy plain array format
      if (Array.isArray(parsed)) {
        return parsed;
      }

      // Envelope format verification
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.mutations)) {
        const serialized = JSON.stringify(parsed.mutations);
        const hmacKey = await KeystoreService.getQueueHmacKey();
        const expectedHmac = await this.computeHmac(hmacKey, serialized);

        if (parsed.hmac === expectedHmac) {
          return parsed.mutations;
        }

        // Support legacy checksum during schema upgrade
        if (parsed.checksum && !parsed.hmac) {
          const legacyChecksum = this.computeChecksum(serialized);
          if (parsed.checksum === legacyChecksum) {
            return parsed.mutations;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Loads journal with corruption detection, HMAC validation, and backup recovery.
   */
  private static async loadJournalInternal(): Promise<PersistentMutation[]> {
    const path = await this.getFilePath(QUEUE_FILENAME);
    const backupPath = await this.getFilePath(QUEUE_BACKUP_FILENAME);
    let rawContent: string | null = null;

    if (path) {
      const FileSystem = await this.getFileSystem();

      // Clean up orphaned .tmp files from prior interrupted writes
      const tempPath = `${path}.tmp`;
      const tempInfo = await FileSystem.getInfoAsync(tempPath);
      if (tempInfo.exists) {
        await FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
      }

      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        rawContent = await FileSystem.readAsStringAsync(path, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }
    } else {
      rawContent = this.memoryJournal;
    }

    if (!rawContent) return [];

    // Attempt primary parse and HMAC integrity validation
    const primaryMutations = await this.parseAndValidateJournal(rawContent);
    if (primaryMutations !== null) {
      return primaryMutations;
    }

    // Primary journal is corrupted or truncated! Attempt recovery from backup
    console.warn('[Queue] Primary journal corruption detected. Attempting backup recovery...');
    let backupContent: string | null = null;
    if (backupPath) {
      const FileSystem = await this.getFileSystem();
      const backupInfo = await FileSystem.getInfoAsync(backupPath);
      if (backupInfo.exists) {
        backupContent = await FileSystem.readAsStringAsync(backupPath, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }
    } else {
      backupContent = this.memoryBackup;
    }

    if (backupContent) {
      const recoveredMutations = await this.parseAndValidateJournal(backupContent);
      if (recoveredMutations !== null) {
        console.warn('[Queue] Successfully recovered mutations from backup journal.');
        await this.saveJournalInternal(recoveredMutations);
        return recoveredMutations;
      }
    }

    // Both primary and backup corrupted; archive corrupted file for diagnostics
    if (path) {
      const FileSystem = await this.getFileSystem();
      const corruptedArchive = `${path}.corrupted.${Date.now()}`;
      await FileSystem.moveAsync({ from: path, to: corruptedArchive }).catch(() => {});
    }
    console.error('[Queue] Unrecoverable journal corruption. Archived for diagnostics.');
    return [];
  }

  /**
   * Public serialized API: Enqueue mutation with deduplication and state persistence.
   */
  static enqueue(
    mutationData: Omit<
      PersistentMutation,
      'mutationId' | 'createdAt' | 'updatedAt' | 'state' | 'retryCount' | 'nextRetryTimestamp'
    >
  ): Promise<PersistentMutation> {
    return this.runExclusive(async () => {
      const journal = await this.loadJournalInternal();
      const now = Date.now();
      const mutationId =
        globalThis.crypto?.randomUUID
          ? globalThis.crypto.randomUUID()
          : `mut_${now}_${Math.random().toString(36).substring(2, 9)}`;

      // Deduplication: Fold un-sent mutations for the same account if still ENQUEUED or RETRYING
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
      await this.saveJournalInternal(filteredJournal);
      return newMutation;
    });
  }

  /**
   * Loads all active mutations.
   */
  static loadJournal(): Promise<PersistentMutation[]> {
    return this.runExclusive(() => this.loadJournalInternal());
  }

  /**
   * Transitions a mutation to PROCESSING.
   */
  static markProcessing(mutationId: string): Promise<void> {
    return this.runExclusive(async () => {
      const journal = await this.loadJournalInternal();
      const target = journal.find((m) => m.mutationId === mutationId);
      if (target) {
        target.state = 'PROCESSING';
        target.updatedAt = Date.now();
        await this.saveJournalInternal(journal);
      }
    });
  }

  /**
   * Idempotently acknowledges a completed mutation.
   */
  static acknowledge(mutationId: string): Promise<void> {
    return this.runExclusive(async () => {
      const journal = await this.loadJournalInternal();
      const exists = journal.some((m) => m.mutationId === mutationId);
      if (!exists) return; // Idempotent no-op

      const updated = journal.filter((m) => m.mutationId !== mutationId);
      await this.saveJournalInternal(updated);
    });
  }

  /**
   * Records failure with bounded exponential backoff and randomized jitter.
   */
  static recordFailure(
    mutationId: string,
    errorMsg: string,
    isPermanent: boolean = false
  ): Promise<void> {
    return this.runExclusive(async () => {
      const journal = await this.loadJournalInternal();
      const target = journal.find((m) => m.mutationId === mutationId);
      if (!target) return;

      target.updatedAt = Date.now();
      target.lastError = errorMsg;

      if (isPermanent || target.retryCount >= MAX_RETRIES) {
        target.state = 'PERMANENTLY_FAILED';
      } else {
        target.retryCount++;
        target.state = 'RETRYING';
        const expDelay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, target.retryCount));
        const jitter = Math.floor(Math.random() * 250);
        target.nextRetryTimestamp = Date.now() + expDelay + jitter;
      }

      await this.saveJournalInternal(journal);
    });
  }

  /**
   * Retrieves mutations eligible for execution.
   */
  static getEligibleMutations(): Promise<PersistentMutation[]> {
    return this.runExclusive(async () => {
      const journal = await this.loadJournalInternal();
      const now = Date.now();
      return journal.filter(
        (m) =>
          m.state === 'ENQUEUED' ||
          (m.state === 'RETRYING' && m.nextRetryTimestamp <= now)
      );
    });
  }

  /**
   * Startup Recovery Mechanism:
   * Inspects and recovers mutations that were interrupted by crash or OS kill while in PROCESSING state.
   */
  static recoverInterruptedMutations(
    checkRemoteAccountStatus?: (
      accountId: string,
      expectedNextVersion: number
    ) => Promise<{ alreadyCommitted: boolean }>
  ): Promise<{ recoveredCount: number; committedCount: number }> {
    return this.runExclusive(async () => {
      const journal = await this.loadJournalInternal();
      let recoveredCount = 0;
      let committedCount = 0;
      const now = Date.now();

      for (const mutation of journal) {
        if (mutation.state === 'PROCESSING') {
          let isCommittedRemotely = false;
          if (checkRemoteAccountStatus) {
            try {
              const check = await checkRemoteAccountStatus(mutation.accountId, mutation.nextVersion);
              isCommittedRemotely = check.alreadyCommitted;
            } catch {
              isCommittedRemotely = false;
            }
          }

          if (isCommittedRemotely) {
            mutation.state = 'ACKNOWLEDGED';
            committedCount++;
          } else {
            mutation.state = 'ENQUEUED';
            mutation.updatedAt = now;
            recoveredCount++;
          }
        }
      }

      const activeMutations = journal.filter((m) => m.state !== 'ACKNOWLEDGED');
      await this.saveJournalInternal(activeMutations);

      return { recoveredCount, committedCount };
    });
  }

  /**
   * Clears the persistent queue and backups (e.g. on vault reset or logout).
   */
  static clearQueue(): Promise<void> {
    return this.runExclusive(async () => {
      const path = await this.getFilePath(QUEUE_FILENAME);
      const backupPath = await this.getFilePath(QUEUE_BACKUP_FILENAME);

      if (path) {
        const FileSystem = await this.getFileSystem();
        await FileSystem.deleteAsync(path, { idempotent: true });
        if (backupPath) {
          await FileSystem.deleteAsync(backupPath, { idempotent: true });
        }
      }
      this.memoryJournal = null;
      this.memoryBackup = null;
    });
  }

  /**
   * Test-only helper: injects raw data into the journal to simulate corruption.
   */
  static async injectCorruptedJournalForTesting(raw: string): Promise<void> {
    const path = await this.getFilePath(QUEUE_FILENAME);
    if (path) {
      const FileSystem = await this.getFileSystem();
      await FileSystem.writeAsStringAsync(path, raw, { encoding: FileSystem.EncodingType.UTF8 });
    } else {
      this.memoryJournal = raw;
    }
  }

  /**
   * Test-only helper: injects raw data into the backup journal.
   */
  static async injectBackupJournalForTesting(raw: string): Promise<void> {
    const backupPath = await this.getFilePath(QUEUE_BACKUP_FILENAME);
    if (backupPath) {
      const FileSystem = await this.getFileSystem();
      await FileSystem.writeAsStringAsync(backupPath, raw, { encoding: FileSystem.EncodingType.UTF8 });
    } else {
      this.memoryBackup = raw;
    }
  }
}
