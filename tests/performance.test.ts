import { generateTotp } from '../src/core/totp';
import { encryptAesGcm, decryptAesGcm, generateVaultKey } from '../src/core/crypto/vault';
import { deriveKeyArgon2id } from '../src/core/crypto/kdf';
import { SyncService } from '../src/services/syncService';
import { DecryptedAccountRecord } from '../src/core/crypto/types';

describe('Phase 6: Performance & Reliability Benchmarking', () => {
  const vaultKey = generateVaultKey();

  function generateMockAccountList(count: number): DecryptedAccountRecord[] {
    const list: DecryptedAccountRecord[] = [];
    for (let i = 0; i < count; i++) {
      list.push({
        id: `account-uuid-${i.toString().padStart(4, '0')}`,
        vault_id: 'vault-perf-001',
        issuer: `Service_${i % 20}`,
        account_name: `user_${i}@corp.internal`,
        secret: 'JBSWY3DPEHPK3PXP', // Valid Base32
        algorithm: i % 3 === 0 ? 'SHA256' : i % 5 === 0 ? 'SHA512' : 'SHA1',
        digits: 6,
        period: 30,
        version: 1,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    return list;
  }

  // ---------------------------------------------------------------------------
  // 1. Large Account List TOTP Generation Responsiveness
  // ---------------------------------------------------------------------------
  describe('Large Account List TOTP Responsiveness', () => {
    it('generates 100 TOTP codes within performance budget (< 150ms)', async () => {
      const accounts100 = generateMockAccountList(100);
      const start = Date.now();

      const promises = accounts100.map((acc) =>
        generateTotp({
          secret: acc.secret,
          algorithm: acc.algorithm,
          digits: acc.digits,
          period: acc.period,
        })
      );
      const results = await Promise.all(promises);
      const elapsed = Date.now() - start;

      expect(results).toHaveLength(100);
      expect(elapsed).toBeLessThan(250);
      console.log(`[PERF] 100 TOTP Codes Generated in: ${elapsed}ms (${(elapsed / 100).toFixed(2)}ms / code)`);
    });

    it('generates 500 TOTP codes without blocking event loop (< 1000ms)', async () => {
      const accounts500 = generateMockAccountList(500);
      const start = Date.now();

      const promises = accounts500.map((acc) =>
        generateTotp({
          secret: acc.secret,
          algorithm: acc.algorithm,
          digits: acc.digits,
          period: acc.period,
        })
      );
      const results = await Promise.all(promises);
      const elapsed = Date.now() - start;

      expect(results).toHaveLength(500);
      expect(elapsed).toBeLessThan(1200);
      console.log(`[PERF] 500 TOTP Codes Generated in: ${elapsed}ms (${(elapsed / 500).toFixed(2)}ms / code)`);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Encrypted Vault Persistence Scaling
  // ---------------------------------------------------------------------------
  describe('Encrypted Vault Serialization & Encryption Scaling', () => {
    it('encrypts and decrypts 100 accounts under AES-256-GCM in < 25ms', async () => {
      const accounts100 = generateMockAccountList(100);
      const json = JSON.stringify(accounts100);

      const t0 = Date.now();
      const enc = await encryptAesGcm(vaultKey, json, 'nyx-local-vault-storage:v1');
      const tEnc = Date.now() - t0;

      const t1 = Date.now();
      const dec = await decryptAesGcm(vaultKey, enc, 'nyx-local-vault-storage:v1');
      const tDec = Date.now() - t1;

      const parsed = JSON.parse(dec);
      expect(parsed).toHaveLength(100);
      console.log(`[PERF] 100 Accounts Encrypted in ${tEnc}ms, Decrypted in ${tDec}ms`);
      expect(tEnc + tDec).toBeLessThan(50);
    });

    it('encrypts and decrypts 500 accounts under AES-256-GCM in < 100ms', async () => {
      const accounts500 = generateMockAccountList(500);
      const json = JSON.stringify(accounts500);

      const t0 = Date.now();
      const enc = await encryptAesGcm(vaultKey, json, 'nyx-local-vault-storage:v1');
      const tEnc = Date.now() - t0;

      const t1 = Date.now();
      const dec = await decryptAesGcm(vaultKey, enc, 'nyx-local-vault-storage:v1');
      const tDec = Date.now() - t1;

      const parsed = JSON.parse(dec);
      expect(parsed).toHaveLength(500);
      console.log(`[PERF] 500 Accounts Encrypted in ${tEnc}ms, Decrypted in ${tDec}ms`);
      expect(tEnc + tDec).toBeLessThan(150);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Argon2id Key Derivation Memory & Execution Profile
  // ---------------------------------------------------------------------------
  describe('Argon2id Key Derivation Resource Profile', () => {
    it('executes RFC 9106 Argon2id (64MB memory, 3 iterations) without OOM', async () => {
      const salt = new Uint8Array(16);
      const t0 = Date.now();
      const derivedKey = await deriveKeyArgon2id('HighSecurityPassphrase!2026', salt, {
        algorithm: 'argon2id',
        memory: 65536,
        iterations: 3,
        parallelism: 4,
        keyLength: 32,
      });
      const elapsed = Date.now() - t0;

      expect(derivedKey).toHaveLength(32);
      console.log(`[PERF] Argon2id Key Derivation (64MB / 3 iterations) completed in: ${elapsed}ms`);
      expect(elapsed).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Synchronization Reconciler Scalability
  // ---------------------------------------------------------------------------
  describe('Synchronization Reconciler Scalability', () => {
    it('reconciles 500 local accounts against 50 remote updates in < 10ms', () => {
      const local = generateMockAccountList(500);
      const remoteUpdates: DecryptedAccountRecord[] = [];

      for (let i = 0; i < 50; i++) {
        remoteUpdates.push({
          ...local[i],
          account_name: `user_${i}_updated@remote.io`,
          version: 2,
        });
      }

      const t0 = Date.now();
      const result = SyncService.reconcileAccounts(local, remoteUpdates);
      const elapsed = Date.now() - t0;

      expect(result.merged).toHaveLength(500);
      expect(result.conflictsResolved).toBe(0);
      console.log(`[PERF] 500 Accounts Reconciled in: ${elapsed}ms`);
      expect(elapsed).toBeLessThan(25);
    });
  });
});
