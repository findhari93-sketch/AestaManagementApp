-- Tea Shop Settlement - Add proof_url column for UPI payment screenshots

-- Add proof_url column to tea_shop_settlements
ALTER TABLE tea_shop_settlements
ADD COLUMN IF NOT EXISTS proof_url TEXT;

COMMENT ON COLUMN tea_shop_settlements.proof_url IS 'URL to payment proof screenshot (for UPI payments)';

-- Create index for efficient queries on settlements with proof
CREATE INDEX IF NOT EXISTS idx_tea_shop_settlements_proof
ON tea_shop_settlements(tea_shop_id)
WHERE proof_url IS NOT NULL;
