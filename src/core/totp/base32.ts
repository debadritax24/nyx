/**
 * RFC 4648 Base32 Decoder and Validator
 * Handles standard A-Z, 2-7 character set with optional '=' padding.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function sanitizeBase32(secret: string): string {
  if (!secret || typeof secret !== 'string') return '';
  return secret.replace(/[\s-]+/g, '').toUpperCase();
}

export function isValidBase32(secret: string): boolean {
  if (!secret || typeof secret !== 'string') return false;
  const sanitized = sanitizeBase32(secret).replace(/=+$/, '');
  if (sanitized.length === 0) return false;
  for (let i = 0; i < sanitized.length; i++) {
    if (BASE32_ALPHABET.indexOf(sanitized[i]) === -1) {
      return false;
    }
  }
  return true;
}

export function decodeBase32(secret: string): Uint8Array {
  if (!secret || typeof secret !== 'string') {
    throw new Error('Invalid Base32 secret: secret is empty or not a valid string');
  }
  const sanitized = sanitizeBase32(secret).replace(/=+$/, '');
  if (!isValidBase32(sanitized)) {
    throw new Error('Invalid Base32 secret string: contains invalid characters');
  }

  let bits = 0;
  let value = 0;
  let outputIndex = 0;
  const output = new Uint8Array(Math.floor((sanitized.length * 5) / 8));

  for (let i = 0; i < sanitized.length; i++) {
    const val = BASE32_ALPHABET.indexOf(sanitized[i]);
    if (val === -1) {
      throw new Error(`Invalid Base32 character: ${sanitized[i]}`);
    }
    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output[outputIndex++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }

  return output.subarray(0, outputIndex);
}

export function encodeBase32(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  while (output.length % 8 !== 0) {
    output += '=';
  }

  return output;
}
