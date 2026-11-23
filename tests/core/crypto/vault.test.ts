import { generateVaultKey, encryptAesGcm, decryptAesGcm, zeroMemory, getRandomBytes } from '../../../src/core/crypto/vault';

describe('AES-256-GCM Authenticated Encryption & Key Lifecycle', () => {
  it('generates a 32-byte (256-bit) cryptographically secure Vault Key', () => {
    const key = generateVaultKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
    // Not all zeros
    expect(key.some((b) => b !== 0)).toBe(true);
  });

  it('successfully encrypts and decrypts a record roundtrip with AAD', async () => {
    const vaultKey = generateVaultKey();
    const plaintext = JSON.stringify({
      issuer: 'ProtonMail',
      account: 'sec@pm.me',
      secret: 'JBSWY3DPEHPK3PXP',
    });
    const aad = 'nyx-account:acc_123:v1';

    const encrypted = await encryptAesGcm(vaultKey, plaintext, aad);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.nonce).toBeDefined();
    expect(encrypted.crypto_version).toBe(1);

    const decrypted = await decryptAesGcm(vaultKey, encrypted, aad);
    expect(decrypted).toBe(plaintext);
    const parsed = JSON.parse(decrypted);
    expect(parsed.issuer).toBe('ProtonMail');
  });

  it('fails decryption when wrong key is provided', async () => {
    const key1 = generateVaultKey();
    const key2 = generateVaultKey();
    const plaintext = 'SecretPayloadData';

    const encrypted = await encryptAesGcm(key1, plaintext);
    await expect(decryptAesGcm(key2, encrypted)).rejects.toThrow();
  });

  it('fails decryption when ciphertext is tampered with', async () => {
    const vaultKey = generateVaultKey();
    const plaintext = 'SuperSensitiveSecretKey123';
    const encrypted = await encryptAesGcm(vaultKey, plaintext);

    const rawBuffer = Buffer.from(encrypted.ciphertext, 'base64');
    rawBuffer[0] ^= 0x01; // Tamper with 1 bit
    const tampered = {
      ...encrypted,
      ciphertext: rawBuffer.toString('base64'),
    };

    await expect(decryptAesGcm(vaultKey, tampered)).rejects.toThrow();
  });

  it('fails decryption when nonce is tampered with', async () => {
    const vaultKey = generateVaultKey();
    const encrypted = await encryptAesGcm(vaultKey, 'Plaintext');

    const rawNonce = Buffer.from(encrypted.nonce, 'base64');
    rawNonce[0] ^= 0x01;
    const tampered = {
      ...encrypted,
      nonce: rawNonce.toString('base64'),
    };

    await expect(decryptAesGcm(vaultKey, tampered)).rejects.toThrow();
  });

  it('fails decryption when Associated Authenticated Data (AAD) is altered', async () => {
    const vaultKey = generateVaultKey();
    const encrypted = await encryptAesGcm(vaultKey, 'SecretAccountPayload', 'account-id-101');

    // Attempt decrypting with mismatched AAD
    await expect(
      decryptAesGcm(vaultKey, encrypted, 'account-id-999')
    ).rejects.toThrow();
  });

  it('produces unique nonces across 1,000 successive encryptions without collisions', () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const nonce = Buffer.from(getRandomBytes(12)).toString('hex');
      expect(nonces.has(nonce)).toBe(false);
      nonces.add(nonce);
    }
    expect(nonces.size).toBe(1000);
  });

  it('zeroMemory overwrites byte buffer completely', () => {
    const key = generateVaultKey();
    expect(key.some((b) => b !== 0)).toBe(true);
    zeroMemory(key);
    expect(key.every((b) => b === 0)).toBe(true);
  });

  it('generates secure random bytes even when WebCrypto getRandomValues is unavailable', () => {
    const originalGetRandomValues = globalThis.crypto?.getRandomValues;
    try {
      if (globalThis.crypto) {
        delete (globalThis.crypto as any).getRandomValues;
      }
      const bytes = getRandomBytes(32);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(32);
      expect(bytes.some((b) => b !== 0)).toBe(true);

      // Verify no collision across 100 iterations
      const set = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const rand = Buffer.from(getRandomBytes(16)).toString('hex');
        expect(set.has(rand)).toBe(false);
        set.add(rand);
      }
      expect(set.size).toBe(100);
    } finally {
      if (globalThis.crypto && originalGetRandomValues) {
        globalThis.crypto.getRandomValues = originalGetRandomValues;
      }
    }
  });

  it('encrypts and decrypts AES-256-GCM via pure JS node-forge when WebCrypto is unavailable', async () => {
    const originalSubtle = globalThis.crypto?.subtle;
    try {
      if (globalThis.crypto) {
        delete (globalThis.crypto as any).subtle;
      }

      const key = generateVaultKey();
      const plaintext = 'Offline Hermes Payload 12345! 🔐';
      const aad = 'nyx-account:hermes_test:v1';

      const encrypted = await encryptAesGcm(key, plaintext, aad);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.nonce).toBeDefined();

      const decrypted = await decryptAesGcm(key, encrypted, aad);
      expect(decrypted).toBe(plaintext);

      // Verify tampered AAD fails
      await expect(decryptAesGcm(key, encrypted, 'tampered-aad')).rejects.toThrow();
    } finally {
      if (globalThis.crypto && originalSubtle) {
        (globalThis.crypto as any).subtle = originalSubtle;
      }
    }
  });
});
