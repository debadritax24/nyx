import { EncryptedPayload } from './types';

export const CURRENT_CRYPTO_VERSION = 1;

/**
 * Returns a cryptographically secure random buffer of specified byte length.
 */
export function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }
  try {
    const nodeCrypto = require('crypto');
    return new Uint8Array(nodeCrypto.randomBytes(length));
  } catch {
    throw new Error('No cryptographically secure random number generator available.');
  }
}

/**
 * Generates a fresh 256-bit (32-byte) symmetric Vault Key.
 */
export function generateVaultKey(): Uint8Array {
  return getRandomBytes(32);
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts a plaintext string using AES-256-GCM under the provided 256-bit key.
 * Always generates a fresh 96-bit (12-byte) nonce.
 */
export async function encryptAesGcm(
  keyBytes: Uint8Array,
  plaintext: string,
  associatedData?: string
): Promise<EncryptedPayload> {
  if (keyBytes.length !== 32) {
    throw new Error('Invalid key length: AES-256 requires a 32-byte key');
  }

  const nonce = getRandomBytes(12);
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const aadBytes = associatedData ? new TextEncoder().encode(associatedData) : undefined;

  // 1. WebCrypto
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBytes as unknown as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const ciphertextBuffer = await globalThis.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce as unknown as BufferSource,
        additionalData: aadBytes as unknown as BufferSource,
        tagLength: 128,
      },
      cryptoKey,
      plaintextBytes as unknown as BufferSource
    );

    return {
      ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
      nonce: bytesToBase64(nonce),
      crypto_version: CURRENT_CRYPTO_VERSION,
    };
  }

  // 2. Node.js crypto fallback
  try {
    const nodeCrypto = require('crypto');
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', Buffer.from(keyBytes), Buffer.from(nonce), {
      authTagLength: 16,
    });
    if (aadBytes) {
      cipher.setAAD(Buffer.from(aadBytes));
    }
    const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintextBytes)), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([encrypted, tag]);

    return {
      ciphertext: combined.toString('base64'),
      nonce: bytesToBase64(nonce),
      crypto_version: CURRENT_CRYPTO_VERSION,
    };
  } catch (err: any) {
    throw new Error(`AES-GCM encryption failed: ${err.message}`);
  }
}

/**
 * Decrypts an AES-256-GCM ciphertext payload and verifies its authentication tag.
 */
export async function decryptAesGcm(
  keyBytes: Uint8Array,
  payload: EncryptedPayload,
  associatedData?: string
): Promise<string> {
  if (keyBytes.length !== 32) {
    throw new Error('Invalid key length: AES-256 requires a 32-byte key');
  }

  const nonceBytes = base64ToBytes(payload.nonce);
  const ciphertextWithTagBytes = base64ToBytes(payload.ciphertext);
  const aadBytes = associatedData ? new TextEncoder().encode(associatedData) : undefined;

  // 1. WebCrypto
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBytes as unknown as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonceBytes as unknown as BufferSource,
        additionalData: aadBytes as unknown as BufferSource,
        tagLength: 128,
      },
      cryptoKey,
      ciphertextWithTagBytes as unknown as BufferSource
    );

    return new TextDecoder().decode(decryptedBuffer);
  }

  // 2. Node.js crypto fallback
  try {
    const nodeCrypto = require('crypto');
    const tagLength = 16;
    if (ciphertextWithTagBytes.length < tagLength) {
      throw new Error('Invalid ciphertext length');
    }

    const ciphertext = ciphertextWithTagBytes.subarray(0, ciphertextWithTagBytes.length - tagLength);
    const tag = ciphertextWithTagBytes.subarray(ciphertextWithTagBytes.length - tagLength);

    const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', Buffer.from(keyBytes), Buffer.from(nonceBytes), {
      authTagLength: 16,
    });
    decipher.setAuthTag(Buffer.from(tag));
    if (aadBytes) {
      decipher.setAAD(Buffer.from(aadBytes));
    }

    const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err: any) {
    throw new Error(`AES-GCM decryption failed / authentication tag mismatch: ${err.message}`);
  }
}
