-- =====================================================
-- Migration: Attendance System Improvements
-- Description: Adds two-phase attendance tracking and payment fields
-- Date: 2024-12-09
-- =====================================================

-- =====================================================
-- PART 1: Two-Phase Attendance Tracking
-- =====================================================

-- Add status tracking to daily_attendance
ALTER TABLE daily_attendance
ADD COLUMN IF NOT EXISTS attendance_status TEXT DEFAULT 'confirmed'
  CHECK (attendance_status IN ('morning_entry', 'confirmed'));

ALTER TABLE daily_attendance
ADD COLUMN IF NOT EXISTS morning_entry_at TIMESTAMPTZ;

ALTER TABLE daily_attendance
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Add work progress tracking
ALTER TABLE daily_attendance
ADD COLUMN IF NOT EXISTS work_progress_percent INTEGER DEFAULT 100;

-- Same for market_laborer_attendance
ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS attendance_status TEXT DEFAULT 'confirmed'
  CHECK (attendance_status IN ('morning_entry', 'confirmed'));

ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS morning_entry_at TIMESTAMPTZ;

ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Add to daily_work_summary
ALTER TABLE daily_work_summary
ADD COLUMN IF NOT EXISTS work_progress_percent INTEGER DEFAULT 100;

-- =====================================================
-- PART 2: Payment Tracking for Attendance
-- =====================================================

-- Add payment tracking to daily_attendance
ALTER TABLE daily_attendance
ADD COLUMN IF NOT EXISTS payment_date DATE;

ALTER TABLE daily_attendance
ADD COLUMN IF NOT EXISTS payment_mode TEXT;

ALTER TABLE daily_attendance
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

ALTER TABLE daily_attendance
ADD COLUMN IF NOT EXISTS paid_via TEXT CHECK (paid_via IN ('direct', 'engineer_wallet'));

ALTER TABLE daily_attendance
ADD COLUMN IF NOT EXISTS engineer_transaction_id UUID REFERENCES site_engineer_transactions(id);

-- Add is_paid and payment tracking to market_laborer_attendance
ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS payment_date DATE;

ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS payment_mode TEXT;

ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS paid_via TEXT CHECK (paid_via IN ('direct', 'engineer_wallet'));

ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS engineer_transaction_id UUID REFERENCES site_engineer_transactions(id);

-- =====================================================
-- PART 3: Indexes for Performance
-- =====================================================

-- Index for finding unconfirmed morning entries
CREATE INDEX IF NOT EXISTS idx_daily_attendance_status
ON daily_attendance(attendance_status)
WHERE attendance_status = 'morning_entry';

-- Index for finding unpaid attendance
CREATE INDEX IF NOT EXISTS idx_daily_attendance_unpaid
ON daily_attendance(is_paid, site_id, date)
WHERE is_paid = FALSE OR is_paid IS NULL;

CREATE INDEX IF NOT EXISTS idx_market_laborer_attendance_unpaid
ON market_laborer_attendance(is_paid, site_id, date)
WHERE is_paid = FALSE;

-- Index for payment tracking via engineer
CREATE INDEX IF NOT EXISTS idx_daily_attendance_engineer_tx
ON daily_attendance(engineer_transaction_id)
WHERE engineer_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_market_attendance_engineer_tx
ON market_laborer_attendance(engineer_transaction_id)
WHERE engineer_transaction_id IS NOT NULL;

-- =====================================================
-- PART 4: Storage Bucket for Payment Proofs
-- =====================================================
-- NOTE: Run this in Supabase Dashboard > Storage > Create new bucket
-- Bucket name: payment-proofs
-- Public: false (private)
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- =====================================================
-- PART 5: Update RLS Policies
-- =====================================================

-- Allow all authenticated users to upload payment proofs
-- (Run in Supabase Dashboard > Storage > payment-proofs > Policies)
--
-- INSERT policy: Allow uploads
-- CREATE POLICY "Allow authenticated uploads"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (bucket_id = 'payment-proofs');
--
-- SELECT policy: Allow viewing own uploads
-- CREATE POLICY "Allow authenticated downloads"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (bucket_id = 'payment-proofs');
