-- Fix the orphaned expense for Nov 17, 2025
-- The expense description says "market laborers payment for Nov 17, 2025"
-- So we need to find the market_laborer_attendance for that date and link them

-- First, let's find the market attendance for Nov 17 with amount 800 and get its subcontract_id
DO $$
DECLARE
  exp_id UUID := 'd315c143-ce1c-4089-bcbe-dfad8732354d';
  market_rec RECORD;
  site_id_val UUID;
BEGIN
  -- Get the site_id from the expense
  SELECT site_id INTO site_id_val FROM expenses WHERE id = exp_id;

  -- Find market attendance for Nov 17, 2025 at the same site with total_cost = 800
  SELECT * INTO market_rec
  FROM market_laborer_attendance
  WHERE date = '2025-11-17'
    AND site_id = site_id_val
    AND total_cost = 800
  LIMIT 1;

  IF market_rec IS NOT NULL THEN
    RAISE NOTICE 'Found market attendance: id=%, subcontract_id=%, engineer_tx=%',
      market_rec.id, market_rec.subcontract_id, market_rec.engineer_transaction_id;

    -- Update the expense with the subcontract_id from the attendance
    IF market_rec.subcontract_id IS NOT NULL THEN
      UPDATE expenses SET contract_id = market_rec.subcontract_id WHERE id = exp_id;
      RAISE NOTICE 'Updated expense with contract_id=%', market_rec.subcontract_id;
    ELSE
      RAISE NOTICE 'Market attendance has no subcontract_id - cannot link';
    END IF;

    -- Also link the expense to the attendance if not already linked
    IF market_rec.expense_id IS NULL THEN
      UPDATE market_laborer_attendance SET expense_id = exp_id WHERE id = market_rec.id;
      RAISE NOTICE 'Linked expense to market attendance';
    END IF;

    -- If the attendance has engineer_transaction_id, update the expense too
    IF market_rec.engineer_transaction_id IS NOT NULL THEN
      UPDATE expenses SET engineer_transaction_id = market_rec.engineer_transaction_id WHERE id = exp_id;
      RAISE NOTICE 'Updated expense engineer_transaction_id';
    END IF;
  ELSE
    -- Try to find any market attendance for Nov 17 at the same site
    SELECT * INTO market_rec
    FROM market_laborer_attendance
    WHERE date = '2025-11-17'
      AND site_id = site_id_val
    LIMIT 1;

    IF market_rec IS NOT NULL THEN
      RAISE NOTICE 'Found market attendance (different amount): id=%, amount=%, subcontract_id=%',
        market_rec.id, market_rec.total_cost, market_rec.subcontract_id;

      -- Update anyway if we found something
      IF market_rec.subcontract_id IS NOT NULL THEN
        UPDATE expenses SET contract_id = market_rec.subcontract_id WHERE id = exp_id;
        RAISE NOTICE 'Updated expense with contract_id=%', market_rec.subcontract_id;
      END IF;
    ELSE
      RAISE NOTICE 'No market attendance found for Nov 17, 2025 at this site';
    END IF;
  END IF;
END $$;
