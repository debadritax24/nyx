import {
  generateRecoveryCode,
  validateRecoveryCode,
  normalizeRecoveryCode,
  wrapVaultKeyWithRecoveryCode,
  unwrapVaultKeyWithRecoveryCode,
} from '../../../src/core/crypto/recovery';
import { generateVaultKey } from '../../../src/core/crypto/vault';

describe('Emergency Recovery Code & Key Wrapping', () => {
  it('generates a valid 24-word recovery code', () => {
    const code = generateRecoveryCode();
    expect(typeof code).toBe('string');
    const words = code.split(' ');
    expect(words).toHaveLength(24);
    expect(validateRecoveryCode(code)).toBe(true);
  });

  it('rejects malformed recovery codes', () => {
    expect(validateRecoveryCode('')).toBe(false);
    expect(validateRecoveryCode('abandon ability able')).toBe(false); // Only 3 words
    expect(validateRecoveryCode('abandon '.repeat(25).trim())).toBe(false); // 25 words
    expect(validateRecoveryCode('abandon1 ability2 able3 '.repeat(8).trim())).toBe(false); // Numbers
  });

  it('normalizes recovery code spacing and case', () => {
    const dirty = '  ABANDON   ability   ABLE  ';
    const normalized = normalizeRecoveryCode(dirty);
    expect(normalized).toBe('abandon ability able');
  });

  it('wraps and unwraps Vault Key using 24-word recovery code', async () => {
    const vaultKey = generateVaultKey();
    const recoveryCode = generateRecoveryCode();

    const envelope = await wrapVaultKeyWithRecoveryCode(vaultKey, recoveryCode);
    expect(envelope.wrappedKey).toBeDefined();
    expect(envelope.salt).toBeDefined();

    const unwrapped = await unwrapVaultKeyWithRecoveryCode(envelope, recoveryCode);
    expect(Array.from(unwrapped)).toEqual(Array.from(vaultKey));
  });

  it('fails unwrapping when recovery code has altered words', async () => {
    const vaultKey = generateVaultKey();
    const recoveryCode = generateRecoveryCode();
    const envelope = await wrapVaultKeyWithRecoveryCode(vaultKey, recoveryCode);

    const words = recoveryCode.split(' ');
    words[0] = words[0] === 'apple' ? 'banana' : 'apple';
    const tamperedCode = words.join(' ');

    await expect(unwrapVaultKeyWithRecoveryCode(envelope, tamperedCode)).rejects.toThrow();
  });
});
