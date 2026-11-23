import { isValidBase32, sanitizeBase32, decodeBase32, encodeBase32 } from '../../../src/core/totp/base32';

describe('Base32 Decoder and Validator', () => {
  it('validates correct Base32 secrets', () => {
    expect(isValidBase32('JBSWY3DPEHPK3PXP')).toBe(true);
    expect(isValidBase32('jbswy3dpehpk3pxp')).toBe(true);
    expect(isValidBase32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')).toBe(true);
  });

  it('rejects invalid characters (0, 1, 8, 9)', () => {
    expect(isValidBase32('JBSWY3DPEHPK3PX8')).toBe(false);
    expect(isValidBase32('JBSWY3DPEHPK3PX9')).toBe(false);
    expect(isValidBase32('JBSWY3DPEHPK3PX0')).toBe(false);
    expect(isValidBase32('JBSWY3DPEHPK3PX1')).toBe(false);
    expect(isValidBase32('')).toBe(false);
  });

  it('sanitizes spaces, hyphens, and case', () => {
    expect(sanitizeBase32('jbsw y3dp ehpk 3pxp')).toBe('JBSWY3DPEHPK3PXP');
    expect(sanitizeBase32('jbsw-y3dp-ehpk-3pxp')).toBe('JBSWY3DPEHPK3PXP');
    expect(isValidBase32('HXDM-VJEC-JJWS-RB3H')).toBe(true);
    expect(decodeBase32('HXDM-VJEC-JJWS-RB3H')).toHaveLength(10);
  });

  it('correctly encodes and decodes roundtrip', () => {
    const input = new Uint8Array([72, 101, 108, 108, 111, 33]); // "Hello!"
    const encoded = encodeBase32(input);
    const decoded = decodeBase32(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(input));
  });
});
