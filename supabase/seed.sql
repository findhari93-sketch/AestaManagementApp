-- Seed data for local Supabase development
-- This file runs after all migrations when using: supabase db reset

-- Set search path to public schema
SET search_path TO public;

-- ============================================
-- LABOR CATEGORIES (using proper UUIDs)
-- ============================================
INSERT INTO public.labor_categories (id, name, description, display_order, is_active) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Skilled Workers', 'Experienced workers with specialized skills', 1, true),
  ('11111111-1111-1111-1111-111111111102', 'Unskilled Workers', 'General laborers', 2, true),
  ('11111111-1111-1111-1111-111111111103', 'Specialists', 'Highly specialized workers', 3, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- LABOR ROLES
-- ============================================
INSERT INTO public.labor_roles (id, name, category_id, default_daily_rate, display_order, is_active) VALUES
  ('22222222-2222-2222-2222-222222222201', 'Mason', '11111111-1111-1111-1111-111111111101', 800, 1, true),
  ('22222222-2222-2222-2222-222222222202', 'Helper', '11111111-1111-1111-1111-111111111102', 500, 2, true),
  ('22222222-2222-2222-2222-222222222203', 'Carpenter', '11111111-1111-1111-1111-111111111101', 850, 3, true),
  ('22222222-2222-2222-2222-222222222204', 'Electrician', '11111111-1111-1111-1111-111111111103', 900, 4, true),
  ('22222222-2222-2222-2222-222222222205', 'Plumber', '11111111-1111-1111-1111-111111111103', 900, 5, true),
  ('22222222-2222-2222-2222-222222222206', 'Painter', '11111111-1111-1111-1111-111111111101', 750, 6, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EXPENSE CATEGORIES
-- ============================================
INSERT INTO public.expense_categories (id, name, module, description, display_order, is_active, is_recurring) VALUES
  ('33333333-3333-3333-3333-333333333301', 'Labor Wages', 'labor', 'Daily wages for workers', 1, true, true),
  ('33333333-3333-3333-3333-333333333302', 'Materials', 'material', 'Construction materials', 2, true, false),
  ('33333333-3333-3333-3333-333333333303', 'Transport', 'general', 'Transportation costs', 3, true, false),
  ('33333333-3333-3333-3333-333333333304', 'Miscellaneous', 'general', 'Other expenses', 4, true, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TEST USERS
-- ============================================
INSERT INTO public.users (id, name, email, role, status, phone) VALUES
  ('44444444-4444-4444-4444-444444444401', 'Test Admin', 'admin@test.local', 'admin', 'active', '9876543210'),
  ('44444444-4444-4444-4444-444444444402', 'Test Engineer', 'engineer@test.local', 'site_engineer', 'active', '9876543211'),
  ('44444444-4444-4444-4444-444444444403', 'Test Office', 'office@test.local', 'office', 'active', '9876543212')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TEST SITES
-- ============================================
INSERT INTO public.sites (id, name, address, city, status, site_type, created_by, client_name, client_contact) VALUES
  ('55555555-5555-5555-5555-555555555501', 'Demo Construction Site', '123 Main Street', 'Chennai', 'active', 'single_client', '44444444-4444-4444-4444-444444444401', 'Test Client', '9876543220'),
  ('55555555-5555-5555-5555-555555555502', 'Demo Renovation Project', '456 Second Avenue', 'Chennai', 'active', 'single_client', '44444444-4444-4444-4444-444444444401', 'Another Client', '9876543221')
ON CONFLICT (id) DO NOTHING;

-- Assign engineer to demo sites
UPDATE public.users SET assigned_sites = ARRAY['55555555-5555-5555-5555-555555555501', '55555555-5555-5555-5555-555555555502']::uuid[] WHERE id = '44444444-4444-4444-4444-444444444402';

-- ============================================
-- BUILDING SECTIONS
-- ============================================
INSERT INTO public.building_sections (id, name, site_id, status, sequence_order) VALUES
  ('66666666-6666-6666-6666-666666666601', 'Foundation', '55555555-5555-5555-5555-555555555501', 'in_progress', 1),
  ('66666666-6666-6666-6666-666666666602', 'Ground Floor', '55555555-5555-5555-5555-555555555501', 'not_started', 2),
  ('66666666-6666-6666-6666-666666666603', 'First Floor', '55555555-5555-5555-5555-555555555501', 'not_started', 3)
ON CONFLICT (id) DO NOTHING;

-- Set default section for site
UPDATE public.sites SET default_section_id = '66666666-6666-6666-6666-666666666601' WHERE id = '55555555-5555-5555-5555-555555555501';

-- ============================================
-- TEST LABORERS
-- ============================================
INSERT INTO public.laborers (id, name, phone, category_id, role_id, daily_rate, status, employment_type, joining_date) VALUES
  ('77777777-7777-7777-7777-777777777701', 'Raju Kumar', '9876543230', '11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222201', 800, 'active', 'daily_wage', '2024-01-01'),
  ('77777777-7777-7777-7777-777777777702', 'Suresh Patel', '9876543231', '11111111-1111-1111-1111-111111111102', '22222222-2222-2222-2222-222222222202', 500, 'active', 'daily_wage', '2024-01-01'),
  ('77777777-7777-7777-7777-777777777703', 'Venkat Rao', '9876543232', '11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222203', 850, 'active', 'daily_wage', '2024-01-15'),
  ('77777777-7777-7777-7777-777777777704', 'Mohan Das', '9876543233', '11111111-1111-1111-1111-111111111103', '22222222-2222-2222-2222-222222222204', 900, 'active', 'daily_wage', '2024-02-01'),
  ('77777777-7777-7777-7777-777777777705', 'Arjun Singh', '9876543234', '11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222206', 750, 'active', 'daily_wage', '2024-02-15')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SUMMARY
-- ============================================
-- After running seed, you have:
-- - 3 labor categories
-- - 6 labor roles
-- - 4 expense categories
-- - 3 test users (admin, engineer, office)
-- - 2 test sites
-- - 3 building sections for site 1
-- - 5 test laborers
--
-- To login, create auth users via Supabase Studio or sign up via the app.
-- Then update the users table to link auth_id.
