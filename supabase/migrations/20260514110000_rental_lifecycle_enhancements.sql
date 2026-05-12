-- supabase/migrations/20260514110000_rental_lifecycle_enhancements.sql

-- ── rental_orders: support re-order linking ──────────────────────────────────
ALTER TABLE public.rental_orders
  ADD COLUMN IF NOT EXISTS parent_order_id UUID
    REFERENCES public.rental_orders(id) ON DELETE SET NULL;

-- ── rental_orders: add request status for the request→PO workflow ────────────
-- rental_order_status IS a real PostgreSQL ENUM (defined in 20260102100000_rental_management.sql)
-- Existing values: draft|confirmed|active|partially_returned|completed|cancelled
-- Add pending and approved for the request phase
ALTER TYPE rental_order_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE rental_order_status ADD VALUE IF NOT EXISTS 'approved';

-- ── rental_settlements: support 3-party settlement ───────────────────────────
-- Add party_type column
DO $$ BEGIN
  CREATE TYPE rental_settlement_party_type AS ENUM ('vendor', 'transport', 'loading_unloading');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.rental_settlements
  ADD COLUMN IF NOT EXISTS party_type rental_settlement_party_type NOT NULL DEFAULT 'vendor';

ALTER TABLE public.rental_settlements
  ADD COLUMN IF NOT EXISTS party_name TEXT;  -- transport person name, laborer name, etc.

-- Drop old unique constraint on rental_order_id alone
-- (was created inline as UNIQUE in CREATE TABLE, PostgreSQL auto-named it rental_settlements_rental_order_id_key)
ALTER TABLE public.rental_settlements
  DROP CONSTRAINT IF EXISTS rental_settlements_rental_order_id_key;

-- Add new unique on (rental_order_id, party_type)
ALTER TABLE public.rental_settlements
  ADD CONSTRAINT rental_settlements_order_party_unique
  UNIQUE (rental_order_id, party_type);
