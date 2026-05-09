-- Engineer Wallet v2 — Migration A: Hard cleanup of all wallet activity
--
-- Wipes site_engineer_transactions, engineer_wallet_batch_usage, site_engineer_settlements,
-- engineer_reimbursements (CASCADE will handle the latter two, but we drop explicitly for clarity).
-- For every domain table with a FK to site_engineer_transactions or with paid_via='engineer_wallet',
-- the linkage is broken and the channel reverted to 'direct'. Settlement amounts and laborer rows
-- are PRESERVED — only the wallet attribution is wiped.
--
-- The 12 child references discovered via information_schema (verified 2026-05-09):
--   CASCADE FKs (auto-clean on parent delete):
--     engineer_reimbursements.expense_transaction_id
--     engineer_wallet_batch_usage.transaction_id
--     engineer_wallet_batch_usage.batch_transaction_id
--   SET NULL FK:
--     settlement_groups.engineer_transaction_id
--   NO ACTION FKs (must be unlinked manually before parent delete):
--     daily_attendance.engineer_transaction_id
--     market_laborer_attendance.engineer_transaction_id
--     expenses.engineer_transaction_id          -- 47 rows linked at audit time
--     labor_payments.site_engineer_transaction_id
--     misc_expenses.engineer_transaction_id
--     rental_advances.engineer_transaction_id
--     rental_settlements.engineer_transaction_id
--     subcontract_payments.site_engineer_transaction_id

BEGIN;

DO $$
DECLARE
  c_tx int; c_bu int; c_set int; c_reim int;
  c_sg int; c_da int; c_mla int; c_exp int;
  c_lp int; c_me int; c_ra int; c_rs int; c_sp int;
BEGIN
  SELECT count(*) INTO c_tx   FROM site_engineer_transactions;
  SELECT count(*) INTO c_bu   FROM engineer_wallet_batch_usage;
  SELECT count(*) INTO c_set  FROM site_engineer_settlements;
  SELECT count(*) INTO c_reim FROM engineer_reimbursements;
  SELECT count(*) INTO c_sg   FROM settlement_groups WHERE payment_channel = 'engineer_wallet';
  SELECT count(*) INTO c_da   FROM daily_attendance WHERE paid_via = 'engineer_wallet';
  SELECT count(*) INTO c_mla  FROM market_laborer_attendance WHERE paid_via = 'engineer_wallet';
  SELECT count(*) INTO c_exp  FROM expenses WHERE engineer_transaction_id IS NOT NULL;
  SELECT count(*) INTO c_lp   FROM labor_payments WHERE site_engineer_transaction_id IS NOT NULL;
  SELECT count(*) INTO c_me   FROM misc_expenses WHERE engineer_transaction_id IS NOT NULL;
  SELECT count(*) INTO c_ra   FROM rental_advances WHERE engineer_transaction_id IS NOT NULL;
  SELECT count(*) INTO c_rs   FROM rental_settlements WHERE engineer_transaction_id IS NOT NULL;
  SELECT count(*) INTO c_sp   FROM subcontract_payments WHERE site_engineer_transaction_id IS NOT NULL;
  RAISE NOTICE 'PRE-CLEANUP: tx=% batch_usage=% settlements=% reimbursements=% sg_wallet=% da_wallet=% mla_wallet=% expenses_linked=% lp_linked=% me_linked=% ra_linked=% rs_linked=% sp_linked=%',
    c_tx, c_bu, c_set, c_reim, c_sg, c_da, c_mla, c_exp, c_lp, c_me, c_ra, c_rs, c_sp;
END $$;

-- 1. settlement_groups: revert wallet channel + null FK (FK has SET NULL, but flip channel explicitly)
UPDATE settlement_groups
   SET payment_channel = 'direct',
       engineer_transaction_id = NULL
 WHERE payment_channel = 'engineer_wallet';

-- 2. daily_attendance: revert paid_via + null FK (FK is NO ACTION, so must null first)
UPDATE daily_attendance
   SET paid_via = 'direct',
       engineer_transaction_id = NULL
 WHERE paid_via = 'engineer_wallet' OR engineer_transaction_id IS NOT NULL;

-- 3. market_laborer_attendance: revert paid_via + null FK
UPDATE market_laborer_attendance
   SET paid_via = 'direct',
       engineer_transaction_id = NULL
 WHERE paid_via = 'engineer_wallet' OR engineer_transaction_id IS NOT NULL;

-- 4. expenses: null FK only (no paid_via on this table)
UPDATE expenses SET engineer_transaction_id = NULL WHERE engineer_transaction_id IS NOT NULL;

-- 5. labor_payments: null FK + revert payment_channel if applicable
UPDATE labor_payments
   SET site_engineer_transaction_id = NULL,
       payment_channel = CASE WHEN payment_channel = 'engineer_wallet' THEN 'direct' ELSE payment_channel END
 WHERE site_engineer_transaction_id IS NOT NULL OR payment_channel = 'engineer_wallet';

