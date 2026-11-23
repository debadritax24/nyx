import {
  deriveKeyArgon2id,
  deriveKeyPbkdf2,
  wrapVaultKey,
  unwrapVaultKey,
  DEFAULT_ARGON2_PARAMS,
} from '../../../src/core/crypto/kdf';
import { generateVaultKey } from '../../../src/core/crypto/vault';

describe('Argon2id & PBKDF2 Key Derivation Function (KDF)', () => {
  const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const passphrase = 'Correct-Horse-Battery-Staple-2026!';

  it('derives a 256-bit key using Argon2id deterministically', async () => {
    const key1 = await deriveKeyArgon2id(passphrase, salt, DEFAULT_ARGON2_PARAMS);
    const key2 = await deriveKeyArgon2id(passphrase, salt, DEFAULT_ARGON2_PARAMS);

    expect(key1).toBeInstanceOf(Uint8Array);
    expect(key1.length).toBe(32);
    expect(Array.from(key1)).toEqual(Array.from(key2));
  });

  it('generates distinct keys for distinct salts under Argon2id', async () => {
    const saltAlt = new Uint8Array([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const key1 = await deriveKeyArgon2id(passphrase, salt, DEFAULT_ARGON2_PARAMS);
    const key2 = await deriveKeyArgon2id(passphrase, saltAlt, DEFAULT_ARGON2_PARAMS);

    expect(Array.from(key1)).not.toEqual(Array.from(key2));
  });

  it('derives a 256-bit key using PBKDF2 deterministically', async () => {
    const key1 = await deriveKeyPbkdf2(passphrase, salt);
    const key2 = await deriveKeyPbkdf2(passphrase, salt);

    expect(key1.length).toBe(32);
    expect(Array.from(key1)).toEqual(Array.from(key2));
  });

  it('wraps and unwraps Vault Key using Argon2id envelope', async () => {
    const masterVaultKey = generateVaultKey();
    const envelope = await wrapVaultKey(masterVaultKey, passphrase, DEFAULT_ARGON2_PARAMS);

    expect(envelope.wrappedKey).toBeDefined();
    expect(envelope.salt).toBeDefined();
    expect(envelope.nonce).toBeDefined();
    expect(envelope.kdfParams.algorithm).toBe('argon2id');

    const unwrapped = await unwrapVaultKey(envelope, passphrase);
    expect(Array.from(unwrapped)).toEqual(Array.from(masterVaultKey));
  });

  it('fails unwrapping when incorrect passphrase is provided', async () => {
    const masterVaultKey = generateVaultKey();
    const envelope = await wrapVaultKey(masterVaultKey, passphrase, DEFAULT_ARGON2_PARAMS);

    await expect(unwrapVaultKey(envelope, 'WrongPassphrase!')).rejects.toThrow();
  });
});
