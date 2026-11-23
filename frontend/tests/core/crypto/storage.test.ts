import { LocalVaultStorage } from '../../../src/core/crypto/storage';
import { generateVaultKey } from '../../../src/core/crypto/vault';
import { DecryptedAccountRecord } from '../../../src/core/crypto/types';

describe('Local Encrypted Vault Storage', () => {
  const vaultKey = generateVaultKey();
  const mockAccounts: DecryptedAccountRecord[] = [
    {
      id: 'acc-1',
      issuer: 'GitHub',
      account_name: 'octocat',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'acc-2',
      issuer: 'AWS',
      account_name: 'admin@corp.io',
      secret: 'GEZDGNBVGY3TQOJQ',
      algorithm: 'SHA256',
      digits: 6,
      period: 30,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(async () => {
    await LocalVaultStorage.clearLocalData();
  });

  it('returns empty array when no storage file exists', async () => {
    const loaded = await LocalVaultStorage.loadAccounts(vaultKey);
    expect(loaded).toEqual([]);
  });

  it('encrypts, saves, and loads accounts roundtrip', async () => {
    await LocalVaultStorage.saveAccounts(vaultKey, mockAccounts);
    const loaded = await LocalVaultStorage.loadAccounts(vaultKey);

    expect(loaded).toHaveLength(2);
    expect(loaded[0].issuer).toBe('GitHub');
    expect(loaded[1].issuer).toBe('AWS');
  });

  it('fails loading with wrong vault key', async () => {
    await LocalVaultStorage.saveAccounts(vaultKey, mockAccounts);
    const wrongKey = generateVaultKey();

    await expect(LocalVaultStorage.loadAccounts(wrongKey)).rejects.toThrow();
  });

  it('clears local data completely', async () => {
    await LocalVaultStorage.saveAccounts(vaultKey, mockAccounts);
    await LocalVaultStorage.clearLocalData();

    const loaded = await LocalVaultStorage.loadAccounts(vaultKey);
    expect(loaded).toEqual([]);
  });
});
