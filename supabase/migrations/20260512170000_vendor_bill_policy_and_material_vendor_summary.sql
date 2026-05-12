-- =====================================================================
-- Slice 1 of Material Inspect Pane redesign
--   * vendors.bill_policy — captures mandy-dealer behaviour: some sellers
--     never issue a bill, some skip the bill when paid in cash, the rest
--     always bill. Existing accepts_cash stays as a payment-method flag.
--   * get_material_vendor_summary(material_id) RPC — drives the new
--     deduped Vendors tab. Returns one row per vendor across the
--     material and its variant children, with quote count, brand chips,
--     last purchase and total purchased aggregates.
-- =====================================================================

-- 1. Enum + column ----------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_bill_policy') THEN
    CREATE TYPE public.vendor_bill_policy AS ENUM (
      'always_bills',
      'bills_unless_cash',
      'no_bills'
    );
  END IF;
END$$;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS bill_policy public.vendor_bill_policy
    NOT NULL DEFAULT 'always_bills';

COMMENT ON COLUMN public.vendors.bill_policy IS
  'Whether the vendor issues bills. always_bills = standard GST seller, '
  'bills_unless_cash = mandy dealer who skips bill on cash payments, '
  'no_bills = never issues bills (cash-only, no GST).';

-- 2. RPC ---------------------------------------------------------------
-- Returns one row per vendor that has either a quote or a purchase
-- against this material or any of its active variant children.

CREATE OR REPLACE FUNCTION public.get_material_vendor_summary(
  p_material_id uuid
)
RETURNS TABLE (
  vendor_id              uuid,
  vendor_name            text,
  shop_name              text,
  vendor_type            text,
  bill_policy            text,
  accepts_cash           boolean,
  accepts_upi            boolean,
  accepts_credit         boolean,
  gst_number             text,
  quote_count            integer,
  brand_chips            text[],
  distinct_brands_count  integer,
  min_price              numeric,
  latest_quote_updated   timestamptz,
  last_purchase_date     date,
  last_purchase_amount   numeric,
  total_purchased_value  numeric,
  total_purchased_qty    numeric,
  purchase_count         integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $body$
WITH material_set AS (
  SELECT p_material_id AS id
  UNION
  SELECT m.id FROM materials m
   WHERE m.parent_id = p_material_id
     AND m.is_active = TRUE
),
quotes AS (
  SELECT
    vi.vendor_id,
    COUNT(*)::int                                                AS quote_count,
    MIN(vi.current_price)                                        AS min_price,
    MAX(COALESCE(vi.last_price_update, vi.updated_at))           AS latest_quote_updated,
    ARRAY_AGG(DISTINCT mb.brand_name)
      FILTER (WHERE mb.brand_name IS NOT NULL)                   AS brand_chips,
    COUNT(DISTINCT vi.brand_id)
      FILTER (WHERE vi.brand_id IS NOT NULL)::int                AS distinct_brands_count
  FROM vendor_inventory vi
  LEFT JOIN material_brands mb ON mb.id = vi.brand_id
  WHERE vi.material_id IN (SELECT id FROM material_set)
    AND vi.is_available = TRUE
  GROUP BY vi.vendor_id
),
-- Per-(vendor, purchase) subtotal restricted to this material set, so
-- "last purchase amount" reflects what was spent on THIS material, not
-- the whole bill that may contain other lines.
per_purchase AS (
  SELECT
    mpe.id              AS purchase_id,
    mpe.vendor_id,
    mpe.purchase_date,
    SUM(mpei.total_price)  AS purchase_subtotal,
    SUM(mpei.quantity)     AS purchase_qty
  FROM material_purchase_expense_items mpei
  JOIN material_purchase_expenses mpe
    ON mpe.id = mpei.purchase_expense_id
  WHERE mpei.material_id IN (SELECT id FROM material_set)
    AND mpe.vendor_id IS NOT NULL
  GROUP BY mpe.id, mpe.vendor_id, mpe.purchase_date
),
purchase_totals AS (
  SELECT
    vendor_id,
    COUNT(*)::int            AS purchase_count,
    SUM(purchase_subtotal)   AS total_purchased_value,
    SUM(purchase_qty)        AS total_purchased_qty
  FROM per_purchase
  GROUP BY vendor_id
),
last_purchase AS (
  SELECT DISTINCT ON (pp.vendor_id)
    pp.vendor_id,
    pp.purchase_date         AS last_purchase_date,
    pp.purchase_subtotal     AS last_purchase_amount
  FROM per_purchase pp
  ORDER BY pp.vendor_id, pp.purchase_date DESC, pp.purchase_id DESC
)
SELECT
  v.id                                            AS vendor_id,
  v.name                                          AS vendor_name,
  v.shop_name                                     AS shop_name,
  v.vendor_type::text                             AS vendor_type,
  v.bill_policy::text                             AS bill_policy,
  v.accepts_cash                                  AS accepts_cash,
  v.accepts_upi                                   AS accepts_upi,
  v.accepts_credit                                AS accepts_credit,
  v.gst_number                                    AS gst_number,
  COALESCE(q.quote_count, 0)                      AS quote_count,
  COALESCE(q.brand_chips, ARRAY[]::text[])        AS brand_chips,
  COALESCE(q.distinct_brands_count, 0)            AS distinct_brands_count,
  q.min_price                                     AS min_price,
  q.latest_quote_updated                          AS latest_quote_updated,
  lp.last_purchase_date                           AS last_purchase_date,
  lp.last_purchase_amount                         AS last_purchase_amount,
  pt.total_purchased_value                        AS total_purchased_value,
  pt.total_purchased_qty                          AS total_purchased_qty,
  COALESCE(pt.purchase_count, 0)                  AS purchase_count
FROM vendors v
LEFT JOIN quotes          q  ON q.vendor_id  = v.id
LEFT JOIN purchase_totals pt ON pt.vendor_id = v.id
LEFT JOIN last_purchase   lp ON lp.vendor_id = v.id
WHERE v.is_active = TRUE
  AND (q.vendor_id IS NOT NULL OR pt.vendor_id IS NOT NULL)
ORDER BY q.min_price NULLS LAST, v.name;
$body$;

GRANT EXECUTE ON FUNCTION public.get_material_vendor_summary(uuid) TO authenticated;
