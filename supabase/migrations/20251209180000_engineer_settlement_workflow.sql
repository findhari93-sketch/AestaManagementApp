-- Engineer Settlement Workflow Enhancement
-- Adds columns for tracking payment settlement status and confirmation flow
-- NOTE: Wrapped in IF EXISTS check for local development

DO $$
BEGIN
  -- Only run if table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_engineer_transactions' AND table_schema = 'public') THEN
    RAISE NOTICE 'Table site_engineer_transactions does not exist yet, skipping engineer settlement workflow';
    RETURN;
  END IF;

  -- Add settlement workflow columns to site_engineer_transactions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_engineer_transactions' AND column_name = 'settlement_status') THEN
    ALTER TABLE site_engineer_transactions ADD COLUMN settlement_status TEXT DEFAULT 'pending_settlement';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_engineer_transactions' AND column_name = 'settlement_mode') THEN
    ALTER TABLE site_engineer_transactions ADD COLUMN settlement_mode TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_engineer_transactions' AND column_name = 'settlement_proof_url') THEN
    ALTER TABLE site_engineer_transactions ADD COLUMN settlement_proof_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_engineer_transactions' AND column_name = 'confirmed_by') THEN
    ALTER TABLE site_engineer_transactions ADD COLUMN confirmed_by TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_engineer_transactions' AND column_name = 'confirmed_by_user_id') THEN
    ALTER TABLE site_engineer_transactions ADD COLUMN confirmed_by_user_id UUID;
    -- Only add FK if reference table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
      ALTER TABLE site_engineer_transactions ADD CONSTRAINT site_engineer_transactions_confirmed_by_user_fk FOREIGN KEY (confirmed_by_user_id) REFERENCES users(id);
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_engineer_transactions' AND column_name = 'confirmed_at') THEN
    ALTER TABLE site_engineer_transactions ADD COLUMN confirmed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_engineer_transactions' AND column_name = 'dispute_notes') THEN
    ALTER TABLE site_engineer_transactions ADD COLUMN dispute_notes TEXT;
  END IF;

  -- Add comments for documentation
  COMMENT ON COLUMN site_engineer_transactions.settlement_status IS 'Status: pending_settlement, pending_confirmation, confirmed, disputed';
  COMMENT ON COLUMN site_engineer_transactions.settlement_mode IS 'Payment mode used by engineer when settling (upi, cash, net_banking, other)';
  COMMENT ON COLUMN site_engineer_transactions.settlement_proof_url IS 'Proof uploaded by engineer when settling';
  COMMENT ON COLUMN site_engineer_transactions.confirmed_by IS 'Name of admin who confirmed the settlement';
  COMMENT ON COLUMN site_engineer_transactions.confirmed_by_user_id IS 'User ID of admin who confirmed';
  COMMENT ON COLUMN site_engineer_transactions.confirmed_at IS 'Timestamp when settlement was confirmed';
  COMMENT ON COLUMN site_engineer_transactions.dispute_notes IS 'Notes if settlement is disputed';

  -- Create index for faster queries on settlement status
  CREATE INDEX IF NOT EXISTS idx_site_engineer_transactions_settlement_status
  ON site_engineer_transactions(settlement_status)
  WHERE settlement_status IS NOT NULL;

  -- Update existing records to have a default settlement_status based on is_settled
  UPDATE site_engineer_transactions
  SET settlement_status = CASE
    WHEN is_settled = true THEN 'confirmed'
    ELSE 'pending_settlement'
  END
  WHERE settlement_status IS NULL;

  RAISE NOTICE 'Engineer settlement workflow applied successfully';
END $$;
