-- Engineer Wallet v2 — Migration D: Balance view + atomic_record_wallet_spend RPC
--
-- The view is the single source of truth for engineer wallet balance.
-- The RPC is the only sanctioned write path for spend rows; it takes a per-engineer advisory
-- lock so that two concurrent settlements cannot collectively overspend the wallet.

BEGIN;

-- 1. Balance view — recomputed on every read, cheap thanks to the (user_id, ...) index.
CREATE OR REPLACE VIEW v_engineer_wallet_balance AS
SELECT
  user_id,
  COALESCE(SUM(CASE transaction_type
                 WHEN 'deposit' THEN amount
                 WHEN 'spend'   THEN -amount
                 WHEN 'return'  THEN -amount
               END), 0) AS balance,
  MAX(transaction_date) AS last_txn_at,
  COUNT(*) FILTER (WHERE transaction_type = 'deposit') AS deposit_count,
  COUNT(*) FILTER (WHERE transaction_type = 'spend')   AS spend_count,
  COUNT(*) FILTER (WHERE transaction_type = 'return')  AS return_count,
  SUM(amount) FILTER (WHERE transaction_type = 'deposit') AS total_deposited,
  SUM(amount) FILTER (WHERE transaction_type = 'spend')   AS total_spent,
  SUM(amount) FILTER (WHERE transaction_type = 'return')  AS total_returned
FROM site_engineer_transactions
WHERE cancelled_at IS NULL
GROUP BY user_id;

GRANT SELECT ON v_engineer_wallet_balance TO authenticated, anon;

COMMENT ON VIEW v_engineer_wallet_balance IS
  'Per-engineer wallet balance + lifetime totals, derived live from site_engineer_transactions. Excludes cancelled rows.';

-- 2. Atomic spend RPC. Every domain settlement service that wants to debit the wallet calls this.
--    Direct INSERTs into site_engineer_transactions for transaction_type=spend are forbidden by
--    convention — bypassing this RPC bypasses the advisory lock and the balance check.
CREATE OR REPLACE FUNCTION atomic_record_wallet_spend(
  p_engineer_id   uuid,
  p_amount        numeric,
  p_transaction_date date,
  p_payment_mode  text,
  p_proof_url     text,
  p_notes         text,
  p_recorded_by         text,
  p_recorded_by_user_id uuid,
  p_site_id       uuid DEFAULT NULL,
  p_description   text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance numeric;
  v_tx_id   uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Wallet spend amount must be positive (got %)', p_amount
      USING ERRCODE = '22023';
  END IF;
  IF p_engineer_id IS NULL THEN
    RAISE EXCEPTION 'Wallet spend requires an engineer_id'
      USING ERRCODE = '22023';
  END IF;
  IF p_payment_mode NOT IN ('cash','upi','bank_transfer') THEN
    RAISE EXCEPTION 'Invalid payment_mode % for wallet spend', p_payment_mode
      USING ERRCODE = '22023';
  END IF;

  -- Per-engineer transaction-scoped advisory lock. Hash collisions are harmless: two engineers
  -- that hash to the same lock id will serialize spend writes briefly. The lock releases at
  -- COMMIT/ROLLBACK so the caller's enclosing transaction owns it.
  PERFORM pg_advisory_xact_lock(hashtext(p_engineer_id::text));

  SELECT balance INTO v_balance
    FROM v_engineer_wallet_balance
   WHERE user_id = p_engineer_id;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance: have %, need %', COALESCE(v_balance, 0), p_amount
      USING ERRCODE = 'WLT01';
  END IF;

  INSERT INTO site_engineer_transactions (
    user_id,
    transaction_type,
    amount,
    transaction_date,
    site_id,
    description,
    payment_mode,
    proof_url,
    notes,
    recorded_by,
    recorded_by_user_id
  ) VALUES (
    p_engineer_id,
    'spend',
    p_amount,
    COALESCE(p_transaction_date, CURRENT_DATE),
    p_site_id,
    p_description,
    p_payment_mode,
    p_proof_url,
    p_notes,
    COALESCE(p_recorded_by, 'system'),
    p_recorded_by_user_id
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION atomic_record_wallet_spend(
  uuid, numeric, date, text, text, text, text, uuid, uuid, text
) TO authenticated;

COMMENT ON FUNCTION atomic_record_wallet_spend IS
  'Sole write path for wallet spend rows. Holds a per-engineer transactional advisory lock and verifies balance before insert. Returns the new site_engineer_transactions.id.';

COMMIT;
