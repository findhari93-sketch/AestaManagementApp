-- Engineer Wallet v2 — Migration C: Per-user wallet_enabled flag on company_members
--
-- Replaces the role-based wallet access model with an explicit per-user flag.
-- Today only Ajith Kumar (id 59ab8650-9436-469f-99a0-192af1e08198) is opted in.
-- Adding a future trusted user becomes a one-row UPDATE on company_members.

BEGIN;

ALTER TABLE company_members
  ADD COLUMN IF NOT EXISTS wallet_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN company_members.wallet_enabled IS
  'When true, this member can hold a wallet balance and act as a wallet payer in any settlement dialog.';

-- Backfill: opt Ajith Kumar in.
UPDATE company_members
   SET wallet_enabled = true
 WHERE user_id = '59ab8650-9436-469f-99a0-192af1e08198';

-- Partial index speeds up the "list wallet-enabled engineers" query that runs on every
-- settlement dialog open (engineer picker autocomplete).
CREATE INDEX IF NOT EXISTS idx_company_members_wallet_enabled
  ON company_members (company_id)
  WHERE wallet_enabled = true;

COMMIT;
