-- =============================================================================
-- NYX INITIAL SCHEMA MIGRATION
-- Version: 20261123000000
-- Description: Core tables, strict RLS policies, indexes, and concurrency controls
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Helper Functions & Triggers
-- -----------------------------------------------------------------------------

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enforce optimistic concurrency on authenticator_accounts
CREATE OR REPLACE FUNCTION public.check_optimistic_concurrency()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.version IS NOT NULL AND NEW.version <= OLD.version THEN
    RAISE EXCEPTION 'Concurrency conflict: Submitted version (%) is not greater than existing version (%)',
      NEW.version, OLD.version
      USING ERRCODE = '23514'; -- check_violation
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 2. Profiles Table
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile upon auth.user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3. Vaults Table (Client-Wrapped Vault Keys)
-- -----------------------------------------------------------------------------
CREATE TABLE public.vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  passphrase_wrapped_vault_key TEXT NOT NULL,
  passphrase_wrap_nonce TEXT NOT NULL,
  passphrase_kdf_salt TEXT NOT NULL,
  passphrase_kdf_params JSONB NOT NULL,
  recovery_wrapped_vault_key TEXT NOT NULL,
  recovery_wrap_nonce TEXT NOT NULL,
  recovery_kdf_salt TEXT NOT NULL,
  recovery_kdf_params JSONB NOT NULL,
  crypto_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaults FORCE ROW LEVEL SECURITY;

CREATE POLICY "vaults_select_own"
  ON public.vaults FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "vaults_insert_own"
  ON public.vaults FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vaults_update_own"
  ON public.vaults FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vaults_delete_own"
  ON public.vaults FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_vaults_user_id ON public.vaults(user_id);

CREATE TRIGGER trg_vaults_updated_at
  BEFORE UPDATE ON public.vaults
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Authenticator Accounts Table (Encrypted Account Records)
-- -----------------------------------------------------------------------------
CREATE TABLE public.authenticator_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_id UUID NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  crypto_version INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.authenticator_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authenticator_accounts FORCE ROW LEVEL SECURITY;

CREATE POLICY "accounts_select_own"
  ON public.authenticator_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "accounts_insert_own"
  ON public.authenticator_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_update_own"
  ON public.authenticator_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_delete_own"
  ON public.authenticator_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_authenticator_accounts_user_vault 
  ON public.authenticator_accounts(user_id, vault_id);

CREATE INDEX idx_authenticator_accounts_sync 
  ON public.authenticator_accounts(user_id, updated_at);

CREATE INDEX idx_authenticator_accounts_deleted 
  ON public.authenticator_accounts(user_id, deleted_at);

CREATE TRIGGER trg_accounts_concurrency
  BEFORE UPDATE ON public.authenticator_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_optimistic_concurrency();

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.authenticator_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Devices Table (Registered Devices)
-- -----------------------------------------------------------------------------
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices FORCE ROW LEVEL SECURITY;

CREATE POLICY "devices_select_own"
  ON public.devices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "devices_insert_own"
  ON public.devices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "devices_update_own"
  ON public.devices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "devices_delete_own"
  ON public.devices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_devices_user_id ON public.devices(user_id);

CREATE TRIGGER trg_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
