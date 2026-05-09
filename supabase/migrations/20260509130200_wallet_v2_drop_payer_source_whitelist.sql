-- Engineer Wallet v2 — drop the hardcoded payer_source whitelist CHECK.
--
-- The payer_sources registry (per-site) is the source of truth for allowed
-- keys. Sites may have custom entries — e.g. Srinivasan has a "site_cash" key
-- that was never in the original 7-key whitelist. The DB CHECK was previously
-- duplicating registry validation and rejecting valid custom keys.
--
-- Validation now lives at the app layer: PayerSourceSelector reads the registry
-- by site and only offers keys that exist there. The deposit_payer_source_check
-- (deposits must have non-null payer_source) is unaffected and stays in place.

ALTER TABLE site_engineer_transactions
  DROP CONSTRAINT IF EXISTS site_engineer_transactions_payer_source_check;

COMMENT ON COLUMN site_engineer_transactions.payer_source IS
  'Payer source key — validated against payer_sources registry at the app layer. Required for deposits, null for spends/returns.';
