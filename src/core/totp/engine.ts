import { HashAlgorithm, TotpOptions, TotpResult } from './types';
import { decodeBase32 } from './base32';
import { hmac } from '@noble/hashes/hmac.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';

/**
 * Universal HMAC calculation supporting SHA-1, SHA-256, and SHA-512
 * Uses Web Crypto API (SubtleCrypto) where available, falling back to Node.js crypto,
 * and pure JavaScript RFC HMAC via @noble/hashes for React Native / Hermes mobile runtime.
 */
async function computeHmac(
  algorithm: HashAlgorithm,
  keyBytes: Uint8Array,
  messageBytes: Uint8Array
): Promise<Uint8Array> {
  const normalizedAlgo = (algorithm || 'SHA1').toUpperCase().replace('-', '') as 'SHA1' | 'SHA256' | 'SHA512';
  const algoName = normalizedAlgo === 'SHA1' ? 'SHA-1' : normalizedAlgo === 'SHA256' ? 'SHA-256' : 'SHA-512';

  // 1. Check if global crypto.subtle is available (Browsers, Expo WebCrypto, modern React Native)
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    try {
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        keyBytes as unknown as BufferSource,
        { name: 'HMAC', hash: { name: algoName } },
        false,
        ['sign']
      );
      const signature = await globalThis.crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageBytes as unknown as BufferSource
      );
      return new Uint8Array(signature);
    } catch {}
  }

  // 2. Node.js environment fallback (for Jest unit test execution)
  try {
    const nodeCrypto = require('crypto');
    if (nodeCrypto && typeof nodeCrypto.createHmac === 'function') {
      const nodeAlgo = normalizedAlgo.toLowerCase();
      const nodeHmac = nodeCrypto.createHmac(nodeAlgo, Buffer.from(keyBytes));
      nodeHmac.update(Buffer.from(messageBytes));
      return new Uint8Array(nodeHmac.digest());
    }
  } catch {}

  // 3. Pure JavaScript RFC HMAC via @noble/hashes (Hermes / React Native mobile)
  if (normalizedAlgo === 'SHA1') {
    return hmac(sha1, keyBytes, messageBytes);
  } else if (normalizedAlgo === 'SHA256') {
    return hmac(sha256, keyBytes, messageBytes);
  } else if (normalizedAlgo === 'SHA512') {
    return hmac(sha512, keyBytes, messageBytes);
  }

  throw new Error(`SubtleCrypto, Node crypto, and pure JS HMAC unavailable for ${algorithm} HMAC computation`);
}

/**
 * Generates an RFC 6238 TOTP code given a Base32 secret and parameters.
 */
export async function generateTotp(options: TotpOptions): Promise<TotpResult> {
  const {
    secret,
    algorithm = 'SHA1',
    digits = 6,
    period = 30,
    timestamp = Date.now(),
  } = options;

  const numDigits = Number(digits) || 6;
  const numPeriod = Number(period) || 30;

  const keyBytes = decodeBase32(secret);
  const epochSeconds = Math.floor(timestamp / 1000);
  const timeStep = Math.floor(epochSeconds / numPeriod);
  const remainingSeconds = numPeriod - (epochSeconds % numPeriod);

  // Convert time step to 8-byte big-endian buffer (RFC 4226)
  const counterBytes = new Uint8Array(8);
  let tempStep = BigInt(timeStep);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = Number(tempStep & BigInt(0xff));
    tempStep >>= BigInt(8);
  }

  const hmac = await computeHmac(algorithm, keyBytes, counterBytes);

  // Dynamic Truncation (RFC 4226 Section 5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, numDigits);
  const code = otp.toString().padStart(numDigits, '0');

  return {
    code,
    remainingSeconds,
    period: numPeriod,
  };
}

/**
 * Calculates remaining seconds in the current period without computing HMAC.
 */
export function getRemainingPeriodSeconds(period: number = 30, timestamp: number = Date.now()): number {
  const epochSeconds = Math.floor(timestamp / 1000);
  const remainder = epochSeconds % period;
  return remainder === 0 ? period : period - remainder;
}
