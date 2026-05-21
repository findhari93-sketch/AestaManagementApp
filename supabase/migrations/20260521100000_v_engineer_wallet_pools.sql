-- Per-source running pool balance per (engineer, site).
--
-- Phase 3 of the wallet payer-source attribution feature: gives the UI a
-- single read for "how much of each source pool is left in Ajith's wallet
-- at Padmavathy" so /site/my-wallet can render a breakdown card.
--
-- Pool composition per source:
--   deposited     = SUM(non-cancelled deposits of this source for this engineer+site)
--   spent         = SUM(allocations of this source against non-cancelled spends for this engineer+site)
--   available     = deposited − spent (clamped to >= 0; overdraft shows separately)
--
-- The view also surfaces overdraft rows (kind='overdraft') as their own
-- pseudo-source so the wallet card can label them clearly.

CREATE OR REPLACE VIEW v_engineer_wallet_pools AS
WITH deposits AS (
  SELECT
    t.user_id,
    t.site_id,
    t.payer_source,
    SUM(t.amount) AS deposited
  FROM site_engineer_transactions t
  WHERE t.transaction_type = 'deposit'
    AND t.cancelled_at IS NULL
    AND t.payer_source IS NOT NULL
  GROUP BY t.user_id, t.site_id, t.payer_source
),
spent AS (
  SELECT
    s.user_id,
    s.site_id,
    a.payer_source,
    a.kind,
    SUM(a.amount) AS spent
  FROM engineer_wallet_spend_allocations a
  JOIN site_engineer_transactions s ON s.id = a.spend_id
  WHERE s.cancelled_at IS NULL
  GROUP BY s.user_id, s.site_id, a.payer_source, a.kind
)
SELECT
  COALESCE(d.user_id, sp.user_id) AS user_id,
  COALESCE(d.site_id, sp.site_id) AS site_id,
  COALESCE(d.payer_source, sp.payer_source) AS payer_source,
  COALESCE(sp.kind, 'source') AS kind,
  COALESCE(d.deposited, 0) AS deposited,
  COALESCE(sp.spent, 0) AS spent,
  GREATEST(COALESCE(d.deposited, 0) - COALESCE(sp.spent, 0), 0) AS available
FROM deposits d
FULL OUTER JOIN spent sp
  ON d.user_id = sp.user_id
 AND d.site_id = sp.site_id
 AND d.payer_source = sp.payer_source
WHERE COALESCE(d.deposited, 0) > 0 OR COALESCE(sp.spent, 0) > 0;

COMMENT ON VIEW v_engineer_wallet_pools IS
  'Per-source pool balances per (engineer, site). Drives the wallet breakdown card on /site/my-wallet. Overdraft rows appear with kind=overdraft + payer_source=overdraft.';

GRANT SELECT ON v_engineer_wallet_pools TO authenticated;
