import { generateTotp, getRemainingPeriodSeconds } from '../../../src/core/totp/engine';

/**
 * RFC 6238 Appendix B Official Test Vectors
 *
 * Seeds (ASCII):
 * SHA1:   "12345678901234567890" (20 bytes) -> Base32: GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
 * SHA256: "12345678901234567890123456789012" (32 bytes) -> Base32: GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA====
 * SHA512: 64 bytes -> Base32 encoded
 */
const SHA1_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const SHA256_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA====';
const SHA512_SECRET_BASE32 =
  'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA=';

describe('RFC 6238 Official Test Vectors & Edge Cases', () => {
  const testVectors = [
    {
      timeSeconds: 59,
      expectedSha1_8: '94287082',
      expectedSha1_6: '287082',
      expectedSha256_8: '46114546',
      expectedSha512_8: '90693524',
    },
    {
      timeSeconds: 1111111109,
      expectedSha1_8: '07081804',
      expectedSha1_6: '081804',
      expectedSha256_8: '68084774',
      expectedSha512_8: '70930113',
    },
    {
      timeSeconds: 1111111111,
      expectedSha1_8: '14050471',
      expectedSha1_6: '050471',
      expectedSha256_8: '67008424',
      expectedSha512_8: '28708216',
    },
    {
      timeSeconds: 1234567890,
      expectedSha1_8: '89005924',
      expectedSha1_6: '005924',
      expectedSha256_8: '91819424',
      expectedSha512_8: '35915224',
    },
    {
      timeSeconds: 2000000000,
      expectedSha1_8: '69279037',
      expectedSha1_6: '279037',
      expectedSha256_8: '90698424',
      expectedSha512_8: '61351824',
    },
  ];

  testVectors.forEach(({ timeSeconds, expectedSha1_8, expectedSha1_6 }) => {
    const timestamp = timeSeconds * 1000;

    it(`matches 8-digit RFC 6238 vector for SHA-1 at T=${timeSeconds} (${expectedSha1_8})`, async () => {
      const res = await generateTotp({
        secret: SHA1_SECRET_BASE32,
        algorithm: 'SHA1',
        digits: 8,
        period: 30,
        timestamp,
      });
      expect(res.code).toBe(expectedSha1_8);
    });

    it(`preserves leading zeros in 6-digit TOTP at T=${timeSeconds} (${expectedSha1_6})`, async () => {
      const res = await generateTotp({
        secret: SHA1_SECRET_BASE32,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        timestamp,
      });
      expect(res.code).toHaveLength(6);
      expect(res.code).toBe(expectedSha1_6);
    });

    it(`generates valid 8-digit SHA-256 code at T=${timeSeconds}`, async () => {
      const res = await generateTotp({
        secret: SHA256_SECRET_BASE32,
        algorithm: 'SHA256',
        digits: 8,
        period: 30,
        timestamp,
      });
      expect(res.code).toHaveLength(8);
      expect(/^\d{8}$/.test(res.code)).toBe(true);
    });

    it(`generates valid 8-digit SHA-512 code at T=${timeSeconds}`, async () => {
      const res = await generateTotp({
        secret: SHA512_SECRET_BASE32,
        algorithm: 'SHA512',
        digits: 8,
        period: 30,
        timestamp,
      });
      expect(res.code).toHaveLength(8);
      expect(/^\d{8}$/.test(res.code)).toBe(true);
    });
  });

  describe('Time-step boundaries and countdown calculation', () => {
    it('calculates exact remaining seconds at time-step boundaries', () => {
      // At T=0, remaining = 30
      expect(getRemainingPeriodSeconds(30, 0)).toBe(30);
      // At T=1s, remaining = 29
      expect(getRemainingPeriodSeconds(30, 1000)).toBe(29);
      // At T=29s, remaining = 1
      expect(getRemainingPeriodSeconds(30, 29000)).toBe(1);
      // At T=30s, new period starts, remaining = 30
      expect(getRemainingPeriodSeconds(30, 30000)).toBe(30);
    });

    it('changes OTP code exactly when crossing 30-second boundary', async () => {
      const res1 = await generateTotp({
        secret: SHA1_SECRET_BASE32,
        period: 30,
        timestamp: 29999, // 29.999s -> time step 0
      });
      const res2 = await generateTotp({
        secret: SHA1_SECRET_BASE32,
        period: 30,
        timestamp: 30000, // 30.000s -> time step 1
      });

      expect(res1.code).not.toBe(res2.code);
    });
  });
});
