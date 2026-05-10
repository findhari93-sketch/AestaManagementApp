-- Vendor recent activity summary RPC for the AI ingest Preview vendor card.
-- Standalone file (no GRANT here); companion 20260510100130_ai_ingest_v2_grants.sql.

CREATE OR REPLACE FUNCTION public.get_vendor_recent_summary(
  p_vendor_id UUID,
  p_days      INT DEFAULT 30
)
RETURNS TABLE (
  bill_count   INT,
  total_amount NUMERIC,
  avg_amount   NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $body$
  SELECT
    COUNT(*)::INT                           AS bill_count,
    COALESCE(SUM(total_amount), 0)::NUMERIC AS total_amount,
    COALESCE(AVG(total_amount), 0)::NUMERIC AS avg_amount
  FROM material_purchase_expenses
  WHERE vendor_id = p_vendor_id
    AND purchase_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL;
$body$;
