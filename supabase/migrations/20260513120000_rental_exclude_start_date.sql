-- supabase/migrations/20260513120000_rental_exclude_start_date.sql
ALTER TABLE rental_orders
  ADD COLUMN exclude_start_date boolean NOT NULL DEFAULT false;
