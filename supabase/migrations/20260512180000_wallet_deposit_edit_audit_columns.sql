-- Engineer Wallet v2: admin-edit audit trail for deposits.
-- Adds nullable audit columns so that when an office user edits a deposit row
-- the dialog can stamp who/when/why. The actual edit gate lives in the app
-- layer (role !== 'site_engineer'); RLS on this table is still legacy-permissive
-- (see rls_legacy_policies_gotcha memory entry) — tightening it is out of scope.

ALTER TABLE public.site_engineer_transactions
  ADD COLUMN IF NOT EXISTS edited_at        timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by        text,
  ADD COLUMN IF NOT EXISTS edited_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS edit_reason      text;

COMMENT ON COLUMN public.site_engineer_transactions.edited_at IS
  'Timestamp of the most recent admin edit to this row (null = never edited).';
COMMENT ON COLUMN public.site_engineer_transactions.edited_by IS
  'Display name of the user who last edited this row.';
COMMENT ON COLUMN public.site_engineer_transactions.edited_by_user_id IS
  'User id of the editor — for foreign-key style lookups in audit views.';
COMMENT ON COLUMN public.site_engineer_transactions.edit_reason IS
  'Short rationale supplied by the editor (e.g. "actual cash handed over was lower").';
