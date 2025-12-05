-- =====================================================
-- Client Payment Tracking System - Database Schema
-- =====================================================

-- 1. Client Payment Plans (Payment Schedule for each Site)
-- This defines how the contract payment will be structured
CREATE TABLE IF NOT EXISTS client_payment_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  plan_name VARCHAR(255) NOT NULL,
  total_contract_amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_active_plan_per_site UNIQUE(site_id) WHERE is_active = TRUE
);

-- 2. Payment Milestones/Phases (Individual payment phases for a plan)
-- Example: 30% upfront, 40% on completion of foundation, 30% final
CREATE TABLE IF NOT EXISTS payment_phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_plan_id UUID NOT NULL REFERENCES client_payment_plans(id) ON DELETE CASCADE,
  phase_name VARCHAR(255) NOT NULL,
  description TEXT,
  percentage DECIMAL(5, 2) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  expected_date DATE,
  sequence_order INTEGER NOT NULL,
  is_milestone BOOLEAN DEFAULT FALSE, -- Link to construction phase if TRUE
  construction_phase_id UUID REFERENCES construction_phases(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_percentage CHECK (percentage > 0 AND percentage <= 100),
  CONSTRAINT valid_amount CHECK (amount > 0)
);

-- 3. Client Payment Transactions (Actual payments received)
-- Tracks each payment received from the client
CREATE TABLE IF NOT EXISTS client_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  payment_phase_id UUID REFERENCES payment_phases(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL,
  payment_mode VARCHAR(50) NOT NULL, -- 'cash', 'upi', 'bank_transfer', 'cheque'
  amount DECIMAL(15, 2) NOT NULL,
  transaction_reference VARCHAR(255), -- For bank transfers, cheque number, UPI ref, etc.
  notes TEXT,
  receipt_url TEXT, -- Path to receipt in storage
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_amount_payment CHECK (amount > 0)
);

-- 4. Payment Disputes/Issues (For tracking payment issues)
-- Track if there are any payment disputes or problems
CREATE TABLE IF NOT EXISTS payment_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  client_payment_id UUID REFERENCES client_payments(id) ON DELETE SET NULL,
  dispute_type VARCHAR(100) NOT NULL, -- 'wrong_amount', 'duplicate', 'refund_request', 'bounced_cheque'
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'in_review', 'resolved', 'rejected'
  description TEXT NOT NULL,
  resolution TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_client_payment_plans_site_id ON client_payment_plans(site_id);
CREATE INDEX IF NOT EXISTS idx_payment_phases_plan_id ON payment_phases(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_site_id ON client_payments(site_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_phase_id ON client_payments(payment_phase_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_date ON client_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_site_id ON payment_disputes(site_id);

-- =====================================================
-- Views for Easy Querying
-- =====================================================

-- View: Payment Plan Summary
CREATE OR REPLACE VIEW payment_plan_summary AS
SELECT 
  cpp.id,
  cpp.site_id,
  cpp.plan_name,
  cpp.total_contract_amount,
  COALESCE(SUM(cp.amount), 0) as total_amount_paid,
  cpp.total_contract_amount - COALESCE(SUM(cp.amount), 0) as balance_amount,
  ROUND((COALESCE(SUM(cp.amount), 0) / cpp.total_contract_amount * 100)::NUMERIC, 2) as payment_percentage,
  COUNT(DISTINCT cp.id) as total_payments_received,
  MAX(cp.payment_date) as last_payment_date,
  cpp.is_active,
  cpp.created_at
FROM client_payment_plans cpp
LEFT JOIN client_payments cp ON cpp.id = (
  SELECT payment_plan_id FROM payment_phases 
  WHERE id = cp.payment_phase_id
)
GROUP BY cpp.id, cpp.site_id, cpp.plan_name, cpp.total_contract_amount, cpp.is_active, cpp.created_at;

-- View: Payment Phase Status
CREATE OR REPLACE VIEW payment_phase_status AS
SELECT 
  pp.id,
  pp.payment_plan_id,
  pp.phase_name,
  pp.percentage,
  pp.amount,
  pp.expected_date,
  pp.sequence_order,
  COALESCE(SUM(cp.amount), 0) as amount_paid,
  pp.amount - COALESCE(SUM(cp.amount), 0) as amount_pending,
  CASE 
    WHEN COALESCE(SUM(cp.amount), 0) >= pp.amount THEN 'paid'
    WHEN COALESCE(SUM(cp.amount), 0) > 0 THEN 'partial'
    WHEN pp.expected_date < CURRENT_DATE THEN 'overdue'
    ELSE 'pending'
  END as status,
  MAX(cp.payment_date) as last_payment_date,
  COUNT(cp.id) as payment_count
FROM payment_phases pp
LEFT JOIN client_payments cp ON pp.id = cp.payment_phase_id
GROUP BY pp.id, pp.payment_plan_id, pp.phase_name, pp.percentage, pp.amount, pp.expected_date, pp.sequence_order;

-- =====================================================
-- RLS Policies (Row Level Security)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE client_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see payment plans for sites they have access to
CREATE POLICY "Allow users to view payment plans" ON client_payment_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sites s
      JOIN users u ON u.id = auth.uid()
      WHERE s.id = client_payment_plans.site_id
    )
  );

CREATE POLICY "Allow users to manage payment plans" ON client_payment_plans
  FOR ALL USING (
    auth.uid() IS NOT NULL
  );

-- Similar policies for other tables
CREATE POLICY "Allow users to view payment phases" ON payment_phases
  FOR SELECT USING (TRUE);

CREATE POLICY "Allow users to manage payment phases" ON payment_phases
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow users to view client payments" ON client_payments
  FOR SELECT USING (TRUE);

CREATE POLICY "Allow users to manage client payments" ON client_payments
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow users to view payment disputes" ON payment_disputes
  FOR SELECT USING (TRUE);

CREATE POLICY "Allow users to manage payment disputes" ON payment_disputes
  FOR ALL USING (auth.uid() IS NOT NULL);
