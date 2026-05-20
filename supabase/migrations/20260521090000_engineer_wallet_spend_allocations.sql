-- Engineer wallet — spend-to-deposit allocation table.
--
-- Pattern mirrors payment_week_allocations (used by the wage waterfall).
-- One spend row produces N allocation rows where N = number of active source
-- pools the spend drew down, plus optionally 1 "overdraft" row when the spend
-- pushed the (engineer, site) pool negative.
--
-- Phase 2 of the wallet payer-source attribution feature
-- (see docs/superpowers/specs/2026-05-20-engineer-wallet-source-attribution-design.md).

CREATE TABLE engineer_wallet_spend_allocations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spend_id          uuid NOT NULL REFERENCES site_engineer_transactions(id) ON DELETE CASCADE,
  deposit_id        uuid REFERENCES site_engineer_transactions(id),
  kind              text NOT NULL DEFAULT 'source' CHECK (kind IN ('source','overdraft')),
  payer_source      text NOT NULL,
  payer_name        text,
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ewsa_spend_id ON engineer_wallet_spend_allocations (spend_id);
CREATE INDEX idx_ewsa_deposit_id ON engineer_wallet_spend_allocations (deposit_id);
CREATE INDEX idx_ewsa_payer_source ON engineer_wallet_spend_allocations (payer_source);

COMMENT ON TABLE engineer_wallet_spend_allocations IS
  'Splits each wallet spend across the deposit sources that funded it. Proportional rule: each spend touches every active source pro-rata to its current pool share. Phase 2 of the wallet payer-source attribution feature.';

ALTER TABLE engineer_wallet_spend_allocations ENABLE ROW LEVEL SECURITY;

-- RLS: visible to anyone who can see the parent spend row.
-- Inserts only via SECURITY DEFINER RPC (atomic_record_wallet_spend below + backfill).
CREATE POLICY ewsa_read ON engineer_wallet_spend_allocations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM site_engineer_transactions t
      WHERE t.id = engineer_wallet_spend_allocations.spend_id
    )
  );

-- ----------------------------------------------------------------------------
-- Extend atomic_record_wallet_spend to also write allocation rows in the same
-- transaction (same advisory lock, same atomicity guarantee).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION atomic_record_wallet_spend(
  p_engineer_id        uuid,
  p_site_id            uuid,
  p_amount             numeric,
  p_transaction_date   date,
  p_payment_mode       text,
  p_proof_url          text,
  p_notes              text,
  p_recorded_by        text,
  p_recorded_by_user_id uuid,
  p_description        text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx_id          uuid;
  v_pool_total     numeric := 0;
  v_remaining      numeric;
  v_allocated      numeric := 0;
  v_last_alloc_id  uuid;
  v_source_row     record;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Wallet spend amount must be positive (got %)', p_amount USING ERRCODE = '22023';
  END IF;
  IF p_engineer_id IS NULL THEN
    RAISE EXCEPTION 'Wallet spend requires an engineer_id' USING ERRCODE = '22023';
  END IF;
  IF p_site_id IS NULL THEN
    RAISE EXCEPTION 'Wallet spend requires a site_id' USING ERRCODE = '22023';
  END IF;
  IF p_payment_mode NOT IN ('cash','upi','bank_transfer') THEN
    RAISE EXCEPTION 'Invalid payment_mode % for wallet spend', p_payment_mode USING ERRCODE = '22023';
  END IF;

  -- Per-(engineer, site) advisory lock — concurrent spends on the same pool
  -- serialise here. The allocator below reads pool state under this lock.
  PERFORM pg_advisory_xact_lock(hashtext(p_engineer_id::text || ':' || p_site_id::text));

  -- Insert the spend row first; allocations reference it via FK.
  INSERT INTO site_engineer_transactions (
    user_id, transaction_type, amount, transaction_date, site_id,
    description, payment_mode, proof_url, notes,
    recorded_by, recorded_by_user_id
  ) VALUES (
    p_engineer_id, 'spend', p_amount, COALESCE(p_transaction_date, CURRENT_DATE), p_site_id,
    p_description, p_payment_mode, p_proof_url, p_notes,
    COALESCE(p_recorded_by, 'system'), p_recorded_by_user_id
  )
  RETURNING id INTO v_tx_id;

  -- ---------- Proportional allocator ----------
  -- For each active source pool, compute the unspent balance
  -- (sum of non-cancelled deposits of that source, minus prior allocations
  -- against that source). Then distribute the new spend pro-rata.
  CREATE TEMP TABLE _pools ON COMMIT DROP AS
  SELECT
    d.payer_source,
    (
      SELECT d2.id FROM site_engineer_transactions d2
      WHERE d2.user_id = p_engineer_id
        AND d2.site_id = p_site_id
        AND d2.transaction_type = 'deposit'
        AND d2.payer_source = d.payer_source
        AND d2.cancelled_at IS NULL
      ORDER BY d2.transaction_date ASC, d2.created_at ASC
      LIMIT 1
    ) AS oldest_deposit_id,
    GREATEST(
      0,
      COALESCE(SUM(d.amount), 0)
      - COALESCE((
        SELECT SUM(a.amount) FROM engineer_wallet_spend_allocations a
        JOIN site_engineer_transactions s ON s.id = a.spend_id
        WHERE s.user_id = p_engineer_id
          AND s.site_id = p_site_id
          AND s.cancelled_at IS NULL
          AND a.payer_source = d.payer_source
      ), 0)
    ) AS available
  FROM site_engineer_transactions d
  WHERE d.user_id = p_engineer_id
    AND d.site_id = p_site_id
    AND d.transaction_type = 'deposit'
    AND d.cancelled_at IS NULL
    AND d.payer_source IS NOT NULL
  GROUP BY d.payer_source;

  SELECT COALESCE(SUM(available), 0) INTO v_pool_total FROM _pools WHERE available > 0;

  v_remaining := p_amount;

  IF v_pool_total > 0 THEN
    FOR v_source_row IN SELECT * FROM _pools WHERE available > 0 ORDER BY payer_source LOOP
      DECLARE
        v_share numeric;
      BEGIN
        v_share := ROUND((v_source_row.available / v_pool_total) * LEAST(p_amount, v_pool_total), 2);
        IF v_share > 0 THEN
          INSERT INTO engineer_wallet_spend_allocations
            (spend_id, deposit_id, kind, payer_source, amount)
          VALUES
            (v_tx_id, v_source_row.oldest_deposit_id, 'source', v_source_row.payer_source, v_share)
          RETURNING id INTO v_last_alloc_id;
          v_allocated := v_allocated + v_share;
        END IF;
      END;
    END LOOP;

    -- Distribute any rounding leftover (a few paise) to the most recent row.
    IF v_allocated < LEAST(p_amount, v_pool_total) AND v_last_alloc_id IS NOT NULL THEN
      UPDATE engineer_wallet_spend_allocations
      SET amount = amount + (LEAST(p_amount, v_pool_total) - v_allocated)
      WHERE id = v_last_alloc_id;
      v_allocated := LEAST(p_amount, v_pool_total);
    END IF;

    v_remaining := p_amount - v_allocated;
  END IF;

  -- Overdraft row for any portion that exceeded the pool total.
  IF v_remaining > 0.005 THEN
    INSERT INTO engineer_wallet_spend_allocations
      (spend_id, deposit_id, kind, payer_source, amount)
    VALUES
      (v_tx_id, NULL, 'overdraft', 'overdraft', ROUND(v_remaining, 2));
  END IF;

  RETURN v_tx_id;
END;
$$;
