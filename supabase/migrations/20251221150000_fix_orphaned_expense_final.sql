-- Final fix for orphaned expense
-- The expense d315c143-ce1c-4089-bcbe-dfad8732354d needs to be linked to a subcontract

-- First, let's find all market attendance for Nov 17, 2025 across all sites and link them
DO $$
DECLARE
  exp_id UUID := 'd315c143-ce1c-4089-bcbe-dfad8732354d';
  exp_site_id UUID;
  subcontract_id_val UUID;
BEGIN
  -- Get the site_id from the expense
  SELECT site_id INTO exp_site_id FROM expenses WHERE id = exp_id;

  IF exp_site_id IS NULL THEN
    RAISE NOTICE 'Expense not found';
    RETURN;
  END IF;

  -- Get the active subcontract for this site (assuming there's only one active)
  SELECT id INTO subcontract_id_val
  FROM subcontracts
  WHERE site_id = exp_site_id
    AND status IN ('active', 'on_hold')
  LIMIT 1;

  IF subcontract_id_val IS NOT NULL THEN
    -- Update the expense with this subcontract
    UPDATE expenses
    SET contract_id = subcontract_id_val
    WHERE id = exp_id AND contract_id IS NULL;

    RAISE NOTICE 'Updated expense % with subcontract %', exp_id, subcontract_id_val;
  ELSE
    RAISE NOTICE 'No active subcontract found for site %', exp_site_id;
  END IF;
END $$;

-- Verify the fix
DO $$
DECLARE
  unlinked_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unlinked_count
  FROM expenses
  WHERE module = 'labor'
    AND contract_id IS NULL
    AND is_cleared = true;

  RAISE NOTICE 'Remaining unlinked cleared labor expenses: %', unlinked_count;
END $$;
