import { generateVaultKey, encryptAesGcm, decryptAesGcm } from '../../../src/core/crypto/vault';
import { wrapVaultKey, unwrapVaultKey } from '../../../src/core/crypto/kdf';

describe('Cryptographic Vault & AES-256-GCM', () => {
  it('generates a 32-byte (256-bit) Vault Key', () => {
    const key = generateVaultKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it('successfully encrypts and decrypts a record roundtrip', async () => {
    const vaultKey = generateVaultKey();
    const plaintext = JSON.stringify({
      issuer: 'ProtonMail',
      account: 'sec@pm.me',
      secret: 'JBSWY3DPEHPK3PXP',
    });

    const encrypted = await encryptAesGcm(vaultKey, plaintext, 'account-record-v1');
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.nonce).toBeDefined();
    expect(encrypted.crypto_version).toBe(1);

    const decrypted = await decryptAesGcm(vaultKey, encrypted, 'account-record-v1');
    expect(decrypted).toBe(plaintext);
    const parsed = JSON.parse(decrypted);
    expect(parsed.issuer).toBe('ProtonMail');
  });

  it('fails decryption when ciphertext is tampered with (Auth Tag verification)', async () => {
    const vaultKey = generateVaultKey();
    const plaintext = 'SuperSensitiveSecretKey123';
    const encrypted = await encryptAesGcm(vaultKey, plaintext);

    // Tamper with first byte of base64 ciphertext
    const rawBuffer = Buffer.from(encrypted.ciphertext, 'base64');
    rawBuffer[0] ^= 0xff; // Flip bits
    const tamperedPayload = {
      ...encrypted,
      ciphertext: rawBuffer.toString('base64'),
    };

    await expect(decryptAesGcm(vaultKey, tamperedPayload)).rejects.toThrow();
  });

  it('wraps and unwraps Vault Key using passphrase KDF envelope', async () => {
    const masterVaultKey = generateVaultKey();
    const passphrase = 'Correct-Horse-Battery-Staple-2026!';

    const envelope = await wrapVaultKey(masterVaultKey, passphrase);
    expect(envelope.wrappedKey).toBeDefined();
    expect(envelope.salt).toBeDefined();
    expect(envelope.nonce).toBeDefined();

    const unwrapped = await unwrapVaultKey(envelope, passphrase);
    expect(Array.from(unwrapped)).toEqual(Array.from(masterVaultKey));
  });

  it('fails unwrapping when wrong passphrase is provided', async () => {
    const masterVaultKey = generateVaultKey();
    const envelope = await wrapVaultKey(masterVaultKey, 'ValidPassphrase123');

    await expect(unwrapVaultKey(envelope, 'IncorrectPassword456')).rejects.toThrow();
  });
});
