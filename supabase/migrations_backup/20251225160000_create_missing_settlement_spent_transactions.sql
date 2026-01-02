-- Migration: Create missing spent_on_behalf transactions for engineer wallet settlements
-- Purpose: Fix historical settlements that were made via engineer wallet but don't have spending transactions

-- ============================================================================
-- 1. Find and create missing spent_on_behalf transactions
-- ============================================================================

-- Create a function to handle the data fix
DO $$
DECLARE
  rec RECORD;
  new_tx_id UUID;
BEGIN
  -- Loop through settlement_groups that were paid via engineer wallet but have no engineer_transaction_id
  FOR rec IN
    SELECT
      sg.id as settlement_group_id,
      sg.settlement_reference,
      sg.site_id,
      sg.total_amount,
      sg.settlement_date,
      sg.created_by as engineer_id,
      sg.payer_source,
      sg.payer_name,
      sg.payment_mode,
      sg.created_at,
      sg.notes
    FROM settlement_groups sg
    WHERE sg.payment_channel = 'engineer_wallet'
      AND sg.engineer_transaction_id IS NULL
      AND sg.is_cancelled = false
  LOOP
    -- Create the missing spent_on_behalf transaction
    INSERT INTO site_engineer_transactions (
      user_id,
      transaction_type,
      amount,
      transaction_date,
      site_id,
      description,
      payment_mode,
      settlement_reference,
      settlement_group_id,
      payer_source,
      payer_name,
      created_at
    )
    VALUES (
      rec.engineer_id,
      'spent_on_behalf',
      rec.total_amount,
      rec.settlement_date,
      rec.site_id,
      'Settlement via engineer wallet - ' || COALESCE(rec.settlement_reference, 'migrated'),
      rec.payment_mode,
      rec.settlement_reference,
      rec.settlement_group_id,
      rec.payer_source,
      rec.payer_name,
      COALESCE(rec.created_at, NOW())
    )
    RETURNING id INTO new_tx_id;

    -- Update the settlement_group with the new transaction ID
    UPDATE settlement_groups
    SET engineer_transaction_id = new_tx_id
    WHERE id = rec.settlement_group_id;

    RAISE NOTICE 'Created spent_on_behalf transaction % for settlement %', new_tx_id, rec.settlement_reference;
  END LOOP;
END $$;

-- ============================================================================
-- 2. Also fix any transactions that have settlement_group_id but wrong type
-- ============================================================================

-- If a transaction is linked to a settlement_group and is for spending,
-- ensure it's marked as spent_on_behalf (not received_from_company)
UPDATE site_engineer_transactions t
SET transaction_type = 'spent_on_behalf'
FROM settlement_groups sg
WHERE t.settlement_group_id = sg.id
  AND sg.payment_channel = 'engineer_wallet'
  AND t.transaction_type = 'received_from_company'
  AND sg.engineer_transaction_id = t.id;

-- ============================================================================
-- 3. Log summary of changes
-- ============================================================================

DO $$
DECLARE
  total_settlements INT;
  settlements_with_tx INT;
  spent_transactions INT;
BEGIN
  SELECT COUNT(*) INTO total_settlements
  FROM settlement_groups
  WHERE payment_channel = 'engineer_wallet' AND is_cancelled = false;

  SELECT COUNT(*) INTO settlements_with_tx
  FROM settlement_groups
  WHERE payment_channel = 'engineer_wallet'
    AND is_cancelled = false
    AND engineer_transaction_id IS NOT NULL;

  SELECT COUNT(*) INTO spent_transactions
  FROM site_engineer_transactions
  WHERE transaction_type = 'spent_on_behalf';

  RAISE NOTICE '=== Migration Summary ===';
  RAISE NOTICE 'Total engineer wallet settlements: %', total_settlements;
  RAISE NOTICE 'Settlements with transaction link: %', settlements_with_tx;
  RAISE NOTICE 'Total spent_on_behalf transactions: %', spent_transactions;
END $$;