-- 6. misc_expenses: null FK
UPDATE misc_expenses SET engineer_transaction_id = NULL WHERE engineer_transaction_id IS NOT NULL;

-- 7. rental_advances: null FK + revert payment_channel
UPDATE rental_advances
   SET engineer_transaction_id = NULL,
       payment_channel = CASE WHEN payment_channel = 'engineer_wallet' THEN 'direct' ELSE payment_channel END
 WHERE engineer_transaction_id IS NOT NULL OR payment_channel = 'engineer_wallet';

-- 8. rental_settlements: null FK + revert payment_channel
UPDATE rental_settlements
   SET engineer_transaction_id = NULL,
       payment_channel = CASE WHEN payment_channel = 'engineer_wallet' THEN 'direct' ELSE payment_channel END
 WHERE engineer_transaction_id IS NOT NULL OR payment_channel = 'engineer_wallet';

-- 9. subcontract_payments: null FK + revert payment_channel
UPDATE subcontract_payments
   SET site_engineer_transaction_id = NULL,
       payment_channel = CASE WHEN payment_channel = 'engineer_wallet' THEN 'direct' ELSE payment_channel END
 WHERE site_engineer_transaction_id IS NOT NULL OR payment_channel = 'engineer_wallet';

-- 10. tea_shop_settlements: null FK if column exists (no payment_channel column on this table yet)
UPDATE tea_shop_settlements SET site_engineer_transaction_id = NULL WHERE site_engineer_transaction_id IS NOT NULL;

-- 11. Hard-delete the wallet rows. CASCADE on engineer_reimbursements + engineer_wallet_batch_usage
--     means those clean themselves; we DELETE explicitly for clarity and post-count verification.
DELETE FROM engineer_wallet_batch_usage;
DELETE FROM engineer_reimbursements;
DELETE FROM site_engineer_settlements;
DELETE FROM site_engineer_transactions;

-- 12. Verify
DO $$
DECLARE
  c_tx int; c_bu int; c_set int; c_reim int;
  c_sg int; c_da int; c_mla int; c_exp int;
  c_lp int; c_me int; c_ra int; c_rs int; c_sp int;
BEGIN
  SELECT count(*) INTO c_tx   FROM site_engineer_transactions;
  SELECT count(*) INTO c_bu   FROM engineer_wallet_batch_usage;
  SELECT count(*) INTO c_set  FROM site_engineer_settlements;
  SELECT count(*) INTO c_reim FROM engineer_reimbursements;
  SELECT count(*) INTO c_sg   FROM settlement_groups WHERE payment_channel = 'engineer_wallet';
  SELECT count(*) INTO c_da   FROM daily_attendance WHERE paid_via = 'engineer_wallet' OR engineer_transaction_id IS NOT NULL;
  SELECT count(*) INTO c_mla  FROM market_laborer_attendance WHERE paid_via = 'engineer_wallet' OR engineer_transaction_id IS NOT NULL;
  SELECT count(*) INTO c_exp  FROM expenses WHERE engineer_transaction_id IS NOT NULL;
  SELECT count(*) INTO c_lp   FROM labor_payments WHERE site_engineer_transaction_id IS NOT NULL OR payment_channel = 'engineer_wallet';
  SELECT count(*) INTO c_me   FROM misc_expenses WHERE engineer_transaction_id IS NOT NULL;
  SELECT count(*) INTO c_ra   FROM rental_advances WHERE engineer_transaction_id IS NOT NULL OR payment_channel = 'engineer_wallet';
  SELECT count(*) INTO c_rs   FROM rental_settlements WHERE engineer_transaction_id IS NOT NULL OR payment_channel = 'engineer_wallet';
  SELECT count(*) INTO c_sp   FROM subcontract_payments WHERE site_engineer_transaction_id IS NOT NULL OR payment_channel = 'engineer_wallet';
  RAISE NOTICE 'POST-CLEANUP: tx=% batch_usage=% settlements=% reimbursements=% sg_wallet=% da_residual=% mla_residual=% exp_residual=% lp_residual=% me_residual=% ra_residual=% rs_residual=% sp_residual=%',
    c_tx, c_bu, c_set, c_reim, c_sg, c_da, c_mla, c_exp, c_lp, c_me, c_ra, c_rs, c_sp;
  IF c_tx <> 0 OR c_bu <> 0 OR c_set <> 0 OR c_reim <> 0
     OR c_sg <> 0 OR c_da <> 0 OR c_mla <> 0 OR c_exp <> 0
     OR c_lp <> 0 OR c_me <> 0 OR c_ra <> 0 OR c_rs <> 0 OR c_sp <> 0
  THEN
    RAISE EXCEPTION 'Wallet cleanup verification failed — residual rows remain';
  END IF;
END $$;

COMMIT;
