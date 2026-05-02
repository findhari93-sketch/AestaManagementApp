-- Backfill the 5 pre-existing non-in-house subcontracts (all Civil work:
-- floor construction, house construction, BCD grid) to the Civil trade
-- category so they appear in /site/trades. Future non-civil contracts will
-- have trade_category_id set at creation by the new quick-create dialog.
--
-- Applied to production via mcp__supabase__apply_migration on 2026-05-02
-- after the parent trade-dimension migration (20260502120000) revealed that
-- existing subcontracts had trade_category_id NULL and were therefore
-- filtered out of /site/trades by groupContractsByTrade.

UPDATE public.subcontracts
   SET trade_category_id = (SELECT id FROM public.labor_categories WHERE name = 'Civil' LIMIT 1)
 WHERE trade_category_id IS NULL
   AND is_in_house = false;
