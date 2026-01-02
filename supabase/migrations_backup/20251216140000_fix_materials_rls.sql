-- Migration: Fix Materials RLS Policy
-- Allow all authenticated users to INSERT materials
-- Keep UPDATE/DELETE restricted to admin/office roles

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "allow_all_materials" ON materials;
DROP POLICY IF EXISTS "allow_select_materials" ON materials;
DROP POLICY IF EXISTS "allow_insert_materials" ON materials;
DROP POLICY IF EXISTS "allow_update_materials" ON materials;
DROP POLICY IF EXISTS "allow_delete_materials" ON materials;

-- Allow ALL authenticated users to SELECT materials
CREATE POLICY "allow_select_materials" ON materials
  FOR SELECT TO authenticated
  USING (true);

-- Allow ALL authenticated users to INSERT materials
CREATE POLICY "allow_insert_materials" ON materials
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Keep UPDATE restricted to admin/office only
CREATE POLICY "allow_update_materials" ON materials
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

-- Keep DELETE restricted to admin/office only
CREATE POLICY "allow_delete_materials" ON materials
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));
