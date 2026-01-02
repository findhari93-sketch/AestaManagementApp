-- Migration: Add wallet settlement traceability
-- Purpose: Link batch deposits to their usage in settlements for better tracking

-- ============================================================================
-- 1. Add function to get settlement summary for a batch
-- ============================================================================

-- Function to get all settlements funded by a specific batch
CREATE OR REPLACE FUNCTION get_batch_settlement_summary(batch_id UUID)
RETURNS TABLE (
  settlement_reference TEXT,
  settlement_date DATE,
  amount_used NUMERIC,
  laborer_count INT,
  site_name TEXT,
  payment_channel TEXT
) AS $$
  SELECT
    sg.settlement_reference,
    sg.settlement_date,
    ewbu.amount_used,
    sg.laborer_count,
    s.name as site_name,
    sg.payment_channel
  FROM engineer_wallet_batch_usage ewbu
  JOIN site_engineer_transactions spent ON spent.id = ewbu.transaction_id
  JOIN settlement_groups sg ON sg.id = spent.settlement_group_id
  JOIN sites s ON s.id = sg.site_id
  WHERE ewbu.batch_transaction_id = batch_id
  ORDER BY sg.settlement_date DESC;
$$ LANGUAGE sql;

COMMENT ON FUNCTION get_batch_settlement_summary IS 'Returns all settlements that used money from a specific wallet batch';

-- ============================================================================
-- 2. Add function to get batch sources for a settlement
-- ============================================================================

-- Function to get all batches that funded a specific settlement
CREATE OR REPLACE FUNCTION get_settlement_batch_sources(p_settlement_group_id UUID)
RETURNS TABLE (
  batch_code TEXT,
  batch_transaction_id UUID,
  amount_used NUMERIC,
  payer_source TEXT,
  payer_name TEXT,
  batch_date DATE
) AS $$
  SELECT
    batch_tx.batch_code,
    ewbu.batch_transaction_id,
    ewbu.amount_used,
    batch_tx.payer_source,
    batch_tx.payer_name,
    batch_tx.transaction_date::DATE as batch_date
  FROM settlement_groups sg
  JOIN site_engineer_transactions spent_tx ON spent_tx.settlement_group_id = sg.id
  JOIN engineer_wallet_batch_usage ewbu ON ewbu.transaction_id = spent_tx.id
  JOIN site_engineer_transactions batch_tx ON batch_tx.id = ewbu.batch_transaction_id
  WHERE sg.id = p_settlement_group_id
  ORDER BY ewbu.amount_used DESC;
$$ LANGUAGE sql;

COMMENT ON FUNCTION get_settlement_batch_sources IS 'Returns all batch deposits that funded a specific settlement';

-- ============================================================================
-- 3. Add function to get laborers paid in a settlement
-- ============================================================================

CREATE OR REPLACE FUNCTION get_settlement_laborers(p_settlement_group_id UUID)
RETURNS TABLE (
  laborer_id UUID,
  laborer_name TEXT,
  amount NUMERIC,
  work_date DATE,
  attendance_type TEXT
) AS $$
  -- Daily laborers
  SELECT
    l.id as laborer_id,
    l.name as laborer_name,
    da.daily_earnings as amount,
    da.date as work_date,
    'daily'::TEXT as attendance_type
  FROM daily_attendance da
  JOIN laborers l ON l.id = da.laborer_id
  WHERE da.settlement_group_id = p_settlement_group_id

  UNION ALL

  -- Market laborers
  SELECT
    NULL as laborer_id,
    lr.name as laborer_name,
    mla.total_cost as amount,
    mla.date as work_date,
    'market'::TEXT as attendance_type
  FROM market_laborer_attendance mla
  JOIN labor_roles lr ON lr.id = mla.role_id
  WHERE mla.settlement_group_id = p_settlement_group_id

  ORDER BY work_date, laborer_name;
$$ LANGUAGE sql;

COMMENT ON FUNCTION get_settlement_laborers IS 'Returns all laborers paid in a specific settlement';
