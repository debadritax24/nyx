export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded ciphertext + 128-bit auth tag
  nonce: string; // Base64 encoded 96-bit (12-byte) IV
  crypto_version: number;
}

export interface KdfParams {
  algorithm: 'argon2id' | 'pbkdf2';
  iterations: number;
  memory?: number;
  parallelism?: number;
  keyLength: number;
}

export interface WrappedVaultKeyEnvelope {
  wrappedKey: string; // Base64
  nonce: string; // Base64
  salt: string; // Base64
  kdfParams: KdfParams;
  cryptoVersion: number;
}

export interface DecryptedAccountRecord {
  id: string;
  vault_id?: string;
  issuer: string;
  account_name: string;
  secret: string; // Base32
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  digits: number;
  period: number;
  version: number; // Concurrency version
  deleted_at?: string | null; // Soft delete tombstone
  created_at: string;
  updated_at: string;
}
