-- Engineer Wallet v2 — Migration B: Simplify site_engineer_transactions schema
--
-- Drops the entire batch / per-deposit settlement complexity from the wallet ledger.
-- After this migration the table is a simple ledger: one row per deposit / spend / return,
-- signed by transaction_type. Balance is computed via v_engineer_wallet_balance (Migration D).
--
-- IMPORTANT: assumes Migration A has already run (table is empty). The DROP TABLE on
-- engineer_wallet_batch_usage will fail loudly if Migration A was skipped.

BEGIN;

-- 1. Drop dependent views before touching site_engineer_transactions columns.
--    v_all_expenses references site_engineer_transactions.confirmed_at and .is_settled in
--    seven CASE expressions (settlement_groups, tea_shop, misc_expense, subcontract_payment
--    branches). Migration F recreates it with v2-compatible logic.
DROP VIEW IF EXISTS v_all_expenses CASCADE;

-- 2. Drop the auxiliary batch tables. site_engineer_settlements and engineer_reimbursements
--    encoded the batch-aware settlement workflow that the new model collapses into a single
--    spend ledger row.
DROP TABLE IF EXISTS engineer_wallet_batch_usage CASCADE;
DROP TABLE IF EXISTS site_engineer_settlements CASCADE;
DROP TABLE IF EXISTS engineer_reimbursements CASCADE;

-- 2. Drop legacy CHECK constraints on site_engineer_transactions before we drop the columns
--    they reference, then drop columns themselves.
DO $$
DECLARE
  cn text;
BEGIN
  FOR cn IN
    SELECT conname FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'site_engineer_transactions' AND c.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE site_engineer_transactions DROP CONSTRAINT %I', cn);
  END LOOP;
END $$;

-- 3. Drop columns that encoded the batch / settlement-state model. Use IF EXISTS so the
--    migration is idempotent if any column was already removed by an earlier hot-fix.
ALTER TABLE site_engineer_transactions
  DROP COLUMN IF EXISTS batch_code,
  DROP COLUMN IF EXISTS site_restricted,
  DROP COLUMN IF EXISTS remaining_balance,
  DROP COLUMN IF EXISTS settlement_status,
  DROP COLUMN IF EXISTS settlement_mode,
  DROP COLUMN IF EXISTS settlement_proof_url,
  DROP COLUMN IF EXISTS settlement_reason,
  DROP COLUMN IF EXISTS settlement_reference,
  DROP COLUMN IF EXISTS settlement_group_id,
  DROP COLUMN IF EXISTS confirmed_by,
  DROP COLUMN IF EXISTS confirmed_by_user_id,
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS dispute_notes,
  DROP COLUMN IF EXISTS is_settled,
  DROP COLUMN IF EXISTS settled_date,
  DROP COLUMN IF EXISTS settled_by,
  DROP COLUMN IF EXISTS recipient_type,
  DROP COLUMN IF EXISTS recipient_id,
  DROP COLUMN IF EXISTS related_attendance_id,
  DROP COLUMN IF EXISTS related_subcontract_id,
  DROP COLUMN IF EXISTS money_source,
  DROP COLUMN IF EXISTS money_source_name;

-- 4. Recreate CHECK constraints for the v2 model.
--    Surviving columns of interest: id, user_id, transaction_type, amount, transaction_date,
--    site_id, description, payment_mode, proof_url, notes, recorded_by, recorded_by_user_id,
--    created_at, updated_at, cancelled_at, cancelled_by, cancelled_by_user_id, cancellation_reason,
--    payer_source, payer_name.
--    payer_source is reused: required on deposit rows (which payer the money came from), null on
--    spend/return rows.

ALTER TABLE site_engineer_transactions
  ADD CONSTRAINT site_engineer_transactions_transaction_type_check
    CHECK (transaction_type IN ('deposit', 'spend', 'return'));

ALTER TABLE site_engineer_transactions
  ADD CONSTRAINT site_engineer_transactions_payment_mode_check
    CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer'));

ALTER TABLE site_engineer_transactions
  ADD CONSTRAINT site_engineer_transactions_payer_source_check
    CHECK (
      payer_source IS NULL
      OR payer_source IN (
           'own_money', 'amma_money', 'client_money', 'trust_account',
           'other_site_money', 'custom', 'mothers_money'
         )
    );

-- Deposits must declare a payer_source. Spends and returns leave it null.
ALTER TABLE site_engineer_transactions
  ADD CONSTRAINT site_engineer_transactions_deposit_payer_source_check
    CHECK (transaction_type <> 'deposit' OR payer_source IS NOT NULL);

-- UPI deposits and UPI returns require a proof URL. Spends are written via RPC; their proof_url
-- mirrors the parent settlement's proof and may be null when the parent itself was cash.
ALTER TABLE site_engineer_transactions
  ADD CONSTRAINT site_engineer_transactions_upi_proof_required_check
    CHECK (
      payment_mode <> 'upi'
      OR transaction_type = 'spend'
      OR (proof_url IS NOT NULL AND length(proof_url) > 0)
    );

-- Amount must be strictly positive — sign comes from transaction_type, not from the value.
ALTER TABLE site_engineer_transactions
  ADD CONSTRAINT site_engineer_transactions_amount_positive_check
    CHECK (amount > 0);

-- 5. Index for ledger pagination by (user_id, transaction_date desc, id desc).
DROP INDEX IF EXISTS idx_site_engineer_transactions_user_date;
CREATE INDEX idx_site_engineer_transactions_user_date
  ON site_engineer_transactions (user_id, transaction_date DESC, id DESC)
  WHERE cancelled_at IS NULL;

-- 6. Document the new model.
COMMENT ON TABLE site_engineer_transactions IS
  'Wallet ledger v2 — one row per deposit/spend/return per engineer. Balance = SUM(deposit) - SUM(spend) - SUM(return). Spends are written exclusively via atomic_record_wallet_spend.';
COMMENT ON COLUMN site_engineer_transactions.transaction_type IS 'deposit | spend | return';
COMMENT ON COLUMN site_engineer_transactions.payment_mode IS 'cash | upi | bank_transfer';
COMMENT ON COLUMN site_engineer_transactions.payer_source IS 'Required for deposits — canonical key matching payer_sources.key. Null for spends/returns.';
COMMENT ON COLUMN site_engineer_transactions.payer_name IS 'Free-text counterpart name when payer_source is custom or other_site_money. Null otherwise.';
COMMENT ON COLUMN site_engineer_transactions.proof_url IS 'Mandatory for UPI deposits and UPI returns. Optional otherwise.';
COMMENT ON COLUMN site_engineer_transactions.cancelled_at IS 'Soft-cancel marker. Cancelled rows are excluded from the balance view.';

COMMIT;
