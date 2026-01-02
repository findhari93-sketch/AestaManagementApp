-- ============================================
-- PRICE ANALYTICS ENHANCEMENTS
-- Add price change reasons, bill tracking
-- Created: 2024-12-30
-- ============================================

-- ============================================
-- PRICE CHANGE REASONS TABLE
-- Common reasons for price changes
-- ============================================

CREATE TABLE IF NOT EXISTS price_change_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason TEXT NOT NULL,
  description TEXT,
  is_increase BOOLEAN,  -- true = price went up, false = price went down, NULL = either
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed common price change reasons
INSERT INTO price_change_reasons (reason, description, is_increase, sort_order) VALUES
  ('Market rate increase', 'General market price increase due to demand/supply', true, 1),
  ('Fuel price increase', 'Transportation costs increased due to fuel prices', true, 2),
  ('Raw material shortage', 'Shortage of raw materials driving prices up', true, 3),
  ('Seasonal demand', 'High demand during construction season', true, 4),
  ('Bulk order discount', 'Discount for ordering large quantities', false, 5),
  ('New vendor negotiation', 'Better rates negotiated with vendor', false, 6),
  ('Long-term contract rate', 'Fixed rate from long-term supply agreement', false, 7),
  ('Quality upgrade', 'Higher quality product at premium price', true, 8),
  ('Quality downgrade', 'Lower quality product at reduced price', false, 9),
  ('Transportation cost change', 'Change in delivery/transport costs', NULL, 10),
  ('GST rate change', 'Government GST rate adjustment', NULL, 11),
  ('Currency fluctuation', 'Import material price change due to forex', NULL, 12),
  ('Promotional offer', 'Temporary promotional pricing', false, 13),
  ('End of promotion', 'Return to regular pricing after promo', true, 14),
  ('Other', 'Other reason (specify in notes)', NULL, 15)
ON CONFLICT DO NOTHING;

-- ============================================
-- ENHANCE PRICE_HISTORY TABLE
-- Add reason tracking and bill info
-- ============================================

ALTER TABLE price_history ADD COLUMN IF NOT EXISTS change_reason_id UUID REFERENCES price_change_reasons(id);
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS change_reason_text TEXT;  -- For custom reasons
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS change_percentage DECIMAL(8,2);  -- % change from previous
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS bill_url TEXT;  -- Link to uploaded bill/invoice
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS bill_number TEXT;  -- Invoice/bill number
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS bill_date DATE;  -- Date on the bill
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_price_history_change_reason ON price_history(change_reason_id);
CREATE INDEX IF NOT EXISTS idx_price_history_bill ON price_history(bill_number);

-- ============================================
-- VIEW FOR PRICE HISTORY WITH DETAILS
-- ============================================

DROP VIEW IF EXISTS v_price_history_details;
CREATE OR REPLACE VIEW v_price_history_details AS
SELECT
  ph.id,
  ph.material_id,
  m.name as material_name,
  m.code as material_code,
  m.unit as material_unit,
  ph.vendor_id,
  v.name as vendor_name,
  v.shop_name as vendor_shop_name,
  ph.brand_id,
  mb.brand_name,
  ph.price,
  ph.recorded_date,
  ph.change_reason_id,
  pcr.reason as change_reason,
  pcr.is_increase as reason_is_increase,
  ph.change_reason_text,
  ph.change_percentage,
  ph.bill_url,
  ph.bill_number,
  ph.bill_date,
  ph.notes,
  ph.created_at,
  -- Calculate previous price and change
  LAG(ph.price) OVER (
    PARTITION BY ph.material_id, ph.vendor_id
    ORDER BY ph.recorded_date
  ) as previous_price,
  ph.price - LAG(ph.price) OVER (
    PARTITION BY ph.material_id, ph.vendor_id
    ORDER BY ph.recorded_date
  ) as price_change
FROM price_history ph
JOIN materials m ON m.id = ph.material_id
LEFT JOIN vendors v ON v.id = ph.vendor_id
LEFT JOIN material_brands mb ON mb.id = ph.brand_id
LEFT JOIN price_change_reasons pcr ON pcr.id = ph.change_reason_id
ORDER BY ph.recorded_date DESC;

