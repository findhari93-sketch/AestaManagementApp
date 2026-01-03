-- Migration: Add UPI ID and QR Code fields to vendors table
-- Purpose: Support direct UPI payments and QR code scanning for vendors

-- Add UPI ID field for direct UPI payments
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- Add QR code URL field for payment QR codes (compressed image storage)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS qr_code_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN vendors.upi_id IS 'UPI ID for direct payments (e.g., name@upi, phone@bank)';
COMMENT ON COLUMN vendors.qr_code_url IS 'URL to compressed QR code image for payment scanning';
