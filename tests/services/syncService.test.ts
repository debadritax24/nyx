import { SyncService, RemoteAccountRow } from '../../src/services/syncService';
import { generateVaultKey } from '../../src/core/crypto/vault';
import { DecryptedAccountRecord } from '../../src/core/crypto/types';

describe('Phase 5: Secure Cloud Synchronization & Concurrency Engine', () => {
  const vaultKeyA = generateVaultKey();
  // In multi-device sync, Device B unwraps the identical Vault Key using its Master Passphrase / Recovery Code
  const vaultKeyB = new Uint8Array(vaultKeyA);

  const mockAccount1: DecryptedAccountRecord = {
    id: '11111111-1111-4111-8111-111111111111',
    vault_id: 'vault-uuid-001',
    issuer: 'GitHub',
    account_name: 'alice',
    secret: 'JBSWY3DPEHPK3PXP',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    version: 1,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('encrypts account records client-side without exposing plaintext secrets', async () => {
    const encrypted = await SyncService.encryptAccountForSync(vaultKeyA, mockAccount1);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.nonce).toBeDefined();
    expect(encrypted.crypto_version).toBe(1);

    // Assert ciphertext does NOT contain plaintext secret or issuer
    const rawCiphertext = Buffer.from(encrypted.ciphertext, 'base64').toString('utf8');
    expect(rawCiphertext).not.toContain('JBSWY3DPEHPK3PXP');
    expect(rawCiphertext).not.toContain('GitHub');
    expect(rawCiphertext).not.toContain('alice');
  });

  it('decrypts remote account rows with matching Vault Key and verifies AAD', async () => {
    const encrypted = await SyncService.encryptAccountForSync(vaultKeyA, mockAccount1);

    const remoteRow: RemoteAccountRow = {
      id: mockAccount1.id,
      user_id: 'user-001',
      vault_id: mockAccount1.vault_id || 'vault-001',
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      crypto_version: encrypted.crypto_version,
      version: 1,
      deleted_at: null,
      created_at: mockAccount1.created_at,
      updated_at: mockAccount1.updated_at,
    };

    // Device B decrypts with its unwrapped Vault Key
    const decrypted = await SyncService.decryptRemoteAccount(vaultKeyB, remoteRow);

    expect(decrypted.id).toBe(mockAccount1.id);
    expect(decrypted.issuer).toBe('GitHub');
    expect(decrypted.account_name).toBe('alice');
    expect(decrypted.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(decrypted.version).toBe(1);
  });

  it('fails decryption when AAD is mismatched (cross-account substitution defense)', async () => {
    const encrypted = await SyncService.encryptAccountForSync(vaultKeyA, mockAccount1);

    // Attacker modifies row ID to substitute another account
    const tamperedRow: RemoteAccountRow = {
      id: '99999999-9999-4999-8999-999999999999', // Different ID
      user_id: 'user-001',
      vault_id: 'vault-001',
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      crypto_version: 1,
      version: 1,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await expect(SyncService.decryptRemoteAccount(vaultKeyB, tamperedRow)).rejects.toThrow();
  });

  describe('Deterministic Reconciliation & Conflict Resolution', () => {
    it('adopts newer remote records when remote version > local version', () => {
      const local: DecryptedAccountRecord[] = [
        { ...mockAccount1, version: 1, account_name: 'alice-old' },
      ];

      const remote: DecryptedAccountRecord[] = [
        { ...mockAccount1, version: 2, account_name: 'alice-updated-on-device-b' },
      ];

      const result = SyncService.reconcileAccounts(local, remote);
      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].version).toBe(2);
      expect(result.merged[0].account_name).toBe('alice-updated-on-device-b');
      expect(result.conflictsResolved).toBe(0);
    });

    it('preserves both copies when concurrent conflicting edits occur', () => {
      // Local modified account while offline, but remote on Device B also advanced version
      const local: DecryptedAccountRecord[] = [
        { ...mockAccount1, version: 1, account_name: 'alice-local-offline-edit' },
      ];

      const remote: DecryptedAccountRecord[] = [
        { ...mockAccount1, version: 2, account_name: 'alice-remote-online-edit' },
      ];

      const conflictingIds = new Set([mockAccount1.id]);
      const result = SyncService.reconcileAccounts(local, remote, conflictingIds);
      // Both must be preserved without data loss
      expect(result.merged).toHaveLength(2);
      expect(result.conflictsResolved).toBe(1);

      const canonical = result.merged.find((a) => a.id === mockAccount1.id);
      const forked = result.merged.find((a) => a.account_name.includes('Conflicted Copy'));

      expect(canonical?.account_name).toBe('alice-remote-online-edit');
      expect(forked?.account_name).toBe('alice-local-offline-edit (Conflicted Copy)');
    });

    it('detects and forks when same version has divergent concurrent edits', () => {
      const local: DecryptedAccountRecord[] = [
        { ...mockAccount1, version: 2, account_name: 'alice-branch-a' },
      ];

      const remote: DecryptedAccountRecord[] = [
        { ...mockAccount1, version: 2, account_name: 'alice-branch-b' },
      ];

      const result = SyncService.reconcileAccounts(local, remote);
      expect(result.merged).toHaveLength(2);
      expect(result.conflictsResolved).toBe(1);
    });

    it('enforces tombstone deletion and prevents resurrection of deleted records', () => {
      // Device A deleted the record while Device B was offline
      const localOnDeviceB: DecryptedAccountRecord[] = [
        { ...mockAccount1, version: 1 },
      ];

      const remoteTombstone: DecryptedAccountRecord = {
        ...mockAccount1,
        version: 2,
        deleted_at: new Date().toISOString(), // Tombstone
      };

      const result = SyncService.reconcileAccounts(localOnDeviceB, [remoteTombstone]);
      // The deleted account must be purged from active list, NOT resurrected
      expect(result.merged).toHaveLength(0);
    });

    it('is idempotent when running repeated synchronizations without changes', () => {
      const local: DecryptedAccountRecord[] = [mockAccount1];
      const remote: DecryptedAccountRecord[] = [mockAccount1];

      const result1 = SyncService.reconcileAccounts(local, remote);
      const result2 = SyncService.reconcileAccounts(result1.merged, remote);

      expect(result1.merged).toHaveLength(1);
      expect(result2.merged).toHaveLength(1);
      expect(result1.merged[0].id).toBe(mockAccount1.id);
      expect(result2.merged[0].id).toBe(mockAccount1.id);
    });
  });

  describe('Multi-Device Bidirectional Sync Simulation', () => {
    it('successfully propagates an update from Device A to Device B', async () => {
      // 1. Device A creates account at version 1
      const accountOnA: DecryptedAccountRecord = {
        ...mockAccount1,
        version: 1,
      };

      // 2. Device A encrypts and pushes
      const encA = await SyncService.encryptAccountForSync(vaultKeyA, accountOnA);
      const remoteRowV1: RemoteAccountRow = {
        id: accountOnA.id,
        user_id: 'user-001',
        vault_id: 'vault-001',
        ciphertext: encA.ciphertext,
        nonce: encA.nonce,
        crypto_version: 1,
        version: 1,
        deleted_at: null,
        created_at: accountOnA.created_at,
        updated_at: accountOnA.updated_at,
      };

      // 3. Device B pulls and decrypts with Vault Key B
      const pulledOnB = await SyncService.decryptRemoteAccount(vaultKeyB, remoteRowV1);
      expect(pulledOnB.account_name).toBe('alice');

      // 4. Device B modifies account to version 2
      const updatedOnB: DecryptedAccountRecord = {
        ...pulledOnB,
        account_name: 'alice-renamed-on-b',
        version: 2,
        updated_at: new Date().toISOString(),
      };

      // 5. Device B encrypts and updates remote
      const encB = await SyncService.encryptAccountForSync(vaultKeyB, updatedOnB);
      const remoteRowV2: RemoteAccountRow = {
        ...remoteRowV1,
        ciphertext: encB.ciphertext,
        nonce: encB.nonce,
        version: 2,
        updated_at: updatedOnB.updated_at,
      };

      // 6. Device A pulls remoteRowV2 and decrypts
      const pulledOnA = await SyncService.decryptRemoteAccount(vaultKeyA, remoteRowV2);
      const reconcileOnA = SyncService.reconcileAccounts([accountOnA], [pulledOnA]);

      expect(reconcileOnA.merged).toHaveLength(1);
      expect(reconcileOnA.merged[0].version).toBe(2);
      expect(reconcileOnA.merged[0].account_name).toBe('alice-renamed-on-b');
    });
  });

  describe('Phase 6 Hardening: Delete vs Update Conflicts & Zero Data Loss', () => {
    it('preserves local offline edits when remote was deleted (tombstoned)', () => {
      // 1. Local device was offline and modified account
      const localModified: DecryptedAccountRecord = {
        ...mockAccount1,
        account_name: 'alice-offline-work',
        version: 1,
      };

      // 2. Remote device deleted the account (tombstone)
      const remoteTombstone: DecryptedAccountRecord = {
        ...mockAccount1,
        version: 2,
        deleted_at: new Date().toISOString(),
      };

      // Flag local ID as having a conflicting mutation
      const conflictedIds = new Set([mockAccount1.id]);

      const result = SyncService.reconcileAccounts([localModified], [remoteTombstone], conflictedIds);

      // Invariant: Zero Data Loss.
      // Canonical ID is deleted, but local edits are preserved under a new UUID with "(Restored from Deleted Copy)"
      expect(result.conflictsResolved).toBe(1);
      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].id).not.toBe(mockAccount1.id);
      expect(result.merged[0].account_name).toBe('alice-offline-work (Restored from Deleted Copy)');
      expect(result.merged[0].deleted_at).toBeNull();
    });

    it('ensures deleted records do not reappear on repeated synchronization', () => {
      // 1. Initial sync resolved the delete-vs-update conflict
      const localModified: DecryptedAccountRecord = {
        ...mockAccount1,
        account_name: 'alice-offline-work',
        version: 1,
      };
      const remoteTombstone: DecryptedAccountRecord = {
        ...mockAccount1,
        version: 2,
        deleted_at: new Date().toISOString(),
      };
      const conflictedIds = new Set([mockAccount1.id]);
      const firstSync = SyncService.reconcileAccounts([localModified], [remoteTombstone], conflictedIds);
      const restoredAccount = firstSync.merged[0];

      // 2. Subsequent sync: remote tombstone arrives again during polling
      // Local now holds [restoredAccount], remote has [remoteTombstone]
      const secondSync = SyncService.reconcileAccounts([restoredAccount], [remoteTombstone]);

      // Original deleted account must NOT reappear, and restored account must remain active
      expect(secondSync.merged).toHaveLength(1);
      expect(secondSync.merged[0].id).toBe(restoredAccount.id);
      expect(secondSync.merged[0].account_name).toBe('alice-offline-work (Restored from Deleted Copy)');
      expect(secondSync.conflictsResolved).toBe(0);
    });
  });

  describe('Phase 6 Hardening: Forked Account Cryptographic Identity & AAD Integrity', () => {
    it('strictly forbids reusing ciphertext under a different account identity (AAD mismatch)', async () => {
      const originalAccount: DecryptedAccountRecord = {
        ...mockAccount1,
        id: '22222222-2222-4222-8222-222222222222',
      };

      // Encrypt under original account ID
      const encrypted = await SyncService.encryptAccountForSync(vaultKeyA, originalAccount);

      // Attacker attempts to forge or relocate ciphertext under a new account ID
      const forkedRowWithReusedCiphertext: RemoteAccountRow = {
        id: '33333333-3333-4333-8333-333333333333', // New forked ID
        user_id: 'user-001',
        vault_id: 'vault-001',
        ciphertext: encrypted.ciphertext, // Copied old ciphertext
        nonce: encrypted.nonce,
        crypto_version: 1,
        version: 1,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // GCM tag authentication must reject the relocated ciphertext because AAD is bound to the account ID
      await expect(
        SyncService.decryptRemoteAccount(vaultKeyB, forkedRowWithReusedCiphertext)
      ).rejects.toThrow();
    });

    it('correctly re-encrypts forked accounts with fresh nonce and updated AAD', async () => {
      const forkedAccount: DecryptedAccountRecord = {
        ...mockAccount1,
        id: '44444444-4444-4444-8444-444444444444',
        account_name: 'alice (Conflicted Copy)',
        version: 1,
      };

      // Properly re-encrypt using reencryptForkedAccount
      const reencrypted = await SyncService.reencryptForkedAccount(vaultKeyA, forkedAccount);

      const validForkedRow: RemoteAccountRow = {
        id: forkedAccount.id,
        user_id: 'user-001',
        vault_id: 'vault-001',
        ciphertext: reencrypted.ciphertext,
        nonce: reencrypted.nonce,
        crypto_version: 1,
        version: 1,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Decryption succeeds cleanly under the new UUID identity
      const decrypted = await SyncService.decryptRemoteAccount(vaultKeyB, validForkedRow);
      expect(decrypted.id).toBe(forkedAccount.id);
      expect(decrypted.account_name).toBe('alice (Conflicted Copy)');
    });
  });
});
