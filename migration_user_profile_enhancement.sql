-- Migration: User Profile Enhancement
-- Purpose: Add fields for avatar, preferences, and user management
-- Date: 2025-12-08

-- ============================================
-- STEP 1: Add new columns to users table
-- ============================================
DO $$
BEGIN
  -- Add avatar_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar_url TEXT;
  END IF;

  -- Add display_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE users ADD COLUMN display_name TEXT;
  END IF;

  -- Add job_title column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'job_title'
  ) THEN
    ALTER TABLE users ADD COLUMN job_title TEXT;
  END IF;

  -- Add timezone column with default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'Asia/Kolkata';
  END IF;

  -- Add date_format column with default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'date_format'
  ) THEN
    ALTER TABLE users ADD COLUMN date_format TEXT DEFAULT 'DD/MM/YYYY';
  END IF;

  -- Add last_login_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;

  -- Add theme_preference column with default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'theme_preference'
  ) THEN
    ALTER TABLE users ADD COLUMN theme_preference TEXT DEFAULT 'light';
  END IF;

  -- Add email_notifications column with default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email_notifications'
  ) THEN
    ALTER TABLE users ADD COLUMN email_notifications BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ============================================
-- STEP 2: Create avatars storage bucket
-- ============================================
-- Run this SQL in Supabase SQL Editor:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 3: Set up RLS policies for avatars bucket
-- ============================================

-- Allow authenticated users to upload avatars
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Allow authenticated users to delete avatars
CREATE POLICY "Authenticated users can delete avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- Anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================
-- VERIFICATION: Run this after to confirm success
-- ============================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'users'
-- AND column_name IN ('avatar_url', 'display_name', 'job_title', 'timezone', 'date_format', 'last_login_at', 'theme_preference', 'email_notifications')
-- ORDER BY column_name;

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
-- ALTER TABLE users DROP COLUMN IF EXISTS display_name;
-- ALTER TABLE users DROP COLUMN IF EXISTS job_title;
-- ALTER TABLE users DROP COLUMN IF EXISTS timezone;
-- ALTER TABLE users DROP COLUMN IF EXISTS date_format;
-- ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS theme_preference;
-- ALTER TABLE users DROP COLUMN IF EXISTS email_notifications;
