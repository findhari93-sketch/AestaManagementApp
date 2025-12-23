-- Verify v_all_expenses view returns correct payer_name
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Checking payer_name in v_all_expenses for salary settlements:';

  FOR rec IN
    SELECT
      settlement_reference,
      expense_type,
      COALESCE(payer_name, '(NULL)') as payer_display
    FROM v_all_expenses
    WHERE source_type = 'settlement'
      AND is_deleted = false
    ORDER BY date DESC
    LIMIT 15
  LOOP
    RAISE NOTICE '  %: type=%, payer=%', rec.settlement_reference, rec.expense_type, rec.payer_display;
  END LOOP;

  -- Count distinct payer_name values in view
  RAISE NOTICE '';
  RAISE NOTICE 'Distinct payer_name values in v_all_expenses (settlements only):';
  FOR rec IN
    SELECT
      COALESCE(payer_name, '(NULL)') as payer_display,
      COUNT(*) as cnt
    FROM v_all_expenses
    WHERE source_type = 'settlement'
      AND is_deleted = false
    GROUP BY payer_name
    ORDER BY cnt DESC
  LOOP
    RAISE NOTICE '  %: % records', rec.payer_display, rec.cnt;
  END LOOP;
END $$;
