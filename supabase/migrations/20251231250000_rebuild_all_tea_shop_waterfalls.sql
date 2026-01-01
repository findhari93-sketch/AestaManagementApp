-- Manual rebuild of all tea shop waterfalls to fix current data
-- This runs once to correct any entries with incorrect payment status

DO $$
DECLARE
  shop_rec RECORD;
BEGIN
  FOR shop_rec IN SELECT id, shop_name FROM tea_shop_accounts LOOP
    PERFORM rebuild_tea_shop_waterfall(shop_rec.id);
    RAISE NOTICE 'Rebuilt waterfall for shop: %', shop_rec.shop_name;
  END LOOP;
END $$;
