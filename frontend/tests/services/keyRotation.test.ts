import { VaultService } from '../../src/services/vaultService';
import {
  generateVaultKey,
  unwrapVaultKey,
  unwrapVaultKeyWithRecoveryCode,
  generateRecoveryCode,
  LocalVaultStorage,
  DecryptedAccountRecord,
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
    oldVaultKey = generateVaultKey();

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
  });

  it('rotates vault key, re-encrypts records, and updates envelopes transactionally', async () => {
    // Mock getRemoteVault
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

    // Mock pushMutation in SyncService
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

    pushMutationSpy.mockRestore();
  });
});
