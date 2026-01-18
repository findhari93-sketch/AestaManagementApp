-- ============================================
-- Price Alerts System
-- Tables for configuring and tracking price alerts
-- ============================================

-- Price Alerts Configuration Table
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES material_brands(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'price_increase', 'threshold_below', 'threshold_above')),
  threshold_value NUMERIC(12, 2), -- For threshold_below/threshold_above alerts
  threshold_percent NUMERIC(5, 2), -- For price_drop/price_increase alerts
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Price Alerts Triggered Table (history of triggered alerts)
CREATE TABLE IF NOT EXISTS price_alerts_triggered (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES price_alerts(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  old_price NUMERIC(12, 2) NOT NULL,
  new_price NUMERIC(12, 2) NOT NULL,
  change_percent NUMERIC(8, 2) NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  source_reference TEXT,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_price_alerts_material ON price_alerts(material_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_brand ON price_alerts(brand_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_price_alerts_triggered_alert ON price_alerts_triggered(alert_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_triggered_acknowledged ON price_alerts_triggered(acknowledged) WHERE acknowledged = false;

-- Enable RLS
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts_triggered ENABLE ROW LEVEL SECURITY;

-- RLS Policies for price_alerts
CREATE POLICY "Users can view all price alerts"
  ON price_alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create price alerts"
  ON price_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update price alerts"
  ON price_alerts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete price alerts"
  ON price_alerts FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for price_alerts_triggered
CREATE POLICY "Users can view all triggered alerts"
  ON price_alerts_triggered FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create triggered alerts"
  ON price_alerts_triggered FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update triggered alerts"
  ON price_alerts_triggered FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger to update updated_at on price_alerts
CREATE OR REPLACE FUNCTION update_price_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER price_alerts_updated_at
  BEFORE UPDATE ON price_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_price_alerts_updated_at();

-- Comment on tables
COMMENT ON TABLE price_alerts IS 'Configuration for price change alerts on materials';
COMMENT ON TABLE price_alerts_triggered IS 'History of triggered price alerts';
