import { supabase } from './supabase';
import { WrappedVaultKeyEnvelope } from '../core/crypto';

export interface RemoteVaultRow {
  id: string;
  user_id: string;
  passphrase_wrapped_vault_key: string;
  passphrase_wrap_nonce: string;
  passphrase_kdf_salt: string;
  passphrase_kdf_params: any;
  recovery_wrapped_vault_key: string;
  recovery_wrap_nonce: string;
  recovery_kdf_salt: string;
  recovery_kdf_params: any;
  crypto_version: number;
  created_at: string;
  updated_at: string;
}

export class VaultService {
  /**
   * Retrieves the user's remote vault envelope from Supabase.
   */
  static async getRemoteVault(userId: string): Promise<RemoteVaultRow | null> {
    const { data, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Uploads freshly wrapped Vault Keys during vault initialization.
   */
  static async uploadVaultEnvelope(
    userId: string,
    passphraseEnvelope: WrappedVaultKeyEnvelope,
    recoveryEnvelope: WrappedVaultKeyEnvelope
  ): Promise<RemoteVaultRow> {
    const { data, error } = await supabase
      .from('vaults')
      .insert({
        user_id: userId,
        passphrase_wrapped_vault_key: passphraseEnvelope.wrappedKey,
        passphrase_wrap_nonce: passphraseEnvelope.nonce,
        passphrase_kdf_salt: passphraseEnvelope.salt,
        passphrase_kdf_params: passphraseEnvelope.kdfParams,
        recovery_wrapped_vault_key: recoveryEnvelope.wrappedKey,
        recovery_wrap_nonce: recoveryEnvelope.nonce,
        recovery_kdf_salt: recoveryEnvelope.salt,
        recovery_kdf_params: recoveryEnvelope.kdfParams,
        crypto_version: 1,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
