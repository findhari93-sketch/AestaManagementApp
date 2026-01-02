-- Engineer Wallet Batch Tracking Enhancement
-- Adds support for:
-- 1. Payment source tracking (payer_source) on deposits
-- 2. Auto-generated batch codes for each deposit
-- 3. Site restriction (money locked to specific site)
-- 4. Balance tracking per batch
-- 5. Multi-batch spending tracking
-- 6. Engineer reimbursement flow for own money expenses

-- ============================================
-- Step 1: Add new columns to site_engineer_transactions
-- ============================================

-- payer_source: Who provided the money (Trust, Amma, Client, etc.)
ALTER TABLE site_engineer_transactions
ADD COLUMN IF NOT EXISTS payer_source TEXT;

-- payer_name: Custom name when payer_source is 'custom' or 'other_site_money'
ALTER TABLE site_engineer_transactions
ADD COLUMN IF NOT EXISTS payer_name TEXT;

-- batch_code: Auto-generated unique code for deposits (e.g., TRUST-202412-001)
ALTER TABLE site_engineer_transactions
ADD COLUMN IF NOT EXISTS batch_code TEXT;

-- site_restricted: If true, this money can ONLY be used for the linked site
ALTER TABLE site_engineer_transactions
ADD COLUMN IF NOT EXISTS site_restricted BOOLEAN DEFAULT FALSE;

-- remaining_balance: For deposits, tracks how much is left unspent
ALTER TABLE site_engineer_transactions
ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC DEFAULT 0;

-- Add constraint for payer_source values
ALTER TABLE site_engineer_transactions
DROP CONSTRAINT IF EXISTS site_engineer_transactions_payer_source_check;

ALTER TABLE site_engineer_transactions
ADD CONSTRAINT site_engineer_transactions_payer_source_check
CHECK (payer_source IS NULL OR payer_source IN (
  'own_money', 'amma_money', 'client_money', 'trust_account',
  'other_site_money', 'custom', 'mothers_money'
));

