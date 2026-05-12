-- supabase/migrations/20260512120000_add_usage_date_end.sql
-- Allow recording material usage over a date range (e.g bricks used May 6–12)
alter table daily_material_usage
  add column if not exists usage_date_end date;

alter table batch_usage_records
  add column if not exists usage_date_end date;
