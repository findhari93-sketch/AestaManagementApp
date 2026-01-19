-- Migration: Add miscellaneous expense categories
-- Purpose: Add predefined categories for miscellaneous expenses to allow simple expense tracking

-- 1. Add 'miscellaneous' to the expense_module enum
ALTER TYPE public.expense_module ADD VALUE IF NOT EXISTS 'miscellaneous';

-- 2. Insert miscellaneous expense categories
INSERT INTO public.expense_categories (id, name, module, description, display_order, is_active, is_recurring)
VALUES
  (gen_random_uuid(), 'Daily Labor Settlement', 'miscellaneous', 'Ad-hoc daily labor salary settlements', 1, true, false),
  (gen_random_uuid(), 'Contract Labor Settlement', 'miscellaneous', 'Ad-hoc contract labor salary settlements', 2, true, false),
  (gen_random_uuid(), 'Material Settlement', 'miscellaneous', 'Material used from group stock for this site', 3, true, false),
  (gen_random_uuid(), 'Material Purchasing', 'miscellaneous', 'Direct material purchases for the site', 4, true, false),
  (gen_random_uuid(), 'Rental Settlement', 'miscellaneous', 'Machinery/equipment rental settlements', 5, true, false),
  (gen_random_uuid(), 'Tea & Snacks Settlement', 'miscellaneous', 'Tea shop and snacks related settlements', 6, true, false),
  (gen_random_uuid(), 'General Expense', 'miscellaneous', 'Other general miscellaneous expenses', 7, true, false);
