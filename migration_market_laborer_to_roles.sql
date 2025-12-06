-- Migration: Change market_laborer_attendance from category_id to role_id
-- This allows market laborers to be tracked by labor role (Male Helper, Female Helper, etc.)
-- instead of category (Civil, Electrical, etc.)

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.market_laborer_attendance
DROP CONSTRAINT IF EXISTS market_laborer_attendance_category_id_fkey;

-- Step 2: Drop the unique constraint that includes category_id
ALTER TABLE public.market_laborer_attendance
DROP CONSTRAINT IF EXISTS market_laborer_attendance_site_id_date_category_id_key;

-- Step 3: Rename the column from category_id to role_id
ALTER TABLE public.market_laborer_attendance
RENAME COLUMN category_id TO role_id;

-- Step 4: Add new foreign key constraint to labor_roles table
ALTER TABLE public.market_laborer_attendance
ADD CONSTRAINT market_laborer_attendance_role_id_fkey
FOREIGN KEY (role_id) REFERENCES labor_roles(id);

-- Step 5: Add new unique constraint with role_id
ALTER TABLE public.market_laborer_attendance
ADD CONSTRAINT market_laborer_attendance_site_id_date_role_id_key
UNIQUE (site_id, date, role_id);

-- Verify the changes
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'market_laborer_attendance'
    AND table_schema = 'public'
ORDER BY ordinal_position;
