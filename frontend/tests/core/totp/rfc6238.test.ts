import { generateTotp } from '../../../src/core/totp/engine';

/**
 * RFC 6238 Appendix B Official Test Vectors
 */
const SHA1_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const SHA256_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA====';

describe('RFC 6238 Official Test Vectors', () => {
  const testVectors = [
    { timeSeconds: 59, expectedSha1: '287082' },
    { timeSeconds: 1111111109, expectedSha1: '081804' },
    { timeSeconds: 1111111111, expectedSha1: '050471' },
    { timeSeconds: 1234567890, expectedSha1: '005924' },
    { timeSeconds: 2000000000, expectedSha1: '279037' },
  ];

  testVectors.forEach(({ timeSeconds, expectedSha1 }) => {
    const timestamp = timeSeconds * 1000;

    it(`matches 8-digit RFC 6238 test vector at T=${timeSeconds} for SHA-1`, async () => {
      const rfc8Digits: Record<number, string> = {
        59: '94287082',
        1111111109: '07081804',
        1111111111: '14050471',
        1234567890: '89005924',
        2000000000: '69279037',
      };

      const res = await generateTotp({
        secret: SHA1_SECRET_BASE32,
        algorithm: 'SHA1',
        digits: 8,
        period: 30,
        timestamp,
      });

      expect(res.code).toBe(rfc8Digits[timeSeconds]);
    });

    it(`generates 8-digit RFC 6238 code at T=${timeSeconds} for SHA-256`, async () => {
      const res = await generateTotp({
        secret: SHA256_SECRET_BASE32,
        algorithm: 'SHA256',
        digits: 8,
        period: 30,
        timestamp,
      });

      expect(res.code).toHaveLength(8);
    });

    it(`generates standard 6-digit TOTP code for SHA-1 at T=${timeSeconds}`, async () => {
      const res = await generateTotp({
        secret: SHA1_SECRET_BASE32,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        timestamp,
      });
      expect(res.code).toHaveLength(6);
      expect(res.code).toBe(expectedSha1);
    });
  });
});
