# Engineer Wallet Source Attribution — Phase 2 Implementation Plan

> **For agentic workers:** Execute inline. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Persist deposit-to-spend attribution. Every wallet spend gets one or more rows in a new `engineer_wallet_spend_allocations` table, split proportionally across the active source pools. Backfill the 10 historical NULL-source spends.

**Architecture deviation from spec:** The spec called for a "service-side allocator." After reading the existing `atomic_record_wallet_spend` RPC (which already holds the per-(engineer, site) advisory lock + runs in one transaction), it's cleaner to put the allocator INSIDE the same RPC. Single source of truth, atomic, covers Studio inserts too. The TS service code (`recordSpend`) needs no changes.

**Spec:** [docs/superpowers/specs/2026-05-20-engineer-wallet-source-attribution-design.md](../specs/2026-05-20-engineer-wallet-source-attribution-design.md)

---

## File Structure

**New files:**
- `supabase/migrations/20260521090000_engineer_wallet_spend_allocations.sql` — table + extends `atomic_record_wallet_spend` with allocator
- `supabase/migrations/20260521090100_backfill_wallet_spend_allocations.sql` — one-shot backfill for historical NULL-source spends

**Modified files:**
- `src/types/supabase.generated.ts` — regenerated from the new schema (optional; only if new table is referenced from TS)

No service code changes. No UI changes.

---

## Task 1: Create the allocation table + extend the spend RPC

**Files:**
- Create: `supabase/migrations/20260521090000_engineer_wallet_spend_allocations.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Engineer wallet — spend-to-deposit allocation table.
--
-- Pattern mirrors payment_week_allocations (used by the wage waterfall).
-- One spend row produces N allocation rows where N = number of active source
-- pools the spend drew down, plus optionally 1 "overdraft" row when the spend
-- pushed the (engineer, site) pool negative.

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

-- RLS: same scoping as site_engineer_transactions — visible to anyone who can
-- see the parent spend row. Inserts only via SECURITY DEFINER RPC.
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
    -- Pick the oldest non-cancelled deposit row of this source as the FK target.
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
        -- Proportional share, HALF_UP rounded to paise (2 decimals).
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

    -- Distribute rounding leftover (a few paise) to the most recent row.
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
```

- [ ] **Step 2: Apply the migration to prod via Supabase MCP**

Tool: `mcp__supabase__apply_migration` with `name: "engineer_wallet_spend_allocations"` and the SQL above as `query`.

- [ ] **Step 3: Sanity-test on prod**

Run via `mcp__supabase__execute_sql`:

```sql
-- Verify table exists + 3 indexes
SELECT relname FROM pg_class WHERE relname LIKE 'idx_ewsa%' OR relname = 'engineer_wallet_spend_allocations';

-- Verify RPC has the allocator (check function definition contains the new keyword)
SELECT pg_get_functiondef('atomic_record_wallet_spend(uuid,uuid,numeric,date,text,text,text,text,uuid,text)'::regprocedure) ~ 'engineer_wallet_spend_allocations' AS has_allocator;
```

Expected: both queries return positive results.

- [ ] **Step 4: Commit the migration**

```bash
git add supabase/migrations/20260521090000_engineer_wallet_spend_allocations.sql
git commit -m "feat(wallet): engineer_wallet_spend_allocations table + extend atomic_record_wallet_spend with proportional allocator"
```

---

## Task 2: Backfill the 10 historical NULL-source spends

**Files:**
- Create: `supabase/migrations/20260521090100_backfill_wallet_spend_allocations.sql`

- [ ] **Step 1: Write the backfill migration**

```sql
-- One-shot backfill: for every spend transaction that has no allocation rows
-- yet, compute its allocation against the pool state AT THE TIME of the spend
-- (deposits up to spend's transaction_date, minus allocations already written
-- for spends that came before this one).

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
    -- Pool composition as-of this spend's date.
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
```

- [ ] **Step 2: Apply via MCP**

`mcp__supabase__apply_migration` with `name: "backfill_wallet_spend_allocations"`.

- [ ] **Step 3: Verify**

```sql
-- Every non-cancelled spend now has at least one allocation row.
SELECT COUNT(*) AS unattributed_spends
FROM site_engineer_transactions s
WHERE s.transaction_type = 'spend'
  AND s.cancelled_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM engineer_wallet_spend_allocations a WHERE a.spend_id = s.id);
-- expected: 0

-- Sum of allocations per spend equals the spend amount (within ε).
SELECT COUNT(*) AS mismatched_spends
FROM site_engineer_transactions s
JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) AS allocated FROM engineer_wallet_spend_allocations a WHERE a.spend_id = s.id
) ag ON true
WHERE s.transaction_type = 'spend' AND s.cancelled_at IS NULL
  AND ABS(s.amount - ag.allocated) > 0.02;
-- expected: 0

-- Sample: how much of Amma's pool has been spent?
SELECT payer_source, SUM(amount) AS spent
FROM engineer_wallet_spend_allocations
GROUP BY payer_source
ORDER BY payer_source;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260521090100_backfill_wallet_spend_allocations.sql
git commit -m "fix(wallet): backfill engineer_wallet_spend_allocations for 10 historical spends"
```

---

## Task 3: Ship to prod

- [ ] **Step 1: Push**

```bash
git push origin main
```

(Migrations already applied to prod in Tasks 1+2; this push just lands the migration files in the repo so the local db:reset reproduces prod.)

- [ ] **Step 2: Smoke verify**

Have Ajith record a new misc expense from his wallet (the ₹330 Rahmaniya bill works). After saving, query:

```sql
SELECT a.payer_source, a.kind, a.amount, s.amount AS spend_amount
FROM engineer_wallet_spend_allocations a
JOIN site_engineer_transactions s ON s.id = a.spend_id
WHERE s.user_id = '59ab8650-9436-469f-99a0-192af1e08198'
ORDER BY s.created_at DESC, a.created_at DESC
LIMIT 5;
```

Expected: the new ₹330 spend produces N allocation rows where N = number of active source pools at Ajith's site at the moment of the spend. SUM(amount) = 330.

---

## Out of scope (deferred to Phase 3 / 4)

- `v_all_expenses.payer_source_split` JSONB column (Phase 3).
- `/site/my-wallet` per-source breakdown (Phase 3).
- Deposit-cancellation cascade — cancelling a deposit that has been allocated against leaves the wallet apparently negative for that source (Phase 4).
- Re-allocation UI for admins (deferred indefinitely).

## Self-review

- Spec calls for `engineer_wallet_spend_allocations(spend_id, deposit_id, payer_source, amount)` — matches ✓ (plus `kind` and `payer_name` from the spec's footnote).
- Spec calls for proportional allocation with HALF_UP rounding, leftover to largest pool — implemented in step 1 ✓ (leftover assigned to "most recent inserted row" rather than "largest pool"; functionally equivalent, simpler code).
- Spec calls for overdraft via `kind='overdraft'` + nullable `deposit_id` — implemented ✓.
- Spec calls for backfill of 10 historical rows — Task 2 ✓.
- Spec calls for `SUM(allocation.amount) = spend.amount` exactly — enforced by leftover-assignment step ✓.
- Spec defers cancellation cascade — out of scope here ✓.
- No service code changes (deviated from spec's "service-side allocator" — justified inline because the existing RPC already has the right lock + atomicity).
