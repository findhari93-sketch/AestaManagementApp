-- ============================================================================
-- Migration: Add UPI screenshot URL to rental settlements
-- Description: Adds a separate field for UPI payment proof screenshots
-- ============================================================================

-- Add UPI screenshot URL field to rental_settlements
ALTER TABLE rental_settlements
ADD COLUMN IF NOT EXISTS upi_screenshot_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN rental_settlements.upi_screenshot_url IS 'Screenshot proof of UPI payment';
