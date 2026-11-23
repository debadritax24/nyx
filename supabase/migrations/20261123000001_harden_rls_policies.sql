-- =============================================================================
-- NYX FORWARD MIGRATION: HARDEN RLS & CROSS-TENANT INTEGRITY
-- Version: 20261123000001
-- Description: Enforces vault ownership in authenticator_accounts and adds audit checks
-- =============================================================================

-- Drop previous insert/update policies on authenticator_accounts
DROP POLICY IF EXISTS "accounts_insert_own" ON public.authenticator_accounts;
DROP POLICY IF EXISTS "accounts_update_own" ON public.authenticator_accounts;

-- Recreate with explicit cross-tenant vault ownership validation
CREATE POLICY "accounts_insert_own"
  ON public.authenticator_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.vaults v
      WHERE v.id = authenticator_accounts.vault_id
        AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "accounts_update_own"
  ON public.authenticator_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.vaults v
      WHERE v.id = authenticator_accounts.vault_id
        AND v.user_id = auth.uid()
    )
  );
