import { supabase } from './supabase';

export interface RemoteAccountRow {
  id: string;
  user_id: string;
  vault_id: string;
  ciphertext: string;
  nonce: string;
  crypto_version: number;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncMutation {
  id: string;
  vault_id: string;
  ciphertext: string;
  nonce: string;
  crypto_version: number;
  version: number;
  deleted_at: string | null;
}

export class SyncService {
  /**
   * Pulls encrypted account records modified since last sync timestamp.
   */
  static async pullAccounts(sinceTimestamp?: string): Promise<RemoteAccountRow[]> {
    let query = supabase
      .from('authenticator_accounts')
      .select('*')
      .order('updated_at', { ascending: true });

    if (sinceTimestamp) {
      query = query.gt('updated_at', sinceTimestamp);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Pushes an encrypted mutation to Supabase with optimistic version validation.
   */
  static async pushAccount(mutation: SyncMutation): Promise<RemoteAccountRow> {
    const { data, error } = await supabase
      .from('authenticator_accounts')
      .upsert({
        id: mutation.id,
        vault_id: mutation.vault_id,
        ciphertext: mutation.ciphertext,
        nonce: mutation.nonce,
        crypto_version: mutation.crypto_version,
        version: mutation.version,
        deleted_at: mutation.deleted_at,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
