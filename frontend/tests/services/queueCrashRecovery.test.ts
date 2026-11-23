import {
  PersistentMutationQueue,
} from '../../src/services/queueService';

describe('PersistentMutationQueue: Crash-Safe Durability & Recovery', () => {
  beforeEach(async () => {
    await PersistentMutationQueue.clearQueue();
  });

  afterAll(async () => {
    await PersistentMutationQueue.clearQueue();
  });

  it('enqueues mutations with stable UUIDs and persists state machine transitions', async () => {
    const mutation = await PersistentMutationQueue.enqueue({
      accountId: 'acc-1111',
      vaultId: 'vault-1111',
      action: 'UPSERT',
      expectedVersion: 0,
      nextVersion: 1,
      ciphertext: 'enc_data',
      nonce: 'nonce_data',
      crypto_version: 1,
      deleted_at: null,
    });

    expect(mutation.mutationId).toBeDefined();
    expect(mutation.state).toBe('ENQUEUED');
    expect(mutation.retryCount).toBe(0);

    // Verify journal persistence
    const journal = await PersistentMutationQueue.loadJournal();
    expect(journal).toHaveLength(1);
    expect(journal[0].mutationId).toBe(mutation.mutationId);
    expect(journal[0].state).toBe('ENQUEUED');

    // Transition to PROCESSING
    await PersistentMutationQueue.markProcessing(mutation.mutationId);
    const updatedJournal = await PersistentMutationQueue.loadJournal();
    expect(updatedJournal[0].state).toBe('PROCESSING');

    // Acknowledge and purge
    await PersistentMutationQueue.acknowledge(mutation.mutationId);
    const emptiedJournal = await PersistentMutationQueue.loadJournal();
    expect(emptiedJournal).toHaveLength(0);
  });

  it('folds intermediate modifications for the same account to prevent queue bloat', async () => {
    // User edits an account twice while offline
    await PersistentMutationQueue.enqueue({
      accountId: 'acc-same-uuid',
      vaultId: 'vault-1111',
      action: 'UPSERT',
      expectedVersion: 0,
      nextVersion: 1,
      ciphertext: 'edit_1',
      nonce: 'nonce_1',
      crypto_version: 1,
      deleted_at: null,
    });

    const m2 = await PersistentMutationQueue.enqueue({
      accountId: 'acc-same-uuid',
      vaultId: 'vault-1111',
      action: 'UPSERT',
      expectedVersion: 1,
      nextVersion: 2,
      ciphertext: 'edit_2',
      nonce: 'nonce_2',
      crypto_version: 1,
      deleted_at: null,
    });

    const journal = await PersistentMutationQueue.loadJournal();
    expect(journal).toHaveLength(1);
    expect(journal[0].mutationId).toBe(m2.mutationId);
    expect(journal[0].ciphertext).toBe('edit_2');
    expect(journal[0].nextVersion).toBe(2);
  });

  it('preserves tombstones across application restart and offline cycles', async () => {
    const tombstone = await PersistentMutationQueue.enqueue({
      accountId: 'acc-to-delete',
      vaultId: 'vault-1111',
      action: 'DELETE',
      expectedVersion: 2,
      nextVersion: 3,
      ciphertext: 'tombstone_cipher',
      nonce: 'nonce_tomb',
      crypto_version: 1,
      deleted_at: new Date().toISOString(),
    });

    expect(tombstone.action).toBe('DELETE');
    expect(tombstone.deleted_at).toBeDefined();

    // Simulate app restart by reloading journal from storage
    const loaded = await PersistentMutationQueue.loadJournal();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].action).toBe('DELETE');
    expect(loaded[0].deleted_at).toBe(tombstone.deleted_at);
  });

  it('recovers interrupted mutations if application terminated during active upload', async () => {
    // 1. Enqueue mutation
    const m = await PersistentMutationQueue.enqueue({
      accountId: 'acc-interrupted',
      vaultId: 'vault-1111',
      action: 'UPSERT',
      expectedVersion: 0,
      nextVersion: 1,
      ciphertext: 'enc_payload',
      nonce: 'nonce_payload',
      crypto_version: 1,
      deleted_at: null,
    });

    // 2. Mark PROCESSING (upload started)
    await PersistentMutationQueue.markProcessing(m.mutationId);

    // 3. Simulate process crash (state is left in PROCESSING without acknowledge)
    const journalAtCrash = await PersistentMutationQueue.loadJournal();
    expect(journalAtCrash[0].state).toBe('PROCESSING');

    // 4. On reboot, run recovery where remote server DID NOT receive the write
    const recoveryResult1 = await PersistentMutationQueue.recoverInterruptedMutations(
      async () => ({ alreadyCommitted: false })
    );

    expect(recoveryResult1.recoveredCount).toBe(1);
    expect(recoveryResult1.committedCount).toBe(0);

    const journalAfterRecovery1 = await PersistentMutationQueue.loadJournal();
    expect(journalAfterRecovery1[0].state).toBe('ENQUEUED'); // Safely reset to ENQUEUED for retry
  });

  it('acknowledges mutation if remote server write succeeded before local crash', async () => {
    const m = await PersistentMutationQueue.enqueue({
      accountId: 'acc-committed-remotely',
      vaultId: 'vault-1111',
      action: 'UPSERT',
      expectedVersion: 1,
      nextVersion: 2,
      ciphertext: 'enc_payload',
      nonce: 'nonce_payload',
      crypto_version: 1,
      deleted_at: null,
    });

    await PersistentMutationQueue.markProcessing(m.mutationId);

    // Simulate crash where server write succeeded, but app crashed before local ack!
    const recoveryResult2 = await PersistentMutationQueue.recoverInterruptedMutations(
      async (accId, nextVersion) => {
        expect(accId).toBe('acc-committed-remotely');
        expect(nextVersion).toBe(2);
        return { alreadyCommitted: true }; // Server reports version 2 already committed
      }
    );

    expect(recoveryResult2.committedCount).toBe(1);
    expect(recoveryResult2.recoveredCount).toBe(0);

    // Mutation should be cleanly purged from active journal
    const journalAfterRecovery2 = await PersistentMutationQueue.loadJournal();
    expect(journalAfterRecovery2).toHaveLength(0);
  });

  it('implements bounded exponential backoff with jitter on transient failures', async () => {
    const m = await PersistentMutationQueue.enqueue({
      accountId: 'acc-retry',
      vaultId: 'vault-1111',
      action: 'UPSERT',
      expectedVersion: 0,
      nextVersion: 1,
      ciphertext: 'enc_payload',
      nonce: 'nonce_payload',
      crypto_version: 1,
      deleted_at: null,
    });

    await PersistentMutationQueue.markProcessing(m.mutationId);

    const beforeTime = Date.now();
    await PersistentMutationQueue.recordFailure(m.mutationId, 'Network timeout', false);

    const journal = await PersistentMutationQueue.loadJournal();
    expect(journal[0].state).toBe('RETRYING');
    expect(journal[0].retryCount).toBe(1);
    expect(journal[0].nextRetryTimestamp).toBeGreaterThanOrEqual(beforeTime + 500); // Base delay 500ms * 2^1 + jitter
    expect(journal[0].lastError).toBe('Network timeout');
  });

  it('transitions to PERMANENTLY_FAILED immediately on non-retryable authorization errors', async () => {
    const m = await PersistentMutationQueue.enqueue({
      accountId: 'acc-forbidden',
      vaultId: 'vault-wrong',
      action: 'UPSERT',
      expectedVersion: 0,
      nextVersion: 1,
      ciphertext: 'enc_payload',
      nonce: 'nonce_payload',
      crypto_version: 1,
      deleted_at: null,
    });

    await PersistentMutationQueue.markProcessing(m.mutationId);

    // 42501 Unauthorized error is permanent
    await PersistentMutationQueue.recordFailure(m.mutationId, '42501 Unauthorized: Vault not owned', true);

    const journal = await PersistentMutationQueue.loadJournal();
    expect(journal[0].state).toBe('PERMANENTLY_FAILED');
    expect(journal[0].lastError).toContain('42501');

    // Should NOT be returned in eligible mutations for automatic retry
    const eligible = await PersistentMutationQueue.getEligibleMutations();
    expect(eligible).toHaveLength(0);
  });
});
