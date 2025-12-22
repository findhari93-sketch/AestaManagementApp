-- Debug: Find the remaining unlinked labor expense and check its related attendance
DO $$
DECLARE
  exp RECORD;
  daily_rec RECORD;
  market_rec RECORD;
  tx_rec RECORD;
BEGIN
  FOR exp IN
    SELECT id, date, amount, description, engineer_transaction_id, site_id
    FROM expenses
    WHERE module = 'labor'
      AND contract_id IS NULL
      AND is_cleared = true
  LOOP
    RAISE NOTICE 'Unlinked expense: id=%, date=%, amount=%, desc=%',
      exp.id, exp.date, exp.amount, exp.description;

    -- Check for daily attendance with this expense_id
    SELECT * INTO daily_rec FROM daily_attendance WHERE expense_id = exp.id LIMIT 1;
    IF daily_rec IS NOT NULL THEN
      RAISE NOTICE '  -> Found daily_attendance: id=%, subcontract_id=%', daily_rec.id, daily_rec.subcontract_id;
    END IF;

    -- Check for market attendance with this expense_id
    SELECT * INTO market_rec FROM market_laborer_attendance WHERE expense_id = exp.id LIMIT 1;
    IF market_rec IS NOT NULL THEN
      RAISE NOTICE '  -> Found market_attendance: id=%, subcontract_id=%', market_rec.id, market_rec.subcontract_id;
    END IF;

    -- Check engineer transaction
    IF exp.engineer_transaction_id IS NOT NULL THEN
      SELECT * INTO tx_rec FROM site_engineer_transactions WHERE id = exp.engineer_transaction_id LIMIT 1;
      IF tx_rec IS NOT NULL THEN
        RAISE NOTICE '  -> Found engineer_tx: id=%, related_subcontract_id=%', tx_rec.id, tx_rec.related_subcontract_id;
      END IF;

      -- Check daily attendance via engineer_tx
      SELECT * INTO daily_rec FROM daily_attendance WHERE engineer_transaction_id = exp.engineer_transaction_id LIMIT 1;
      IF daily_rec IS NOT NULL THEN
        RAISE NOTICE '  -> Found daily via tx: id=%, subcontract_id=%', daily_rec.id, daily_rec.subcontract_id;
      END IF;

      -- Check market attendance via engineer_tx
      SELECT * INTO market_rec FROM market_laborer_attendance WHERE engineer_transaction_id = exp.engineer_transaction_id LIMIT 1;
      IF market_rec IS NOT NULL THEN
        RAISE NOTICE '  -> Found market via tx: id=%, subcontract_id=%', market_rec.id, market_rec.subcontract_id;
      END IF;
    ELSE
      RAISE NOTICE '  -> No engineer_transaction_id on this expense';
    END IF;
  END LOOP;
END $$;
