-- Fix RLS policy for expenses table
-- This allows authenticated users to create expense records
-- Needed for settlement confirmation to create expense entries

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "allow_all_select_expenses" ON expenses;
DROP POLICY IF EXISTS "allow_all_insert_expenses" ON expenses;
DROP POLICY IF EXISTS "allow_all_update_expenses" ON expenses;
DROP POLICY IF EXISTS "allow_all_delete_expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Users can create expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses" ON expenses;

-- Ensure RLS is enabled on expenses table
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for authenticated users
-- SELECT: All authenticated users can view expenses
CREATE POLICY "allow_all_select_expenses" ON expenses
    FOR SELECT TO authenticated USING (true);

-- INSERT: All authenticated users can create expenses
CREATE POLICY "allow_all_insert_expenses" ON expenses
    FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE: All authenticated users can update expenses
CREATE POLICY "allow_all_update_expenses" ON expenses
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- DELETE: All authenticated users can delete expenses
CREATE POLICY "allow_all_delete_expenses" ON expenses
    FOR DELETE TO authenticated USING (true);

-- Also add policies for anon role (in case client uses anon key during initialization)
CREATE POLICY "allow_anon_select_expenses" ON expenses
    FOR SELECT TO anon USING (true);

CREATE POLICY "allow_anon_insert_expenses" ON expenses
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow_anon_update_expenses" ON expenses
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_anon_delete_expenses" ON expenses
    FOR DELETE TO anon USING (true);
