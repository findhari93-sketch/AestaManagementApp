-- Migration: Add updated_at column to group_stock_transactions table
-- This column was missing from the initial schema and is causing schema cache errors

-- Add updated_at column with default value
ALTER TABLE group_stock_transactions
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing records with created_at value
UPDATE group_stock_transactions
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Make it non-nullable after backfill
ALTER TABLE group_stock_transactions
ALTER COLUMN updated_at SET NOT NULL;

-- Create auto-update trigger function
CREATE OR REPLACE FUNCTION update_group_stock_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS update_group_stock_transactions_updated_at_trigger
  ON group_stock_transactions;

CREATE TRIGGER update_group_stock_transactions_updated_at_trigger
  BEFORE UPDATE ON group_stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_group_stock_transactions_updated_at();

-- Add comment for documentation
COMMENT ON COLUMN group_stock_transactions.updated_at IS
  'Automatically updated timestamp when record is modified';

-- Verify the column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'group_stock_transactions'
    AND column_name = 'updated_at'
  ) THEN
    RAISE NOTICE 'Successfully added updated_at column to group_stock_transactions';
  ELSE
    RAISE EXCEPTION 'Failed to add updated_at column to group_stock_transactions';
  END IF;
END $$;
