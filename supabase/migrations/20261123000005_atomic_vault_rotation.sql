-- =============================================================================
-- NYX FORWARD MIGRATION: ATOMIC VAULT KEY ROTATION TRANSACTION PROCEDURE
-- Version: 20261123000005
-- Description: Creates sync_rotate_vault stored procedure to atomically migrate
--              the vault envelope and all re-encrypted accounts in a single
--              PostgreSQL transaction, eliminating partial cloud-commit states.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_rotate_vault(
  p_vault_id UUID,
  p_passphrase_wrapped_vault_key TEXT,
  p_passphrase_wrap_nonce TEXT,
  p_passphrase_kdf_salt TEXT,
  p_passphrase_kdf_params JSONB,
  p_recovery_wrapped_vault_key TEXT,
  p_recovery_wrap_nonce TEXT,
  p_recovery_kdf_salt TEXT,
  p_recovery_kdf_params JSONB,
  p_accounts JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_vault_owner UUID;
  v_acc JSONB;
  v_acc_id UUID;
  v_expected_version INTEGER;
  v_next_version INTEGER;
  v_ciphertext TEXT;
  v_nonce TEXT;
  v_crypto_version INTEGER;
  v_deleted_at TIMESTAMPTZ;
  v_existing public.authenticator_accounts%ROWTYPE;
  v_updated_count INTEGER := 0;
BEGIN
  -- 1. Identify and authenticate user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not authenticated' USING ERRCODE = '42501';
  END IF;

  -- 2. Verify and lock the target vault row with FOR UPDATE
  SELECT user_id INTO v_vault_owner
  FROM public.vaults
  WHERE id = p_vault_id
  FOR UPDATE;

  IF v_vault_owner IS NULL OR v_vault_owner <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Target vault % does not exist or does not belong to user %',
      p_vault_id, v_user_id
      USING ERRCODE = '42501';
  END IF;

  -- 3. Atomically validate and update every account in p_accounts
  IF p_accounts IS NOT NULL AND jsonb_typeof(p_accounts) = 'array' THEN
    FOR v_acc IN SELECT * FROM jsonb_array_elements(p_accounts)
    LOOP
      v_acc_id := (v_acc->>'id')::UUID;
      v_expected_version := (v_acc->>'expected_version')::INTEGER;
      v_next_version := (v_acc->>'next_version')::INTEGER;
      v_ciphertext := v_acc->>'ciphertext';
      v_nonce := v_acc->>'nonce';
      v_crypto_version := COALESCE((v_acc->>'crypto_version')::INTEGER, 1);
      v_deleted_at := (v_acc->>'deleted_at')::TIMESTAMPTZ;

      IF v_acc_id IS NULL OR v_expected_version IS NULL OR v_next_version IS NULL OR v_ciphertext IS NULL OR v_nonce IS NULL THEN
        RAISE EXCEPTION 'Invalid account mutation payload in rotation batch' USING ERRCODE = '22023';
      END IF;

      -- Lock existing account row
      SELECT * INTO v_existing
      FROM public.authenticator_accounts
      WHERE id = v_acc_id AND user_id = v_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Concurrency conflict on rotation: Account % not found for user %',
          v_acc_id, v_user_id
          USING ERRCODE = '23514';
      END IF;

      -- Strict version check: must match expected_version
      IF v_existing.version != v_expected_version THEN
        RAISE EXCEPTION 'Concurrency conflict on rotation: Expected version % but found version % on account %',
          v_expected_version, v_existing.version, v_acc_id
          USING ERRCODE = '23514';
      END IF;

      -- Update the account record with re-encrypted ciphertext and incremented version
      UPDATE public.authenticator_accounts
      SET ciphertext = v_ciphertext,
          nonce = v_nonce,
          crypto_version = v_crypto_version,
          version = v_next_version,
          deleted_at = v_deleted_at,
          updated_at = now()
      WHERE id = v_acc_id AND user_id = v_user_id;

      v_updated_count := v_updated_count + 1;
    END LOOP;
  END IF;

  -- 4. Atomically update the vault envelope with new wrapped keys
  UPDATE public.vaults
  SET passphrase_wrapped_vault_key = p_passphrase_wrapped_vault_key,
      passphrase_wrap_nonce = p_passphrase_wrap_nonce,
      passphrase_kdf_salt = p_passphrase_kdf_salt,
      passphrase_kdf_params = p_passphrase_kdf_params,
      recovery_wrapped_vault_key = p_recovery_wrapped_vault_key,
      recovery_wrap_nonce = p_recovery_wrap_nonce,
      recovery_kdf_salt = p_recovery_kdf_salt,
      recovery_kdf_params = p_recovery_kdf_params,
      updated_at = now()
  WHERE id = p_vault_id AND user_id = v_user_id;

  -- 5. Return success confirmation
  RETURN jsonb_build_object(
    'success', true,
    'vault_id', p_vault_id,
    'migrated_accounts', v_updated_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Explicitly grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.sync_rotate_vault TO authenticated;
