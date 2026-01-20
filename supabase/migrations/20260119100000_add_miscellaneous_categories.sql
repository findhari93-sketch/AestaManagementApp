-- Migration: Add miscellaneous to expense_module enum
-- Purpose: Add 'miscellaneous' module type for simple expense tracking
-- Note: The categories are inserted in a separate migration due to PostgreSQL enum restrictions

-- Add 'miscellaneous' to the expense_module enum
ALTER TYPE public.expense_module ADD VALUE IF NOT EXISTS 'miscellaneous';
