-- Backfill engineer_wallet_spend_allocations for historical spend rows.
--
-- For every spend transaction that has no allocation rows yet, compute its
-- allocation against the pool state AT THE TIME of the spend (deposits up to
-- spend's transaction_date, minus allocations already written for spends that
-- came before this one). Idempotent: skips spends already attributed.

DO $$
DECLARE
  v_spend record;
  v_pool_total numeric;
  v_remaining numeric;
  v_allocated numeric;
  v_last_alloc_id uuid;
  v_source_row record;
BEGIN
  FOR v_spend IN
    SELECT s.id, s.user_id, s.site_id, s.amount, s.transaction_date, s.created_at
    FROM site_engineer_transactions s
    WHERE s.transaction_type = 'spend'
      AND s.cancelled_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM engineer_wallet_spend_allocations a WHERE a.spend_id = s.id
      )
    ORDER BY s.transaction_date ASC, s.created_at ASC
  LOOP
    -- Pool composition as-of this spend's date (deposits with date+created_at <= spend's).
    CREATE TEMP TABLE _pools ON COMMIT DROP AS
    SELECT
      d.payer_source,
      (
        SELECT d2.id FROM site_engineer_transactions d2
        WHERE d2.user_id = v_spend.user_id
          AND d2.site_id = v_spend.site_id
          AND d2.transaction_type = 'deposit'
          AND d2.payer_source = d.payer_source
          AND d2.cancelled_at IS NULL
          AND (d2.transaction_date, d2.created_at) <= (v_spend.transaction_date, v_spend.created_at)
        ORDER BY d2.transaction_date ASC, d2.created_at ASC
        LIMIT 1
      ) AS oldest_deposit_id,
      GREATEST(
        0,
        COALESCE(SUM(d.amount), 0)
        - COALESCE((
          SELECT SUM(a.amount) FROM engineer_wallet_spend_allocations a
          JOIN site_engineer_transactions s2 ON s2.id = a.spend_id
          WHERE s2.user_id = v_spend.user_id
            AND s2.site_id = v_spend.site_id
            AND s2.cancelled_at IS NULL
            AND a.payer_source = d.payer_source
            AND (s2.transaction_date, s2.created_at) < (v_spend.transaction_date, v_spend.created_at)
        ), 0)
      ) AS available
    FROM site_engineer_transactions d
    WHERE d.user_id = v_spend.user_id
      AND d.site_id = v_spend.site_id
      AND d.transaction_type = 'deposit'
      AND d.cancelled_at IS NULL
      AND d.payer_source IS NOT NULL
      AND (d.transaction_date, d.created_at) <= (v_spend.transaction_date, v_spend.created_at)
    GROUP BY d.payer_source;

    SELECT COALESCE(SUM(available), 0) INTO v_pool_total FROM _pools WHERE available > 0;
    v_remaining := v_spend.amount;
    v_allocated := 0;
    v_last_alloc_id := NULL;

    IF v_pool_total > 0 THEN
      FOR v_source_row IN SELECT * FROM _pools WHERE available > 0 ORDER BY payer_source LOOP
        DECLARE v_share numeric;
        BEGIN
          v_share := ROUND((v_source_row.available / v_pool_total) * LEAST(v_spend.amount, v_pool_total), 2);
          IF v_share > 0 THEN
            INSERT INTO engineer_wallet_spend_allocations (spend_id, deposit_id, kind, payer_source, amount)
            VALUES (v_spend.id, v_source_row.oldest_deposit_id, 'source', v_source_row.payer_source, v_share)
            RETURNING id INTO v_last_alloc_id;
            v_allocated := v_allocated + v_share;
          END IF;
        END;
      END LOOP;

      IF v_allocated < LEAST(v_spend.amount, v_pool_total) AND v_last_alloc_id IS NOT NULL THEN
        UPDATE engineer_wallet_spend_allocations
        SET amount = amount + (LEAST(v_spend.amount, v_pool_total) - v_allocated)
        WHERE id = v_last_alloc_id;
        v_allocated := LEAST(v_spend.amount, v_pool_total);
      END IF;

      v_remaining := v_spend.amount - v_allocated;
    END IF;

    IF v_remaining > 0.005 THEN
      INSERT INTO engineer_wallet_spend_allocations (spend_id, deposit_id, kind, payer_source, amount)
      VALUES (v_spend.id, NULL, 'overdraft', 'overdraft', ROUND(v_remaining, 2));
    END IF;

    DROP TABLE _pools;
  END LOOP;
END$$;
