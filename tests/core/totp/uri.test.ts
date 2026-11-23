import { parseTotpUri, buildTotpUri } from '../../../src/core/totp/uri';

describe('TOTP URI Parser', () => {
  it('parses standard otpauth URI with issuer and account', () => {
    const uri = 'otpauth://totp/GitHub:mona?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30';
    const parsed = parseTotpUri(uri);

    expect(parsed.issuer).toBe('GitHub');
    expect(parsed.account).toBe('mona');
    expect(parsed.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(parsed.algorithm).toBe('SHA1');
    expect(parsed.digits).toBe(6);
    expect(parsed.period).toBe(30);
  });

  it('handles label without issuer prefix if query param exists', () => {
    const uri = 'otpauth://totp/alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Google';
    const parsed = parseTotpUri(uri);

    expect(parsed.issuer).toBe('Google');
    expect(parsed.account).toBe('alice@google.com');
  });

  it('throws error when secret is missing', () => {
    const uri = 'otpauth://totp/Example:user?issuer=Example';
    expect(() => parseTotpUri(uri)).toThrow('URI is missing required "secret" query parameter');
  });

  it('throws error on unsupported protocol type', () => {
    const uri = 'otpauth://hotp/Example:user?secret=JBSWY3DPEHPK3PXP&counter=0';
    expect(() => parseTotpUri(uri)).toThrow('Unsupported OTP type');
  });

  it('builds canonical URI from parsed object', () => {
    const built = buildTotpUri({
      issuer: 'Acme',
      account: 'test@acme.com',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA256',
      digits: 6,
      period: 30,
    });

    expect(built).toContain('otpauth://totp/Acme%3Atest%40acme.com');
    expect(built).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(built).toContain('algorithm=SHA256');
  });

  it('parses typical OpenAI / ChatGPT QR code URIs with default parameters', () => {
    const uri = 'otpauth://totp/OpenAI:alex%40openai.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=OpenAI';
    const parsed = parseTotpUri(uri);

    expect(parsed.issuer).toBe('OpenAI');
    expect(parsed.account).toBe('alex@openai.com');
    expect(parsed.secret).toBe('HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ');
    expect(parsed.algorithm).toBe('SHA1');
    expect(parsed.digits).toBe(6);
    expect(parsed.period).toBe(30);
  });

  it('normalizes algorithm variations such as SHA-1 and sha256', () => {
    const uri1 = 'otpauth://totp/Test:user?secret=JBSWY3DPEHPK3PXP&algorithm=SHA-1';
    expect(parseTotpUri(uri1).algorithm).toBe('SHA1');

    const uri2 = 'otpauth://totp/Test:user?secret=JBSWY3DPEHPK3PXP&algorithm=sha256';
    expect(parseTotpUri(uri2).algorithm).toBe('SHA256');
  });
});
