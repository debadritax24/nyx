import { HashAlgorithm, ParsedTotpUri } from './types';
import { isValidBase32, sanitizeBase32 } from './base32';

/**
 * Parses an RFC 6238 otpauth:// URI.
 * Example: otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&algorithm=SHA1&digits=6&period=30
 */
export function parseTotpUri(uriString: string): ParsedTotpUri {
  if (!uriString || !uriString.startsWith('otpauth://')) {
    throw new Error('Invalid URI: Must start with otpauth://');
  }

  const parsedUrl = new URL(uriString);
  if (parsedUrl.host.toLowerCase() !== 'totp') {
    throw new Error(`Unsupported OTP type: ${parsedUrl.host}. NYX currently supports TOTP.`);
  }

  // Label handling: may be /Issuer:Account or just /Account
  const pathLabel = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
  let labelIssuer = '';
  let account = pathLabel;

  if (pathLabel.includes(':')) {
    const parts = pathLabel.split(':');
    labelIssuer = parts[0].trim();
    account = parts.slice(1).join(':').trim();
  }

  const params = parsedUrl.searchParams;
  const rawSecret = params.get('secret');
  if (!rawSecret) {
    throw new Error('URI is missing required "secret" query parameter');
  }

  const secret = sanitizeBase32(rawSecret);
  if (!isValidBase32(secret)) {
    throw new Error('Secret is not a valid Base32 string');
  }

  const queryIssuer = params.get('issuer')?.trim();
  const issuer = queryIssuer || labelIssuer || 'Unknown';

  const rawAlgo = (params.get('algorithm') || 'SHA1').toUpperCase().replace('-', '');
  let algorithm: HashAlgorithm = 'SHA1';
  if (rawAlgo === 'SHA256') algorithm = 'SHA256';
  else if (rawAlgo === 'SHA512') algorithm = 'SHA512';
  else if (rawAlgo === 'SHA1') algorithm = 'SHA1';
  else {
    throw new Error(`Unsupported algorithm: ${rawAlgo}`);
  }

  const digits = parseInt(params.get('digits') || '6', 10);
  if (isNaN(digits) || digits < 6 || digits > 8) {
    throw new Error(`Invalid digits count: ${digits}. Must be between 6 and 8.`);
  }

  const period = parseInt(params.get('period') || '30', 10);
  if (isNaN(period) || period <= 0) {
    throw new Error(`Invalid period: ${period}. Must be greater than 0.`);
  }

  return {
    issuer,
    account,
    secret,
    algorithm,
    digits,
    period,
  };
}

/**
 * Serializes TOTP parameters into a standard otpauth:// URI string.
 */
export function buildTotpUri(params: ParsedTotpUri): string {
  const label = encodeURIComponent(`${params.issuer}:${params.account}`);
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: params.algorithm,
    digits: params.digits.toString(),
    period: params.period.toString(),
  });

  return `otpauth://totp/${label}?${query.toString()}`;
}
