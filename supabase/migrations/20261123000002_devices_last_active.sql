-- =============================================================================
-- NYX FORWARD MIGRATION: DEVICE METADATA ENHANCEMENT
-- Version: 20261123000002
-- Description: Adds last_active_at and device_label to devices table
-- =============================================================================

ALTER TABLE public.devices 
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS device_label TEXT;

-- Index on last_active_at for inactive session audits
CREATE INDEX IF NOT EXISTS idx_devices_last_active ON public.devices(user_id, last_active_at);
