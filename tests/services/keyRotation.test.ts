import { VaultService } from '../../src/services/vaultService';
import {
  generateVaultKey,
  unwrapVaultKey,
  unwrapVaultKeyWithRecoveryCode,
  generateRecoveryCode,
  LocalVaultStorage,
  DecryptedAccountRecord,
  KeystoreService,
  wrapVaultKey,
  wrapVaultKeyWithRecoveryCode,
  encryptAesGcm,
  bytesToBase64,
} from '../../src/core/crypto';
import { supabase } from '../../src/services/supabase';

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('VaultService: Master Vault Key Rotation (Kv -> Kv\')', () => {
  const userId = 'user-test-rotate-123';
  const passphrase = 'InitialPassphrase123!@#';
  const recoveryCode = generateRecoveryCode();

  let oldVaultKey: Uint8Array;
  let accounts: DecryptedAccountRecord[];

  beforeEach(async () => {
    jest.clearAllMocks();
    await VaultService.clearRotationManifest();
    await KeystoreService.clearStagingVaultKey();
    oldVaultKey = generateVaultKey();
    await KeystoreService.saveVaultKey(oldVaultKey);

    accounts = [
      {
        id: 'acc-uuid-1',
        vault_id: 'vault-uuid-orig',
        issuer: 'Google',
        account_name: 'test@gmail.com',
        secret: 'JBSWY3DPEHPK3PXP',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        version: 1,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'acc-uuid-2',
        vault_id: 'vault-uuid-orig',
        issuer: 'GitHub',
        account_name: 'dev@github.com',
        secret: 'JBSWY3DPEHPK3PXQ',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        version: 2,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    await LocalVaultStorage.saveAccounts(oldVaultKey, accounts);
  });

  afterAll(async () => {
    await LocalVaultStorage.clearLocalData();
    await VaultService.clearRotationManifest();
    await KeystoreService.clearStagingVaultKey();
  });

  it('rotates vault key, re-encrypts records, and commits via atomic sync_rotate_vault RPC', async () => {
    const mockRemoteVault = {
      id: 'vault-uuid-orig',
      user_id: userId,
      passphrase_wrapped_vault_key: 'old_wrapped',
      passphrase_wrap_nonce: 'old_nonce',
      passphrase_kdf_salt: 'old_salt',
      passphrase_kdf_params: {},
      recovery_wrapped_vault_key: 'old_rec_wrapped',
      recovery_wrap_nonce: 'old_rec_nonce',
      recovery_kdf_salt: 'old_rec_salt',
      recovery_kdf_params: {},
      crypto_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'vaults') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockRemoteVault, error: null }),
          })),
        };
      }
      return {};
    });

    let rpcPayload: any = null;
    (supabase.rpc as jest.Mock).mockImplementation((fnName: string, payload: any) => {
      if (fnName === 'sync_rotate_vault') {
        rpcPayload = payload;
        return Promise.resolve({ data: { success: true }, error: null });
      }
      return Promise.resolve({ data: null, error: { message: 'Unknown RPC' } });
    });

    const result = await VaultService.rotateVaultKey(
      userId,
      oldVaultKey,
      passphrase,
      recoveryCode,
      accounts
    );

    expect(result.newVaultKey).toBeDefined();
    expect(result.newVaultKey).not.toEqual(oldVaultKey);
    expect(result.rotatedCount).toBe(2);

    // Verify atomic RPC was called with all re-encrypted accounts and new wrapped envelopes
    expect(rpcPayload).toBeDefined();
    expect(rpcPayload.p_vault_id).toBe('vault-uuid-orig');
    expect(rpcPayload.p_accounts).toHaveLength(2);
    expect(rpcPayload.p_accounts[0].expected_version).toBe(1);
    expect(rpcPayload.p_accounts[0].next_version).toBe(2);
    expect(rpcPayload.p_accounts[1].expected_version).toBe(2);
    expect(rpcPayload.p_accounts[1].next_version).toBe(3);

    // Verify new key can unwrap with passphrase
    const unwrappedWithPass = await unwrapVaultKey(
      {
        wrappedKey: rpcPayload.p_passphrase_wrapped_vault_key,
        nonce: rpcPayload.p_passphrase_wrap_nonce,
        salt: rpcPayload.p_passphrase_kdf_salt,
        kdfParams: rpcPayload.p_passphrase_kdf_params,
        cryptoVersion: 1,
      },
      passphrase
    );
    expect(unwrappedWithPass).toEqual(result.newVaultKey);

    // Verify new key can unwrap with recovery code
    const unwrappedWithRecovery = await unwrapVaultKeyWithRecoveryCode(
      {
        wrappedKey: rpcPayload.p_recovery_wrapped_vault_key,
        nonce: rpcPayload.p_recovery_wrap_nonce,
        salt: rpcPayload.p_recovery_kdf_salt,
        kdfParams: rpcPayload.p_recovery_kdf_params,
        cryptoVersion: 1,
      },
      recoveryCode
    );
    expect(unwrappedWithRecovery).toEqual(result.newVaultKey);

    // Verify local storage is readable with new key and accounts are preserved with incremented versions
    const loadedAccounts = await LocalVaultStorage.loadAccounts(result.newVaultKey);
    expect(loadedAccounts).toHaveLength(2);
    expect(loadedAccounts[0].issuer).toBe('Google');
    expect(loadedAccounts[0].version).toBe(2);
    expect(loadedAccounts[1].issuer).toBe('GitHub');
    expect(loadedAccounts[1].version).toBe(3);

    // Verify old key cannot decrypt storage
    await expect(LocalVaultStorage.loadAccounts(oldVaultKey)).rejects.toThrow();

    // Verify manifest was cleared upon completion
    const manifest = await VaultService.loadRotationManifest();
    expect(manifest).toBeNull();
  });

  it('preserves staged key confidentiality: manifest contains no plaintext key; key is in Keystore staging slot and encrypted under old key', async () => {
    const mockRemoteVault = {
      id: 'vault-uuid-orig',
      user_id: userId,
      passphrase_wrapped_vault_key: 'old_wrapped',
      passphrase_wrap_nonce: 'old_nonce',
      passphrase_kdf_salt: 'old_salt',
      passphrase_kdf_params: {},
      recovery_wrapped_vault_key: 'old_rec_wrapped',
      recovery_wrap_nonce: 'old_rec_nonce',
      recovery_kdf_salt: 'old_rec_salt',
      recovery_kdf_params: {},
      crypto_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'vaults') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockRemoteVault, error: null }),
          })),
        };
      }
      return {};
    });

    // Intercept during RPC to inspect staged manifest on disk before completion
    let manifestDuringPreparation: any = null;
    let stagingKeyDuringPreparation: any = null;

    (supabase.rpc as jest.Mock).mockImplementation(async (fnName: string) => {
      if (fnName === 'sync_rotate_vault') {
        manifestDuringPreparation = await VaultService.loadRotationManifest();
        stagingKeyDuringPreparation = await KeystoreService.getStagingVaultKey();
        return { data: { success: true }, error: null };
      }
      return { data: null, error: { message: 'Unknown RPC' } };
    });

    const result = await VaultService.rotateVaultKey(
      userId,
      oldVaultKey,
      passphrase,
      recoveryCode,
      accounts
    );

    // Assert manifest on disk never contains the raw new key in plaintext!
    expect(manifestDuringPreparation).toBeDefined();
    expect(manifestDuringPreparation.newVaultKeyBase64).toBeUndefined(); // MUST NOT EXIST!
    expect(manifestDuringPreparation.wrappedNewVaultKeyCiphertext).toBeDefined();
    expect(manifestDuringPreparation.wrappedNewVaultKeyNonce).toBeDefined();
    expect(manifestDuringPreparation.stagedAccounts).toHaveLength(2);

    // Assert staged key is securely in hardware Keystore staging slot
    expect(stagingKeyDuringPreparation).toBeDefined();
    expect(stagingKeyDuringPreparation).toEqual(result.newVaultKey);

    // After rotation finishes, staging slot must be cleared
    const stagingSlotAfter = await KeystoreService.getStagingVaultKey();
    expect(stagingSlotAfter).toBeNull();
  });

  it('aborts immediately with zero side-effects if pre-flight check fails', async () => {
    const wrongKey = generateVaultKey();

    await expect(
      VaultService.rotateVaultKey(userId, wrongKey, passphrase, recoveryCode, accounts)
    ).rejects.toThrow('Pre-flight verification failed');

    // Remote vault must not have been touched
    expect(supabase.rpc).not.toHaveBeenCalled();

    // Manifest must not exist
    const manifest = await VaultService.loadRotationManifest();
    expect(manifest).toBeNull();

    // Keystore must still hold original oldVaultKey
    const currentKey = await KeystoreService.getVaultKey(false);
    expect(currentKey).toEqual(oldVaultKey);
  });

  it('safely rolls back, purges staging key, and leaves old key active if RPC fails during PREPARED stage', async () => {
    const mockRemoteVault = {
      id: 'vault-uuid-orig',
      user_id: userId,
      passphrase_wrapped_vault_key: 'old_wrapped',
      passphrase_wrap_nonce: 'old_nonce',
      passphrase_kdf_salt: 'old_salt',
      passphrase_kdf_params: {},
      recovery_wrapped_vault_key: 'old_rec_wrapped',
      recovery_wrap_nonce: 'old_rec_nonce',
      recovery_kdf_salt: 'old_rec_salt',
      recovery_kdf_params: {},
      crypto_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'vaults') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockRemoteVault, error: null }),
          })),
        };
      }
      return {};
    });

    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: '23514 Concurrency conflict on account acc-uuid-1' },
    });

    await expect(
      VaultService.rotateVaultKey(userId, oldVaultKey, passphrase, recoveryCode, accounts)
    ).rejects.toThrow('Atomic vault rotation failed: 23514 Concurrency conflict');

    // Keystore staging slot must be wiped
    const stagingKey = await KeystoreService.getStagingVaultKey();
    expect(stagingKey).toBeNull();

    // Keystore master key must remain old key
    const masterKey = await KeystoreService.getVaultKey(false);
    expect(masterKey).toEqual(oldVaultKey);

    // Local storage must remain decryptable by old key
    const loaded = await LocalVaultStorage.loadAccounts(oldVaultKey);
    expect(loaded).toHaveLength(2);

    // Manifest must be cleaned up
    const manifest = await VaultService.loadRotationManifest();
    expect(manifest).toBeNull();
  });

  it('recovers from crash occurring after cloud commit (COMMITTED stage) using Keystore staging key', async () => {
    const newKey = generateVaultKey();
    const passWrap = await wrapVaultKey(newKey, passphrase);
    const recWrap = await wrapVaultKeyWithRecoveryCode(newKey, recoveryCode);
    const keyEnc = await encryptAesGcm(oldVaultKey, bytesToBase64(newKey), 'nyx-rotation-manifest:v1');

    // Stage new key in Keystore staging slot
    await KeystoreService.saveStagingVaultKey(newKey);

    // Simulate crash after remote commit succeeded
    await VaultService.saveRotationManifest({
      manifestVersion: 2,
      userId,
      vaultId: 'vault-uuid-orig',
      stage: 'COMMITTED',
      timestamp: Date.now(),
      wrappedNewVaultKeyCiphertext: keyEnc.ciphertext,
      wrappedNewVaultKeyNonce: keyEnc.nonce,
      passphraseEnvelope: passWrap,
      recoveryEnvelope: recWrap,
      stagedAccounts: [
        {
          id: 'acc-uuid-1',
          expected_version: 1,
          next_version: 2,
          ciphertext: 'enc1',
          nonce: 'nonce1',
          crypto_version: 1,
          deleted_at: null,
        },
      ],
    });

    // Remote vault in cloud has new wrapped envelope
    const mockRemoteVault = {
      id: 'vault-uuid-orig',
      user_id: userId,
      passphrase_wrapped_vault_key: passWrap.wrappedKey,
      passphrase_wrap_nonce: passWrap.nonce,
      passphrase_kdf_salt: passWrap.salt,
      passphrase_kdf_params: passWrap.kdfParams,
      recovery_wrapped_vault_key: recWrap.wrappedKey,
      recovery_wrap_nonce: recWrap.nonce,
      recovery_kdf_salt: recWrap.salt,
      recovery_kdf_params: recWrap.kdfParams,
      crypto_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'vaults') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockRemoteVault, error: null }),
          })),
        };
      }
      return {};
    });

    // Run startup recovery
    const recoveryResult = await VaultService.recoverInterruptedRotation(userId, accounts);
    expect(recoveryResult.recovered).toBe(true);
    expect(recoveryResult.newVaultKey).toEqual(newKey);

    // Keystore must now be promoted to new key
    const keystoreKey = await KeystoreService.getVaultKey(false);
    expect(keystoreKey).toEqual(newKey);

    // Staging slot must be cleared
    const stagingSlot = await KeystoreService.getStagingVaultKey();
    expect(stagingSlot).toBeNull();

    // Local storage must now be readable with new key
    const loaded = await LocalVaultStorage.loadAccounts(newKey);
    expect(loaded).toHaveLength(2);

    // Manifest must be cleaned up
    const manifest = await VaultService.loadRotationManifest();
    expect(manifest).toBeNull();
  });

  it('recovers from crash when Keystore staging slot was cleared, decrypting new key from manifest using oldVaultKey', async () => {
    const newKey = generateVaultKey();
    const passWrap = await wrapVaultKey(newKey, passphrase);
    const recWrap = await wrapVaultKeyWithRecoveryCode(newKey, recoveryCode);
    const keyEnc = await encryptAesGcm(oldVaultKey, bytesToBase64(newKey), 'nyx-rotation-manifest:v1');

    // Simulate scenario where Keystore staging slot is empty
    await KeystoreService.clearStagingVaultKey();

    await VaultService.saveRotationManifest({
      manifestVersion: 2,
      userId,
      vaultId: 'vault-uuid-orig',
      stage: 'COMMITTED',
      timestamp: Date.now(),
      wrappedNewVaultKeyCiphertext: keyEnc.ciphertext,
      wrappedNewVaultKeyNonce: keyEnc.nonce,
      passphraseEnvelope: passWrap,
      recoveryEnvelope: recWrap,
      stagedAccounts: [],
    });

    const mockRemoteVault = {
      id: 'vault-uuid-orig',
      user_id: userId,
      passphrase_wrapped_vault_key: passWrap.wrappedKey,
      passphrase_wrap_nonce: passWrap.nonce,
      passphrase_kdf_salt: passWrap.salt,
      passphrase_kdf_params: passWrap.kdfParams,
      recovery_wrapped_vault_key: recWrap.wrappedKey,
      recovery_wrap_nonce: recWrap.nonce,
      recovery_kdf_salt: recWrap.salt,
      recovery_kdf_params: recWrap.kdfParams,
      crypto_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'vaults') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockRemoteVault, error: null }),
          })),
        };
      }
      return {};
    });

    // Run recovery passing oldVaultKey
    const recoveryResult = await VaultService.recoverInterruptedRotation(userId, accounts, oldVaultKey);
    expect(recoveryResult.recovered).toBe(true);
    expect(recoveryResult.newVaultKey).toEqual(newKey);

    // Keystore must be promoted to new key
    const currentKey = await KeystoreService.getVaultKey(false);
    expect(currentKey).toEqual(newKey);
  });

  it('startup recovery safely rolls back if cloud was never committed (stage PREPARED with old key on remote)', async () => {
    const newKey = generateVaultKey();
    const passWrap = await wrapVaultKey(newKey, passphrase);
    const recWrap = await wrapVaultKeyWithRecoveryCode(newKey, recoveryCode);
    const keyEnc = await encryptAesGcm(oldVaultKey, bytesToBase64(newKey), 'nyx-rotation-manifest:v1');

    await KeystoreService.saveStagingVaultKey(newKey);

    await VaultService.saveRotationManifest({
      manifestVersion: 2,
      userId,
      vaultId: 'vault-uuid-orig',
      stage: 'PREPARED',
      timestamp: Date.now(),
      wrappedNewVaultKeyCiphertext: keyEnc.ciphertext,
      wrappedNewVaultKeyNonce: keyEnc.nonce,
      passphraseEnvelope: passWrap,
      recoveryEnvelope: recWrap,
      stagedAccounts: [],
    });

    // Remote vault in cloud still has OLD key!
    const mockRemoteVault = {
      id: 'vault-uuid-orig',
      user_id: userId,
      passphrase_wrapped_vault_key: 'old_unrotated_key',
      passphrase_wrap_nonce: 'nonce',
      passphrase_kdf_salt: 'salt',
      passphrase_kdf_params: {},
      recovery_wrapped_vault_key: 'old_rec',
      recovery_wrap_nonce: 'nonce',
      recovery_kdf_salt: 'salt',
      recovery_kdf_params: {},
      crypto_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'vaults') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockRemoteVault, error: null }),
          })),
        };
      }
      return {};
    });

    const recoveryResult = await VaultService.recoverInterruptedRotation(userId, accounts);
    expect(recoveryResult.recovered).toBe(false);

    // Staging slot must be wiped
    const stagingSlot = await KeystoreService.getStagingVaultKey();
    expect(stagingSlot).toBeNull();

    // Master key must remain old key
    const masterKey = await KeystoreService.getVaultKey(false);
    expect(masterKey).toEqual(oldVaultKey);

    // Manifest must be deleted
    const manifest = await VaultService.loadRotationManifest();
    expect(manifest).toBeNull();
  });

  it('repeated recovery calls are idempotent and do not corrupt storage or lock out the user', async () => {
    // Calling recovery when no manifest exists
    const res1 = await VaultService.recoverInterruptedRotation(userId, accounts);
    expect(res1.recovered).toBe(false);

    const res2 = await VaultService.recoverInterruptedRotation(userId, accounts);
    expect(res2.recovered).toBe(false);

    // Active key must still unlock accounts
    const loaded = await LocalVaultStorage.loadAccounts(oldVaultKey);
    expect(loaded).toHaveLength(2);
  });
});
