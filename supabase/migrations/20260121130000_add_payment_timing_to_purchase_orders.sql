-- Add payment_timing field to purchase_orders table
-- This determines when payment should be made: before delivery (advance) or after (on_delivery)

ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS payment_timing TEXT DEFAULT 'on_delivery' CHECK (payment_timing IN ('advance', 'on_delivery'));

COMMENT ON COLUMN purchase_orders.payment_timing IS 'When payment should be made: advance (before delivery) or on_delivery (after receiving goods)';

-- Add index for querying advance payment POs
CREATE INDEX IF NOT EXISTS idx_purchase_orders_payment_timing ON purchase_orders(payment_timing) WHERE payment_timing = 'advance';
