-- Migration: Create TMT weight history table for smart weight prediction
-- Purpose: Track actual weights per vendor/material/brand for predicting future purchases

-- Create weight history table
CREATE TABLE IF NOT EXISTS tmt_weight_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES material_brands(id) ON DELETE SET NULL,

  -- Weight data (per piece, derived from actual_weight / quantity)
  actual_weight_per_piece DECIMAL(10,4) NOT NULL,
  standard_weight_per_piece DECIMAL(10,4), -- From material specs for comparison
  deviation_percent DECIMAL(5,2), -- ((actual - standard) / standard) * 100

  -- Source reference
  source_po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  source_po_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  quantity_in_sample INTEGER NOT NULL, -- How many pieces in this data point
  total_weight DECIMAL(12,3) NOT NULL, -- Actual total weight recorded

  -- Metadata
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint to prevent duplicates from same PO item
  CONSTRAINT unique_weight_history_per_po_item UNIQUE (source_po_item_id)
);

-- Comments for documentation
COMMENT ON TABLE tmt_weight_history IS 'Historical weight data per vendor/material/brand for TMT weight prediction';
COMMENT ON COLUMN tmt_weight_history.actual_weight_per_piece IS 'Actual weight per piece = actual_weight / quantity';
COMMENT ON COLUMN tmt_weight_history.deviation_percent IS 'Deviation from standard weight as percentage';
COMMENT ON COLUMN tmt_weight_history.quantity_in_sample IS 'Number of pieces in this measurement (affects confidence)';

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_weight_history_vendor_material
  ON tmt_weight_history(vendor_id, material_id);
CREATE INDEX IF NOT EXISTS idx_weight_history_vendor_material_brand
  ON tmt_weight_history(vendor_id, material_id, brand_id);
CREATE INDEX IF NOT EXISTS idx_weight_history_recorded_date
  ON tmt_weight_history(recorded_date DESC);

-- View for aggregated weight statistics per vendor/material/brand
CREATE OR REPLACE VIEW v_weight_prediction_stats AS
SELECT
  vendor_id,
  material_id,
  brand_id,
  COUNT(*) as sample_count,
  SUM(quantity_in_sample) as total_pieces_sampled,
  AVG(actual_weight_per_piece)::DECIMAL(10,4) as avg_weight_per_piece,
  STDDEV_POP(actual_weight_per_piece)::DECIMAL(10,4) as weight_stddev,
  MIN(actual_weight_per_piece)::DECIMAL(10,4) as min_weight,
  MAX(actual_weight_per_piece)::DECIMAL(10,4) as max_weight,
  AVG(deviation_percent)::DECIMAL(5,2) as avg_deviation_percent,
  MAX(recorded_date) as last_recorded_date
FROM tmt_weight_history
GROUP BY vendor_id, material_id, brand_id;

COMMENT ON VIEW v_weight_prediction_stats IS 'Aggregated weight statistics for prediction calculations';

-- Function to auto-record weight history when PO items have actual_weight
CREATE OR REPLACE FUNCTION record_tmt_weight_history()
RETURNS TRIGGER AS $$
DECLARE
  v_material_record RECORD;
  v_standard_piece_weight DECIMAL(10,4);
  v_deviation DECIMAL(5,2);
  v_vendor_id UUID;
BEGIN
  -- Only process if actual_weight and actual_weight_per_piece are set
  IF NEW.actual_weight IS NOT NULL
     AND NEW.actual_weight_per_piece IS NOT NULL
     AND NEW.quantity > 0
  THEN
    -- Get vendor_id from PO
    SELECT vendor_id INTO v_vendor_id
    FROM purchase_orders WHERE id = NEW.po_id;

    IF v_vendor_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Get material data to check if it's a weight-tracked material (TMT)
    SELECT weight_per_unit, length_per_piece, length_unit
    INTO v_material_record
    FROM materials WHERE id = NEW.material_id;

    -- Only record for weight-tracked materials (those with weight_per_unit)
    IF v_material_record.weight_per_unit IS NOT NULL
       AND v_material_record.length_per_piece IS NOT NULL
    THEN
      -- Calculate standard piece weight (weight_per_unit is kg/meter)
      v_standard_piece_weight := v_material_record.weight_per_unit *
        CASE WHEN v_material_record.length_unit = 'ft'
             THEN v_material_record.length_per_piece * 0.3048
             ELSE v_material_record.length_per_piece
        END;

      -- Calculate deviation percentage
      IF v_standard_piece_weight > 0 THEN
        v_deviation := ((NEW.actual_weight_per_piece - v_standard_piece_weight) / v_standard_piece_weight) * 100;
      ELSE
        v_deviation := NULL;
      END IF;

      -- Insert or update weight history (upsert on source_po_item_id)
      INSERT INTO tmt_weight_history (
        vendor_id,
        material_id,
        brand_id,
        actual_weight_per_piece,
        standard_weight_per_piece,
        deviation_percent,
        source_po_id,
        source_po_item_id,
        quantity_in_sample,
        total_weight,
        recorded_date
      ) VALUES (
        v_vendor_id,
        NEW.material_id,
        NEW.brand_id,
        NEW.actual_weight_per_piece,
        v_standard_piece_weight,
        v_deviation,
        NEW.po_id,
        NEW.id,
        NEW.quantity::INTEGER,
        NEW.actual_weight,
        CURRENT_DATE
      )
      ON CONFLICT (source_po_item_id) DO UPDATE SET
        actual_weight_per_piece = EXCLUDED.actual_weight_per_piece,
        total_weight = EXCLUDED.total_weight,
        deviation_percent = EXCLUDED.deviation_percent,
        quantity_in_sample = EXCLUDED.quantity_in_sample,
        recorded_date = CURRENT_DATE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-recording weight history
DROP TRIGGER IF EXISTS trg_record_tmt_weight_history ON purchase_order_items;
CREATE TRIGGER trg_record_tmt_weight_history
AFTER INSERT OR UPDATE OF actual_weight, actual_weight_per_piece
ON purchase_order_items
FOR EACH ROW
EXECUTE FUNCTION record_tmt_weight_history();

-- Enable RLS
ALTER TABLE tmt_weight_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can read weight history
CREATE POLICY "allow_select_tmt_weight_history"
ON tmt_weight_history
FOR SELECT
TO authenticated
USING (true);

-- RLS Policy: Admin/office users can manage weight history
CREATE POLICY "allow_all_tmt_weight_history"
ON tmt_weight_history
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('admin', 'office')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('admin', 'office')
  )
);
