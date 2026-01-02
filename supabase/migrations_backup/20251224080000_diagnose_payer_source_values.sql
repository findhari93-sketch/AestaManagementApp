-- Diagnostic migration to check payer_source values
-- This will output the distinct values found

DO $$
DECLARE
  rec RECORD;
  total_count INTEGER;
  null_count INTEGER;
BEGIN
  -- Count total records
  SELECT COUNT(*) INTO total_count FROM settlement_groups WHERE is_cancelled = false;
  RAISE NOTICE 'Total active settlement_groups: %', total_count;

  -- Count NULL payer_source
  SELECT COUNT(*) INTO null_count FROM settlement_groups WHERE is_cancelled = false AND payer_source IS NULL;
  RAISE NOTICE 'Records with NULL payer_source: %', null_count;

  -- Show distinct payer_source values with counts
  RAISE NOTICE 'Distinct payer_source values:';
  FOR rec IN
    SELECT
      COALESCE(payer_source, '(NULL)') as source_value,
      COUNT(*) as cnt
    FROM settlement_groups
    WHERE is_cancelled = false
    GROUP BY payer_source
    ORDER BY COUNT(*) DESC
  LOOP
    RAISE NOTICE '  % : % records', rec.source_value, rec.cnt;
  END LOOP;

  -- Show sample of records with empty display (where payer_source not in expected values)
  RAISE NOTICE '';
  RAISE NOTICE 'Sample records with unexpected payer_source:';
  FOR rec IN
    SELECT
      settlement_reference,
      COALESCE(payer_source, '(NULL)') as source_value,
      COALESCE(payer_name, '(no name)') as name_value
    FROM settlement_groups
    WHERE is_cancelled = false
      AND (payer_source IS NULL
           OR payer_source NOT IN ('own_money', 'amma_money', 'client_money', 'other_site_money', 'custom'))
    LIMIT 10
  LOOP
    RAISE NOTICE '  %: payer_source=%, payer_name=%', rec.settlement_reference, rec.source_value, rec.name_value;
  END LOOP;
END $$;
