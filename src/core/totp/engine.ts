import { HashAlgorithm, TotpOptions, TotpResult } from './types';
import { decodeBase32 } from './base32';
import { hmac } from '@noble/hashes/hmac.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';

/**
 * Universal RFC HMAC calculation supporting SHA-1, SHA-256, and SHA-512.
 * Executes pure JavaScript RFC HMAC via @noble/hashes for 100% deterministic,
 * synchronous execution across React Native Hermes, Node.js, and web browsers.
 */
export function computeHmacSync(
  algorithm: HashAlgorithm,
  keyBytes: Uint8Array,
  messageBytes: Uint8Array
): Uint8Array {
  const normalizedAlgo = (algorithm || 'SHA1').toUpperCase().replace('-', '');

  if (normalizedAlgo === 'SHA1') {
    return hmac(sha1, keyBytes, messageBytes);
  } else if (normalizedAlgo === 'SHA256') {
    return hmac(sha256, keyBytes, messageBytes);
  } else if (normalizedAlgo === 'SHA512') {
    return hmac(sha512, keyBytes, messageBytes);
  }

  throw new Error(`Unsupported algorithm: ${algorithm}. Must be SHA1, SHA256, or SHA512.`);
}

export async function computeHmac(
  algorithm: HashAlgorithm,
  keyBytes: Uint8Array,
  messageBytes: Uint8Array
): Promise<Uint8Array> {
  return computeHmacSync(algorithm, keyBytes, messageBytes);
}

/**
 * Generates an RFC 6238 TOTP code synchronously given a Base32 secret and parameters.
 */
export function generateTotpSync(options: TotpOptions): TotpResult {
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

  const hmacResult = computeHmacSync(algorithm, keyBytes, counterBytes);

  // Dynamic Truncation (RFC 4226 Section 5.4)
  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, numDigits);
  const code = otp.toString().padStart(numDigits, '0');

  return {
    code,
    remainingSeconds,
    period: numPeriod,
  };
}

/**
 * Generates an RFC 6238 TOTP code given a Base32 secret and parameters (async interface).
 */
export async function generateTotp(options: TotpOptions): Promise<TotpResult> {
  return generateTotpSync(options);
}

/**
 * Calculates remaining seconds in the current period without computing HMAC.
 */
export function getRemainingPeriodSeconds(period: number = 30, timestamp: number = Date.now()): number {
  const epochSeconds = Math.floor(timestamp / 1000);
  const remainder = epochSeconds % period;
  return remainder === 0 ? period : period - remainder;
}
