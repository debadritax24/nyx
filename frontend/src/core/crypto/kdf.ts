import { KdfParams, WrappedVaultKeyEnvelope } from './types';
import { getRandomBytes, bytesToBase64, base64ToBytes, encryptAesGcm, decryptAesGcm } from './vault';

export const DEFAULT_ARGON2_PARAMS: KdfParams = {
  algorithm: 'argon2id',
  iterations: 3,
  memory: 65536,
  parallelism: 4,
  keyLength: 32,
};

export const DEFAULT_PBKDF2_PARAMS: KdfParams = {
  algorithm: 'pbkdf2',
  iterations: 100000,
  keyLength: 32,
};

/**
 * Universal Key Derivation: derives a 256-bit wrapping key from a passphrase/secret.
 * Uses PBKDF2 (SHA-256) where native Argon2id module is not linked, with full Argon2id metadata support.
 */
export async function deriveKeyFromSecret(
  passphrase: string,
  saltBytes: Uint8Array,
  params: KdfParams = DEFAULT_PBKDF2_PARAMS
): Promise<Uint8Array> {
  const passphraseBytes = new TextEncoder().encode(passphrase);

  // 1. WebCrypto PBKDF2
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const importedPassphrase = await globalThis.crypto.subtle.importKey(
      'raw',
      passphraseBytes as unknown as BufferSource,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await globalThis.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes as unknown as BufferSource,
        iterations: params.iterations,
        hash: 'SHA-256',
      },
      importedPassphrase,
      params.keyLength * 8
    );

    return new Uint8Array(derivedBits);
  }

  // 2. Node.js crypto fallback
  try {
    const nodeCrypto = require('crypto');
    const derived = nodeCrypto.pbkdf2Sync(
      Buffer.from(passphraseBytes),
      Buffer.from(saltBytes),
      params.iterations,
      params.keyLength,
      'sha256'
    );
    return new Uint8Array(derived);
  } catch (err: any) {
    throw new Error(`Key derivation failed: ${err.message}`);
  }
}

/**
 * Wraps a 256-bit Vault Key using a key derived from a secret passphrase or recovery code.
 */
export async function wrapVaultKey(
  vaultKeyBytes: Uint8Array,
  secretPassphrase: string,
  params: KdfParams = DEFAULT_PBKDF2_PARAMS
): Promise<WrappedVaultKeyEnvelope> {
  const salt = getRandomBytes(16);
  const wrappingKey = await deriveKeyFromSecret(secretPassphrase, salt, params);
  const vaultKeyBase64 = bytesToBase64(vaultKeyBytes);

  const encrypted = await encryptAesGcm(wrappingKey, vaultKeyBase64, 'nyx-vault-key-wrap-v1');

  return {
    wrappedKey: encrypted.ciphertext,
    nonce: encrypted.nonce,
    salt: bytesToBase64(salt),
    kdfParams: params,
    cryptoVersion: 1,
  };
}

/**
 * Unwraps a wrapped Vault Key using the provided passphrase/recovery code and stored envelope.
 */
export async function unwrapVaultKey(
  envelope: WrappedVaultKeyEnvelope,
  secretPassphrase: string
): Promise<Uint8Array> {
  const saltBytes = base64ToBytes(envelope.salt);
  const wrappingKey = await deriveKeyFromSecret(secretPassphrase, saltBytes, envelope.kdfParams);

  const decryptedBase64 = await decryptAesGcm(
    wrappingKey,
    {
      ciphertext: envelope.wrappedKey,
      nonce: envelope.nonce,
      crypto_version: envelope.cryptoVersion,
    },
    'nyx-vault-key-wrap-v1'
  );

  return base64ToBytes(decryptedBase64);
}
