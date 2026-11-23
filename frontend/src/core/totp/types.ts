export type HashAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface TotpOptions {
  secret: string; // Base32 encoded secret
  algorithm?: HashAlgorithm;
  digits?: number;
  period?: number;
  timestamp?: number; // Milliseconds since epoch
}

export interface TotpResult {
  code: string;
  remainingSeconds: number;
  period: number;
}

export interface ParsedTotpUri {
  issuer: string;
  account: string;
  secret: string;
  algorithm: HashAlgorithm;
  digits: number;
  period: number;
}
