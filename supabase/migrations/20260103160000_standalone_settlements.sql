-- Add is_standalone column to tea_shop_settlements
-- This allows creating settlements without allocating to specific entries
-- Used for historical data where daily breakdown doesn't exist

ALTER TABLE "public"."tea_shop_settlements"
ADD COLUMN IF NOT EXISTS "is_standalone" boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN "public"."tea_shop_settlements"."is_standalone"
IS 'True if this settlement is historical/standalone without allocation to specific entries';

-- Index for filtering standalone settlements
CREATE INDEX IF NOT EXISTS "idx_tea_shop_settlements_standalone"
ON "public"."tea_shop_settlements"("is_standalone")
WHERE "is_standalone" = true;
