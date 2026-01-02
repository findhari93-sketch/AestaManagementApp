-- =====================================================
-- Migration: Attendance System Improvements
-- Description: Adds two-phase attendance tracking and payment fields
-- Date: 2024-12-09
-- NOTE: Wrapped in IF EXISTS check for local development
-- =====================================================

DO $$
BEGIN
  -- Only run if tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_attendance' AND table_schema = 'public') THEN
    RAISE NOTICE 'Tables do not exist yet, skipping attendance improvements';
    RETURN;
  END IF;

  -- =====================================================
  -- PART 1: Two-Phase Attendance Tracking
  -- =====================================================

  -- Add status tracking to daily_attendance
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_attendance' AND column_name = 'attendance_status') THEN
    ALTER TABLE daily_attendance ADD COLUMN attendance_status TEXT DEFAULT 'confirmed';
    ALTER TABLE daily_attendance ADD CONSTRAINT daily_attendance_status_check CHECK (attendance_status IN ('morning_entry', 'confirmed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_attendance' AND column_name = 'morning_entry_at') THEN
    ALTER TABLE daily_attendance ADD COLUMN morning_entry_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_attendance' AND column_name = 'confirmed_at') THEN
    ALTER TABLE daily_attendance ADD COLUMN confirmed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_attendance' AND column_name = 'work_progress_percent') THEN
    ALTER TABLE daily_attendance ADD COLUMN work_progress_percent INTEGER DEFAULT 100;
  END IF;

  -- Same for market_laborer_attendance
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_laborer_attendance' AND column_name = 'attendance_status') THEN
    ALTER TABLE market_laborer_attendance ADD COLUMN attendance_status TEXT DEFAULT 'confirmed';
    ALTER TABLE market_laborer_attendance ADD CONSTRAINT market_attendance_status_check CHECK (attendance_status IN ('morning_entry', 'confirmed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_laborer_attendance' AND column_name = 'morning_entry_at') THEN
    ALTER TABLE market_laborer_attendance ADD COLUMN morning_entry_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_laborer_attendance' AND column_name = 'confirmed_at') THEN
    ALTER TABLE market_laborer_attendance ADD COLUMN confirmed_at TIMESTAMPTZ;
  END IF;

  -- Add to daily_work_summary
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_work_summary' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_work_summary' AND column_name = 'work_progress_percent') THEN
      ALTER TABLE daily_work_summary ADD COLUMN work_progress_percent INTEGER DEFAULT 100;
    END IF;
  END IF;

  -- =====================================================
  -- PART 2: Payment Tracking for Attendance
  -- =====================================================

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_attendance' AND column_name = 'payment_date') THEN
    ALTER TABLE daily_attendance ADD COLUMN payment_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_attendance' AND column_name = 'payment_mode') THEN
    ALTER TABLE daily_attendance ADD COLUMN payment_mode TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_attendance' AND column_name = 'payment_proof_url') THEN
    ALTER TABLE daily_attendance ADD COLUMN payment_proof_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_attendance' AND column_name = 'paid_via') THEN
    ALTER TABLE daily_attendance ADD COLUMN paid_via TEXT;
    ALTER TABLE daily_attendance ADD CONSTRAINT daily_attendance_paid_via_check CHECK (paid_via IN ('direct', 'engineer_wallet'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_attendance' AND column_name = 'engineer_transaction_id') THEN
    ALTER TABLE daily_attendance ADD COLUMN engineer_transaction_id UUID;
    -- Only add FK if reference table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_engineer_transactions' AND table_schema = 'public') THEN
      ALTER TABLE daily_attendance ADD CONSTRAINT daily_attendance_engineer_tx_fk FOREIGN KEY (engineer_transaction_id) REFERENCES site_engineer_transactions(id);
    END IF;
  END IF;

  -- Market laborer attendance payment fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_laborer_attendance' AND column_name = 'is_paid') THEN
    ALTER TABLE market_laborer_attendance ADD COLUMN is_paid BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_laborer_attendance' AND column_name = 'payment_date') THEN
    ALTER TABLE market_laborer_attendance ADD COLUMN payment_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_laborer_attendance' AND column_name = 'payment_mode') THEN
    ALTER TABLE market_laborer_attendance ADD COLUMN payment_mode TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_laborer_attendance' AND column_name = 'payment_proof_url') THEN
    ALTER TABLE market_laborer_attendance ADD COLUMN payment_proof_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_laborer_attendance' AND column_name = 'paid_via') THEN
    ALTER TABLE market_laborer_attendance ADD COLUMN paid_via TEXT;
    ALTER TABLE market_laborer_attendance ADD CONSTRAINT market_attendance_paid_via_check CHECK (paid_via IN ('direct', 'engineer_wallet'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_laborer_attendance' AND column_name = 'engineer_transaction_id') THEN
    ALTER TABLE market_laborer_attendance ADD COLUMN engineer_transaction_id UUID;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_engineer_transactions' AND table_schema = 'public') THEN
      ALTER TABLE market_laborer_attendance ADD CONSTRAINT market_attendance_engineer_tx_fk FOREIGN KEY (engineer_transaction_id) REFERENCES site_engineer_transactions(id);
    END IF;
  END IF;

  RAISE NOTICE 'Attendance improvements applied successfully';
END $$;

-- =====================================================
-- PART 3: Indexes for Performance
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_attendance' AND table_schema = 'public') THEN
    CREATE INDEX IF NOT EXISTS idx_daily_attendance_status
    ON daily_attendance(attendance_status)
    WHERE attendance_status = 'morning_entry';

    CREATE INDEX IF NOT EXISTS idx_daily_attendance_unpaid
    ON daily_attendance(is_paid, site_id, date)
    WHERE is_paid = FALSE OR is_paid IS NULL;

    CREATE INDEX IF NOT EXISTS idx_daily_attendance_engineer_tx
    ON daily_attendance(engineer_transaction_id)
    WHERE engineer_transaction_id IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_laborer_attendance' AND table_schema = 'public') THEN
    CREATE INDEX IF NOT EXISTS idx_market_laborer_attendance_unpaid
    ON market_laborer_attendance(is_paid, site_id, date)
    WHERE is_paid = FALSE;

    CREATE INDEX IF NOT EXISTS idx_market_attendance_engineer_tx
    ON market_laborer_attendance(engineer_transaction_id)
    WHERE engineer_transaction_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- PART 4: Storage Bucket for Payment Proofs
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PART 5: Storage RLS Policies
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Allow payment-proofs uploads'
  ) THEN
    CREATE POLICY "Allow payment-proofs uploads"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'payment-proofs');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Allow payment-proofs downloads'
  ) THEN
    CREATE POLICY "Allow payment-proofs downloads"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'payment-proofs');
  END IF;
END $$;
