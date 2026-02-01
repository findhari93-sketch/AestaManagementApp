-- Fix migration: Apply RLS policies for tmt_weight_history
-- The previous migration failed at the RLS policy creation step

-- Drop existing policies if they exist (cleanup)
DROP POLICY IF EXISTS "Users can read weight history for company vendors" ON tmt_weight_history;
DROP POLICY IF EXISTS "Service role can manage weight history" ON tmt_weight_history;
DROP POLICY IF EXISTS "allow_select_tmt_weight_history" ON tmt_weight_history;
DROP POLICY IF EXISTS "allow_all_tmt_weight_history" ON tmt_weight_history;

-- Enable RLS (safe to run even if already enabled)
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

-- Create the trigger if it doesn't exist
-- First, create or replace the function
CREATE OR REPLACE FUNCTION record_tmt_weight_history()
RETURNS TRIGGER AS $$
DECLARE
  v_vendor_id UUID;
  v_material_id UUID;
  v_brand_id UUID;
  v_source_po_id UUID;
  v_is_tmt BOOLEAN;
BEGIN
  -- Get the PO details to check if it's a TMT material
  SELECT
    po.vendor_id,
    poi.material_id,
    poi.brand_id,
    poi.po_id,
    m.category_id = (SELECT id FROM material_categories WHERE name ILIKE '%TMT%' OR name ILIKE '%steel%' LIMIT 1)
  INTO
    v_vendor_id,
    v_material_id,
    v_brand_id,
    v_source_po_id,
    v_is_tmt
  FROM purchase_order_items poi
  JOIN purchase_orders po ON po.id = poi.po_id
  JOIN materials m ON m.id = poi.material_id
  WHERE poi.id = NEW.id;

  -- Only record history for TMT materials with actual weight data
  IF v_is_tmt AND NEW.actual_weight IS NOT NULL AND NEW.actual_weight > 0 AND NEW.quantity > 0 THEN
    -- Calculate weight per piece
    DECLARE
      v_weight_per_piece NUMERIC;
      v_standard_weight NUMERIC;
      v_deviation_percent NUMERIC;
    BEGIN
      v_weight_per_piece := NEW.actual_weight / NEW.quantity;

      -- Get standard weight from material if available
      SELECT weight_per_unit INTO v_standard_weight
      FROM materials WHERE id = v_material_id;

      -- Calculate deviation from standard
      IF v_standard_weight IS NOT NULL AND v_standard_weight > 0 THEN
        v_deviation_percent := ((v_weight_per_piece - v_standard_weight) / v_standard_weight) * 100;
      END IF;

      -- Insert or update weight history
      INSERT INTO tmt_weight_history (
        vendor_id,
        material_id,
        brand_id,
        quantity,
        actual_weight,
        weight_per_piece,
        standard_weight,
        deviation_percent,
        source_po_id,
        recorded_date
      ) VALUES (
        v_vendor_id,
        v_material_id,
        v_brand_id,
        NEW.quantity,
        NEW.actual_weight,
        v_weight_per_piece,
        v_standard_weight,
        v_deviation_percent,
        v_source_po_id,
        NOW()
      )
      ON CONFLICT (vendor_id, material_id, COALESCE(brand_id, '00000000-0000-0000-0000-000000000000'::uuid), source_po_id)
      DO UPDATE SET
        quantity = EXCLUDED.quantity,
        actual_weight = EXCLUDED.actual_weight,
        weight_per_piece = EXCLUDED.weight_per_piece,
        standard_weight = EXCLUDED.standard_weight,
        deviation_percent = EXCLUDED.deviation_percent,
        recorded_date = NOW();
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS trg_record_tmt_weight_history ON purchase_order_items;
CREATE TRIGGER trg_record_tmt_weight_history
AFTER INSERT OR UPDATE OF actual_weight, actual_weight_per_piece
ON purchase_order_items
FOR EACH ROW
EXECUTE FUNCTION record_tmt_weight_history();