-- ============================================
-- FUNCTION TO RECORD PRICE WITH CHANGE TRACKING
-- ============================================

CREATE OR REPLACE FUNCTION record_price_with_reason(
  p_material_id UUID,
  p_vendor_id UUID,
  p_brand_id UUID,
  p_price DECIMAL,
  p_recorded_date DATE,
  p_source TEXT DEFAULT 'manual',
  p_change_reason_id UUID DEFAULT NULL,
  p_change_reason_text TEXT DEFAULT NULL,
  p_bill_url TEXT DEFAULT NULL,
  p_bill_number TEXT DEFAULT NULL,
  p_bill_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_previous_price DECIMAL;
  v_change_percentage DECIMAL;
BEGIN
  -- Get the previous price for this material/vendor combo
  SELECT price INTO v_previous_price
  FROM price_history
  WHERE material_id = p_material_id
    AND vendor_id = p_vendor_id
    AND (brand_id = p_brand_id OR (brand_id IS NULL AND p_brand_id IS NULL))
  ORDER BY recorded_date DESC
  LIMIT 1;

  -- Calculate percentage change
  IF v_previous_price IS NOT NULL AND v_previous_price > 0 THEN
    v_change_percentage := ((p_price - v_previous_price) / v_previous_price) * 100;
  END IF;

  -- Insert the new price record
  INSERT INTO price_history (
    material_id,
    vendor_id,
    brand_id,
    price,
    recorded_date,
    source,
    change_reason_id,
    change_reason_text,
    change_percentage,
    bill_url,
    bill_number,
    bill_date,
    notes
  ) VALUES (
    p_material_id,
    p_vendor_id,
    p_brand_id,
    p_price,
    p_recorded_date,
    p_source,
    p_change_reason_id,
    p_change_reason_text,
    v_change_percentage,
    p_bill_url,
    p_bill_number,
    p_bill_date,
    p_notes
  )
  RETURNING id INTO v_id;

  -- Update vendor_inventory with new price
  UPDATE vendor_inventory
  SET current_price = p_price,
      updated_at = NOW()
  WHERE material_id = p_material_id
    AND vendor_id = p_vendor_id
    AND (brand_id = p_brand_id OR (brand_id IS NULL AND p_brand_id IS NULL));

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW FOR PRICE TRENDS (for charts)
-- ============================================

DROP VIEW IF EXISTS v_price_trends;
CREATE OR REPLACE VIEW v_price_trends AS
SELECT
  ph.material_id,
  m.name as material_name,
  ph.vendor_id,
  v.name as vendor_name,
  ph.brand_id,
  mb.brand_name,
  ph.recorded_date,
  ph.price,
  ph.change_percentage,
  -- 30-day moving average
  AVG(ph.price) OVER (
    PARTITION BY ph.material_id, ph.vendor_id
    ORDER BY ph.recorded_date
    ROWS BETWEEN 30 PRECEDING AND CURRENT ROW
  ) as moving_avg_30d,
  -- Min/max in last 90 days
  MIN(ph.price) OVER (
    PARTITION BY ph.material_id, ph.vendor_id
    ORDER BY ph.recorded_date
    ROWS BETWEEN 90 PRECEDING AND CURRENT ROW
  ) as min_price_90d,
  MAX(ph.price) OVER (
    PARTITION BY ph.material_id, ph.vendor_id
    ORDER BY ph.recorded_date
    ROWS BETWEEN 90 PRECEDING AND CURRENT ROW
  ) as max_price_90d
FROM price_history ph
JOIN materials m ON m.id = ph.material_id
LEFT JOIN vendors v ON v.id = ph.vendor_id
LEFT JOIN material_brands mb ON mb.id = ph.brand_id
ORDER BY ph.material_id, ph.vendor_id, ph.recorded_date;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Allow authenticated users to view price change reasons
ALTER TABLE price_change_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read price_change_reasons"
  ON price_change_reasons FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- END OF PRICE ANALYTICS MIGRATION
-- ============================================
