-- Engineer Wallet v2 — Migration E: Add payment_channel + engineer_transaction_id columns
--
-- Tables already complete (no change):
--   settlement_groups, labor_payments, rental_advances, rental_settlements, subcontract_payments
--
-- Tables that have an FK to site_engineer_transactions but no payment_channel column:
--   tea_shop_settlements    (existing column: site_engineer_transaction_id)
--   expenses                (existing column: engineer_transaction_id)
--   misc_expenses           (existing column: engineer_transaction_id)
--
-- Tables that have neither column:
--   material_purchase_expenses
--   inter_site_settlement_payments
--
-- Phase 3 (Equipment) is intentionally deferred until the team decides which equipment-money
-- flows (maintenance, transfer, handover) actually book payments — equipment tables today
-- have no payment-row primitive to attach a channel to.

BEGIN;

-- 1. tea_shop_settlements — add payment_channel only.
ALTER TABLE tea_shop_settlements
  ADD COLUMN IF NOT EXISTS payment_channel text NOT NULL DEFAULT 'direct';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'tea_shop_settlements' AND c.conname = 'tea_shop_settlements_payment_channel_check'
  ) THEN
    ALTER TABLE tea_shop_settlements
      ADD CONSTRAINT tea_shop_settlements_payment_channel_check
        CHECK (payment_channel IN ('direct','engineer_wallet'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_tea_shop_settlements_engineer_tx
  ON tea_shop_settlements (site_engineer_transaction_id)
  WHERE site_engineer_transaction_id IS NOT NULL;

-- 2. expenses — add payment_channel only.
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS payment_channel text NOT NULL DEFAULT 'direct';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'expenses' AND c.conname = 'expenses_payment_channel_check'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_payment_channel_check
        CHECK (payment_channel IN ('direct','engineer_wallet'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_expenses_engineer_tx
  ON expenses (engineer_transaction_id)
  WHERE engineer_transaction_id IS NOT NULL;

-- 3. misc_expenses — add payment_channel only.
ALTER TABLE misc_expenses
  ADD COLUMN IF NOT EXISTS payment_channel text NOT NULL DEFAULT 'direct';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'misc_expenses' AND c.conname = 'misc_expenses_payment_channel_check'
  ) THEN
    ALTER TABLE misc_expenses
      ADD CONSTRAINT misc_expenses_payment_channel_check
        CHECK (payment_channel IN ('direct','engineer_wallet'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_misc_expenses_engineer_tx
  ON misc_expenses (engineer_transaction_id)
  WHERE engineer_transaction_id IS NOT NULL;

-- 4. material_purchase_expenses — add both columns.
ALTER TABLE material_purchase_expenses
  ADD COLUMN IF NOT EXISTS payment_channel text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS engineer_transaction_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'material_purchase_expenses' AND c.conname = 'material_purchase_expenses_payment_channel_check'
  ) THEN
    ALTER TABLE material_purchase_expenses
      ADD CONSTRAINT material_purchase_expenses_payment_channel_check
        CHECK (payment_channel IN ('direct','engineer_wallet'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'material_purchase_expenses' AND c.conname = 'material_purchase_expenses_engineer_tx_fkey'
  ) THEN
    ALTER TABLE material_purchase_expenses
      ADD CONSTRAINT material_purchase_expenses_engineer_tx_fkey
        FOREIGN KEY (engineer_transaction_id)
        REFERENCES site_engineer_transactions(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_engineer_tx
  ON material_purchase_expenses (engineer_transaction_id)
  WHERE engineer_transaction_id IS NOT NULL;

-- 5. inter_site_settlement_payments — add both columns.
ALTER TABLE inter_site_settlement_payments
  ADD COLUMN IF NOT EXISTS payment_channel text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS engineer_transaction_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'inter_site_settlement_payments' AND c.conname = 'inter_site_settlement_payments_payment_channel_check'
  ) THEN
    ALTER TABLE inter_site_settlement_payments
      ADD CONSTRAINT inter_site_settlement_payments_payment_channel_check
        CHECK (payment_channel IN ('direct','engineer_wallet'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'inter_site_settlement_payments' AND c.conname = 'inter_site_settlement_payments_engineer_tx_fkey'
  ) THEN
    ALTER TABLE inter_site_settlement_payments
      ADD CONSTRAINT inter_site_settlement_payments_engineer_tx_fkey
        FOREIGN KEY (engineer_transaction_id)
        REFERENCES site_engineer_transactions(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_inter_site_settlement_payments_engineer_tx
  ON inter_site_settlement_payments (engineer_transaction_id)
  WHERE engineer_transaction_id IS NOT NULL;

-- 6. Document the convention so future readers don't reinvent it.
COMMENT ON COLUMN settlement_groups.payment_channel        IS 'direct | engineer_wallet — when engineer_wallet, engineer_transaction_id must be set.';
COMMENT ON COLUMN tea_shop_settlements.payment_channel     IS 'direct | engineer_wallet';
COMMENT ON COLUMN expenses.payment_channel                 IS 'direct | engineer_wallet';
COMMENT ON COLUMN misc_expenses.payment_channel            IS 'direct | engineer_wallet';
COMMENT ON COLUMN material_purchase_expenses.payment_channel IS 'direct | engineer_wallet';
COMMENT ON COLUMN inter_site_settlement_payments.payment_channel IS 'direct | engineer_wallet';

COMMIT;
