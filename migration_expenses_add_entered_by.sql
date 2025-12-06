-- Migration: Add entered_by columns to expenses table
-- This allows tracking who entered each expense record

-- Step 1: Add entered_by_user_id column (UUID reference to users)
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS entered_by_user_id uuid REFERENCES users(id);

-- Step 2: Add entered_by column (text for user name)
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS entered_by text;

-- Verify the changes
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'expenses'
    AND table_schema = 'public'
    AND column_name IN ('entered_by', 'entered_by_user_id')
ORDER BY ordinal_position;