-- Add unique constraint on batch_code (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_engineer_transactions_batch_code_unique
ON site_engineer_transactions(batch_code) WHERE batch_code IS NOT NULL;

-- Add index for remaining_balance queries (to find batches with money)
CREATE INDEX IF NOT EXISTS idx_site_engineer_transactions_remaining_balance
ON site_engineer_transactions(user_id, remaining_balance)
WHERE remaining_balance > 0 AND transaction_type = 'received_from_company';

-- Add index for site-restricted batches
CREATE INDEX IF NOT EXISTS idx_site_engineer_transactions_site_restricted
ON site_engineer_transactions(user_id, site_id, site_restricted)
WHERE site_restricted = true;

-- Add comments for documentation
COMMENT ON COLUMN site_engineer_transactions.payer_source IS 'Payment source: own_money, amma_money, client_money, trust_account, other_site_money, custom';
COMMENT ON COLUMN site_engineer_transactions.payer_name IS 'Custom payer name when payer_source is custom or other_site_money';
COMMENT ON COLUMN site_engineer_transactions.batch_code IS 'Auto-generated batch code like TRUST-202412-001';
COMMENT ON COLUMN site_engineer_transactions.site_restricted IS 'If true, money can only be used for the linked site_id';
COMMENT ON COLUMN site_engineer_transactions.remaining_balance IS 'For deposits: tracks unspent amount. Decreases as money is spent.';

-- ============================================
-- Step 2: Create engineer_wallet_batch_usage table
-- ============================================
-- Tracks which batch(es) were used for each spending transaction

CREATE TABLE IF NOT EXISTS engineer_wallet_batch_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The spending transaction (spent_on_behalf or returned_to_company)
  transaction_id UUID NOT NULL REFERENCES site_engineer_transactions(id) ON DELETE CASCADE,

  -- The source batch (received_from_company transaction)
  batch_transaction_id UUID NOT NULL REFERENCES site_engineer_transactions(id) ON DELETE CASCADE,

  -- Amount used from this batch for this transaction
  amount_used NUMERIC NOT NULL CHECK (amount_used > 0),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique pairing
  UNIQUE(transaction_id, batch_transaction_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_batch_usage_transaction
ON engineer_wallet_batch_usage(transaction_id);

CREATE INDEX IF NOT EXISTS idx_batch_usage_batch
ON engineer_wallet_batch_usage(batch_transaction_id);

-- Enable RLS
ALTER TABLE engineer_wallet_batch_usage ENABLE ROW LEVEL SECURITY;

-- RLS policy: Allow all for authenticated users
CREATE POLICY "Allow all for authenticated users" ON engineer_wallet_batch_usage
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add comments
COMMENT ON TABLE engineer_wallet_batch_usage IS 'Tracks which deposit batches were used for each spending transaction';
COMMENT ON COLUMN engineer_wallet_batch_usage.transaction_id IS 'The spending transaction (FK to site_engineer_transactions)';
COMMENT ON COLUMN engineer_wallet_batch_usage.batch_transaction_id IS 'The source deposit batch (FK to site_engineer_transactions)';
COMMENT ON COLUMN engineer_wallet_batch_usage.amount_used IS 'Amount taken from this batch for the spending transaction';

-- ============================================
-- Step 3: Create engineer_reimbursements table
-- ============================================
-- Tracks reimbursements when company pays back engineer for own_money expenses

CREATE TABLE IF NOT EXISTS engineer_reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to the original "used_own_money" transaction(s)
  expense_transaction_id UUID NOT NULL REFERENCES site_engineer_transactions(id) ON DELETE CASCADE,

  -- Engineer being reimbursed
  engineer_id UUID NOT NULL REFERENCES users(id),

  -- Reimbursement details
  amount NUMERIC NOT NULL CHECK (amount > 0),

  -- Who is paying back (Trust, Amma, Client, etc.)
  payer_source TEXT NOT NULL,
  payer_name TEXT,

  -- Payment info
  payment_mode TEXT NOT NULL,
  proof_url TEXT,

  -- When settled
  settled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  settled_by_user_id UUID REFERENCES users(id),
  settled_by_name TEXT,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint for payer_source values
  CONSTRAINT engineer_reimbursements_payer_source_check CHECK (
    payer_source IN ('own_money', 'amma_money', 'client_money', 'trust_account', 'other_site_money', 'custom', 'mothers_money')
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_engineer_reimbursements_expense
ON engineer_reimbursements(expense_transaction_id);

CREATE INDEX IF NOT EXISTS idx_engineer_reimbursements_engineer
ON engineer_reimbursements(engineer_id);

-- Enable RLS
ALTER TABLE engineer_reimbursements ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Allow all for authenticated users" ON engineer_reimbursements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Comments
COMMENT ON TABLE engineer_reimbursements IS 'Tracks reimbursements to engineers who used their own money';
COMMENT ON COLUMN engineer_reimbursements.expense_transaction_id IS 'The used_own_money transaction being reimbursed';
COMMENT ON COLUMN engineer_reimbursements.payer_source IS 'Who paid back the engineer (Trust, Amma, Client, etc.)';

-- ============================================
-- Step 4: Create batch code generation function
-- ============================================

CREATE OR REPLACE FUNCTION generate_batch_code(p_payer_source TEXT)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_month TEXT;
  v_sequence INT;
  v_code TEXT;
BEGIN
  -- Map payer_source to prefix
  v_prefix := CASE p_payer_source
    WHEN 'trust_account' THEN 'TRUST'
    WHEN 'amma_money' THEN 'AMMA'
    WHEN 'mothers_money' THEN 'AMMA'  -- Legacy support
    WHEN 'client_money' THEN 'CLIENT'
    WHEN 'own_money' THEN 'OWN'
    WHEN 'other_site_money' THEN 'SITE'
    WHEN 'custom' THEN 'OTHER'
    ELSE 'MISC'
  END;

  -- Get current year-month in YYYYMM format
  v_month := TO_CHAR(NOW(), 'YYYYMM');

  -- Get next sequence for this prefix+month combination
  SELECT COALESCE(MAX(
    CASE
      WHEN batch_code ~ ('^' || v_prefix || '-' || v_month || '-[0-9]+$')
      THEN CAST(SPLIT_PART(batch_code, '-', 3) AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_sequence
  FROM site_engineer_transactions
  WHERE batch_code LIKE v_prefix || '-' || v_month || '-%';

  -- Format: PREFIX-YYYYMM-NNN (padded to 3 digits)
  v_code := v_prefix || '-' || v_month || '-' || LPAD(v_sequence::TEXT, 3, '0');

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON FUNCTION generate_batch_code(TEXT) IS 'Generates unique batch code for wallet deposits like TRUST-202412-001';

-- ============================================
-- Step 5: Initialize remaining_balance for existing deposits
-- ============================================
-- Set remaining_balance to original amount for existing received_from_company transactions
-- that don't have any spending recorded against them

UPDATE site_engineer_transactions
SET remaining_balance = amount
WHERE transaction_type = 'received_from_company'
  AND remaining_balance = 0
  AND is_settled IS NOT TRUE;

-- For transactions that have been fully used/settled, set remaining_balance to 0
UPDATE site_engineer_transactions
SET remaining_balance = 0
WHERE transaction_type = 'received_from_company'
  AND is_settled = TRUE
  AND remaining_balance = 0;
