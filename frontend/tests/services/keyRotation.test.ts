import { VaultService } from '../../src/services/vaultService';
import {
  generateVaultKey,
  unwrapVaultKey,
  unwrapVaultKeyWithRecoveryCode,
  generateRecoveryCode,
  LocalVaultStorage,
  DecryptedAccountRecord,
  KeystoreService,
  bytesToBase64,
  wrapVaultKey,
  wrapVaultKeyWithRecoveryCode,
} from '../../src/core/crypto';
import { SyncService } from '../../src/services/syncService';
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
  });

  it('rotates vault key, re-encrypts records, and updates envelopes transactionally', async () => {
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

    let updatedVaultPayload: any = null;
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'vaults') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation((_col: string, _val: any) => {
            return {
              maybeSingle: jest.fn().mockResolvedValue({ data: mockRemoteVault, error: null }),
              eq: jest.fn().mockResolvedValue({ error: null }),
            };
          }),
          update: jest.fn().mockImplementation((payload: any) => {
            updatedVaultPayload = payload;
            return {
              eq: jest.fn().mockImplementation(() => ({
                eq: jest.fn().mockResolvedValue({ error: null }),
              })),
            };
          }),
        };
      }
      return {};
    });

    const pushMutationSpy = jest.spyOn(SyncService, 'pushMutation').mockResolvedValue({
      success: true,
      conflict: false,
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

    // Verify remote vault was updated with freshly wrapped envelopes
    expect(updatedVaultPayload).toBeDefined();
    expect(updatedVaultPayload.passphrase_wrapped_vault_key).toBeDefined();
    expect(updatedVaultPayload.recovery_wrapped_vault_key).toBeDefined();

    // Verify new key can unwrap with passphrase
    const unwrappedWithPass = await unwrapVaultKey(
      {
        wrappedKey: updatedVaultPayload.passphrase_wrapped_vault_key,
        nonce: updatedVaultPayload.passphrase_wrap_nonce,
        salt: updatedVaultPayload.passphrase_kdf_salt,
        kdfParams: updatedVaultPayload.passphrase_kdf_params,
        cryptoVersion: 1,
      },
      passphrase
    );
    expect(unwrappedWithPass).toEqual(result.newVaultKey);

    // Verify new key can unwrap with recovery code
    const unwrappedWithRecovery = await unwrapVaultKeyWithRecoveryCode(
      {
        wrappedKey: updatedVaultPayload.recovery_wrapped_vault_key,
        nonce: updatedVaultPayload.recovery_wrap_nonce,
        salt: updatedVaultPayload.recovery_kdf_salt,
        kdfParams: updatedVaultPayload.recovery_kdf_params,
        cryptoVersion: 1,
      },
      recoveryCode
    );
    expect(unwrappedWithRecovery).toEqual(result.newVaultKey);

    // Verify local storage is readable with new key and accounts are preserved
    const loadedAccounts = await LocalVaultStorage.loadAccounts(result.newVaultKey);
    expect(loadedAccounts).toHaveLength(2);
    expect(loadedAccounts[0].issuer).toBe('Google');
    expect(loadedAccounts[1].issuer).toBe('GitHub');

    // Verify old key cannot decrypt storage
    await expect(LocalVaultStorage.loadAccounts(oldVaultKey)).rejects.toThrow();

    // Verify manifest was cleared upon completion
    const manifest = await VaultService.loadRotationManifest();
    expect(manifest).toBeNull();

    pushMutationSpy.mockRestore();
  });

  it('safely rolls back and keeps old key active if cloud update fails during PREPARED stage', async () => {
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

    // Simulate Supabase network/authorization error during update
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'vaults') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation((_col: string, _val: any) => {
            return {
              maybeSingle: jest.fn().mockResolvedValue({ data: mockRemoteVault, error: null }),
              eq: jest.fn().mockResolvedValue({ error: null }),
            };
          }),
          update: jest.fn().mockImplementation(() => {
            return {
              eq: jest.fn().mockImplementation(() => ({
                eq: jest.fn().mockResolvedValue({ error: { message: '503 Service Unavailable' } }),
              })),
            };
          }),
        };
      }
      return {};
    });

    await expect(
      VaultService.rotateVaultKey(userId, oldVaultKey, passphrase, recoveryCode, accounts)
    ).rejects.toThrow('503 Service Unavailable');

    // Verify old key is still intact and can unlock local storage
    const loaded = await LocalVaultStorage.loadAccounts(oldVaultKey);
    expect(loaded).toHaveLength(2);

    // Verify Keystore still holds old key
    const currentKey = await KeystoreService.getVaultKey(false);
    expect(currentKey).toEqual(oldVaultKey);

    // Verify manifest is cleaned up
    const manifest = await VaultService.loadRotationManifest();
    expect(manifest).toBeNull();
  });

  it('recovers from crash occurring after cloud commit (CLOUD_COMMITTED stage)', async () => {
    const newKey = generateVaultKey();
    const passWrap = await wrapVaultKey(newKey, passphrase);
    const recWrap = await wrapVaultKeyWithRecoveryCode(newKey, recoveryCode);

    // Simulate a crash scenario where cloud update finished and manifest was written as CLOUD_COMMITTED,
    // but app was killed before KeystoreService.saveVaultKey or LocalVaultStorage.saveAccounts!
    await VaultService.saveRotationManifest({
      manifestVersion: 1,
      userId,
      vaultId: 'vault-uuid-orig',
      stage: 'CLOUD_COMMITTED',
      timestamp: Date.now(),
      newVaultKeyBase64: bytesToBase64(newKey),
      passphraseEnvelope: passWrap,
      recoveryEnvelope: recWrap,
    });

    // Run startup recovery
    const recoveryResult = await VaultService.recoverInterruptedRotation(userId, accounts);
    expect(recoveryResult.recovered).toBe(true);
    expect(recoveryResult.newVaultKey).toEqual(newKey);

    // Keystore must now be updated to the new key
    const keystoreKey = await KeystoreService.getVaultKey(false);
    expect(keystoreKey).toEqual(newKey);

    // Local storage must now be readable with the new key
    const loaded = await LocalVaultStorage.loadAccounts(newKey);
    expect(loaded).toHaveLength(2);

    // Manifest must be cleaned up
    const manifest = await VaultService.loadRotationManifest();
    expect(manifest).toBeNull();
  });
});
