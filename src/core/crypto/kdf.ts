import { argon2id as nobleArgon2id } from '@noble/hashes/argon2.js';
import { KdfParams, WrappedVaultKeyEnvelope } from './types';
import { getRandomBytes, bytesToBase64, base64ToBytes, encryptAesGcm, decryptAesGcm } from './vault';

export const DEFAULT_ARGON2_PARAMS: KdfParams = {
  algorithm: 'argon2id',
  iterations: 3,
  memory: 65536, // 64 MB
  parallelism: 1, // Standard parallelism for mobile WebAssembly execution
  keyLength: 32, // 256 bits
};

export const DEFAULT_PBKDF2_PARAMS: KdfParams = {
  algorithm: 'pbkdf2',
  iterations: 100000,
  keyLength: 32,
};

/**
 * Derives a 256-bit symmetric key using Argon2id (RFC 9106).
 * Priority:
 * 1. WebAssembly acceleration via `hash-wasm` when WebAssembly is supported (Node, Web).
 * 2. Pure JavaScript RFC 9106 Argon2id via `@noble/hashes/argon2` when WebAssembly is unavailable
 *    (e.g., in React Native / Expo Go on Android Hermes engine).
 * Strict: Never silently falls back to another algorithm (like PBKDF2). Always executes RFC 9106 Argon2id.
 */
export async function deriveKeyArgon2id(
  passphrase: string,
  saltBytes: Uint8Array,
  params: KdfParams = DEFAULT_ARGON2_PARAMS
): Promise<Uint8Array> {
  const iterations = params.iterations || (params as any).t || 3;
  const memory = params.memory || (params as any).m || 65536;
  const parallelism = params.parallelism || (params as any).p || 1;
  const keyLength = params.keyLength || 32;

  // 1. Try WebAssembly acceleration if available
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).WebAssembly !== 'undefined') {
    try {
      const { argon2id } = require('hash-wasm');
      const derived = await argon2id({
        password: passphrase,
        salt: saltBytes,
        iterations,
        memorySize: memory,
        parallelism,
        hashLength: keyLength,
        outputType: 'binary',
      });
      return new Uint8Array(derived);
    } catch {
      // If WebAssembly compilation/instantiation fails, proceed to pure JS Argon2id
    }
  }

  // 2. Pure JavaScript RFC 9106 Argon2id via @noble/hashes (Hermes / React Native mobile runtime)
  try {
    const derived = nobleArgon2id(passphrase, saltBytes, {
      t: iterations,
      m: memory,
      p: parallelism,
      dkLen: keyLength,
    });
    return new Uint8Array(derived);
  } catch (err: any) {
    throw new Error(
      `Argon2id key derivation failed: ${err.message}. Cryptographic algorithm fallback is strictly prohibited.`
    );
  }
}

/**
 * Universal PBKDF2-SHA256 derivation.
 */
export async function deriveKeyPbkdf2(
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
    throw new Error(`PBKDF2 derivation failed: ${err.message}`);
  }
}

/**
 * Main key derivation entry point. Dispatches strictly based on requested algorithm.
 * Never silently changes or downgrades the algorithm.
 */
export async function deriveKeyFromSecret(
  passphrase: string,
  saltBytes: Uint8Array,
  params: KdfParams = DEFAULT_ARGON2_PARAMS
): Promise<Uint8Array> {
  if (params.algorithm === 'argon2id') {
    return deriveKeyArgon2id(passphrase, saltBytes, params);
  }
  if (params.algorithm === 'pbkdf2') {
    return deriveKeyPbkdf2(passphrase, saltBytes, params);
  }
  throw new Error(`Unsupported or prohibited key derivation algorithm: ${params.algorithm}`);
}

/**
 * Wraps a 256-bit Vault Key using a key derived from a secret passphrase or recovery code.
 */
export async function wrapVaultKey(
  vaultKeyBytes: Uint8Array,
  secretPassphrase: string,
  params: KdfParams = DEFAULT_ARGON2_PARAMS
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
