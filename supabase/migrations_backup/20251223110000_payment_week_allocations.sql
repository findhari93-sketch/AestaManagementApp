-- Migration: Create payment_week_allocations table
-- Purpose: Track how salary payments are allocated to weeks (oldest first auto-allocation)

-- Create table to track payment allocations to specific weeks
CREATE TABLE IF NOT EXISTS payment_week_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  labor_payment_id UUID NOT NULL REFERENCES labor_payments(id) ON DELETE CASCADE,
  laborer_id UUID NOT NULL REFERENCES laborers(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  allocated_amount NUMERIC(10,2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each payment can only have one allocation per week
  UNIQUE(labor_payment_id, week_start)
);

-- Create indexes for efficient querying
CREATE INDEX idx_payment_allocations_payment ON payment_week_allocations(labor_payment_id);
CREATE INDEX idx_payment_allocations_laborer_week ON payment_week_allocations(laborer_id, week_start);
CREATE INDEX idx_payment_allocations_site ON payment_week_allocations(site_id);

-- Add RLS policies
ALTER TABLE payment_week_allocations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read allocations
CREATE POLICY "Allow authenticated users to read payment allocations"
  ON payment_week_allocations
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert allocations
CREATE POLICY "Allow authenticated users to insert payment allocations"
  ON payment_week_allocations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to delete allocations
CREATE POLICY "Allow authenticated users to delete payment allocations"
  ON payment_week_allocations
  FOR DELETE
  TO authenticated
  USING (true);

-- Add comments
COMMENT ON TABLE payment_week_allocations IS 'Tracks how salary payments are allocated across weeks (oldest first). One payment can span multiple weeks.';
COMMENT ON COLUMN payment_week_allocations.labor_payment_id IS 'The payment being allocated';
COMMENT ON COLUMN payment_week_allocations.laborer_id IS 'The laborer this allocation is for';
COMMENT ON COLUMN payment_week_allocations.week_start IS 'Start date of the week (Sunday)';
COMMENT ON COLUMN payment_week_allocations.week_end IS 'End date of the week (Saturday)';
COMMENT ON COLUMN payment_week_allocations.allocated_amount IS 'Amount allocated to this week from the payment';
