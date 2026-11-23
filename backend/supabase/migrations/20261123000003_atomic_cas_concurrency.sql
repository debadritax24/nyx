-- =============================================================================
-- NYX FORWARD MIGRATION: ATOMIC COMPARE-AND-SWAP (CAS) OPTIMISTIC CONCURRENCY
-- Version: 20261123000003
-- Description: Implements atomic CAS database function with row locking (FOR UPDATE)
--              to prevent stale writes and guarantee deterministic concurrency control.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_push_account(
  p_id UUID,
  p_vault_id UUID,
  p_ciphertext TEXT,
  p_nonce TEXT,
  p_crypto_version INTEGER,
  p_expected_version INTEGER,
  p_next_version INTEGER,
  p_deleted_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.authenticator_accounts AS $$
DECLARE
  v_user_id UUID;
  v_existing public.authenticator_accounts%ROWTYPE;
  v_result public.authenticator_accounts%ROWTYPE;
BEGIN
  -- 1. Identify and authenticate user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not authenticated' USING ERRCODE = '42501';
  END IF;

  -- 2. Verify vault ownership
  IF NOT EXISTS (SELECT 1 FROM public.vaults WHERE id = p_vault_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: Vault does not belong to the authenticated user' USING ERRCODE = '42501';
  END IF;

  -- 3. Check for existing record with row-level lock (FOR UPDATE)
  SELECT * INTO v_existing
  FROM public.authenticator_accounts
  WHERE id = p_id AND user_id = v_user_id
  FOR UPDATE;

  IF FOUND THEN
    -- Existing Record Update Path
    -- Compare-And-Swap Verification: Expected version must strictly match database version
    IF v_existing.version != p_expected_version THEN
      RAISE EXCEPTION 'Concurrency conflict: Expected version % but found version % on record %',
        p_expected_version, v_existing.version, p_id
        USING ERRCODE = '23514'; -- check_violation
    END IF;

    -- Monotonic increment check
    IF p_next_version <= v_existing.version THEN
      RAISE EXCEPTION 'Concurrency conflict: Next version % must be strictly greater than current version %',
        p_next_version, v_existing.version
        USING ERRCODE = '23514';
    END IF;

    -- Execute Atomic Update
    UPDATE public.authenticator_accounts
    SET vault_id = p_vault_id,
        ciphertext = p_ciphertext,
        nonce = p_nonce,
        crypto_version = p_crypto_version,
        version = p_next_version,
        deleted_at = p_deleted_at,
        updated_at = now()
    WHERE id = p_id AND user_id = v_user_id
    RETURNING * INTO v_result;

    RETURN v_result;

  ELSE
    -- Brand New Record Insertion Path
    -- If client expected this record to already exist, raise concurrency conflict
    IF p_expected_version > 0 THEN
      RAISE EXCEPTION 'Concurrency conflict: Record % does not exist (expected version %)',
        p_id, p_expected_version
        USING ERRCODE = '23514';
    END IF;

    -- Execute Insert
    INSERT INTO public.authenticator_accounts (
      id,
      user_id,
      vault_id,
      ciphertext,
      nonce,
      crypto_version,
      version,
      deleted_at,
      created_at,
      updated_at
    ) VALUES (
      p_id,
      v_user_id,
      p_vault_id,
      p_ciphertext,
      p_nonce,
      p_crypto_version,
      GREATEST(p_next_version, 1),
      p_deleted_at,
      now(),
      now()
    )
    RETURNING * INTO v_result;

    RETURN v_result;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.sync_push_account TO authenticated;

-- Grant table-level CRUD permissions to authenticated role (RLS policies enforce user ownership)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaults TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authenticator_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
